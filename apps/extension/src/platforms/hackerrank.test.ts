// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.hackerrank.com/challenges/a-very-big-sum/problem?isFullScreen=true" }
import { beforeEach, describe, expect, it } from "vitest";

import { hackerrankAdapter } from "./hackerrank";

beforeEach(() => {
  document.head.innerHTML = "<title>A Very Big Sum | HackerRank</title>";
  document.body.innerHTML = "";
  window.history.replaceState(
    {},
    "",
    "/challenges/a-very-big-sum/problem?isFullScreen=true"
  );
});

describe("HackerRank adapter", () => {
  it("recognises challenge problem URLs in regular and fullscreen modes", () => {
    expect(hackerrankAdapter.matches(location.href)).toBe(true);
    expect(
      hackerrankAdapter.matches(
        "https://www.hackerrank.com/challenges/a-very-big-sum/problem"
      )
    ).toBe(true);
    expect(
      hackerrankAdapter.matches(
        "https://www.hackerrank.com/challenges/a-very-big-sum/submissions"
      )
    ).toBe(false);
  });

  it("extracts a canonical task URL without fullscreen navigation state", () => {
    expect(hackerrankAdapter.extractTaskInfo()).toMatchObject({
      taskTitle: "A Very Big Sum",
      taskUrl: "https://www.hackerrank.com/challenges/a-very-big-sum/problem",
      platformTaskSlug: "a-very-big-sum",
    });
  });

  it("selects Submit Code rather than other editor actions", () => {
    document.body.innerHTML = `
      <button>Upload Code as File</button>
      <button>Run Code</button>
      <button>Submit Code</button>
    `;
    expect(hackerrankAdapter.findSubmitButton()?.textContent).toBe("Submit Code");
  });

  it("does not treat Run Code as Submit", () => {
    document.body.innerHTML = `<button>Run Code</button>`;
    expect(hackerrankAdapter.findSubmitButton()).toBeNull();
  });

  it("recognises the current accepted result wording", () => {
    document.body.innerHTML = `
      <section class="submission-result">
        Accepted. Congratulations, your code passed all the test cases!
      </section>
    `;
    expect(hackerrankAdapter.detectSubmitResult()).toBe("accepted");
    expect(hackerrankAdapter.submissionResultFingerprint?.()).toContain(
      "passed all the test cases"
    );
  });

  it("does not accept a failed submission", () => {
    document.body.innerHTML = `<div class="submission-result">Wrong Answer</div>`;
    expect(hackerrankAdapter.detectSubmitResult()).toBe("wrong_answer");
  });

  it("recognises compilation errors but not compiler success alone", () => {
    document.body.innerHTML = `<div class="compiler-message">Compilation Error</div>`;
    expect(hackerrankAdapter.detectSubmitResult()).toBe("runtime_error");

    document.body.innerHTML = `<div class="compiler-message">Compiler Message: Success</div>`;
    expect(hackerrankAdapter.detectSubmitResult()).toBe("unknown");
  });

  it("refreshes task metadata after SPA navigation", () => {
    document.title = "Solve Me First | HackerRank";
    window.history.pushState({}, "", "/challenges/solve-me-first/problem");
    expect(hackerrankAdapter.extractTaskInfo()).toMatchObject({
      taskTitle: "Solve Me First",
      platformTaskSlug: "solve-me-first",
      taskUrl: "https://www.hackerrank.com/challenges/solve-me-first/problem",
    });
  });
});
