"use client";

import { useState } from "react";

import { keepShortWords } from "../_content/i18n";

/**
 * Landing "reviews" section demo card — same 3D flip mechanic as the real
 * card-session player (.focus-card in globals.css: perspective + rotateY +
 * backface-visibility), scaled down to grid-card size. Front shows the
 * question, back shows the answer; click/Enter/Space toggles.
 */
export function FlipReviewCard({
  type,
  front,
  back,
  flipAria,
}: Readonly<{ type: string; front: string; back: string; flipAria: { showAnswer: string; showQuestion: string } }>) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="review-flip">
      <button
        className={flipped ? "review-flip__card review-flip__card--back" : "review-flip__card"}
        type="button"
        aria-pressed={flipped}
        aria-label={keepShortWords(flipped ? flipAria.showQuestion : flipAria.showAnswer)}
        onClick={() => setFlipped((value) => !value)}
      >
        <span className="review-flip__inner">
          <span className="review-flip__face review-flip__face--front" aria-hidden={flipped}>
            <span>{keepShortWords(type)}</span>
            <h3>{keepShortWords(front)}</h3>
          </span>
          <span className="review-flip__face review-flip__face--back" aria-hidden={!flipped}>
            <span>{keepShortWords(type)}</span>
            <p>{keepShortWords(back)}</p>
          </span>
        </span>
      </button>
    </div>
  );
}
