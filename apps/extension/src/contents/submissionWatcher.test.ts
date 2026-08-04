// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.hackerrank.com/challenges/test/problem" }
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hackerrankAdapter } from "../platforms/hackerrank";
import { SubmissionResultWatcher } from "./submissionWatcher";

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => vi.useRealTimers());

async function flushMutations() {
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(1_000);
}

describe("submission result watcher", () => {
  it("emits one accepted result despite repeated DOM mutations", async () => {
    const onResult = vi.fn();
    const watcher = new SubmissionResultWatcher(onResult);
    expect(watcher.watch(hackerrankAdapter, null)).toBe(true);
    expect(watcher.watch(hackerrankAdapter, null)).toBe(false);

    document.body.innerHTML = `<h2>Congratulations</h2><p>You solved this challenge</p>`;
    await flushMutations();
    document.body.append(document.createElement("div"));
    await flushMutations();

    expect(onResult).toHaveBeenCalledOnce();
    expect(onResult.mock.calls[0][1]).toBe("accepted");
  });

  it("reports a failed submission without accepting it", async () => {
    const onResult = vi.fn();
    const watcher = new SubmissionResultWatcher(onResult);
    watcher.watch(hackerrankAdapter, null);
    document.body.innerHTML = `<div class="submission-result">Wrong Answer</div>`;
    await flushMutations();

    expect(onResult.mock.calls[0][1]).toBe("wrong_answer");
  });

  it("disconnects cleanly before later result mutations", async () => {
    const onResult = vi.fn();
    const watcher = new SubmissionResultWatcher(onResult);
    watcher.watch(hackerrankAdapter, null);
    watcher.stop();
    document.body.innerHTML = `<h2>Congratulations</h2>`;
    await flushMutations();

    expect(onResult).not.toHaveBeenCalled();
  });
});
