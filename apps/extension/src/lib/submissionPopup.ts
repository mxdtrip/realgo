export interface SubmissionPopupDependencies {
  openActionPopup: () => Promise<void>;
  createPopupWindow: (url: string) => Promise<{ id?: number }>;
  focusWindow: (windowId: number) => Promise<unknown>;
  popupUrl: string;
}

/** One toolbar popup, or one extension-window fallback when Chrome rejects
    action.openPopup after the asynchronous judge result. */
export function createSubmissionPopupController(deps: SubmissionPopupDependencies) {
  let popupWindowId: number | undefined;
  let inFlight: Promise<void> | null = null;

  function open(): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = openOnce().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function openOnce(): Promise<void> {
    if (popupWindowId !== undefined) {
      try {
        await deps.focusWindow(popupWindowId);
        return;
      } catch {
        popupWindowId = undefined;
      }
    }
    try {
      await deps.openActionPopup();
    } catch {
      const popup = await deps.createPopupWindow(deps.popupUrl);
      popupWindowId = popup.id;
    }
  }

  function handleWindowRemoved(windowId: number) {
    if (windowId === popupWindowId) popupWindowId = undefined;
  }

  return { open, handleWindowRemoved };
}
