import { describe, expect, it, vi } from "vitest";

import { createSubmissionPopupController } from "./submissionPopup";

describe("submission popup controller", () => {
  it("opens only one fallback window for several fast messages", async () => {
    const createPopupWindow = vi.fn().mockResolvedValue({ id: 42 });
    const controller = createSubmissionPopupController({
      openActionPopup: vi.fn().mockRejectedValue(new Error("gesture expired")),
      createPopupWindow,
      focusWindow: vi.fn().mockResolvedValue(undefined),
      popupUrl: "chrome-extension://id/popup.html",
    });

    await Promise.all([controller.open(), controller.open(), controller.open()]);
    await controller.open();

    expect(createPopupWindow).toHaveBeenCalledOnce();
  });

  it("uses the toolbar popup without creating a fallback when allowed", async () => {
    const createPopupWindow = vi.fn();
    const controller = createSubmissionPopupController({
      openActionPopup: vi.fn().mockResolvedValue(undefined),
      createPopupWindow,
      focusWindow: vi.fn(),
      popupUrl: "chrome-extension://id/popup.html",
    });

    await controller.open();
    expect(createPopupWindow).not.toHaveBeenCalled();
  });
});
