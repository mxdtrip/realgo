import type { SubmitResult } from "../lib/types";
import type { PlatformAdapter, TaskInfo } from "../platforms";

const RESULT_POLL_MS = 500;
const DEFAULT_TIMEOUT_MS = 20_000;

export interface WatchOptions {
  timeoutMs?: number;
  pollImmediately?: boolean;
}

export function shouldCancelWatch(watchedTaskKey: string, currentTaskKey: string): boolean {
  return Boolean(watchedTaskKey && currentTaskKey && watchedTaskKey !== currentTaskKey);
}

export function shouldNotifySubmission(result: SubmitResult): boolean {
  return result === "accepted";
}

/** Owns exactly one cancellable result observer for a content-script instance. */
export class SubmissionResultWatcher {
  private cleanup: (() => void) | null = null;

  constructor(
    private readonly onResult: (
      adapter: PlatformAdapter,
      result: SubmitResult,
      clickInfo: TaskInfo | null
    ) => void
  ) {}

  watch(
    adapter: PlatformAdapter,
    clickInfo: TaskInfo | null,
    options: WatchOptions = {}
  ): boolean {
    if (this.cleanup) return false;

    const timeoutMs = options.timeoutMs ?? adapter.resultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startedAt = Date.now();
    const initialFingerprint = adapter.submissionResultFingerprint?.() ?? null;
    let fingerprintChanged = initialFingerprint === null;
    let sawMutation = options.pollImmediately ?? false;
    let lastSeen: SubmitResult | null = null;
    let timer = 0;
    let stopped = false;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      observer.disconnect();
      if (this.cleanup === stop) this.cleanup = null;
    };
    const finish = (result: SubmitResult) => {
      stop();
      this.onResult(adapter, result, clickInfo);
    };
    const check = () => {
      if (!sawMutation) {
        if (Date.now() - startedAt > timeoutMs) finish("unknown");
        return;
      }
      const fingerprint = adapter.submissionResultFingerprint?.() ?? null;
      if (initialFingerprint !== null && fingerprint !== initialFingerprint) {
        fingerprintChanged = true;
      }
      if (Date.now() - startedAt < 800) return;
      if (!fingerprintChanged || (initialFingerprint !== null && !fingerprint)) {
        if (Date.now() - startedAt > timeoutMs) finish("unknown");
        return;
      }

      const result = adapter.detectSubmitResult();
      if (result !== "unknown" && result === lastSeen) {
        finish(result);
        return;
      }
      lastSeen = result;
      if (Date.now() - startedAt > timeoutMs) finish(result);
    };

    const observer = new MutationObserver((records) => {
      sawMutation = true;
      if (
        initialFingerprint !== null &&
        adapter.didSubmissionResultMutate?.(records)
      ) {
        fingerprintChanged = true;
      }
      check();
    });
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    });
    timer = window.setInterval(check, RESULT_POLL_MS);
    this.cleanup = stop;
    return true;
  }

  stop(): void {
    this.cleanup?.();
  }
}
