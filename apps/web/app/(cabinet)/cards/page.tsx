"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CabinetPanel } from "../_components";
import { CabinetIcon } from "../_icons";
import { getDictionary } from "../../_content/i18n";
import {
  getCardSession,
  getDueSummary,
  type CardSession,
  type DueSummary,
} from "../../_api/cards";

type SummaryState = "loading" | "loaded" | "error";

export default function CardsPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.cards;
  const overview = page.overview;

  // Live numbers from GET /me/cards/due-summary (un-capped, unlike the
  // review-session endpoint). An outage is explicit: never present demo
  // records as if they belonged to the signed-in user.
  const [live, setLive] = useState<DueSummary | null>(null);
  const [practiceSession, setPracticeSession] = useState<CardSession | null>(null);
  const [summaryState, setSummaryState] = useState<SummaryState>("loading");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setSummaryState("loading");
    Promise.all([
      getDueSummary(controller.signal),
      getCardSession({ scope: "practice" }, controller.signal),
    ])
      .then(([summary, practice]) => {
        setLive(summary);
        setPracticeSession(practice);
        setSummaryState("loaded");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLive(null);
          setPracticeSession(null);
          setSummaryState("error");
        }
      });
    return () => controller.abort();
  }, [reloadVersion]);

  const dueCount = live ? String(live.totalDue) : "—";
  const estimatedTime = live ? `~${live.estimatedMinutes} ${overview.minuteUnit}` : "—";
  const practiceCount = practiceSession ? String(practiceSession.cards.length) : "—";
  const practiceTime = practiceSession
    ? `~${practiceSession.estimatedMinutes} ${overview.minuteUnit}`
    : "—";
  // Не показываем «start session», пока карточек нет (0 или ещё не загрузились):
  // сессия по пустой очереди бессмысленна.
  const hasDue = live !== null && live.totalDue > 0;
  const hasPractice = practiceSession !== null && practiceSession.cards.length > 0;
  const practiceRemaining = practiceSession
    ? practiceSession.cards.filter((card) => card.reviewState.attempts === 0).length
    : 0;
  const isPracticeCompleted = hasPractice && practiceRemaining === 0;
  const practiceSources = practiceSession
    ? [...new Set(practiceSession.cards.map((card) => card.sourceLabel))].slice(0, 3)
    : [];

  const mix = overview.types.map(([key, label]) => {
    if (live) {
      const entry = live.byType.find((item) => item.type === key);
      const count = entry?.count ?? 0;
      const shown = entry?.sampleLabels.map((source) => source.split(" · ")[0]) ?? [];
      const hidden = count - shown.length;
      const sources = hidden > 0 ? [...shown, `+${hidden}`].join(", ") : shown.join(", ");
      return { label, count, sources };
    }
    return {
      label,
      count: "—",
      sources: summaryState === "loading" ? page.session.loading : "",
    };
  });

  return (
    <main className="cabinet-page cards-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <div className="cabinet-page-head__actions">
          <span className="cabinet-next-hint">
            <em>{dueCount}</em> {overview.todayShort} · <em>{practiceCount}</em> {overview.practiceShort}
          </span>
        </div>
      </section>

      {summaryState === "error" ? (
        <div className="cards-summary-error" role="alert">
          <span>{page.session.sessionError}</span>
          <button type="button" onClick={() => setReloadVersion((version) => version + 1)}>
            {page.session.retry}
          </button>
        </div>
      ) : null}

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="cards-mode-grid">
          <article className="cards-mode-card cards-mode-card--due">
            <span className="cards-mode-card__eyebrow">{overview.dueModeEyebrow}</span>
            <div className="cards-mode-card__count" aria-live="polite">
              <strong>{dueCount}</strong>
              <span>{overview.cardUnit}</span>
            </div>
            <h2>{overview.readyTitle}</h2>
            <p>{overview.readyDescription}</p>
            <div className="cards-mode-card__meta">
              <span>{estimatedTime}</span>
            </div>
            {hasDue ? (
              <Link className="cabinet-cta" href="/cards/session">
                {overview.start}
                <CabinetIcon name="arrow" />
              </Link>
            ) : (
              <span className="cards-mode-card__empty">{overview.dueEmpty}</span>
            )}
          </article>

          <article className="cards-mode-card cards-mode-card--practice" id="practice">
            <span className="cards-mode-card__eyebrow">{overview.practiceModeEyebrow}</span>
            <div className="cards-mode-card__count" aria-live="polite">
              <strong>{practiceCount}</strong>
              <span>{overview.cardUnit}</span>
            </div>
            <h2>{overview.practiceTitle}</h2>
            <p>{overview.practiceDescription}</p>
            {isPracticeCompleted ? (
              <div className="cards-mode-card__sources">{overview.practiceCompleted}</div>
            ) : practiceSources.length > 0 ? (
              <div className="cards-mode-card__sources">{practiceSources.join(" · ")}</div>
            ) : null}
            {hasPractice ? (
              <Link
                className="cabinet-cta"
                href={isPracticeCompleted ? "/cards/session?scope=practice&restart=1" : "/cards/session?scope=practice"}
              >
                {isPracticeCompleted ? overview.restartPractice : overview.startPractice}
                <CabinetIcon name="arrow" />
              </Link>
            ) : (
              <div className="cards-mode-card__empty-actions">
                <span className="cards-mode-card__empty">{overview.practiceEmpty}</span>
                <Link className="cabinet-ghost-link" href="/patterns">
                  {overview.addPractice}
                </Link>
              </div>
            )}
          </article>
        </div>
      </CabinetPanel>

      <CabinetPanel eyebrow={overview.mixEyebrow} title={overview.mixTitle}>
        <div className="cards-mix">
          {mix.map((group) => (
            <article className="cards-mix__type" key={group.label}>
              <div className="cards-mix__count">
                <strong>{group.count}</strong>
                <span>{overview.cardUnit}</span>
              </div>
              <strong className="cards-mix__label">{group.label}</strong>
              <p>{group.sources}</p>
            </article>
          ))}
        </div>
      </CabinetPanel>

      <CabinetPanel eyebrow={overview.methodEyebrow} title={overview.methodTitle}>
        <div className="cards-method">
          {overview.methodSteps.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </CabinetPanel>
    </main>
  );
}
