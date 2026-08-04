// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  assistantHostPosition,
  buildAssistantTask,
  findHackerRankRunButton,
  mountHackerRankLauncher,
} from "./assistantTask";

describe("assistant task integration", () => {
  it("builds the shared Agent payload for GeeksForGeeks metadata", () => {
    expect(
      buildAssistantTask("geeksforgeeks", {
        taskTitle: "Prerequisite Tasks",
        taskUrl: "https://www.geeksforgeeks.org/problems/prerequisite-tasks/1",
        platformTaskSlug: "prerequisite-tasks",
        difficulty: "medium",
        tags: ["graph"],
        taskDescription: "Determine whether all tasks can finish.",
      })
    ).toEqual({
      platform: "geeksforgeeks",
      taskTitle: "Prerequisite Tasks",
      taskUrl: "https://www.geeksforgeeks.org/problems/prerequisite-tasks/1",
      platformTaskSlug: "prerequisite-tasks",
      difficulty: "medium",
      tags: ["graph"],
      taskDescription: "Determine whether all tasks can finish.",
    });
  });

  it("positions the GFG launcher above editor actions without changing LeetCode", () => {
    expect(assistantHostPosition("geeksforgeeks")).toContain("bottom: 88px");
    expect(assistantHostPosition("leetcode")).toContain("bottom: 18px");
  });

  it("mounts one HackerRank launcher before the primary button group", () => {
    document.body.innerHTML = `
      <div id="actions">
        <div><button>Upload Code as File</button><label>Custom Input</label></div>
        <div id="primary"><button>Run Code</button><button>Submit Code</button></div>
      </div>`;
    const host = document.createElement("div");
    host.id = "realgo-assistant-host";

    expect(mountHackerRankLauncher(host)).toBe(true);
    expect(mountHackerRankLauncher(host)).toBe(true);
    expect(document.querySelector("#primary")?.previousElementSibling).toBe(host);
    expect(document.querySelectorAll("#realgo-assistant-host")).toHaveLength(1);
  });

  it("moves the existing launcher when HackerRank replaces its action row", () => {
    const host = document.createElement("div");
    document.body.innerHTML = `<section><div><button>Run Code</button><button>Submit Code</button></div></section>`;
    mountHackerRankLauncher(host);
    document.body.innerHTML = `<section id="replacement"><div><button>Run Code</button><button>Submit Code</button></div></section>`;

    expect(mountHackerRankLauncher(host)).toBe(true);
    expect(host.parentElement?.id).toBe("replacement");
    expect(document.querySelectorAll("button")).toHaveLength(2);
  });

  it("uses a flat action row when there is no primary wrapper", () => {
    document.body.innerHTML = `
      <div id="flat-actions">
        <button>Upload Code as File</button>
        <button>Run Code</button>
        <button>Submit Code</button>
      </div>`;
    const host = document.createElement("div");

    expect(mountHackerRankLauncher(host)).toBe(true);
    expect(findHackerRankRunButton()?.previousElementSibling).toBe(host);
  });
});
