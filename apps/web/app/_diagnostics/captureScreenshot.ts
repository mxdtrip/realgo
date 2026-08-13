"use client";

import type { ReportScreenshot } from "./reportDiagnostics";

const MAX_WIDTH = 1_440;
const MAX_HEIGHT = 900;
const JPEG_QUALITY = 0.72;
const MAX_BYTES = 800 * 1024;

type CaptureNavigator = Navigator & {
  mediaDevices?: MediaDevices & {
    getDisplayMedia?: (constraints?: DisplayMediaStreamOptions) => Promise<MediaStream>;
  };
};

export function supportsScreenshotCapture(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator as CaptureNavigator).mediaDevices?.getDisplayMedia === "function";
}

export async function captureScreenshot(): Promise<ReportScreenshot> {
  const getDisplayMedia = (navigator as CaptureNavigator).mediaDevices?.getDisplayMedia;
  if (!getDisplayMedia) throw new Error("screen_capture_unsupported");

  const stream = await getDisplayMedia.call(navigator.mediaDevices, {
    video: true,
    audio: false,
  });
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  document.documentElement.classList.add("is-report-capturing");

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("screen_capture_timeout")), 10_000);
      video.addEventListener("loadedmetadata", () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
      video.addEventListener("error", () => {
        window.clearTimeout(timer);
        reject(new Error("screen_capture_failed"));
      }, { once: true });
      void video.play().catch(reject);
    });

    const scale = Math.min(1, MAX_WIDTH / video.videoWidth, MAX_HEIGHT / video.videoHeight);
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("screen_capture_failed");
    context.drawImage(video, 0, 0, width, height);

    let quality = JPEG_QUALITY;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (estimatedDataURLBytes(dataUrl) > MAX_BYTES && quality > 0.4) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (estimatedDataURLBytes(dataUrl) > MAX_BYTES) throw new Error("screen_capture_too_large");
    return { dataUrl, width, height };
  } finally {
    document.documentElement.classList.remove("is-report-capturing");
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }
}

function estimatedDataURLBytes(dataUrl: string): number {
  const encoded = dataUrl.split(",")[1] ?? "";
  return Math.ceil(encoded.length * 0.75);
}
