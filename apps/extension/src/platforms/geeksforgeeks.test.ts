// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.geeksforgeeks.org/problems/prerequisite-tasks/1" }
import { beforeEach, describe, expect, it } from "vitest";

import { geeksforgeeksAdapter } from "./geeksforgeeks";

beforeEach(() => {
  document.head.innerHTML = "<title>Prerequisite Tasks | Practice | GeeksforGeeks</title>";
  document.body.innerHTML = "<h2>Prerequisite Tasks</h2>";
});

describe("GeeksForGeeks adapter", () => {
  it("recognises the current successful compilation result", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<section class="CompilationResults_content_pane__abc">
        <div class="problem_solved_successfully__abc">
          <h3>Problem Solved Successfully</h3>
          <span>Test Cases Passed: 1115 / 1115</span>
        </div>
      </section>`
    );

    expect(geeksforgeeksAdapter.detectSubmitResult()).toBe("accepted");
    expect(geeksforgeeksAdapter.submissionResultFingerprint?.()).toContain(
      "Problem Solved Successfully"
    );
  });

  it("accepts a complete test count but not a partial one", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="compilation_result__abc">Test Cases Passed: 1115 / 1115</div>`
    );
    expect(geeksforgeeksAdapter.detectSubmitResult()).toBe("accepted");

    document.body.innerHTML =
      `<div class="compilation_result__abc">Test Cases Passed: 1114 / 1115</div>`;
    expect(geeksforgeeksAdapter.detectSubmitResult()).toBe("unknown");
  });

  it("classifies failed compilation results without accepting them", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="compilation_result__abc">Wrong Answer</div>`
    );
    expect(geeksforgeeksAdapter.detectSubmitResult()).toBe("wrong_answer");
  });
});
