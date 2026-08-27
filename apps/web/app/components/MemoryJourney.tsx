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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function renderGradientPhrase(value: string, phrase: string) {
  const text = keepShortWords(value);
  const target = keepShortWords(phrase);
  const index = text.indexOf(target);

  if (index === -1) {
    return text;
  }

  return [
    text.slice(0, index),
    <span className="landing-gradient-text" key={target}>
      {target}
    </span>,
    text.slice(index + target.length),
  ];
}

/**
 * Scroll-scrubbed two-state scene:
 *
 *   copy stack | static extension window
 *
 * The extension window keeps its right-hand position. The left copy ribbon and
 * the popup internals react directly to scroll position, without wheel capture
 * or scroll anchors.
 */
export function MemoryJourney({ section }: { section: MemorySectionCopy }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [demoMode, setDemoMode] = useState<DemoMode>("agent");
  const modeRef = useRef<DemoMode>("agent");

  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;

    const desktop = window.matchMedia("(min-width: 921px)");
    let frame = 0;

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

    const applyScene = (rawProgress: number) => {
      const progress = clamp(rawProgress, 0, 1);
      const agentExit = progress;
      const ratingEnter = progress;

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
      setMode(progress >= 0.5 ? "rating" : "agent");
    };

    const updateScene = () => {
      frame = 0;

      if (!desktop.matches) {
        applyScene(0);
        return;
      }

      const { top, end } = sectionBounds();
      applyScene((window.scrollY - top) / Math.max(1, end - top));
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScene);
    };

    updateScene();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    desktop.addEventListener("change", scheduleUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      desktop.removeEventListener("change", scheduleUpdate);
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
                  <h2>{renderGradientPhrase(section.agentTitle, "ReAlgo подскажет")}</h2>
                  <p>{keepShortWords(section.agentDescription)}</p>
                  <LandingCTA label={section.agentCta} intent="memory-agent" />
                </div>

                <div
                  aria-hidden={demoMode !== "rating"}
                  className="section-copy memory-journey__copy memory-journey__copy--rating"
                  data-active={demoMode === "rating"}
                >
                  <h2>{renderGradientPhrase(section.title, "ReAlgo сохраняет то")}</h2>
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
