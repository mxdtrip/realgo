import type { SubmitResult } from "../lib/types";
import type { PlatformAdapter, TaskInfo } from "../platforms";

const RESULT_POLL_MS = 500;
const DEFAULT_RESULT_TIMEOUT_MS = 20_000;

/** One cancellable verdict observer per content-script instance. */
export class SubmissionResultWatcher {
  private cleanup: (() => void) | null = null;

  constructor(
    private readonly onResult: (
      adapter: PlatformAdapter,
      result: SubmitResult,
      clickInfo: TaskInfo | null
    ) => void
  ) {}

  watch(adapter: PlatformAdapter, clickInfo: TaskInfo | null): boolean {
    if (this.cleanup) return false;

    const startedAt = Date.now();
    const timeoutMs = adapter.resultTimeoutMs ?? DEFAULT_RESULT_TIMEOUT_MS;
    const initialFingerprint = adapter.submissionResultFingerprint?.() ?? null;
    let resultUiChanged = initialFingerprint === null;
    let sawMutation = false;
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
        resultUiChanged = true;
      }
      if (Date.now() - startedAt < 800) return;
      if (!resultUiChanged || (initialFingerprint !== null && !fingerprint)) {
        if (Date.now() - startedAt > timeoutMs) finish("unknown");
        return;
      }
      const result = adapter.detectSubmitResult();
      if (result !== "unknown") finish(result);
      else if (Date.now() - startedAt > timeoutMs) finish("unknown");
    };

    const observer = new MutationObserver(() => {
      sawMutation = true;
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
