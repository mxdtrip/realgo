"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  recordProblemAttempt,
  type ProblemAttemptOutcome,
} from "../../../_api/problems";
import {
  resolveRoadmapTaskAccess,
  type RoadmapTask,
  type RoadmapTaskAccessAction,
} from "../../../_api/roadmap";
import { ApiError } from "../../../_api/types";
import { CabinetIcon } from "../../_icons";

export type RoadmapTaskDialogCopy = Readonly<{
  title: string;
  description: string;
  openAction: string;
  reopenAction: string;
  rateEyebrow: string;
  rateTitle: string;
  rateDescription: string;
  ratings: Readonly<Record<"hard" | "normal" | "easy", Readonly<{ label: string; hint: string }>>>;
  notSolved: string;
  notSolvedHint: string;
  later: string;
  saving: string;
  solvedTitle: string;
  solvedDescription: string;
  unsolvedTitle: string;
  unsolvedDescription: string;
  noAccessAction: string;
  noAccessTitle: string;
  noAccessDescription: string;
  replaceTask: string;
  replaceTaskHint: string;
  skipTask: string;
  skipTaskHint: string;
  accessSaving: string;
  taskReplacedTitle: string;
  taskReplacedDescription: string;
  taskSkippedTitle: string;
  taskSkippedDescription: string;
  noReplacementError: string;
  backToPlan: string;
  backToTheory: string;
  close: string;
  error: string;
}>;

type Phase = "open" | "rating" | "access" | "saving" | "success" | "error";

export function RoadmapTaskDialog({
  task,
  patternCode,
  difficultyLabel,
  copy,
  onClose,
  onRecorded,
  onRefreshTask,
}: Readonly<{
  task: RoadmapTask;
  patternCode: string;
  difficultyLabel: string;
  copy: RoadmapTaskDialogCopy;
  onClose: () => void;
  onRecorded: () => Promise<void> | void;
  onRefreshTask: (problemId: number) => Promise<RoadmapTask | null>;
}>) {
  const [phase, setPhase] = useState<Phase>(task.accessStatus === "unavailable" ? "access" : "open");
  const [outcome, setOutcome] = useState<ProblemAttemptOutcome | null>(null);
  const [accessAction, setAccessAction] = useState<RoadmapTaskAccessAction | null>(null);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const openedAtRef = useRef(0);
  const checkingSyncRef = useRef(false);

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

  useEffect(() => {
    if (phase !== "rating") return;

    async function checkExtensionSync() {
      if (checkingSyncRef.current || Date.now() - openedAtRef.current < 500) return;
      checkingSyncRef.current = true;
      try {
        const refreshed = await onRefreshTask(task.id);
        if (
          refreshed &&
          refreshed.reviewCount > task.reviewCount &&
          refreshed.lastRating
        ) {
          setOutcome(refreshed.lastRating);
          setPhase("success");
        }
      } finally {
        checkingSyncRef.current = false;
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") void checkExtensionSync();
    }

    window.addEventListener("focus", checkExtensionSync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", checkExtensionSync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [onRefreshTask, phase, task.id, task.reviewCount]);

  async function save(nextOutcome: ProblemAttemptOutcome) {
    if (phase === "saving") return;
    setOutcome(nextOutcome);
    setPhase("saving");
    setError("");
    try {
      await recordProblemAttempt(task.id, nextOutcome);
      await onRecorded();
      setPhase("success");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : copy.error);
      setPhase("error");
    }
  }

  async function resolveAccess(nextAction: RoadmapTaskAccessAction) {
    if (phase === "saving") return;
    setAccessAction(nextAction);
    setPhase("saving");
    setError("");
    try {
      await resolveRoadmapTaskAccess(task.originalId || task.id, nextAction);
      await onRecorded();
      setPhase("success");
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.code === "NO_REPLACEMENT"
          ? copy.noReplacementError
          : reason instanceof ApiError
            ? reason.message
            : copy.error,
      );
      setPhase("access");
    }
  }

  const hasOpened = phase !== "open";
  const unsolved = outcome === "not_solved";
  const accessResolved = accessAction !== null && phase === "success";

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
        aria-labelledby="roadmap-task-dialog-title"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shell-dialog__head">
          <span>{phase === "open" ? copy.title : copy.rateEyebrow}</span>
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
          <span>{difficultyLabel}</span>
          <h2 id="roadmap-task-dialog-title">{task.title}</h2>
        </div>

        {phase === "open" ? (
          <>
            <p className="roadmap-task-dialog__description">{copy.description}</p>
            <a
              className="cabinet-cta roadmap-task-dialog__open"
              href={task.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                openedAtRef.current = Date.now();
                setPhase("rating");
              }}
            >
              {copy.openAction}
              <CabinetIcon name="arrow" />
            </a>
          </>
        ) : null}

        {phase === "rating" || (phase === "saving" && !accessAction) || phase === "error" ? (
          <section className="roadmap-task-dialog__rating" aria-labelledby="roadmap-task-rating-title">
            <h3 id="roadmap-task-rating-title">{copy.rateTitle}</h3>
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
              <button
                className="roadmap-task-rating roadmap-task-rating--unsolved"
                disabled={phase === "saving"}
                type="button"
                onClick={() => void save("not_solved")}
              >
                <strong>{copy.notSolved}</strong>
                <small>{copy.notSolvedHint}</small>
              </button>
            </div>
            {phase === "saving" ? <p className="roadmap-task-dialog__status" role="status">{copy.saving}</p> : null}
            {phase === "error" ? <p className="roadmap-task-dialog__error" role="alert">{error || copy.error}</p> : null}
          </section>
        ) : null}

        {phase === "access" || (phase === "saving" && accessAction) ? (
          <section className="roadmap-task-dialog__rating" aria-labelledby="roadmap-task-access-title">
            <h3 id="roadmap-task-access-title">{copy.noAccessTitle}</h3>
            <p>{copy.noAccessDescription}</p>
            <div className="roadmap-task-dialog__choices">
              <button
                className="roadmap-task-rating roadmap-task-rating--normal"
                disabled={phase === "saving"}
                type="button"
                onClick={() => void resolveAccess("replace")}
              >
                <strong>{copy.replaceTask}</strong>
                <small>{copy.replaceTaskHint}</small>
              </button>
              <button
                className="roadmap-task-rating roadmap-task-rating--unsolved"
                disabled={phase === "saving"}
                type="button"
                onClick={() => void resolveAccess("skip")}
              >
                <strong>{copy.skipTask}</strong>
                <small>{copy.skipTaskHint}</small>
              </button>
            </div>
            {phase === "saving" ? <p className="roadmap-task-dialog__status" role="status">{copy.accessSaving}</p> : null}
            {error ? <p className="roadmap-task-dialog__error" role="alert">{error}</p> : null}
          </section>
        ) : null}

        {phase === "success" ? (
          <section className={`roadmap-task-dialog__result${unsolved ? " is-unsolved" : ""}`}>
            <span aria-hidden="true">{unsolved ? "↻" : "✓"}</span>
            <div>
              <h3>{accessResolved ? accessAction === "replace" ? copy.taskReplacedTitle : copy.taskSkippedTitle : unsolved ? copy.unsolvedTitle : copy.solvedTitle}</h3>
              <p>{accessResolved ? accessAction === "replace" ? copy.taskReplacedDescription : copy.taskSkippedDescription : unsolved ? copy.unsolvedDescription : copy.solvedDescription}</p>
            </div>
          </section>
        ) : null}

        {hasOpened ? (
          <footer className="roadmap-task-dialog__footer">
            {phase === "success" && unsolved && !accessResolved ? (
              <Link href={`/patterns/${encodeURIComponent(patternCode)}?from=roadmap`} onClick={onClose}>
                {copy.backToTheory}
              </Link>
            ) : null}
            {phase === "success" && !unsolved ? (
              <button type="button" onClick={onClose}>{copy.backToPlan}</button>
            ) : null}
            {phase !== "success" ? (
              <button type="button" disabled={phase === "saving"} onClick={onClose}>{copy.later}</button>
            ) : null}
            {phase === "rating" || phase === "error" ? (
              <button type="button" onClick={() => { setAccessAction(null); setError(""); setPhase("access"); }}>
                {copy.noAccessAction}
              </button>
            ) : null}
            {phase !== "saving" ? (
              <a href={task.url} target="_blank" rel="noreferrer">{copy.reopenAction}</a>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
