"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getReviewQueue,
  rateReview,
  type ReviewQueueItem,
  type ReviewRating,
} from "../../../_api/reviews";
import { ApiError } from "../../../_api/types";
import { CabinetIcon } from "../../_icons";
import { ReviewProblemRatingDialog, type ReviewProblemRatingDialogCopy } from "./ReviewProblemRatingDialog";

type QueueCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  panelEyebrow: string;
  panelTitle: string;
  loading: string;
  errorTitle: string;
  retry: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction: string;
  itemActions: Readonly<Record<"problem" | "card" | "pattern" | "fallback", string>>;
  itemTypes: Readonly<Record<"problem" | "card" | "pattern" | "fallback", string>>;
  difficultyLabels: Readonly<Record<string, string>>;
  taskDialog: ReviewProblemRatingDialogCopy;
  dueNow: string;
  attemptUnits: readonly [string, string, string];
}>;

function pluralRu(value: number, forms: readonly [string, string, string]): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

function itemType(item: ReviewQueueItem, copy: QueueCopy): string {
  if (item.entityType === "problem" || item.entityType === "card" || item.entityType === "pattern") {
    return copy.itemTypes[item.entityType];
  }
  return copy.itemTypes.fallback;
}

function localizeMeta(value: string, labels: Readonly<Record<string, string>>): string {
  return value.replace(/\b(easy|medium|hard)\b/gi, (match) => labels[match.toLowerCase()] ?? match);
}

function actionFor(item: ReviewQueueItem, copy: QueueCopy) {
  if (item.entityType === "card") {
    return { href: "/cards/session", label: copy.itemActions.card, external: false };
  }
  if (item.entityType === "pattern") {
    const href = item.patternCode
      ? `/patterns/${encodeURIComponent(item.patternCode)}/session`
      : "/cards/session";
    return { href, label: copy.itemActions.pattern, external: false };
  }
  if (item.entityUrl) {
    return { href: item.entityUrl, label: copy.itemActions.problem, external: true };
  }
  return { href: "/reviews", label: copy.itemActions.fallback, external: false };
}

export function ReviewQueueClient({ copy }: Readonly<{ copy: QueueCopy }>) {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [activeProblem, setActiveProblem] = useState<ReviewQueueItem | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setError("");
    getReviewQueue(controller.signal)
      .then((response) => {
        setItems(response.data);
        setState("loaded");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof ApiError ? reason.message : copy.errorTitle);
        setState("error");
      });
    return () => controller.abort();
  }, [copy.errorTitle, reloadVersion]);

  async function handleRate(item: ReviewQueueItem, rating: ReviewRating) {
    await rateReview(item.id, rating);
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  return (
    <main className="cabinet-page review-queue-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        {state === "loaded" ? (
          <span className="review-queue-count" aria-live="polite">
            {items.length}
          </span>
        ) : null}
      </section>

      {state === "loading" ? <p className="review-queue-state" role="status">{copy.loading}</p> : null}
      {state === "error" ? (
        <div className="review-queue-state" role="alert">
          <strong>{copy.errorTitle}</strong>
          <span>{error}</span>
          <button type="button" onClick={() => setReloadVersion((value) => value + 1)}>
            {copy.retry}
          </button>
        </div>
      ) : null}

      {state === "loaded" && items.length === 0 ? (
        <section className="review-queue-empty">
          <span className="cabinet-eyebrow">{copy.panelEyebrow}</span>
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyDescription}</p>
          <Link className="cabinet-cta" href="/roadmap">
            {copy.emptyAction}
            <CabinetIcon name="arrow" />
          </Link>
        </section>
      ) : null}

      {state === "loaded" && items.length > 0 ? (
        <section className="review-queue-list" aria-label={copy.panelTitle}>
          {items.map((item, index) => {
            const action = actionFor(item, copy);
            return (
              <article className="review-queue-card" key={item.id}>
                <div className="review-queue-card__number">{String(index + 1).padStart(2, "0")}</div>
                <div className="review-queue-card__main">
                  <div className="review-queue-card__meta">
                    <span>{itemType(item, copy)}</span>
                    <span>{copy.dueNow}</span>
                    {item.attempts > 0 ? (
                      <span>{item.attempts} {pluralRu(item.attempts, copy.attemptUnits)}</span>
                    ) : null}
                  </div>
                  <h2>{item.title}</h2>
                  {item.meta ? <p>{localizeMeta(item.meta, copy.difficultyLabels)}</p> : null}
                  <div className="review-queue-card__actions">
                    <a
                      className="cabinet-cta"
                      href={action.href}
                      rel={action.external ? "noreferrer" : undefined}
                      target={action.external ? "_blank" : undefined}
                      onClick={action.external ? () => setActiveProblem(item) : undefined}
                    >
                      {action.label}
                      <CabinetIcon name="arrow" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
          {error ? <p className="review-queue-inline-error" role="alert">{error}</p> : null}
        </section>
      ) : null}

      {activeProblem ? (
        <ReviewProblemRatingDialog
          item={activeProblem}
          meta={localizeMeta(activeProblem.meta, copy.difficultyLabels)}
          copy={copy.taskDialog}
          onClose={() => setActiveProblem(null)}
          onRate={(rating) => handleRate(activeProblem, rating)}
        />
      ) : null}
    </main>
  );
}
