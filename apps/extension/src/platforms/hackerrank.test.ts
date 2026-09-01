// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.hackerrank.com/challenges/a-very-big-sum/problem" }
import { beforeEach, describe, expect, it } from "vitest";

import { hackerrankAdapter } from "./hackerrank";

beforeEach(() => {
  document.head.innerHTML = "<title>A Very Big Sum | HackerRank</title>";
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/challenges/a-very-big-sum/problem");
});

describe("HackerRank adapter", () => {
  it("recognises problem URLs and extracts canonical task metadata", () => {
    expect(hackerrankAdapter.matches(location.href)).toBe(true);
    expect(hackerrankAdapter.extractTaskInfo()).toMatchObject({
      taskTitle: "A Very Big Sum",
      taskUrl: "https://www.hackerrank.com/challenges/a-very-big-sum/problem",
      platformTaskSlug: "a-very-big-sum",
    });
  });

  it("selects Submit Code and never treats Run Code as submit", () => {
    document.body.innerHTML = `<button>Run Code</button><button>Submit Code</button>`;
    expect(hackerrankAdapter.findSubmitButton()?.textContent).toBe("Submit Code");

    document.body.innerHTML = `<button>Run Code</button>`;
    expect(hackerrankAdapter.findSubmitButton()).toBeNull();
  });

  it("recognises current accepted wording", () => {
    document.body.innerHTML = `
      <section role="status">
        <h2>Congratulations</h2>
        <p>You solved this challenge. Your code passed all the test cases.</p>
      </section>`;
    expect(hackerrankAdapter.detectSubmitResult()).toBe("accepted");
  });

  it("does not accept a wrong answer", () => {
    document.body.innerHTML = `<div class="submission-result">Wrong Answer</div>`;
    expect(hackerrankAdapter.detectSubmitResult()).toBe("wrong_answer");
  });
});
