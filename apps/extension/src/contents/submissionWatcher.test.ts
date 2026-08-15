// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.geeksforgeeks.org/problems/prerequisite-tasks/1" }
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { geeksforgeeksAdapter } from "../platforms/geeksforgeeks";
import { hackerrankAdapter } from "../platforms/hackerrank";
import {
  shouldCancelWatch,
  shouldNotifySubmission,
  SubmissionResultWatcher,
} from "./submissionWatcher";

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => vi.useRealTimers());

async function advance(ms = 1_000) {
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(ms);
}

function solvedResult() {
  return `<div class="problem_solved_successfully__hash">
    Problem Solved Successfully
    Test Cases Passed: 1115 / 1115
  </div>`;
}

describe("submission result watcher", () => {
  it("does not accept a successful result that predates Submit", async () => {
    document.body.innerHTML = solvedResult();
    const onResult = vi.fn();
    const watcher = new SubmissionResultWatcher(onResult);
    watcher.watch(geeksforgeeksAdapter, null);

    document.body.append(document.createElement("aside"));
    await advance(2_000);

    expect(onResult).not.toHaveBeenCalled();
    watcher.stop();
  });

  it("recognises a new accepted cycle once and ignores later mutations", async () => {
    document.body.innerHTML = solvedResult();
    const onResult = vi.fn();
    const watcher = new SubmissionResultWatcher(onResult);
    expect(watcher.watch(geeksforgeeksAdapter, null)).toBe(true);
    expect(watcher.watch(geeksforgeeksAdapter, null)).toBe(false);

    document.body.innerHTML =
      `<div class="compilation_result__hash">Compilation Results: Judging…</div>`;
    await advance();
    document.body.innerHTML = solvedResult();
    await advance();
    document.body.append(document.createElement("div"));
    await advance();

    expect(onResult).toHaveBeenCalledOnce();
    expect(onResult.mock.calls[0][1]).toBe("accepted");
  });

  it("accepts a structurally new result even when its fingerprint is identical", async () => {
    document.body.innerHTML = solvedResult();
    const onResult = vi.fn();
    const watcher = new SubmissionResultWatcher(onResult);
    watcher.watch(geeksforgeeksAdapter, null);

    document.body.innerHTML = solvedResult();
    await advance(1_500);

    expect(onResult).toHaveBeenCalledOnce();
    expect(onResult.mock.calls[0][1]).toBe("accepted");
  });

  it("reports a failed result without producing an accepted notification", async () => {
    const onResult = vi.fn();
    const watcher = new SubmissionResultWatcher(onResult);
    watcher.watch(geeksforgeeksAdapter, null);
    document.body.innerHTML =
      `<div class="compilation_result__hash">Wrong Answer</div>`;
    await advance(1_500);

    expect(onResult).toHaveBeenCalledOnce();
    expect(onResult.mock.calls[0][1]).toBe("wrong_answer");
  });

  it("disconnects its observer and timer on cleanup", async () => {
    const onResult = vi.fn();
    const watcher = new SubmissionResultWatcher(onResult);
    watcher.watch(geeksforgeeksAdapter, null);
    watcher.stop();
    document.body.innerHTML = solvedResult();
    await advance(2_000);

    expect(onResult).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps HackerRank watching beyond the default timeout", async () => {
    const onResult = vi.fn();
    const watcher = new SubmissionResultWatcher(onResult);
    watcher.watch(hackerrankAdapter, null);
    document.body.append(document.createElement("aside"));

    await advance(21_000);
    expect(onResult).not.toHaveBeenCalled();
    await advance(40_000);
    expect(onResult.mock.calls[0][1]).toBe("unknown");
  });

  it("recognises an identical replacement HackerRank result only once", async () => {
    const result = `<section role="status"><h2>Congratulations</h2><p>You solved this challenge</p></section>`;
    document.body.innerHTML = result;
    const onResult = vi.fn();
    const watcher = new SubmissionResultWatcher(onResult);
    watcher.watch(hackerrankAdapter, null);

    document.body.innerHTML = result;
    await advance(1_500);
    document.body.append(document.createElement("div"));
    await advance();

    expect(onResult).toHaveBeenCalledOnce();
    expect(onResult.mock.calls[0][1]).toBe("accepted");
  });

  it("does not accept an unchanged HackerRank success left from an older submit", async () => {
    document.body.innerHTML =
      `<section role="status"><h2>Congratulations</h2><p>You solved this challenge</p></section>`;
    const onResult = vi.fn();
    const watcher = new SubmissionResultWatcher(onResult);
    watcher.watch(hackerrankAdapter, null);

    document.body.append(document.createElement("aside"));
    await advance(2_000);

    expect(onResult).not.toHaveBeenCalled();
    watcher.stop();
  });

  it("cancels an old watch when SPA navigation changes the task key", () => {
    expect(
      shouldCancelWatch("hackerrank:a-very-big-sum", "hackerrank:solve-me-first")
    ).toBe(true);
    expect(
      shouldCancelWatch("hackerrank:a-very-big-sum", "hackerrank:a-very-big-sum")
    ).toBe(false);
  });

  it("opens rating UI only for an accepted result", () => {
    expect(shouldNotifySubmission("accepted")).toBe(true);
    expect(shouldNotifySubmission("wrong_answer")).toBe(false);
    expect(shouldNotifySubmission("runtime_error")).toBe(false);
    expect(shouldNotifySubmission("unknown")).toBe(false);
  });
});
