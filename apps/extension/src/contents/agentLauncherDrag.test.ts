// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentLauncherPosition, DraggableAgentPlatform } from "../lib/types";
import {
  AgentLauncherDragController,
  DEFAULT_LAUNCHER_MARGIN_PX,
  calculatePanelPlacement,
  clampLauncherPosition,
  getDefaultLauncherPosition,
  isDraggableAgentPlatform,
} from "./agentLauncherDrag";

let resizeCallbacks: ResizeObserverCallback[] = [];
let resizeDisconnects = 0;

class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) { resizeCallbacks.push(callback); }
  observe() {}
  unobserve() {}
  disconnect() { resizeDisconnects += 1; }
}

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

function pointer(target: Element, type: string, x: number, y: number) {
  target.dispatchEvent(new TestPointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 7,
  }));
}

function setup(
  platform: DraggableAgentPlatform = "leetcode",
  stored?: AgentLauncherPosition
) {
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  const launcher = document.createElement("button");
  launcher.className = "realgo-agent-button";
  shadow.append(launcher);
  document.body.append(host);
  const launcherRect = {
    x: 900, y: 700, left: 900, top: 700, right: 1000, bottom: 740,
    width: 100, height: 40,
  };
  launcher.getBoundingClientRect = () => ({ ...launcherRect, toJSON: () => ({}) });
  Object.defineProperties(launcher, {
    setPointerCapture: { value: vi.fn() },
    hasPointerCapture: { value: vi.fn(() => true) },
    releasePointerCapture: { value: vi.fn() },
  });
  const save = vi.fn(async () => undefined);
  const load = vi.fn(async () => stored);
  const controller = new AgentLauncherDragController({ host, platform, load, save });
  return { host, shadow, launcher, launcherRect, controller, save, load };
}

function openPanel(
  shadow: ShadowRoot,
  launcher: HTMLElement,
  rect: { x: number; y: number; width: number; height: number }
) {
  launcher.remove();
  const panel = document.createElement("section");
  panel.className = "realgo-agent-panel";
  const header = document.createElement("header");
  header.className = "realgo-agent-header";
  const brand = document.createElement("span");
  brand.className = "realgo-agent-brand";
  brand.textContent = "ReAlgo";
  const close = document.createElement("button");
  close.className = "realgo-agent-iconbtn";
  close.textContent = "close";
  header.append(brand, close);
  const hint = document.createElement("button");
  hint.className = "realgo-agent-btn realgo-agent-btn--hint";
  hint.textContent = "получить подсказку";
  const pattern = document.createElement("button");
  pattern.className = "realgo-agent-btn";
  pattern.textContent = "паттерн";
  const input = document.createElement("textarea");
  panel.append(header, hint, pattern, input);
  panel.getBoundingClientRect = () => ({
    x: rect.x, y: rect.y, left: rect.x, top: rect.y,
    right: rect.x + rect.width, bottom: rect.y + rect.height,
    width: rect.width, height: rect.height, toJSON: () => ({}),
  });
  Object.defineProperties(header, {
    setPointerCapture: { value: vi.fn() },
    hasPointerCapture: { value: vi.fn(() => true) },
    releasePointerCapture: { value: vi.fn() },
  });
  shadow.append(panel);
  return { panel, header, brand, close, hint, pattern, input };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  vi.runAllTimers();
  await Promise.resolve();
}

describe("AgentLauncherDragController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    resizeCallbacks = [];
    resizeDisconnects = 0;
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps a short click and sub-threshold pointer movement as a normal click", async () => {
    const { launcher, controller, save } = setup();
    await settle();
    const clicks = vi.fn();
    launcher.addEventListener("click", clicks);
    pointer(launcher, "pointerdown", 920, 720);
    pointer(launcher, "pointermove", 924, 722);
    pointer(launcher, "pointerup", 924, 722);
    launcher.click();
    expect(clicks).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("moves after the threshold, persists, and suppresses only the nearest click", async () => {
    const { host, launcher, controller, save } = setup("hackerrank");
    await settle();
    const clicks = vi.fn();
    launcher.addEventListener("click", clicks);
    pointer(launcher, "pointerdown", 920, 720);
    pointer(launcher, "pointermove", 820, 620);
    vi.runAllTimers();
    pointer(launcher, "pointerup", 820, 620);
    expect(host.style.transform).toBe("translate3d(800px, 600px, 0)");
    expect(save).toHaveBeenCalledWith("hackerrank", { x: 800, y: 600 });
    launcher.click();
    expect(clicks).not.toHaveBeenCalled();
    launcher.click();
    expect(clicks).toHaveBeenCalledOnce();
    controller.destroy();
  });

  it("clamps all viewport edges", () => {
    const size = { width: 100, height: 40 };
    const viewport = { width: 1200, height: 800 };
    expect(clampLauncherPosition({ x: -500, y: -500 }, size, viewport)).toEqual({ x: 10, y: 10 });
    expect(clampLauncherPosition({ x: 5000, y: 5000 }, size, viewport)).toEqual({ x: 1090, y: 750 });
  });

  it("computes the exact bottom-left default from the measured launcher size", () => {
    expect(DEFAULT_LAUNCHER_MARGIN_PX).toBe(18);
    expect(getDefaultLauncherPosition(
      { width: 1200, height: 800 },
      { width: 100, height: 40 }
    )).toEqual({ x: 18, y: 742 });
  });

  it("uses bottom-left only when no saved position exists and does not persist the default", async () => {
    const { host, controller, save } = setup("leetcode");
    expect(host.style.visibility).toBe("hidden");
    await settle();
    expect(host.style.transform).toBe("translate3d(18px, 742px, 0)");
    expect(host.style.visibility).toBe("visible");
    expect(save).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("waits through a zero-size Firefox-style first layout before revealing", async () => {
    const instance = setup("hackerrank");
    instance.launcherRect.width = 0;
    instance.launcherRect.height = 0;
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersToNextTimer();
    expect(instance.host.style.visibility).toBe("hidden");
    expect(instance.host.style.transform).toBe("");
    expect(instance.save).not.toHaveBeenCalled();
    instance.launcherRect.width = 100;
    instance.launcherRect.height = 40;
    vi.runAllTimers();
    expect(instance.host.style.transform).toBe("translate3d(18px, 742px, 0)");
    expect(instance.host.style.visibility).toBe("visible");
    expect(instance.save).not.toHaveBeenCalled();
    instance.controller.destroy();
  });

  it("enables floating drag only on the three scoped platforms", () => {
    expect(["leetcode", "hackerrank", "geeksforgeeks"].every(isDraggableAgentPlatform)).toBe(true);
    expect(isDraggableAgentPlatform("codeforces")).toBe(false);
  });

  it("opens down when it fits and up when only the space above fits", () => {
    const launcher = { width: 100, height: 40 };
    const panel = { width: 400, height: 300 };
    const viewport = { width: 1000, height: 800 };
    expect(calculatePanelPlacement({ x: 100, y: 100 }, launcher, panel, viewport)).toMatchObject({
      direction: "down", x: 100, y: 140, maxHeight: 300,
    });
    expect(calculatePanelPlacement({ x: 100, y: 700 }, launcher, panel, viewport)).toMatchObject({
      direction: "up", x: 100, y: 400, maxHeight: 300,
    });
  });

  it("chooses the larger side, constrains height, and keeps horizontal bounds", () => {
    const placement = calculatePanelPlacement(
      { x: 750, y: 450 },
      { width: 100, height: 40 },
      { width: 400, height: 700 },
      { width: 900, height: 800 }
    );
    expect(placement.direction).toBe("up");
    expect(placement.alignment).toBe("right");
    expect(placement.maxHeight).toBe(440);
    expect(placement).toMatchObject({ x: 450, y: 10 });
    expect(calculatePanelPlacement(
      { x: 10, y: 100 },
      { width: 100, height: 40 },
      { width: 400, height: 200 },
      { width: 900, height: 800 }
    ).x).toBe(10);
  });

  it("restores a platform position and normalizes it after viewport changes", async () => {
    const { host, controller, save } = setup("geeksforgeeks", { x: 5000, y: 5000 });
    await settle();
    expect(host.style.transform).toBe("translate3d(1090px, 750px, 0)");
    expect(save).toHaveBeenCalledWith("geeksforgeeks", { x: 1090, y: 750 });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 700 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });
    window.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(host.style.transform).toBe("translate3d(590px, 450px, 0)");
    controller.destroy();
  });

  it("keeps independent positions per platform through the injected storage", async () => {
    const positions: Partial<Record<DraggableAgentPlatform, AgentLauncherPosition>> = {};
    const load = async (platform: DraggableAgentPlatform) => positions[platform];
    const save = async (platform: DraggableAgentPlatform, value: AgentLauncherPosition) => {
      positions[platform] = value;
    };
    const hosts = [document.createElement("div"), document.createElement("div")];
    const controllers: AgentLauncherDragController[] = [];
    positions.leetcode = { x: 100, y: 120 };
    positions.geeksforgeeks = { x: 300, y: 320 };
    for (const [index, platform] of (["leetcode", "geeksforgeeks"] as const).entries()) {
      const shadow = hosts[index].attachShadow({ mode: "open" });
      const button = document.createElement("button");
      button.className = "realgo-agent-button";
      button.getBoundingClientRect = () => ({ width: 100, height: 40 } as DOMRect);
      shadow.append(button);
      document.body.append(hosts[index]);
      controllers.push(new AgentLauncherDragController({ host: hosts[index], platform, load, save }));
    }
    await settle();
    expect(hosts[0].style.transform).toContain("100px, 120px");
    expect(hosts[1].style.transform).toContain("300px, 320px");
    controllers.forEach((controller) => controller.destroy());
  });

  it("positions an opened panel upward and constrains it to a tight viewport", async () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 400 });
    const { shadow, launcher, controller } = setup("hackerrank", { x: 900, y: 700 });
    await settle();
    const { panel } = openPanel(shadow, launcher, { x: 790, y: 10, width: 400, height: 520 });
    await settle();
    expect(panel.dataset.openDirection).toBe("up");
    expect(panel.style.maxHeight).toBe("340px");
    expect(panel.style.maxWidth).toBe("calc(100vw - 20px)");
    controller.destroy();
  });

  it("recalculates direction after viewport resize", async () => {
    const { shadow, launcher, controller } = setup("leetcode", { x: 100, y: 300 });
    await settle();
    const { panel } = openPanel(shadow, launcher, { x: 100, y: 344, width: 400, height: 520 });
    await settle();
    expect(panel.dataset.openDirection).toBe("down");
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });
    window.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(panel.dataset.openDirection).toBe("up");
    controller.destroy();
  });

  it("repositions when ResizeObserver reports changed panel content", async () => {
    const rect = { x: 100, y: 144, width: 400, height: 300 };
    const { shadow, launcher, controller } = setup("leetcode", { x: 100, y: 100 });
    await settle();
    const { panel } = openPanel(shadow, launcher, rect);
    await settle();
    const before = panel.style.maxHeight;
    rect.height = 700;
    resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver));
    vi.runAllTimers();
    expect(panel.style.maxHeight).not.toBe(before);
    expect(panel.style.maxHeight).toBe("650px");
    controller.destroy();
  });

  it("drags from the panel header, persists the shared anchor, and suppresses one click", async () => {
    const { host, shadow, launcher, controller, save } = setup("geeksforgeeks", { x: 900, y: 700 });
    await settle();
    const { header, brand } = openPanel(shadow, launcher, { x: 600, y: 180, width: 400, height: 520 });
    await settle();
    const clicks = vi.fn();
    brand.addEventListener("click", clicks);
    pointer(brand, "pointerdown", 650, 200);
    pointer(brand, "pointermove", 450, 100);
    vi.runAllTimers();
    pointer(brand, "pointerup", 450, 100);
    expect(host.style.transform).toBe("translate3d(400px, 80px, 0)");
    expect(save).toHaveBeenCalledWith("geeksforgeeks", { x: 700, y: 600 });
    brand.click();
    expect(clicks).not.toHaveBeenCalled();
    brand.click();
    expect(clicks).toHaveBeenCalledOnce();
    expect(header.style.cursor).toBe("");
    controller.destroy();
  });

  it("keeps sub-threshold header movement clickable", async () => {
    const { shadow, launcher, controller, save } = setup();
    await settle();
    const { brand } = openPanel(shadow, launcher, { x: 600, y: 180, width: 400, height: 520 });
    await settle();
    const clicks = vi.fn();
    brand.addEventListener("click", clicks);
    pointer(brand, "pointerdown", 650, 200);
    pointer(brand, "pointermove", 654, 202);
    pointer(brand, "pointerup", 654, 202);
    brand.click();
    expect(clicks).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("never starts panel drag from close, hint, pattern, or form controls", async () => {
    const { host, shadow, launcher, controller, save } = setup();
    await settle();
    const controls = openPanel(shadow, launcher, { x: 600, y: 180, width: 400, height: 520 });
    await settle();
    const before = host.style.transform;
    for (const control of [controls.close, controls.hint, controls.pattern, controls.input]) {
      pointer(control, "pointerdown", 650, 200);
      pointer(control, "pointermove", 450, 100);
      pointer(control, "pointerup", 450, 100);
    }
    expect(host.style.transform).toBe(before);
    expect(save).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("returns the launcher to the anchor updated by panel drag", async () => {
    const { host, shadow, launcher, controller } = setup("leetcode", { x: 900, y: 700 });
    await settle();
    const { brand, panel } = openPanel(shadow, launcher, { x: 600, y: 180, width: 400, height: 520 });
    await settle();
    pointer(brand, "pointerdown", 650, 200);
    pointer(brand, "pointermove", 450, 100);
    pointer(brand, "pointerup", 450, 100);
    panel.remove();
    const nextLauncher = document.createElement("button");
    nextLauncher.className = "realgo-agent-button";
    nextLauncher.getBoundingClientRect = () => ({ width: 100, height: 40 } as DOMRect);
    shadow.append(nextLauncher);
    await settle();
    expect(host.style.transform).toBe("translate3d(700px, 600px, 0)");
    controller.destroy();
  });

  it("ignores invalid restored data and interactions outside the launcher", async () => {
    const invalid = { x: Number.NaN, y: 20 };
    const { host, shadow, controller, save } = setup("leetcode", invalid);
    const panelButton = document.createElement("button");
    panelButton.className = "panel-control";
    shadow.append(panelButton);
    await settle();
    pointer(panelButton, "pointerdown", 10, 10);
    pointer(panelButton, "pointermove", 100, 100);
    pointer(panelButton, "pointerup", 100, 100);
    expect(host.style.transform).toBe("translate3d(18px, 742px, 0)");
    expect(save).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("cleanup removes pointer and resize behavior, preventing duplicate SPA/HMR listeners", async () => {
    const mutationDisconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const { host, launcher, controller, save } = setup();
    await settle();
    const initialTransform = host.style.transform;
    controller.destroy();
    expect(mutationDisconnect).toHaveBeenCalled();
    expect(resizeDisconnects).toBeGreaterThan(0);
    pointer(launcher, "pointerdown", 920, 720);
    pointer(launcher, "pointermove", 700, 500);
    pointer(launcher, "pointerup", 700, 500);
    window.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(host.style.transform).toBe(initialTransform);
    expect(save).not.toHaveBeenCalled();
  });

  it("does not treat host-page Run Code or Submit Code controls as drag handles", async () => {
    const { host, controller, save } = setup();
    const run = document.createElement("button");
    const submit = document.createElement("button");
    run.textContent = "Run Code";
    submit.textContent = "Submit Code";
    document.body.append(run, submit);
    await settle();
    pointer(run, "pointerdown", 10, 10);
    pointer(run, "pointermove", 100, 100);
    pointer(submit, "pointerdown", 10, 10);
    pointer(submit, "pointermove", 100, 100);
    expect(host.style.transform).toBe("translate3d(18px, 742px, 0)");
    expect(save).not.toHaveBeenCalled();
    controller.destroy();
  });
});
