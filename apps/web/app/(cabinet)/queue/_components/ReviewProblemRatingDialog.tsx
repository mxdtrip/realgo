"use client";

import { useEffect, useRef, useState } from "react";

import type { ReviewQueueItem, ReviewRating } from "../../../_api/reviews";
import { ApiError } from "../../../_api/types";

export type ReviewProblemRatingDialogCopy = Readonly<{
  rateEyebrow: string;
  rateTitle: string;
  rateDescription: string;
  ratings: Readonly<Record<ReviewRating, Readonly<{ label: string; hint: string }>>>;
  later: string;
  saving: string;
  successTitle: string;
  successDescription: string;
  backToQueue: string;
  reopenAction: string;
  close: string;
  error: string;
}>;

type Phase = "rating" | "saving" | "success" | "error";

/**
 * The problem is opened in a separate tab by the queue card. This dialog stays
 * in the cabinet tab, so the rating is available the moment a learner returns.
 */
export function ReviewProblemRatingDialog({
  item,
  meta,
  copy,
  onClose,
  onRate,
}: Readonly<{
  item: ReviewQueueItem;
  meta: string;
  copy: ReviewProblemRatingDialogCopy;
  onClose: () => void;
  onRate: (rating: ReviewRating) => Promise<void>;
}>) {
  const [phase, setPhase] = useState<Phase>("rating");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || phase === "saving") return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, phase]);

  async function save(rating: ReviewRating) {
    if (phase === "saving") return;
    setPhase("saving");
    setError("");
    try {
      await onRate(rating);
      setPhase("success");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : copy.error);
      setPhase("error");
    }
  }

  return (
    <div
      className="shell-overlay roadmap-task-overlay"
      data-shell-overlay
      role="presentation"
      onClick={phase === "saving" ? undefined : onClose}
    >
      <div
        className="shell-dialog roadmap-task-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-problem-rating-title"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shell-dialog__head">
          <span>{copy.rateEyebrow}</span>
          <button
            className="shell-dialog__close"
            type="button"
            aria-label={copy.close}
            disabled={phase === "saving"}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="roadmap-task-dialog__problem">
          {meta ? <span>{meta}</span> : null}
          <h2 id="review-problem-rating-title">{item.title}</h2>
        </div>

        {phase === "rating" || phase === "saving" || phase === "error" ? (
          <section className="roadmap-task-dialog__rating" aria-labelledby="review-problem-rating-question">
            <h3 id="review-problem-rating-question">{copy.rateTitle}</h3>
            <p>{copy.rateDescription}</p>
            <div className="roadmap-task-dialog__choices">
              {(["hard", "normal", "easy"] as const).map((rating) => (
                <button
                  className={`roadmap-task-rating roadmap-task-rating--${rating}`}
                  disabled={phase === "saving"}
                  key={rating}
                  type="button"
                  onClick={() => void save(rating)}
                >
                  <strong>{copy.ratings[rating].label}</strong>
                  <small>{copy.ratings[rating].hint}</small>
                </button>
              ))}
            </div>
            {phase === "saving" ? <p className="roadmap-task-dialog__status" role="status">{copy.saving}</p> : null}
            {phase === "error" ? <p className="roadmap-task-dialog__error" role="alert">{error || copy.error}</p> : null}
          </section>
        ) : null}

        {phase === "success" ? (
          <section className="roadmap-task-dialog__result">
            <span aria-hidden="true">✓</span>
            <div>
              <h3>{copy.successTitle}</h3>
              <p>{copy.successDescription}</p>
            </div>
          </section>
        ) : null}

        <footer className="roadmap-task-dialog__footer">
          {phase === "success" ? (
            <button type="button" onClick={onClose}>{copy.backToQueue}</button>
          ) : (
            <button type="button" disabled={phase === "saving"} onClick={onClose}>{copy.later}</button>
          )}
          {phase !== "saving" ? (
            <a href={item.entityUrl} target="_blank" rel="noreferrer">{copy.reopenAction}</a>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
