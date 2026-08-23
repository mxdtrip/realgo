"use client";

import { useEffect } from "react";

const MAX_WHEEL_STEP = 78;
const MAX_TARGET_LEAD = 240;
const EASING = 0.1;
const STOP_THRESHOLD = 0.45;
const SNAP_DELAY = 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function SmoothWheelScroll() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktopWheel = window.matchMedia("(min-width: 768px) and (pointer: fine)").matches;

    if (reduceMotion || !desktopWheel) {
      return undefined;
    }

    const root = document.documentElement;
    root.classList.add("smooth-wheel-scroll");

    let current = window.scrollY;
    let target = current;
    let frame = 0;
    let running = false;
    let snapTimer = 0;

    const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight);

    const anchorPositions = () =>
      Array.from(document.querySelectorAll<HTMLElement>(".landing-section"))
        // A scroll story has meaningful intermediate progress. Snapping to its
        // geometric centre would skip half of the horizontal transition.
        .filter((section) => !section.hasAttribute("data-scroll-story"))
        .map((section) =>
          clamp(
            section.getBoundingClientRect().top + window.scrollY + section.offsetHeight / 2 - window.innerHeight / 2,
            0,
            maxScroll(),
          ),
        );

    const targetInsideScrollStory = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-story]")).some((story) => {
        const top = story.getBoundingClientRect().top + window.scrollY;
        const bottom = top + story.offsetHeight - window.innerHeight;
        return target > top && target < bottom;
      });

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      running = false;
    };

    const tick = () => {
      const distance = target - current;
      if (Math.abs(distance) <= STOP_THRESHOLD) {
        current = target;
        window.scrollTo(0, current);
        stop();
        return;
      }

      current += distance * EASING;
      window.scrollTo(0, current);
      if (!running) return;
      frame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      frame = window.requestAnimationFrame(tick);
    };

    const scheduleSnap = () => {
      if (snapTimer) window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => {
        snapTimer = 0;
        if (targetInsideScrollStory()) return;
        const nearest = anchorPositions().reduce<number | null>((closest, position) => {
          if (closest === null || Math.abs(position - target) < Math.abs(closest - target)) {
            return position;
          }
          return closest;
        }, null);

        const snapDistance = window.innerHeight * 0.58;
        if (nearest === null || Math.abs(nearest - target) > snapDistance) return;
        target = nearest;
        start();
      }, SNAP_DELAY);
    };

    const onWheel = (event: WheelEvent) => {
      // Ctrl + wheel is browser zoom and must remain native.
      if (event.ctrlKey || Math.abs(event.deltaY) < 0.1) return;

      let delta = event.deltaY;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= window.innerHeight;

      const limitedDelta = clamp(delta, -MAX_WHEEL_STEP, MAX_WHEEL_STEP);
      if (!running) {
        current = window.scrollY;
        target = current;
      }

      const max = maxScroll();
      const nextTarget = target + limitedDelta;
      target = clamp(
        nextTarget,
        Math.max(0, current - MAX_TARGET_LEAD),
        Math.min(max, current + MAX_TARGET_LEAD),
      );

      event.preventDefault();
      start();
      scheduleSnap();
    };

    const onScroll = () => {
      if (running) return;
      current = window.scrollY;
      target = current;
    };

    const onResize = () => {
      target = clamp(target, 0, maxScroll());
    };

    const onForcedStop = () => {
      stop();
      if (snapTimer) window.clearTimeout(snapTimer);
      snapTimer = 0;
      current = window.scrollY;
      target = current;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("realgo:stop-smooth-scroll", onForcedStop);

    return () => {
      stop();
      if (snapTimer) window.clearTimeout(snapTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("realgo:stop-smooth-scroll", onForcedStop);
      root.classList.remove("smooth-wheel-scroll");
    };
  }, []);

  return null;
}
