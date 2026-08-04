import { describe, expect, it, vi } from "vitest";

import { createSubmissionPopupController } from "./submissionPopup";

describe("submission popup controller", () => {
  it("uses the toolbar popup when the browser allows it", async () => {
    const openActionPopup = vi.fn().mockResolvedValue(undefined);
    const createPopupWindow = vi.fn();
    const controller = createSubmissionPopupController({
      openActionPopup,
      createPopupWindow,
      focusWindow: vi.fn(),
      popupUrl: "chrome-extension://id/popup.html",
    });

    await controller.open();
    expect(openActionPopup).toHaveBeenCalledOnce();
    expect(createPopupWindow).not.toHaveBeenCalled();
  });

  it("falls back to one extension window outside the user-gesture window", async () => {
    const createPopupWindow = vi.fn().mockResolvedValue({ id: 42 });
    const controller = createSubmissionPopupController({
      openActionPopup: vi.fn().mockRejectedValue(new Error("gesture required")),
      createPopupWindow,
      focusWindow: vi.fn().mockResolvedValue(undefined),
      popupUrl: "chrome-extension://id/popup.html",
    });

    await Promise.all([controller.open(), controller.open()]);
    await controller.open();
    expect(createPopupWindow).toHaveBeenCalledOnce();
  });

  it("allows a new popup after the previous window is closed", async () => {
    const createPopupWindow = vi
      .fn()
      .mockResolvedValueOnce({ id: 42 })
      .mockResolvedValueOnce({ id: 43 });
    const controller = createSubmissionPopupController({
      openActionPopup: vi.fn().mockRejectedValue(new Error("gesture required")),
      createPopupWindow,
      focusWindow: vi.fn(),
      popupUrl: "chrome-extension://id/popup.html",
    });

    await controller.open();
    controller.handleWindowRemoved(42);
    await controller.open();
    expect(createPopupWindow).toHaveBeenCalledTimes(2);
  });
});
