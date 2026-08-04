import { useEffect, useMemo } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import { AssistantApp } from "@realgo-extension/assistant/AssistantApp";
import { ASSISTANT_STATE_KEY_PREFIX } from "@realgo-extension/lib/types";
import type {
  AssistantHintPayload, AssistantHintResult, AssistantPersistedState,
  AssistantTask, DetectedSubmission, ExtensionEventResult,
  ProblemCardsResult, SubmissionPayload,
} from "@realgo-extension/lib/types";
import { PopupApp } from "@realgo-extension/popup/PopupApp";

type DemoMode = "extension-intro" | "extension" | "agent" | "stages" | "rating";
const CAMERA_APPROACH_MS = 3800;
const FIRST_SHOT_HOLD_MS = 1800;
const CAMERA_SETTLED_MS = FIRST_SHOT_HOLD_MS + CAMERA_APPROACH_MS;
const COPY_REVEAL_DELAY_MS = CAMERA_SETTLED_MS + 120;
const EXTENSION_SCREEN_DELAY_MS = COPY_REVEAL_DELAY_MS + 900;
const PRODUCT_FOCUS_DELAY_MS = EXTENSION_SCREEN_DELAY_MS + 620;
const HEIGHT_TRANSITION_MS = 1300;
const RATING_SELECTION_HOLD_MS = 3000;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration));
const storage = new Map<string, unknown>();
const storageListeners = new Set<(changes: Record<string, unknown>, area: string) => void>();

// Production AssistantApp expects chrome.storage. This in-memory implementation
// preserves its real persistence contract while keeping the keynote deterministic.
const chromeApi = (window as typeof window & { chrome?: Record<string, unknown> }).chrome ?? {};
chromeApi.storage = {
  local: {
    async get(key: string | null) {
      if (key === null) return Object.fromEntries(storage);
      return { [key]: storage.get(key) };
    },
    async set(values: Record<string, unknown>) {
      const changes: Record<string, unknown> = {};
      Object.entries(values).forEach(([key, value]) => {
        changes[key] = { oldValue: storage.get(key), newValue: value };
        storage.set(key, value);
      });
      storageListeners.forEach((listener) => listener(changes, "local"));
    },
    async remove(keys: string | string[]) {
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => storage.delete(key));
    },
  },
  onChanged: {
    addListener(listener: (changes: Record<string, unknown>, area: string) => void) { storageListeners.add(listener); },
    removeListener(listener: (changes: Record<string, unknown>, area: string) => void) { storageListeners.delete(listener); },
  },
};
if (!(window as typeof window & { chrome?: Record<string, unknown> }).chrome) {
  (window as typeof window & { chrome?: Record<string, unknown> }).chrome = chromeApi;
}

const task: AssistantTask = {
  platform: "leetcode",
  taskTitle: "Longest Substring Without Repeating Characters",
  taskUrl: "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
  platformTaskSlug: "longest-substring-without-repeating-characters",
  difficulty: "Medium",
  tags: ["Hash Table", "String", "Sliding Window"],
  taskDescription: "Find the length of the longest substring without repeating characters.",
};
const taskKey = `${task.platform}:${task.platformTaskSlug}:${task.taskUrl}`;
const assistantStorageKey = ASSISTANT_STATE_KEY_PREFIX + taskKey;
const submission: DetectedSubmission = {
  eventId: "deck-demo-longest-substring", platform: "leetcode", taskTitle: task.taskTitle,
  taskUrl: task.taskUrl, platformTaskSlug: task.platformTaskSlug,
  tags: ["sliding window", "hash table"], difficulty: "medium",
  submitResult: "accepted", submittedAt: "2026-07-30T12:00:00.000Z",
};
const hints: AssistantHintResult[] = [
  {
    hint: "Не пересчитывай каждую подстроку заново. Двигай левую границу только тогда, когда очередной символ уже есть в текущем окне.",
    question: "Какую информацию о последней позиции символа нужно хранить?", stage: "nudge", problemKnown: true,
    patterns: [{ code: "variable_sliding_window", name: "Variable Sliding Window" }],
  },
  {
    hint: "Держи окно [left, right] без повторяющихся символов и словарь последних позиций. При повторе переноси left сразу за прошлое вхождение.",
    question: "Почему max защищает уже найденное окно?", stage: "approach", problemKnown: true,
    patterns: [{ code: "variable_sliding_window", name: "Variable Sliding Window" }],
  },
  {
    hint: "На каждом right обновляй left через max(left, last[c] + 1), затем last[c] = right и сравнивай ответ с right - left + 1.",
    question: "Какой инвариант выполняется перед обновлением максимальной длины?", stage: "reveal", problemKnown: true,
    patterns: [{ code: "variable_sliding_window", name: "Variable Sliding Window" }],
  },
];

function storedStagesState(): AssistantPersistedState {
  return {
    messages: [
      { role: "user", content: "Дай мягкий намёк, без решения." }, { role: "assistant", content: hints[0].hint },
      { role: "user", content: "Можно конкретнее — всё ещё без полного решения." }, { role: "assistant", content: hints[1].hint },
      { role: "user", content: "Покажи последний уровень разбора." }, { role: "assistant", content: hints[2].hint },
    ],
    hintLevel: 3, hintsUsed: 3, cooldownEndAt: null, patterns: hints[2].patterns,
    problemKnown: true, patternUsed: false, savedAt: Date.now(),
  };
}

function storedFirstHintState(): AssistantPersistedState {
  return {
    messages: [
      { role: "user", content: "Дай мягкий намёк, без решения." },
      { role: "assistant", content: hints[0].hint },
    ],
    hintLevel: 1, hintsUsed: 1, cooldownEndAt: null, patterns: hints[0].patterns,
    problemKnown: true, patternUsed: false, savedAt: Date.now(),
  };
}

function ProductDemo({ mode, ratingSelectionDelayMs = 0 }: { mode: DemoMode; ratingSelectionDelayMs?: number }) {
  useEffect(() => {
    if (mode !== "rating") return undefined;
    const timer = window.setTimeout(() => {
      currentCard?.querySelector<HTMLButtonElement>('.realgo-choice[data-difficulty="normal"]')?.click();
    }, reduceMotion ? 0 : ratingSelectionDelayMs);
    return () => window.clearTimeout(timer);
  }, [mode, ratingSelectionDelayMs]);

  const fetchCards = useMemo(() => {
    let ticks = 0;
    return async (): Promise<ProblemCardsResult> => {
      await wait(180); ticks += 1;
      return ticks < 2 ? { status: "generating", cardsCount: 0 } : { status: "ready", cardsCount: 3 };
    };
  }, []);
  async function saveSubmission(_payload: SubmissionPayload): Promise<ExtensionEventResult> {
    // Keep the selected "Средне" state readable in the keynote before the
    // production component advances to its success screen.
    await wait(mode === "rating" ? 3200 : 620);
    return { accepted: true, duplicate: false, problemId: 42, status: "recorded", nextReviewAt: null };
  }
  async function askAssistant(payload: AssistantHintPayload, onDelta: (text: string) => void): Promise<AssistantHintResult> {
    const result = hints[Math.max(0, Math.min(hints.length - 1, payload.hintLevel - 1))];
    const words = result.hint.split(" "); await wait(260);
    for (let index = 0; index < words.length; index += 3) {
      onDelta(words.slice(index, index + 3).join(" ") + (index + 3 < words.length ? " " : ""));
      await wait(82);
    }
    // Let the final streamed chunk reach the screen before starting the
    // deliberate two-second reading pause on the laptop code editor.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    window.dispatchEvent(new CustomEvent("realgo:hintready", { detail: { slide: currentSlide } }));
    return result;
  }
  if (mode === "rating") {
    return <PopupApp key={mode} submission={submission} onSave={saveSubmission} onFetchCards={fetchCards} onClose={() => undefined} onReview={() => undefined} />;
  }
  return <AssistantApp key={mode} task={task} onAsk={askAssistant} variant="panel" />;
}

let currentRoot: Root | null = null;
let currentSlide: HTMLElement | null = null;
let currentMode: DemoMode | null = null;
let currentCard: HTMLElement | null = null;
let currentLayer: HTMLElement | null = null;
let timers: number[] = [];
let pendingReadyHandler: (() => void) | null = null;

function clearTimeline() {
  timers.forEach((timer) => window.clearTimeout(timer)); timers = [];
  if (pendingReadyHandler) {
    window.removeEventListener("realgo:macbookready", pendingReadyHandler);
    pendingReadyHandler = null;
  }
}

function clearDemo() {
  clearTimeline();
  currentSlide?.classList.remove("is-product-mounted", "is-product-screen", "is-product-focus", "is-camera-settled");
  if (currentSlide) delete currentSlide.dataset.productTimelineStarted;
  currentRoot?.unmount(); currentRoot = null;
  currentCard?.remove(); currentCard = null;
  currentLayer?.remove(); currentLayer = null;
  currentSlide = null;
  currentMode = null;
}

function activateDemo(event?: Event) {
  const slide = document.querySelector<HTMLElement>(".slide.is-active.slide-macbook");
  if (!slide) { clearDemo(); return; }
  const eventDetail = (event as CustomEvent<{ logicalSlide?: HTMLElement }> | undefined)?.detail;
  const logicalSlide = eventDetail?.logicalSlide instanceof HTMLElement ? eventDetail.logicalSlide : null;
  const requestedMode = logicalSlide?.querySelector<HTMLElement>(".macbook-3d-slot")?.dataset.macbookMode
    ?? document.getElementById("stage")?.dataset.productMode
    ?? slide.querySelector<HTMLElement>(".macbook-3d-slot")?.dataset.macbookMode
    ?? "extension";
  const mode = requestedMode as DemoMode;
  if (slide === currentSlide && mode === currentMode) return;
  clearTimeline();
  const continuesProductSequence = Boolean(currentSlide && currentCard && currentLayer && currentRoot);
  const reusesCurrentSlide = slide === currentSlide;
  const previousMode = currentMode ?? undefined;
  const previousHeight = currentCard?.offsetHeight ?? null;
  const ratingSelectionDelayMs = mode === "rating"
    ? (continuesProductSequence ? HEIGHT_TRANSITION_MS : CAMERA_APPROACH_MS + 120) + RATING_SELECTION_HOLD_MS
    : 0;
  currentSlide?.classList.remove("is-product-screen", "is-product-focus");
  if (!reusesCurrentSlide) currentSlide?.classList.remove("is-product-mounted", "is-camera-settled");
  if (currentSlide) delete currentSlide.dataset.productTimelineStarted;

  if (mode === "stages") {
    storage.set(assistantStorageKey, storedStagesState());
  } else if (mode === "agent" && !continuesProductSequence) {
    storage.set(assistantStorageKey, storedFirstHintState());
  } else if (mode === "extension-intro" || mode === "extension") {
    storage.delete(assistantStorageKey);
  }

  if (!continuesProductSequence) {
    currentLayer = document.createElement("div");
    currentLayer.setAttribute("aria-label", "Интерактивная демонстрация интерфейса расширения ReAlgo");
    currentLayer.innerHTML = '<div class="product-focus-dim" aria-hidden="true"></div><div class="product-ui-card"><div class="product-ui-glint" aria-hidden="true"></div><div class="product-ui-root"></div></div>';
    currentCard = currentLayer.querySelector<HTMLElement>(".product-ui-card")!;
    currentRoot = createRoot(currentLayer.querySelector(".product-ui-root")!);
  }

  const layer = currentLayer!;
  const card = currentCard!;
  layer.className = `product-ui-stage product-ui-stage--${mode}`;
  card.dataset.productUiMode = mode;
  slide.appendChild(layer);
  currentSlide = slide;
  currentMode = mode;

  if (continuesProductSequence && previousHeight) {
    // Freeze the old shell before React is allowed to commit the next, possibly
    // shorter tree. Without this ordering the 10 -> 11 update could collapse
    // to its target before CSS had painted the 520px starting state.
    card.classList.add("is-height-transitioning");
    card.style.height = `${previousHeight}px`;
    void card.offsetHeight;
    flushSync(() => currentRoot!.render(<ProductDemo mode={mode} ratingSelectionDelayMs={ratingSelectionDelayMs} />));
    // Both production surfaces use authored, deterministic shell heights.
    // Keep this target independent from the temporary 100%-height override
    // that makes the visible popup frame follow the animated outer shell.
    const targetHeight = mode === "rating" ? 420 : 520;

    requestAnimationFrame(() => {
      if (card !== currentCard) return;
      if (!targetHeight) {
        card.classList.remove("is-height-transitioning");
        card.style.removeProperty("height");
        return;
      }
      requestAnimationFrame(() => {
        if (card !== currentCard) return;
        card.style.height = `${targetHeight}px`;
        timers.push(window.setTimeout(() => {
          if (card !== currentCard) return;
          card.classList.remove("is-height-transitioning");
          card.style.removeProperty("height");
        }, HEIGHT_TRANSITION_MS + 40));
      });
    });
  } else {
    currentRoot!.render(<ProductDemo mode={mode} ratingSelectionDelayMs={ratingSelectionDelayMs} />);
  }
  slide.classList.add("is-product-mounted");

  // Slide 10 owns the hint request. Schedule it independently from the camera
  // timeline: the shared physical slide can retain timeline flags from the
  // preceding logical beat, but that must never suppress the actual request.
  if (mode === "agent") {
    const hintDelay = continuesProductSequence || reduceMotion ? 980 : CAMERA_APPROACH_MS + 1100;
    timers.push(window.setTimeout(() => {
      if (mode !== currentMode || card !== currentCard) return;
      card.querySelector<HTMLButtonElement>(".realgo-agent-btn--hint")?.click();
    }, hintDelay));
  }

  // Keep the exact DOM node and CSS3D object attached to the display for every
  // adjacent product slide. Only React state and intrinsic height change.
  if (continuesProductSequence) {
    slide.classList.add("is-camera-settled");
    if (mode !== "extension-intro" && !(mode === "extension" && previousMode === "extension-intro")) {
      slide.classList.add("is-product-focus");
      slide.classList.add("is-product-screen");
      window.dispatchEvent(new CustomEvent("realgo:productfocus", {
        detail: { slide, immediate: true },
      }));
    }
  }

  function startTimeline() {
    if (slide !== currentSlide || slide.dataset.productTimelineStarted === "true") return;
    slide.dataset.productTimelineStarted = "true";
    if (mode === "extension-intro") {
      if (reduceMotion) slide.classList.add("is-camera-settled");
      else timers.push(window.setTimeout(() => slide.classList.add("is-camera-settled"), COPY_REVEAL_DELAY_MS));
    } else if (mode === "extension" && continuesProductSequence && previousMode === "extension-intro") {
      const revealPanel = () => {
        slide.classList.add("is-product-screen");
        timers.push(window.setTimeout(() => {
          slide.classList.add("is-product-focus");
          window.dispatchEvent(new CustomEvent("realgo:productfocus", { detail: { slide, immediate: reduceMotion } }));
        }, reduceMotion ? 0 : 620));
      };
      if (reduceMotion) revealPanel();
      else timers.push(window.setTimeout(revealPanel, 180));
    } else if (mode === "extension") {
      if (reduceMotion) {
        slide.classList.add("is-camera-settled", "is-product-screen", "is-product-focus");
        window.dispatchEvent(new CustomEvent("realgo:productfocus", { detail: { slide, immediate: true } }));
        return;
      }
      timers.push(window.setTimeout(() => slide.classList.add("is-camera-settled"), COPY_REVEAL_DELAY_MS));
      timers.push(window.setTimeout(() => slide.classList.add("is-product-screen"), EXTENSION_SCREEN_DELAY_MS));
      timers.push(window.setTimeout(() => {
        slide.classList.add("is-product-focus");
        window.dispatchEvent(new CustomEvent("realgo:productfocus", { detail: { slide } }));
      }, PRODUCT_FOCUS_DELAY_MS));
    } else if (!continuesProductSequence) {
      const revealProduct = () => {
        slide.classList.add("is-camera-settled", "is-product-screen", "is-product-focus");
        window.dispatchEvent(new CustomEvent("realgo:productfocus", { detail: { slide, immediate: reduceMotion } }));
      };
      if (reduceMotion) revealProduct();
      else timers.push(window.setTimeout(revealProduct, CAMERA_APPROACH_MS + 120));
    }
  }

  if (document.getElementById("stage")?.classList.contains("has-macbook-3d")) {
    requestAnimationFrame(startTimeline);
  } else {
    pendingReadyHandler = () => {
      pendingReadyHandler = null;
      requestAnimationFrame(startTimeline);
    };
    window.addEventListener("realgo:macbookready", pendingReadyHandler, { once: true });
  }
}

window.addEventListener("realgo:slidechange", activateDemo);
window.addEventListener("DOMContentLoaded", activateDemo, { once: true });
if (document.readyState !== "loading") activateDemo();
