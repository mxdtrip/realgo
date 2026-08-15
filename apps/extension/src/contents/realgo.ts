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
  clearCrossPageSubmitIntent,
  getAgentLauncherPosition,
  getCrossPageSubmitIntent,
  setAgentLauncherPosition,
  setCrossPageSubmitIntent,
} from "../lib/storage";
import { adapters, detectAdapter, type PlatformAdapter, type TaskInfo } from "../platforms";
import { looksLikeSubmitLabel } from "../platforms/types";
import {
  shouldCancelWatch,
  shouldNotifySubmission,
  SubmissionResultWatcher,
  type WatchOptions,
} from "./submissionWatcher";
import {
  AgentLauncherDragController,
  isDraggableAgentPlatform,
} from "./agentLauncherDrag";

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.hackerrank.com/*",
    "https://hackerrank.com/*",
    "https://leetcode.com/*",
    "https://www.geeksforgeeks.org/*",
    "https://geeksforgeeks.org/*",
    "https://codeforces.com/*",
  ],
  run_at: "document_idle",
};

/**
 * Content script. Watches the page for a Submit, resolves the verdict and then
 * notifies the background worker, which owns the single rating popup. All DOM
 * access is defensive — it must never break the host page.
 */
// Cross-page judging (Codeforces) resumes on a freshly loaded status page, so
// there's no click-to-submit latency to subtract, but the judge itself can
// legitimately take longer than any same-page platform's in-browser run.
const CROSS_PAGE_RESULT_TIMEOUT_MS = 90_000;
const ASSISTANT_REFRESH_MS = 1_000;
const contentGlobal = globalThis as typeof globalThis & {
  __realgoContentCleanup?: () => void;
};

function init() {
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
  const assistantTimer = window.setInterval(refreshAssistant, ASSISTANT_REFRESH_MS);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  contentGlobal.__realgoContentCleanup = () => {
    document.removeEventListener("click", onDocumentClick, true);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    window.clearInterval(assistantTimer);
    submissionWatcher.stop();
    watchedTaskKey = "";
    try {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    } catch {
      /* the previous extension context may already be invalidated */
    }
    removeAssistant();
  };
  void resumeCrossPageWatch();
}

function onVisibilityChange() {
  if (!document.hidden) refreshAssistant();
}

function onPageHide() {
  submissionWatcher.stop();
  watchedTaskKey = "";
  removeAssistant();
}

function onPageShow() {
  refreshAssistant();
}

/**
 * Landing on a page after a cross-page submit navigated away from the
 * problem (see PlatformAdapter.crossPage): if a pending snapshot for a
 * matching platform is still fresh, pick up watching for a verdict here
 * instead of waiting for a click that will never come on this page.
 */
async function resumeCrossPageWatch(): Promise<void> {
  const adapter = adapters.find((a) => a.crossPage?.isResultPage(location.href));
  if (!adapter) return;
  const pending = await getCrossPageSubmitIntent(adapter.platform);
  await clearCrossPageSubmitIntent(adapter.platform);
  if (!pending) return;
  // The verdict may already be sitting in the DOM before any mutation is
  // observed (judging can finish before this page finishes loading), and
  // cross-page judging can legitimately run longer than the same-page
  // timeout — poll immediately and allow more time.
  watchForResult(adapter, pending, { timeoutMs: CROSS_PAGE_RESULT_TIMEOUT_MS, pollImmediately: true });
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
  const submitButton = adapter.findSubmitButton();
  if (!isSubmitClick(target, submitButton)) return;
  // Snapshot the task while still on the problem page: after a submit the SPA
  // can swap to the submission-history URL, where extraction would fail.
  const clickInfo = adapter.extractTaskInfo();
  watchedTaskKey = taskKey(adapter, clickInfo);

  if (adapter.crossPage) {
    handleCrossPageSubmitClick(event, adapter, submitButton, clickInfo);
    return;
  }

  watchForResult(adapter, clickInfo);
}

/**
 * A cross-page submit control is a plain navigation (e.g. Codeforces' Submit
 * is an `<a>`), which the browser starts as soon as this handler returns —
 * but persisting the snapshot is an async chrome.storage write. Without
 * intervention the navigation can win the race and unload the page before the
 * write flushes, silently losing the snapshot. preventDefault() buys the time
 * to write first, then the navigation is replayed manually.
 */
function handleCrossPageSubmitClick(
  event: MouseEvent,
  adapter: PlatformAdapter,
  submitButton: HTMLElement | null,
  clickInfo: TaskInfo | null
) {
  const href = submitButton instanceof HTMLAnchorElement ? submitButton.href : null;
  // Not a real link (or no task to snapshot): nothing to persist, let the
  // click behave exactly as the host page intended.
  if (!href || !clickInfo) return;
  event.preventDefault();
  void setCrossPageSubmitIntent(adapter.platform, clickInfo).then(() => {
    window.location.assign(href);
  });
}

function isSubmitClick(target: HTMLElement, submitButton: HTMLElement | null): boolean {
  if (submitButton && (submitButton === target || submitButton.contains(target))) {
    return true;
  }
  // Fallback: the clicked element (or its button ancestor) reads like a
  // submit control. Unbounded startsWith("submit") used to also match
  // unrelated buttons elsewhere on the page ("Submit application" on a
  // HackerRank jobs widget, "Submit feedback", etc.) — this search isn't
  // scoped to the code editor, so the text itself is the only signal.
  const button = target.closest("button, [role='button']") as HTMLElement | null;
  const text = (button?.textContent ?? "").trim().toLowerCase();
  return looksLikeSubmitLabel(text);
}

function watchForResult(
  adapter: PlatformAdapter,
  clickInfo: TaskInfo | null,
  options: WatchOptions = {}
) {
  submissionWatcher.watch(adapter, clickInfo, options);
}

let watchedTaskKey = "";
const submissionWatcher = new SubmissionResultWatcher((adapter, result, clickInfo) => {
  watchedTaskKey = "";
  finalize(adapter, result, clickInfo);
});

function taskKey(adapter: PlatformAdapter, info: TaskInfo | null): string {
  return info ? `${adapter.platform}:${info.platformTaskSlug ?? info.taskUrl}` : "";
}

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
    // twice in a page session, so this id stays stable for retries (overlay or
    // toolbar popup) and the backend treats re-sends as idempotent.
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
  if (!shouldNotifySubmission(submitResult)) return;

  void Promise.resolve(
    chrome.runtime.sendMessage({ type: "REALGO_SUBMISSION_DETECTED", submission })
  ).catch(() => {
    /* badge/pending queue remains available if the worker was restarting */
  });
}

/* -- In-page AI assistant (shadow DOM, independent from rating popup) ----- */

let assistantHost: HTMLDivElement | null = null;
let assistantRoot: Root | null = null;
let assistantKey = "";
let assistantUrl = "";
let assistantDrag: AgentLauncherDragController | null = null;

function refreshAssistant() {
  if (document.hidden) return;
  // The one-second timer remains a robust fallback for SPA navigation, but a
  // stable mounted task now avoids all adapter/DOM extraction work.
  if (location.href === assistantUrl && assistantHost?.isConnected) return;

  const task = currentAssistantTaskResponse().task ?? null;
  if (!task) {
    removeAssistant();
    return;
  }

  const key = `${task.platform}:${task.platformTaskSlug}:${task.taskUrl}`;
  if (shouldCancelWatch(watchedTaskKey, `${task.platform}:${task.platformTaskSlug}`)) {
    submissionWatcher.stop();
    watchedTaskKey = "";
  }
  if (key === assistantKey && assistantHost?.isConnected) {
    assistantUrl = location.href;
    return;
  }

  removeAssistant();
  assistantKey = key;
  assistantUrl = location.href;
  assistantHost = document.createElement("div");
  assistantHost.id = "realgo-assistant-host";
  assistantHost.style.cssText =
    "all: initial; position: fixed; right: 16px; bottom: 18px; z-index: 2147483646; color-scheme: dark; background: transparent; width: max-content; height: max-content; pointer-events: none;";
  const shadow = assistantHost.attachShadow({ mode: "open" });
  const mount = document.createElement("div");
  mount.className = "realgo-assistant-root";
  mount.style.cssText = "all: initial; display: block; background: transparent; width: max-content; height: max-content; pointer-events: none;";
  shadow.appendChild(mount);
  document.body.appendChild(assistantHost);

  assistantRoot = createRoot(mount);
  assistantRoot.render(
    createElement(AssistantApp, {
      task,
      onAsk: streamAssistantHintViaBackground,
      draggableLauncher: isDraggableAgentPlatform(task.platform),
    })
  );
  if (isDraggableAgentPlatform(task.platform)) {
    assistantDrag = new AgentLauncherDragController({
      host: assistantHost,
      platform: task.platform,
      load: getAgentLauncherPosition,
      save: setAgentLauncherPosition,
    });
  }
}

function currentAssistantTaskResponse(): CurrentTaskResponse {
  const adapter = detectAdapter(location.href);
  const info = adapter?.extractTaskInfo() ?? null;
  const task = adapter && info ? assistantTaskFrom(adapter, info) : null;
  return task ? { ok: true, task } : { ok: false };
}

function removeAssistant() {
  assistantDrag?.destroy();
  assistantDrag = null;
  assistantRoot?.unmount();
  assistantHost?.remove();
  assistantRoot = null;
  assistantHost = null;
  assistantKey = "";
  assistantUrl = "";
}

function assistantTaskFrom(adapter: PlatformAdapter, info: TaskInfo): AssistantTask | null {
  if (!isAssistantPlatform(adapter.platform)) return null;
  const slug = info.platformTaskSlug?.trim();
  if (!slug) return null;
  return {
    platform: adapter.platform,
    taskTitle: info.taskTitle,
    taskUrl: info.taskUrl,
    platformTaskSlug: slug,
    tags: info.tags,
    difficulty: info.difficulty,
    taskDescription: info.taskDescription,
  };
}

function isAssistantPlatform(platform: PlatformAdapter["platform"]): platform is AssistantTask["platform"] {
  return (
    platform === "leetcode" ||
    platform === "hackerrank" ||
    platform === "geeksforgeeks" ||
    platform === "codeforces"
  );
}

init();
