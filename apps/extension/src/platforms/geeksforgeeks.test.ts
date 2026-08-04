// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.geeksforgeeks.org/problems/prerequisite-tasks/1" }
import { beforeEach, describe, expect, it } from "vitest";

import { detectAdapter } from "./index";
import { geeksforgeeksAdapter } from "./geeksforgeeks";

beforeEach(() => {
  document.head.innerHTML = "<title>Prerequisite Tasks | Practice | GeeksforGeeks</title>";
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/problems/prerequisite-tasks/1?itm_source=practice");
});

describe("GeeksForGeeks adapter", () => {
  it("recognises practice problem URLs but not articles", () => {
    expect(
      geeksforgeeksAdapter.matches(
        "https://www.geeksforgeeks.org/problems/prerequisite-tasks/1"
      )
    ).toBe(true);
    expect(geeksforgeeksAdapter.matches("https://www.geeksforgeeks.org/graph-data-structure/"))
      .toBe(false);
  });

  it("is registered without changing existing platform detection", () => {
    expect(detectAdapter(location.href)?.platform).toBe("geeksforgeeks");
    expect(detectAdapter("https://leetcode.com/problems/two-sum/")?.platform).toBe("leetcode");
    expect(
      detectAdapter("https://www.hackerrank.com/challenges/solve-me-first/problem")?.platform
    ).toBe("hackerrank");
  });

  it("extracts canonical task metadata", () => {
    document.body.innerHTML = `
      <div class="problems_header_description__abc">Difficulty: Medium</div>
      <div class="problems_problem_content__abc">Determine whether all tasks can finish.</div>
      <a href="/tag/graph/">Graph</a>
    `;

    expect(geeksforgeeksAdapter.extractTaskInfo()).toEqual({
      taskTitle: "Prerequisite Tasks",
      taskUrl: "https://www.geeksforgeeks.org/problems/prerequisite-tasks/1",
      platformTaskSlug: "prerequisite-tasks",
      tags: ["graph"],
      difficulty: "medium",
      taskDescription: "Determine whether all tasks can finish.",
    });
  });

  it("finds the submit control and accepted verdict", () => {
    document.body.innerHTML = `
      <button class="problems_submit_button__6QoNQ">Submit</button>
      <div class="problems_problem_solved_successfully__Zb4yG">
        <h3>Problem Solved Successfully</h3>
      </div>
    `;

    expect(geeksforgeeksAdapter.findSubmitButton()?.textContent).toBe("Submit");
    expect(geeksforgeeksAdapter.detectSubmitResult()).toBe("accepted");
  });
});
