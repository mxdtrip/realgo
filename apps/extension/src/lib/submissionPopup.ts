export interface SubmissionPopupDependencies {
  openActionPopup: () => Promise<void>;
  createPopupWindow: (url: string) => Promise<{ id?: number }>;
  focusWindow: (windowId: number) => Promise<unknown>;
  popupUrl: string;
}

/**
 * Opens the toolbar action when permitted and otherwise reuses one dedicated
 * extension popup window. The in-flight guard also coalesces concurrent opens.
 */
export function createSubmissionPopupController(deps: SubmissionPopupDependencies) {
  let popupWindowId: number | undefined;
  let inFlight: Promise<void> | null = null;

  async function open(): Promise<void> {
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
      return;
    } catch {
      const popup = await deps.createPopupWindow(deps.popupUrl);
      popupWindowId = popup.id;
    }
  }

  function handleWindowRemoved(windowId: number): void {
    if (windowId === popupWindowId) popupWindowId = undefined;
  }

  return { open, handleWindowRemoved };
}
