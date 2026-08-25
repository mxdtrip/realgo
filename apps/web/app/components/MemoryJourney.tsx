"use client";

import { useEffect, useRef, useState } from "react";

import { keepShortWords } from "../_content/i18n";
import { LandingCTA } from "./LandingCTA";
import { MemoryExtensionDemo } from "./MemoryExtensionDemo";

type MemorySectionCopy = {
  kicker: string;
  agentTitle: string;
  agentDescription: string;
  agentCta: string;
  title: string;
  description: string;
  cta: string;
};

type DemoMode = "agent" | "rating";
type ScenePhase =
  | "outside"
  | "anchoring-1"
  | "stage-1-ready"
  | "transition-forward"
  | "anchoring-2"
  | "stage-2-ready"
  | "transition-backward";

const SCENE_TRANSITION_MS = 1640;
const WINDOW_MODE_TRANSITION_MS = 1240;
const ANCHOR_EASING = 0.1;
const ANCHOR_STOP_THRESHOLD = 0.45;
const STORY_ENTRY_DISTANCE = 260;
// Wheel streams (especially trackpads) often contain alternating tail events.
// Treat direction changes inside this quiet window as one gesture.
const GESTURE_END_MS = 280;
// After a scene transition, only the reverse-direction inertia tail is blocked;
// the user can continue scrolling in the same direction immediately.
const INERTIA_TAIL_GUARD_MS = 180;
const WINDOW_MODE_TIMELINE_SPAN = WINDOW_MODE_TRANSITION_MS / SCENE_TRANSITION_MS;
const WINDOW_MODE_TIMELINE_START = (1 - WINDOW_MODE_TIMELINE_SPAN) / 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function easeInQuint(value: number) {
  return value ** 5;
}

function easeOutQuint(value: number) {
  return 1 - (1 - value) ** 5;
}

function easeResponsiveStart(value: number) {
  return 1 - (1 - value) ** 3;
}

/**
 * Two-stage scroll scene:
 *
 *   copy stack | static extension window
 *
 * The extension window keeps its right-hand position. Scroll gestures move one
 * vertical copy ribbon on the left while the popup content performs its
 * internal mode transition.
 */
export function MemoryJourney({ section }: { section: MemorySectionCopy }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [demoMode, setDemoMode] = useState<DemoMode>("agent");
  const modeRef = useRef<DemoMode>("agent");

  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;

    const desktop = window.matchMedia("(min-width: 921px)");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let phase: ScenePhase = "outside";
    let sceneProgress = 0;
    let lastScrollY = window.scrollY;
    let gestureLocked = false;
    let gestureCooldownUntil = 0;
    let guardedInertiaDirection: -1 | 0 | 1 = 0;
    let wheelDirection: -1 | 0 | 1 = 0;
    let lastWheelAt = 0;
    let queuedAnchorDirection: -1 | 0 | 1 = 0;
    let gestureReleaseTimer = 0;
    let anchorFrame = 0;
    let transitionFrame = 0;
    let destroyed = false;

    const sectionBounds = () => {
      const top = root.getBoundingClientRect().top + window.scrollY;
      return {
        top,
        end: top + Math.max(1, root.offsetHeight - window.innerHeight),
      };
    };

    const setMode = (mode: DemoMode) => {
      if (mode === modeRef.current) return;
      modeRef.current = mode;
      setDemoMode(mode);
    };

    const applyScene = (rawProgress: number, rawTimelineProgress = rawProgress) => {
      const progress = clamp(rawProgress, 0, 1);
      const timelineProgress = clamp(rawTimelineProgress, 0, 1);
      const modeProgress = clamp(
        (timelineProgress - WINDOW_MODE_TIMELINE_START) / WINDOW_MODE_TIMELINE_SPAN,
        0,
        1,
      );
      sceneProgress = progress;
      const agentExit = easeInQuint(clamp(modeProgress / 0.68, 0, 1));
      const ratingEnter = easeOutQuint(clamp((modeProgress - 0.32) / 0.68, 0, 1));

      // The copy is one vertical ribbon: the first state leaves through the
      // top while the second state enters from below. Keep this tied directly
      // to the scene's scroll progress so the extension window and the copy
      // arrive at their final positions together.
      root.style.setProperty("--memory-copy-ribbon-progress", `${progress}`);
      root.style.setProperty("--memory-agent-header-y", `${-62 * agentExit}px`);
      root.style.setProperty("--memory-agent-task-x", `${-430 * agentExit}px`);
      root.style.setProperty("--memory-agent-messages-x", `${430 * agentExit}px`);
      root.style.setProperty("--memory-agent-actions-y", `${88 * agentExit}px`);
      root.style.setProperty("--memory-rating-header-y", `${-62 * (1 - ratingEnter)}px`);
      root.style.setProperty("--memory-rating-task-x", `${430 * (1 - ratingEnter)}px`);
      root.style.setProperty("--memory-rating-body-y", `${390 * (1 - ratingEnter)}px`);
      setMode(modeProgress >= 0.5 ? "rating" : "agent");
    };

    const stopSmoothScroll = () => {
      window.dispatchEvent(new Event("realgo:stop-smooth-scroll"));
    };

    const clearGestureReleaseTimer = () => {
      if (!gestureReleaseTimer) return;
      window.clearTimeout(gestureReleaseTimer);
      gestureReleaseTimer = 0;
    };

    const lockCurrentGesture = () => {
      gestureLocked = true;
      clearGestureReleaseTimer();
      gestureReleaseTimer = window.setTimeout(() => {
        gestureReleaseTimer = 0;
        gestureLocked = false;
      }, GESTURE_END_MS);
    };

    const setAnchor = (stage: 1 | 2, snap = true) => {
      stopSmoothScroll();
      if (transitionFrame) {
        window.cancelAnimationFrame(transitionFrame);
        transitionFrame = 0;
      }
      if (anchorFrame) {
        window.cancelAnimationFrame(anchorFrame);
        anchorFrame = 0;
      }

      const { top, end } = sectionBounds();
      const scrollTarget = stage === 1 ? top : end;
      const readyPhase = stage === 1 ? "stage-1-ready" : "stage-2-ready";
      queuedAnchorDirection = 0;
      applyScene(stage === 1 ? 0 : 1);

      const completeAnchor = () => {
        phase = readyPhase;
        const queuedDirection = queuedAnchorDirection;
        queuedAnchorDirection = 0;
        clearGestureReleaseTimer();
        gestureLocked = false;

        if (stage === 1 && queuedDirection > 0) runTransition(2);
        if (stage === 2 && queuedDirection < 0) runTransition(1);
      };

      if (!snap || reduceMotion.matches || Math.abs(window.scrollY - scrollTarget) <= 0.75) {
        window.scrollTo(0, scrollTarget);
        lastScrollY = scrollTarget;
        completeAnchor();
        return;
      }

      let anchorY = window.scrollY;
      phase = stage === 1 ? "anchoring-1" : "anchoring-2";

      const tick = () => {
        if (destroyed) return;
        const distance = scrollTarget - anchorY;

        if (Math.abs(distance) <= ANCHOR_STOP_THRESHOLD) {
          anchorY = scrollTarget;
          window.scrollTo(0, anchorY);
          lastScrollY = anchorY;
          anchorFrame = 0;
          completeAnchor();
          return;
        }

        anchorY += distance * ANCHOR_EASING;
        window.scrollTo(0, anchorY);
        lastScrollY = anchorY;
        anchorFrame = window.requestAnimationFrame(tick);
      };

      anchorFrame = window.requestAnimationFrame(tick);
    };

    const runTransition = (targetStage: 1 | 2) => {
      stopSmoothScroll();
      queuedAnchorDirection = 0;
      const fromProgress = sceneProgress;
      const toProgress = targetStage === 1 ? 0 : 1;
      const { top, end } = sectionBounds();
      const startedAt = performance.now();
      phase = targetStage === 1 ? "transition-backward" : "transition-forward";

      if (reduceMotion.matches) {
        const progress = targetStage === 1 ? 0 : 1;
        applyScene(progress);
        window.scrollTo(0, targetStage === 1 ? top : end);
        lastScrollY = targetStage === 1 ? top : end;
        setAnchor(targetStage, false);
        return;
      }

      const tick = (now: number) => {
        if (destroyed) return;
        const elapsed = clamp((now - startedAt) / SCENE_TRANSITION_MS, 0, 1);
        const eased = easeResponsiveStart(elapsed);
        const progress = fromProgress + (toProgress - fromProgress) * eased;
        const timelineProgress = targetStage === 1 ? 1 - eased : eased;
        const scrollTarget = top + (end - top) * progress;

        applyScene(progress, timelineProgress);
        window.scrollTo(0, scrollTarget);
        lastScrollY = scrollTarget;

        if (elapsed < 1) {
          transitionFrame = window.requestAnimationFrame(tick);
          return;
        }

        transitionFrame = 0;
        // Trackpad inertia can deliver the opposite sign after a transition
        // has visually settled. Ignore only that reverse tail; same-direction
        // scrolling should continue into the next section immediately.
        guardedInertiaDirection = targetStage === 1 ? 1 : -1;
        gestureCooldownUntil = performance.now() + INERTIA_TAIL_GUARD_MS;
        setAnchor(targetStage, false);
      };

      transitionFrame = window.requestAnimationFrame(tick);
    };

    const consumeWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onWheel = (event: WheelEvent) => {
      if (!desktop.matches || event.ctrlKey || Math.abs(event.deltaY) < 0.1) return;

      if (phase === "outside") {
        const { top, end } = sectionBounds();
        const currentY = window.scrollY;
        const enteringFromAbove =
          event.deltaY > 0 && currentY < top && top - currentY <= STORY_ENTRY_DISTANCE;
        const enteringFromBelow =
          event.deltaY < 0 && currentY > end && currentY - end <= STORY_ENTRY_DISTANCE;

        if (enteringFromAbove || enteringFromBelow) {
          consumeWheel(event);
          setAnchor(enteringFromAbove ? 1 : 2);
          lockCurrentGesture();
          return;
        }

        // The story only owns wheel input while it is anchored. Outside of
        // it, leave normal page scrolling completely untouched.
        return;
      }

      const now = performance.now();
      const direction = event.deltaY > 0 ? 1 : -1;
      if (now < gestureCooldownUntil && direction === guardedInertiaDirection) {
        consumeWheel(event);
        return;
      }
      if (now >= gestureCooldownUntil) {
        guardedInertiaDirection = 0;
      }

      if (wheelDirection !== 0 && now - lastWheelAt < GESTURE_END_MS && direction !== wheelDirection) {
        // Consume the opposite-sign tail, but keep extending the same gesture
        // window while the device is still emitting inertia events.
        lastWheelAt = now;
        consumeWheel(event);
        return;
      }
      wheelDirection = direction;
      lastWheelAt = now;

      if (phase === "transition-forward" || phase === "transition-backward") {
        consumeWheel(event);
        lockCurrentGesture();
        return;
      }

      if (phase === "anchoring-1" || phase === "anchoring-2") {
        if (!gestureLocked && performance.now() >= gestureCooldownUntil) {
          queuedAnchorDirection = event.deltaY > 0 ? 1 : -1;
        }
        consumeWheel(event);
        lockCurrentGesture();
        return;
      }

      if (gestureLocked) {
        consumeWheel(event);
        lockCurrentGesture();
        return;
      }

      if (phase === "stage-1-ready") {
        if (event.deltaY > 0) {
          consumeWheel(event);
          lockCurrentGesture();
          runTransition(2);
        } else {
          phase = "outside";
        }
        return;
      }

      if (phase === "stage-2-ready") {
        if (event.deltaY < 0) {
          consumeWheel(event);
          lockCurrentGesture();
          runTransition(1);
        } else {
          phase = "outside";
        }
      }
    };

    const onScroll = () => {
      if (!desktop.matches) return;
      const currentY = window.scrollY;
      const previousY = lastScrollY;
      const direction = currentY - previousY;
      lastScrollY = currentY;
      const { top, end } = sectionBounds();

      if (
        phase === "transition-forward" ||
        phase === "transition-backward" ||
        phase === "anchoring-1" ||
        phase === "anchoring-2"
      ) {
        return;
      }

      if (performance.now() < gestureCooldownUntil) {
        // A delayed scroll event from the wheel stream must not be interpreted
        // as a fresh request to reverse the scene during the inertia guard.
        const movedInGuardedDirection =
          (guardedInertiaDirection > 0 && currentY > previousY) ||
          (guardedInertiaDirection < 0 && currentY < previousY);
        if (phase === "stage-1-ready" && movedInGuardedDirection && Math.abs(currentY - top) > 0.75) {
          window.scrollTo(0, top);
          lastScrollY = top;
        } else if (phase === "stage-2-ready" && movedInGuardedDirection && Math.abs(currentY - end) > 0.75) {
          window.scrollTo(0, end);
          lastScrollY = end;
        }
        if (movedInGuardedDirection) return;
      }

      if (phase === "stage-1-ready") {
        if (currentY > top + 0.75) {
          stopSmoothScroll();
          window.scrollTo(0, top);
          lastScrollY = top;
          runTransition(2);
        } else if (currentY < top - 0.75) {
          phase = "outside";
          applyScene(0);
        }
        return;
      }

      if (phase === "stage-2-ready") {
        if (currentY < end - 0.75) {
          stopSmoothScroll();
          window.scrollTo(0, end);
          lastScrollY = end;
          runTransition(1);
        } else if (currentY > end + 0.75) {
          phase = "outside";
          applyScene(1);
        }
        return;
      }

      if (currentY >= top && currentY <= end) {
        // A large first wheel gesture may land deep inside the sticky range.
        // Entry direction decides which of the two anchors receives the scene.
        setAnchor(direction < 0 ? 2 : 1);
      } else if (currentY < top) {
        applyScene(0);
      } else {
        applyScene(1);
      }
    };

    const onResize = () => {
      if (!desktop.matches) {
        phase = "outside";
        queuedAnchorDirection = 0;
        clearGestureReleaseTimer();
        gestureLocked = false;
        gestureCooldownUntil = 0;
        guardedInertiaDirection = 0;
        if (anchorFrame) window.cancelAnimationFrame(anchorFrame);
        anchorFrame = 0;
        if (transitionFrame) window.cancelAnimationFrame(transitionFrame);
        transitionFrame = 0;
        applyScene(0);
        return;
      }

      if (anchorFrame) window.cancelAnimationFrame(anchorFrame);
      anchorFrame = 0;
      queuedAnchorDirection = 0;
      guardedInertiaDirection = 0;
      clearGestureReleaseTimer();
      gestureLocked = false;

      const { top, end } = sectionBounds();
      if (phase === "anchoring-1" || phase === "stage-1-ready") {
        applyScene(0);
        window.scrollTo(0, top);
        lastScrollY = top;
        phase = "stage-1-ready";
      } else if (phase === "anchoring-2" || phase === "stage-2-ready") {
        applyScene(1);
        window.scrollTo(0, end);
        lastScrollY = end;
        phase = "stage-2-ready";
      } else {
        applyScene(sceneProgress);
      }
    };

    const initialBounds = sectionBounds();
    if (!desktop.matches || window.scrollY < initialBounds.top) {
      applyScene(0);
    } else if (window.scrollY > initialBounds.end) {
      applyScene(1);
    } else {
      setAnchor(window.scrollY - initialBounds.top < initialBounds.end - window.scrollY ? 1 : 2);
    }

    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    desktop.addEventListener("change", onResize);

    return () => {
      destroyed = true;
      clearGestureReleaseTimer();
      gestureCooldownUntil = 0;
      guardedInertiaDirection = 0;
      if (anchorFrame) window.cancelAnimationFrame(anchorFrame);
      if (transitionFrame) window.cancelAnimationFrame(transitionFrame);
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      desktop.removeEventListener("change", onResize);
    };
  }, []);

  return (
    <section
      className="landing-section memory-journey"
      data-scroll-story
      id="memory"
      ref={sectionRef}
    >
      <div className="memory-journey__sticky">
        <div className="section-kicker" data-reveal="blur">
          {keepShortWords(section.kicker)}
        </div>

        <div className="memory-journey__viewport">
          <div className="memory-journey__track">
            <div className="memory-journey__copy-stack">
              <div className="memory-journey__copy-ribbon">
                <div
                  aria-hidden={demoMode !== "agent"}
                  className="section-copy memory-journey__copy memory-journey__copy--agent"
                  data-active={demoMode === "agent"}
                >
                  <h2>{keepShortWords(section.agentTitle)}</h2>
                  <p>{keepShortWords(section.agentDescription)}</p>
                  <LandingCTA label={section.agentCta} intent="memory-agent" />
                </div>

                <div
                  aria-hidden={demoMode !== "rating"}
                  className="section-copy memory-journey__copy memory-journey__copy--rating"
                  data-active={demoMode === "rating"}
                >
                  <h2>{keepShortWords(section.title)}</h2>
                  <p>{keepShortWords(section.description)}</p>
                  <LandingCTA label={section.cta} intent="memory" />
                </div>
              </div>
            </div>

            <div className="memory-ext-demo memory-journey__demo">
              <MemoryExtensionDemo activeMode={demoMode} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
