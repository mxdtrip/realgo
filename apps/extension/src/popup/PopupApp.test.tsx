// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DetectedSubmission } from "../lib/types";
import { PopupApp } from "./PopupApp";

const submission: DetectedSubmission = {
  eventId: "event-1",
  platform: "leetcode",
  taskTitle: "Two Sum",
  taskUrl: "https://leetcode.com/problems/two-sum/",
  platformTaskSlug: "two-sum",
  tags: [],
  difficulty: "easy",
  submitResult: "accepted",
  submittedAt: "2026-08-04T00:00:00.000Z",
};

describe("PopupApp review button", () => {
  it("delegates review navigation to the configured host handler", async () => {
    const onReview = vi.fn();
    render(<PopupApp submission={submission} onSave={async () => null} onReview={onReview} />);

    fireEvent.click(screen.getByRole("button", { name: "Легко" }));
    await waitFor(() => expect(screen.getByText("Запланировано")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "К повторению" }));

    expect(onReview).toHaveBeenCalledOnce();
  });
});
