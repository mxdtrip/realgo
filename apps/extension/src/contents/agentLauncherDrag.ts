import type {
  AgentLauncherPosition,
  DraggableAgentPlatform,
} from "../lib/types";

export const DRAG_THRESHOLD_PX = 6;
export const VIEWPORT_MARGIN_PX = 10;
export const DEFAULT_LAUNCHER_MARGIN_PX = 18;

export interface FloatingSize { width: number; height: number }
export interface FloatingViewport { width: number; height: number }
export type PanelDirection = "up" | "down";
export type PanelAlignment = "left" | "right";

export interface PanelPlacement extends AgentLauncherPosition {
  direction: PanelDirection;
  alignment: PanelAlignment;
  maxHeight: number;
}

export function isDraggableAgentPlatform(platform: string): platform is DraggableAgentPlatform {
  return platform === "leetcode" || platform === "hackerrank" || platform === "geeksforgeeks";
}

export function clampLauncherPosition(
  position: AgentLauncherPosition,
  size: FloatingSize,
  viewport: FloatingViewport,
  margin = VIEWPORT_MARGIN_PX
): AgentLauncherPosition {
  const maxX = Math.max(margin, viewport.width - size.width - margin);
  const maxY = Math.max(margin, viewport.height - size.height - margin);
  return {
    x: Math.min(maxX, Math.max(margin, position.x)),
    y: Math.min(maxY, Math.max(margin, position.y)),
  };
}

export function getDefaultLauncherPosition(
  viewport: FloatingViewport,
  launcher: FloatingSize,
  safeMargin = DEFAULT_LAUNCHER_MARGIN_PX
): AgentLauncherPosition {
  return clampLauncherPosition(
    {
      x: safeMargin,
      y: viewport.height - launcher.height - safeMargin,
    },
    launcher,
    viewport
  );
}

/** Positions a panel next to the launcher's persisted top-left anchor. */
export function calculatePanelPlacement(
  anchor: AgentLauncherPosition,
  launcher: FloatingSize,
  panel: FloatingSize,
  viewport: FloatingViewport,
  margin = VIEWPORT_MARGIN_PX
): PanelPlacement {
  const safePanelHeight = Math.min(panel.height, Math.max(0, viewport.height - margin * 2));
  const spaceBelow = Math.max(0, viewport.height - margin - (anchor.y + launcher.height));
  const spaceAbove = Math.max(0, anchor.y - margin);
  const direction: PanelDirection = panel.height <= spaceBelow
    ? "down"
    : panel.height <= spaceAbove
      ? "up"
      : spaceBelow >= spaceAbove ? "down" : "up";
  const availableHeight = direction === "down" ? spaceBelow : spaceAbove;
  const maxHeight = Math.min(safePanelHeight, availableHeight);

  // Keep the panel growing toward the viewport interior: launchers on the
  // right align the panel's right edge, launchers on the left align its left.
  // This also makes the anchor invertible after dragging an open panel.
  const alignment: PanelAlignment = anchor.x + launcher.width / 2 > viewport.width / 2
    ? "right"
    : "left";
  const rawX = alignment === "left" ? anchor.x : anchor.x + launcher.width - panel.width;
  const rawY = direction === "down"
    ? anchor.y + launcher.height
    : anchor.y - Math.min(panel.height, maxHeight);
  const clamped = clampLauncherPosition(
    { x: rawX, y: rawY },
    { width: Math.min(panel.width, viewport.width - margin * 2), height: Math.min(panel.height, maxHeight) },
    viewport,
    margin
  );
  return { ...clamped, direction, alignment, maxHeight };
}

export interface AgentLauncherDragOptions {
  host: HTMLElement;
  platform: DraggableAgentPlatform;
  load: (platform: DraggableAgentPlatform) => Promise<AgentLauncherPosition | undefined>;
  save: (platform: DraggableAgentPlatform, position: AgentLauncherPosition) => Promise<void>;
}

type DragKind = "launcher" | "panel";

export class AgentLauncherDragController {
  private pointerId: number | null = null;
  private startPointer = { x: 0, y: 0 };
  private startPosition = { x: 0, y: 0 };
  private pendingPosition: AgentLauncherPosition | null = null;
  private anchorPosition: AgentLauncherPosition | null = null;
  private launcherSize: FloatingSize = { width: 150, height: 44 };
  private panelNaturalSize: FloatingSize = { width: 400, height: 520 };
  private placement: PanelPlacement | null = null;
  private dragElement: HTMLElement | null = null;
  private dragKind: DragKind | null = null;
  private dragging = false;
  private suppressNextClick = false;
  private frame = 0;
  private mountFrame = 0;
  private destroyed = false;
  private initialized = false;
  private observedPanel: HTMLElement | null = null;
  private readonly mutationObserver: MutationObserver;
  private readonly resizeObserver: ResizeObserver | null;

  constructor(private readonly options: AgentLauncherDragOptions) {
    // Firefox can paint between React's asynchronous commit and the first
    // usable layout measurement. Keep the empty/intermediate host invisible
    // until restore() has measured a non-zero launcher and applied final x/y.
    options.host.style.visibility = "hidden";
    options.host.addEventListener("pointerdown", this.onPointerDown);
    options.host.addEventListener("pointermove", this.onPointerMove);
    options.host.addEventListener("pointerup", this.onPointerUp);
    options.host.addEventListener("pointercancel", this.onPointerCancel);
    options.host.addEventListener("click", this.onClick, true);
    window.addEventListener("resize", this.onResize);
    this.mutationObserver = new MutationObserver(() => this.onWidgetChanged());
    this.mutationObserver.observe(options.host.shadowRoot ?? options.host, {
      childList: true,
      subtree: true,
    });
    this.resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => this.scheduleLayout());
    void this.restore();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const { host } = this.options;
    host.removeEventListener("pointerdown", this.onPointerDown);
    host.removeEventListener("pointermove", this.onPointerMove);
    host.removeEventListener("pointerup", this.onPointerUp);
    host.removeEventListener("pointercancel", this.onPointerCancel);
    host.removeEventListener("click", this.onClick, true);
    window.removeEventListener("resize", this.onResize);
    this.mutationObserver.disconnect();
    this.resizeObserver?.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
    if (this.mountFrame) cancelAnimationFrame(this.mountFrame);
    this.releasePointer();
    this.resetDragStyles();
  }

  private query(selector: string): HTMLElement | null {
    return this.options.host.shadowRoot?.querySelector<HTMLElement>(selector) ?? null;
  }

  private pathElement(event: Event, selector: string): HTMLElement | null {
    return event.composedPath().find(
      (item): item is HTMLElement => item instanceof HTMLElement && item.matches(selector)
    ) ?? null;
  }

  private dragTarget(event: Event): { kind: DragKind; element: HTMLElement } | null {
    const launcher = this.pathElement(event, ".realgo-agent-button");
    if (launcher) return { kind: "launcher", element: launcher };
    const header = this.pathElement(event, ".realgo-agent-header");
    if (!header) return null;
    const path = event.composedPath();
    const headerIndex = path.indexOf(header);
    const interactive = path.slice(0, headerIndex).some(
      (item) => item instanceof HTMLElement && item.matches(
        "button, a, input, textarea, select, [role='button'], [contenteditable='true']"
      )
    );
    return interactive ? null : { kind: "panel", element: header };
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || this.pointerId !== null) return;
    const target = this.dragTarget(event);
    if (!target) return;
    const floating = target.kind === "panel" ? this.query(".realgo-agent-panel") : target.element;
    if (!floating) return;
    const rect = floating.getBoundingClientRect();
    if (target.kind === "launcher") {
      this.launcherSize = rectSize(rect, this.launcherSize);
      this.anchorPosition = { x: rect.left, y: rect.top };
    }
    this.dragElement = target.element;
    this.dragKind = target.kind;
    this.pointerId = event.pointerId;
    this.startPointer = { x: event.clientX, y: event.clientY };
    this.startPosition = { x: rect.left, y: rect.top };
    this.pendingPosition = null;
    this.dragging = false;
    try {
      target.element.setPointerCapture?.(event.pointerId);
    } catch {
      /* The SPA may replace the handle during pointerdown. */
    }
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId || !this.dragKind) return;
    const dx = event.clientX - this.startPointer.x;
    const dy = event.clientY - this.startPointer.y;
    if (!this.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    this.dragging = true;
    event.preventDefault();
    if (this.dragElement) this.dragElement.style.cursor = "grabbing";
    const panel = this.query(".realgo-agent-panel");
    if (panel) panel.style.userSelect = "none";
    const size = this.dragKind === "panel"
      ? rectSize(panel?.getBoundingClientRect(), this.panelNaturalSize)
      : this.launcherSize;
    this.pendingPosition = clampLauncherPosition(
      { x: this.startPosition.x + dx, y: this.startPosition.y + dy },
      size,
      viewport()
    );
    this.scheduleApplyDrag();
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    if (event.pointerId === this.pointerId) this.finishDrag(true);
  };

  private readonly onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId === this.pointerId) this.finishDrag(false);
  };

  private readonly onClick = (event: MouseEvent) => {
    const target = this.dragTarget(event);
    if (!target) return;
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (target.kind === "launcher") {
      const rect = target.element.getBoundingClientRect();
      this.launcherSize = rectSize(rect, this.launcherSize);
      this.anchorPosition = { x: rect.left, y: rect.top };
    }
  };

  private readonly onResize = () => this.scheduleLayout();

  private onWidgetChanged() {
    if (this.destroyed || !this.initialized) return;
    const launcher = this.query(".realgo-agent-button");
    const panel = this.query(".realgo-agent-panel");
    if (launcher) {
      const rect = launcher.getBoundingClientRect();
      this.launcherSize = rectSize(rect, this.launcherSize);
      this.placement = null;
      this.observePanel(null);
      if (this.anchorPosition) this.applyHost(this.normalizeAnchor(this.anchorPosition));
    }
    if (panel) {
      const measured = rectSize(panel.getBoundingClientRect(), this.panelNaturalSize);
      this.panelNaturalSize = {
        width: Math.max(this.panelNaturalSize.width, measured.width),
        height: Math.max(this.panelNaturalSize.height, measured.height),
      };
      this.observePanel(panel);
      this.scheduleLayout();
    }
  }

  private observePanel(panel: HTMLElement | null) {
    if (panel === this.observedPanel) return;
    this.resizeObserver?.disconnect();
    this.observedPanel = panel;
    if (panel) this.resizeObserver?.observe(panel);
  }

  private scheduleLayout() {
    if (this.destroyed || !this.initialized || this.dragging || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.layoutCurrentWidget();
    });
  }

  private layoutCurrentWidget() {
    const launcher = this.query(".realgo-agent-button");
    if (launcher) {
      const rect = launcher.getBoundingClientRect();
      this.launcherSize = rectSize(rect, this.launcherSize);
      if (!this.anchorPosition) this.anchorPosition = { x: rect.left, y: rect.top };
      const previous = this.anchorPosition;
      const normalized = this.normalizeAnchor(previous);
      this.anchorPosition = normalized;
      this.applyHost(normalized);
      if (normalized.x !== previous.x || normalized.y !== previous.y) this.persist(normalized);
      return;
    }
    const panel = this.query(".realgo-agent-panel");
    if (!panel || !this.anchorPosition) return;
    const measured = rectSize(panel.getBoundingClientRect(), this.panelNaturalSize);
    this.panelNaturalSize = {
      width: Math.max(this.panelNaturalSize.width, measured.width),
      height: Math.max(this.panelNaturalSize.height, measured.height),
    };
    const previous = this.anchorPosition;
    this.anchorPosition = this.normalizeAnchor(previous);
    if (this.anchorPosition.x !== previous.x || this.anchorPosition.y !== previous.y) {
      this.persist(this.anchorPosition);
    }
    this.placement = calculatePanelPlacement(
      this.anchorPosition,
      this.launcherSize,
      this.panelNaturalSize,
      viewport()
    );
    panel.dataset.openDirection = this.placement.direction;
    panel.dataset.horizontalAlignment = this.placement.alignment;
    panel.style.maxHeight = `${Math.max(0, this.placement.maxHeight)}px`;
    panel.style.maxWidth = `calc(100vw - ${VIEWPORT_MARGIN_PX * 2}px)`;
    this.applyHost(this.placement);
  }

  private finishDrag(save: boolean) {
    const wasDragging = this.dragging;
    const kind = this.dragKind;
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    if (this.pendingPosition) this.applyHost(this.pendingPosition);
    if (wasDragging && this.pendingPosition) {
      this.anchorPosition = kind === "panel"
        ? this.anchorFromPanel(this.pendingPosition)
        : this.normalizeAnchor(this.pendingPosition);
      if (save) this.persist(this.anchorPosition);
    }
    this.releasePointer();
    this.resetDragStyles();
    if (wasDragging) {
      this.suppressNextClick = true;
      this.layoutCurrentWidget();
    }
    this.dragging = false;
    this.dragKind = null;
    this.pendingPosition = null;
  }

  private anchorFromPanel(panelPosition: AgentLauncherPosition): AgentLauncherPosition {
    const panel = this.query(".realgo-agent-panel");
    const panelSize = rectSize(panel?.getBoundingClientRect(), this.panelNaturalSize);
    const placement = this.placement ?? calculatePanelPlacement(
      this.anchorPosition ?? panelPosition,
      this.launcherSize,
      panelSize,
      viewport()
    );
    return this.normalizeAnchor({
      x: placement.alignment === "right"
        ? panelPosition.x + panelSize.width - this.launcherSize.width
        : panelPosition.x,
      y: placement.direction === "up"
        ? panelPosition.y + panelSize.height
        : panelPosition.y - this.launcherSize.height,
    });
  }

  private releasePointer() {
    try {
      if (this.pointerId !== null && this.dragElement?.hasPointerCapture?.(this.pointerId)) {
        this.dragElement.releasePointerCapture(this.pointerId);
      }
    } catch {
      /* The captured node may have been replaced by the host SPA. */
    }
    this.pointerId = null;
  }

  private resetDragStyles() {
    if (this.dragElement) this.dragElement.style.cursor = "";
    const panel = this.query(".realgo-agent-panel");
    if (panel) panel.style.userSelect = "";
    this.dragElement = null;
  }

  private normalizeAnchor(position: AgentLauncherPosition) {
    return clampLauncherPosition(position, this.launcherSize, viewport());
  }

  private scheduleApplyDrag() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.pendingPosition) this.applyHost(this.pendingPosition);
    });
  }

  private applyHost(position: AgentLauncherPosition) {
    const { style } = this.options.host;
    style.left = "0";
    style.top = "0";
    style.right = "auto";
    style.bottom = "auto";
    style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  }

  private persist(position: AgentLauncherPosition) {
    void this.options.save(this.options.platform, position).catch(() => {
      /* Extension reload/context invalidation must not break the host page. */
    });
  }

  private async restore() {
    const position = await this.options.load(this.options.platform).catch(() => undefined);
    if (this.destroyed) return;
    const validPosition = position && Number.isFinite(position.x) && Number.isFinite(position.y)
      ? position
      : undefined;
    const applyWhenMounted = () => {
      if (this.destroyed) return;
      const launcher = this.query(".realgo-agent-button");
      if (!launcher) {
        this.mountFrame = requestAnimationFrame(applyWhenMounted);
        return;
      }
      const rect = launcher.getBoundingClientRect();
      if (!hasUsableSize(rect)) {
        this.mountFrame = requestAnimationFrame(applyWhenMounted);
        return;
      }
      this.mountFrame = 0;
      this.launcherSize = { width: rect.width, height: rect.height };
      const initialPosition = validPosition ?? getDefaultLauncherPosition(
        viewport(),
        this.launcherSize
      );
      this.anchorPosition = this.normalizeAnchor(initialPosition);
      this.applyHost(this.anchorPosition);
      this.initialized = true;
      this.options.host.style.visibility = "visible";
      if (validPosition && (
        this.anchorPosition.x !== validPosition.x || this.anchorPosition.y !== validPosition.y
      )) this.persist(this.anchorPosition);
    };
    this.mountFrame = requestAnimationFrame(applyWhenMounted);
  }
}

function viewport(): FloatingViewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

function rectSize(rect: Pick<DOMRect, "width" | "height"> | null | undefined, fallback: FloatingSize): FloatingSize {
  return {
    width: rect?.width && Number.isFinite(rect.width) ? rect.width : fallback.width,
    height: rect?.height && Number.isFinite(rect.height) ? rect.height : fallback.height,
  };
}

function hasUsableSize(rect: Pick<DOMRect, "width" | "height">): boolean {
  return Number.isFinite(rect.width) && rect.width > 0 && Number.isFinite(rect.height) && rect.height > 0;
}
