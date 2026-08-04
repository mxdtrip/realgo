import type { PlasmoCSConfig } from "plasmo";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import type {
  AssistantTask,
  CurrentTaskResponse,
  DetectedSubmission,
  RuntimeMessage,
  SubmitResult,
} from "../lib/types";
import { AssistantApp } from "../assistant/AssistantApp";
import { streamAssistantHintViaBackground } from "../lib/assistantClient";
import {
  assistantHostPosition,
  buildAssistantTask,
  mountHackerRankLauncher,
} from "../platforms/assistantTask";
import { detectAdapter, type PlatformAdapter, type TaskInfo } from "../platforms";
import { SubmissionResultWatcher } from "./submissionWatcher";

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.hackerrank.com/*",
    "https://hackerrank.com/*",
    "https://leetcode.com/*",
    "https://geeksforgeeks.org/*",
    "https://*.geeksforgeeks.org/*",
  ],
  run_at: "document_idle",
};

/**
 * Content script. Watches the page for a Submit, resolves the verdict and then
 * notifies the background worker, which owns the single submit notification in
 * the toolbar popup. All DOM access is defensive — it must never break the host
 * page.
 */
const contentGlobal = globalThis as typeof globalThis & {
  __realgoContentCleanup?: () => void;
};

function init() {
  // Plasmo HMR and extension reloads may inject a fresh module into an existing
  // tab. Tear down the previous instance before registering delegated hooks.
  contentGlobal.__realgoContentCleanup?.();
  // The manifest already scopes this script to supported hosts, so the listener
  // is attached unconditionally and the adapter is resolved per click. Resolving
  // it once at load broke SPA flows: landing on a list page (e.g. /practice)
  // yields no adapter, and the client-side hop to /problems/<slug> never
  // re-runs init — the extension stayed inert until a hard reload.
  // Capture-phase delegation survives the SPA re-rendering its buttons.
  document.addEventListener("click", onDocumentClick, true);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  refreshAssistant();
  const assistantObserver = new MutationObserver(scheduleAssistantRefresh);
  assistantObserver.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("popstate", scheduleAssistantRefresh);
  document.addEventListener("visibilitychange", onVisibilityChange);
  contentGlobal.__realgoContentCleanup = () => {
    document.removeEventListener("click", onDocumentClick, true);
    window.removeEventListener("popstate", scheduleAssistantRefresh);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    assistantObserver.disconnect();
    if (assistantRefreshFrame) window.cancelAnimationFrame(assistantRefreshFrame);
    assistantRefreshFrame = 0;
    submissionWatcher.stop();
    try {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    } catch {
      /* the old extension context may already be invalidated */
    }
    removeAssistant();
  };
}

function onVisibilityChange() {
  if (!document.hidden) scheduleAssistantRefresh();
}

function onRuntimeMessage(
  message: RuntimeMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: CurrentTaskResponse) => void
) {
  if (message.type !== "REALGO_GET_CURRENT_TASK") return false;
  sendResponse(currentAssistantTaskResponse());
  return false;
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const adapter = detectAdapter(location.href);
  if (!adapter) return;
  if (!isSubmitClick(target, adapter)) return;
  // Snapshot the task while still on the problem page: after a submit the SPA
  // can swap to the submission-history URL, where extraction would fail.
  submissionWatcher.watch(adapter, adapter.extractTaskInfo());
}

function isSubmitClick(target: HTMLElement, adapter: PlatformAdapter): boolean {
  const submitButton = adapter.findSubmitButton();
  if (submitButton) return submitButton === target || submitButton.contains(target);
  // Fallback: the clicked element (or its button ancestor) reads "submit".
  const button = target.closest("button, [role='button']") as HTMLElement | null;
  const text = (button?.textContent ?? "").trim().toLowerCase();
  return text === "submit" || text.startsWith("submit");
}

const submissionWatcher = new SubmissionResultWatcher(finalize);

let lastKey = "";
let lastKeyAt = 0;
/** Duplicate notifications of one submit land within this window. */
const DEDUPE_WINDOW_MS = 3_000;

/** Stable idempotency id for one submit. Falls back when randomUUID is absent. */
function newEventId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through to the manual id below */
  }
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function finalize(
  adapter: PlatformAdapter,
  submitResult: SubmitResult,
  clickInfo: TaskInfo | null
) {
  // Prefer the click-time snapshot; by verdict time the SPA may already sit on
  // a URL (submission history) the adapter cannot extract a task from.
  const info = clickInfo ?? adapter.extractTaskInfo();
  if (!info) return;

  const submission: DetectedSubmission = {
    // One id per detected submit. The dedupe below stops the same task firing
    // twice in a page session, so this id stays stable for popup retries and the
    // backend treats re-sends as idempotent.
    eventId: newEventId(),
    platform: adapter.platform,
    taskTitle: info.taskTitle,
    taskUrl: info.taskUrl,
    platformTaskSlug: info.platformTaskSlug,
    tags: info.tags,
    difficulty: info.difficulty,
    submitResult,
    submittedAt: new Date().toISOString(),
  };

  // Dedupe duplicate click/mutation notifications, not genuine later submits:
  // the window is short and the key includes the verdict, so a fail → fix →
  // resubmit sequence of one task still fires each time.
  const key = `${submission.platformTaskSlug}|${submission.taskUrl}|${submitResult}`;
  const now = Date.now();
  if (key === lastKey && now - lastKeyAt < DEDUPE_WINDOW_MS) return;
  lastKey = key;
  lastKeyAt = now;

  // The popup is a spaced-repetition rating flow and must only appear after a
  // confirmed accepted verdict. Wrong answers, runtime errors and verdict
  // timeouts are not solved tasks and must never create review schedules.
  if (submitResult !== "accepted") return;

  try {
    void Promise.resolve(
      chrome.runtime.sendMessage({ type: "REALGO_SUBMISSION_DETECTED", submission })
    ).catch(() => {
      /* the extension may have been reloaded while this tab stayed open */
    });
  } catch {
    /* background may be restarting; a later submit can retry */
  }
}

/* -- In-page AI assistant (shadow DOM, independent from submit popup) ------- */

let assistantHost: HTMLDivElement | null = null;
let assistantRoot: Root | null = null;
let assistantKey = "";
let observedTaskKey = "";
let assistantRefreshFrame = 0;

function scheduleAssistantRefresh() {
  if (assistantRefreshFrame) return;
  assistantRefreshFrame = window.requestAnimationFrame(() => {
    assistantRefreshFrame = 0;
    refreshAssistant();
  });
}

function refreshAssistant() {
  if (document.hidden) return;

  const task = currentAssistantTaskResponse().task ?? null;
  if (!task) {
    removeAssistant();
    return;
  }

  const key = `${task.platform}:${task.platformTaskSlug}:${task.taskUrl}`;
  if (key === assistantKey && assistantHost?.isConnected) {
    placeAssistantHost(task.platform);
    return;
  }

  if (observedTaskKey && key !== observedTaskKey) {
    submissionWatcher.stop();
    lastKey = "";
    lastKeyAt = 0;
  }
  observedTaskKey = key;
  removeAssistant();
  document.querySelectorAll("#realgo-assistant-host").forEach((host) => host.remove());
  assistantKey = key;
  assistantHost = document.createElement("div");
  assistantHost.id = "realgo-assistant-host";
  assistantHost.dataset.realgoPlatform = task.platform;
  assistantHost.style.cssText =
    `all: initial; position: fixed; ${assistantHostPosition(task.platform)} z-index: 2147483646; color-scheme: dark; background: transparent; width: max-content; height: max-content; pointer-events: none;`;
  const shadow = assistantHost.attachShadow({ mode: "open" });
  const mount = document.createElement("div");
  mount.className = "realgo-assistant-root";
  mount.style.cssText = "all: initial; display: block; background: transparent; width: max-content; height: max-content; pointer-events: none;";
  shadow.appendChild(mount);
  document.body.appendChild(assistantHost);
  placeAssistantHost(task.platform);

  assistantRoot = createRoot(mount);
  assistantRoot.render(
    createElement(AssistantApp, {
      task,
      onAsk: streamAssistantHintViaBackground,
    })
  );
}

function placeAssistantHost(platform: AssistantTask["platform"]) {
  if (!assistantHost || platform !== "hackerrank") return;
  const inline = mountHackerRankLauncher(assistantHost);
  assistantHost.toggleAttribute("data-realgo-inline", inline);
  if (inline) {
    assistantHost.style.cssText =
      "all: initial; display: block; position: relative; flex: 0 0 auto; align-self: center; justify-self: end; grid-row: 1 / -1; margin-left: auto; margin-right: 8px; z-index: 2147483646; color-scheme: dark; background: transparent; width: max-content; height: max-content; pointer-events: none;";
    return;
  }
  if (assistantHost.parentElement !== document.body) document.body.appendChild(assistantHost);
  assistantHost.style.cssText =
    `all: initial; position: fixed; ${assistantHostPosition(platform)} z-index: 2147483646; color-scheme: dark; background: transparent; width: max-content; height: max-content; pointer-events: none;`;
}

function currentAssistantTaskResponse(): CurrentTaskResponse {
  const adapter = detectAdapter(location.href);
  const info = adapter?.extractTaskInfo() ?? null;
  const task = adapter && info ? assistantTaskFrom(adapter, info) : null;
  return task ? { ok: true, task } : { ok: false };
}

function removeAssistant() {
  assistantRoot?.unmount();
  assistantHost?.remove();
  assistantRoot = null;
  assistantHost = null;
  assistantKey = "";
}

function assistantTaskFrom(adapter: PlatformAdapter, info: TaskInfo): AssistantTask | null {
  return buildAssistantTask(adapter.platform, info);
}

init();
