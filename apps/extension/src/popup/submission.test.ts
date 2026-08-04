import { describe, expect, it } from "vitest";

import type { AssistantTask, DetectedSubmission } from "../lib/types";
import { RECENT_SUBMISSION_WINDOW_MS, selectPendingSubmission } from "./submission";

const submittedAt = Date.parse("2026-08-04T10:00:00.000Z");
const submission: DetectedSubmission = {
  eventId: "event-1",
  platform: "leetcode",
  taskTitle: "Two Sum",
  taskUrl: "https://leetcode.com/problems/two-sum/",
  platformTaskSlug: "two-sum",
  tags: [],
  submitResult: "accepted",
  submittedAt: new Date(submittedAt).toISOString(),
};

describe("selectPendingSubmission", () => {
  it("keeps a fresh submit when SPA extraction is temporarily unavailable", () => {
    expect(selectPendingSubmission(submission, null, undefined, submittedAt + 1_000)).toBe(
      submission
    );
  });

  it("keeps a pending submit on its submission route", () => {
    expect(
      selectPendingSubmission(
        submission,
        null,
        "https://leetcode.com/problems/two-sum/submissions/123/",
        submittedAt + RECENT_SUBMISSION_WINDOW_MS + 1
      )
    ).toBe(submission);
  });

  it("rejects a stale submit on an unrelated page", () => {
    expect(
      selectPendingSubmission(
        submission,
        null,
        "https://leetcode.com/problemset/",
        submittedAt + RECENT_SUBMISSION_WINDOW_MS + 1
      )
    ).toBeNull();
  });

  it("accepts an exact task match", () => {
    const task = {
      platform: "leetcode",
      platformTaskSlug: "two-sum",
    } as AssistantTask;
    expect(selectPendingSubmission(submission, task, undefined, submittedAt + 120_000)).toBe(
      submission
    );
  });

  it("keeps a GeeksForGeeks submit on its problem route", () => {
    const gfgSubmission: DetectedSubmission = {
      ...submission,
      platform: "geeksforgeeks",
      taskTitle: "Prerequisite Tasks",
      taskUrl: "https://www.geeksforgeeks.org/problems/prerequisite-tasks/1",
      platformTaskSlug: "prerequisite-tasks",
    };
    expect(
      selectPendingSubmission(
        gfgSubmission,
        null,
        "https://www.geeksforgeeks.org/problems/prerequisite-tasks/1",
        submittedAt + RECENT_SUBMISSION_WINDOW_MS + 1
      )
    ).toBe(gfgSubmission);
  });
});
