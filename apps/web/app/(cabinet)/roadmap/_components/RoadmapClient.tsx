"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  activateRoadmap,
  deleteRoadmap,
  getRoadmap,
  getRoadmaps,
  previewRoadmap,
  saveRoadmap,
  type RoadmapPriorityMode,
  type RoadmapResponse,
  type RoadmapSummary,
  type RoadmapTask,
  type RoadmapWeek,
} from "../../../_api/roadmap";
import { ApiError } from "../../../_api/types";
import { clearRoadmap, readRoadmap } from "../../../_profile/roadmapGenerator";
import { CabinetPanel, ProgressBar } from "../../_components";
import { CabinetIcon } from "../../_icons";
import { RoadmapTaskDialog, type RoadmapTaskDialogCopy } from "./RoadmapTaskDialog";

type LoadState = "loading" | "loaded" | "error";

type RoadmapCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  panelEyebrow: string;
  panelTitle: string;
  overallLabel: string;
  nowLabel: string;
  statusDone: string;
  statusActive: string;
  statusTodo: string;
  practiceEyebrow: string;
  practiceCta: string;
  practiceAction: string;
  lockedEyebrow: string;
  lockedTitle: string;
  aheadEyebrow: string;
  aheadTitle: string;
  aheadDescription: string;
  aheadAction: string;
  currentPlanEyebrow: string;
  currentPlanTitle: string;
  aheadPlanTitle: string;
  currentPlanDescription: string;
  paceAhead: string;
  paceOnTrack: string;
  paceBehind: string;
  weekDoneTitle: string;
  learnAction: string;
  tasksTitle: string;
  taskOpenAction: string;
  taskReopenAction: string;
  taskAssignedHint: string;
  taskInProgressHint: string;
  taskUnavailableHint: string;
  taskUnavailableAction: string;
  unavailableLabel: string;
  cardsTitle: string;
  solveAction: string;
  reviewCardsAction: string;
  completedLabel: string;
  remainingLabel: string;
  masteryLabel: string;
  scheduledLabel: string;
  nextStepLabel: string;
  stagesLabel: string;
  stageTheory: string;
  stageTasks: string;
  stageCards: string;
  stageCurrent: string;
  stageQueued: string;
  stageDone: string;
  currentPattern: string;
  queuedPattern: string;
  theoryDescription: string;
  tasksDescription: string;
  cardsDescription: string;
  reinforcementTitle: string;
  reinforcementDue: string;
  reinforcementScheduled: string;
  reinforcementNone: string;
  nextReviewPrefix: string;
  rateTasksAction: string;
  patternComplete: string;
  plansLabel: string;
  switchingPlan: string;
  taskDialog: RoadmapTaskDialogCopy;
  difficultyLabels: Readonly<Record<string, string>>;
  reviewEyebrow?: string;
  reviewTitle?: string;
  empty: string;
  loading: string;
  errorTitle: string;
  retry: string;
  personalizedDescription?: string;
  personalizedPanelTitle?: string;
  personalizedHintCompany?: string;
  personalizedHintWeeks?: string;
  emptyStateDescription?: string;
  emptyStateAction?: string;
  deleteRoadmap?: string;
  deleteRoadmapPending?: string;
  priorityTitle?: string;
  priorityChangeLater?: string;
  priorityPreview?: string;
  priorityApply?: string;
  priorityCancel?: string;
  priorityPending?: string;
  reserveLabel?: string;
  selectedLabel?: string;
  coreLabel?: string;
  modes?: Record<RoadmapPriorityMode, { title: string; description: string }>;
}>;

const fallbackModes: Record<RoadmapPriorityMode, { title: string; description: string }> = {
  balanced: {
    title: "Оптимально",
    description: "Частота компании, твои пробелы и плавное усложнение.",
  },
  easy_first: {
    title: "Легче → сложнее",
    description: "Сначала темы с большей долей easy-задач.",
  },
  company_frequency: {
    title: "Чаще спрашивают",
    description: "Сначала темы с максимальным числом задач компании.",
  },
  knowledge_gaps: {
    title: "Закрыть пробелы",
    description: "Сначала темы с минимальной текущей уверенностью.",
  },
};

function interviewCountdown(interviewDate: string | null): string | null {
  if (!interviewDate) return null;
  const date = new Date(`${interviewDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  return days < 0 ? null : `interview T−${days}d`;
}

function configFrom(data: RoadmapResponse, mode: RoadmapPriorityMode, preserveProgress: boolean) {
  return {
    companyCode: data.target.company?.code ?? "",
    companyName: data.target.company?.name ?? "",
    interviewDate: data.target.interviewDate,
    priorityMode: mode,
    preserveProgress,
  };
}

function taskIsComplete(status: string) {
  return status === "solved" || status === "reviewing";
}

function taskIsUnavailable(task: RoadmapTask) {
  return task.accessStatus === "unavailable" || task.status === "unavailable";
}

function planProgress(item: RoadmapWeek["items"][number]) {
  return Number.isFinite(item.planProgress) ? item.planProgress : item.masteryPercent;
}

const roadmapDateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

function formatRoadmapDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : roadmapDateFormatter.format(date);
}

function withRoadmapContext(href: string): string {
  if (!href.startsWith("/patterns/") || href.includes("from=")) return href;
  return `${href}${href.includes("?") ? "&" : "?"}from=roadmap`;
}

function weekDateRange(generatedAt: string | undefined, weekIndex: number) {
  if (!generatedAt) return null;
  const start = new Date(generatedAt);
  if (Number.isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + weekIndex * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${roadmapDateFormatter.format(start)} — ${roadmapDateFormatter.format(end)}`;
}

function scheduledWeekIndex(generatedAt: string | undefined, weekCount: number) {
  if (!generatedAt || weekCount === 0) return 0;
  const generated = new Date(generatedAt);
  if (Number.isNaN(generated.getTime())) return 0;
  const elapsed = Math.max(0, Date.now() - generated.getTime());
  return Math.min(weekCount - 1, Math.floor(elapsed / (7 * 86_400_000)));
}

export function RoadmapClient({ copy }: Readonly<{ copy: RoadmapCopy }>) {
  const [data, setData] = useState<RoadmapResponse | null>(null);
  const [draft, setDraft] = useState<RoadmapResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [modePending, setModePending] = useState(false);
  const [plans, setPlans] = useState<RoadmapSummary[]>([]);
  const [switchingPlan, setSwitchingPlan] = useState(false);
  const [activeTask, setActiveTask] = useState<{ task: RoadmapTask; patternCode: string } | null>(null);
  const migrationAttempted = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    setError("");

    getRoadmap(controller.signal)
      .then(async (response) => {
        if (response.configured || migrationAttempted.current) return response;
        migrationAttempted.current = true;
        const legacy = readRoadmap();
        const companyName = legacy?.targetCompany || response.target.company?.name || "";
        const companyCode =
          legacy?.targetCompanyCode?.trim() || response.target.company?.code || "";
        if (!legacy && !companyName && !response.target.interviewDate) return response;
        const migrated = await saveRoadmap(
          {
            companyCode,
            companyName,
            interviewDate: response.target.interviewDate,
            priorityMode: "balanced",
            preserveProgress: false,
          },
          controller.signal,
        );
        clearRoadmap();
        return migrated;
      })
      .then((response) => {
        if (controller.signal.aborted) return;
        setData(response);
        setDraft(null);
        setLoadState("loaded");
        void getRoadmaps(controller.signal).then((items) => {
          if (!controller.signal.aborted) setPlans(items);
        }).catch(() => {
          if (!controller.signal.aborted) setPlans([]);
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(reason instanceof ApiError ? reason.message : copy.errorTitle);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [copy.errorTitle, reloadVersion]);

  const handleMode = async (mode: RoadmapPriorityMode) => {
    if (!data || modePending) return;
    if (mode === data.priorityMode) {
      setDraft(null);
      return;
    }
    setModePending(true);
    setError("");
    try {
      const preview = await previewRoadmap(configFrom(data, mode, true));
      setDraft({ ...preview, configured: data.configured });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : copy.errorTitle);
    } finally {
      setModePending(false);
    }
  };

  const applyDraft = async () => {
    if (!data || !draft || modePending) return;
    setModePending(true);
    setError("");
    try {
      const saved = await saveRoadmap(configFrom(data, draft.priorityMode, true));
      setData(saved);
      setDraft(null);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : copy.errorTitle);
    } finally {
      setModePending(false);
    }
  };

  const handleDeleteRoadmap = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteRoadmap();
      clearRoadmap();
      setData(null);
      setDraft(null);
      migrationAttempted.current = true;
      setReloadVersion((version) => version + 1);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : copy.errorTitle);
    } finally {
      setDeleting(false);
    }
  };

  const handlePlanSwitch = async (planKey: string) => {
    if (switchingPlan || planKey === shown?.planKey) return;
    setSwitchingPlan(true);
    setError("");
    try {
      const response = await activateRoadmap(planKey);
      setData(response);
      setDraft(null);
      setPlans(await getRoadmaps());
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : copy.errorTitle);
    } finally {
      setSwitchingPlan(false);
    }
  };

  const refreshAfterAttempt = async () => {
    try {
      const response = await getRoadmap();
      setData(response);
      setDraft(null);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : copy.errorTitle);
    }
  };

  const refreshTask = async (problemId: number): Promise<RoadmapTask | null> => {
    try {
      const response = await getRoadmap();
      setData(response);
      setDraft(null);
      return response.weeks
        .flatMap((week) => week.items)
        .flatMap((item) => item.tasks)
        .find((task) => task.id === problemId) ?? null;
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : copy.errorTitle);
      return null;
    }
  };

  const shown = draft ?? data;
  const modes = copy.modes ?? fallbackModes;
  const statuses: Record<string, string> = {
    done: copy.statusDone,
    active: copy.statusActive,
    todo: copy.statusTodo,
  };
  const weeks = shown?.weeks ?? [];
  const isWeekLocked = (index: number) =>
    weeks.slice(0, index).some((previousWeek) => previousWeek.status !== "done");
  const firstActive = weeks.findIndex(
    (week, index) => week.status === "active" && !isWeekLocked(index),
  );
  const currentWeekIndex = firstActive >= 0 ? firstActive : Math.max(0, weeks.length - 1);
  const currentWeek = weeks[currentWeekIndex];
  const expectedWeekIndex = scheduledWeekIndex(shown?.generatedAt, weeks.length);
  const paceState =
    currentWeekIndex > expectedWeekIndex
      ? "ahead"
      : currentWeekIndex < expectedWeekIndex
        ? "behind"
        : "track";
  const pace = paceState === "ahead"
    ? copy.paceAhead
    : paceState === "behind"
      ? copy.paceBehind
      : copy.paceOnTrack;
  const planTitle = paceState === "ahead" ? copy.aheadPlanTitle : copy.currentPlanTitle;
  const currentRange = weekDateRange(shown?.generatedAt, currentWeekIndex);
  const nextAction = shown?.nextAction;
  const nextTask = nextAction?.stage === "tasks"
    ? currentWeek?.items
      .flatMap((item) => item.tasks.map((task) => ({ task, patternCode: item.code })))
      .find(({ task }) => task.url === nextAction.href || task.title === nextAction.title)
    : undefined;
  const countdown = interviewCountdown(shown?.target.interviewDate ?? null);

  const renderScheduleWeek = (week: RoadmapWeek, index: number) => {
    const stateName = week.status in statuses ? week.status : "todo";
    const locked = isWeekLocked(index);
    const visibleProgress = locked ? 0 : week.progress;
    const isCurrent = index === currentWeekIndex;
    return (
      <li
        className={`roadmap-step roadmap-step--${stateName}${isCurrent ? " roadmap-step--current" : ""}`}
        id={week.id}
        key={week.id}
      >
        <div className="roadmap-step__rail">
          <span className="roadmap-step__node">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <div className={`roadmap-step__body${isCurrent ? " roadmap-step__body--current" : ""}`}>
          <div className="roadmap-step__main">
            <div className="roadmap-step__head">
              <span className="roadmap-step__week">{week.label}</span>
              <span className="roadmap-step__state">{statuses[stateName]}</span>
              {index === firstActive ? (
                <span className="roadmap-step__now">{copy.nowLabel}</span>
              ) : null}
            </div>
            <h3>{week.title}</h3>
            <div className="roadmap-step__progress">
              <ProgressBar value={visibleProgress} label={`${week.title} progress`} />
              <strong>{visibleProgress}%</strong>
            </div>
          </div>
          {!isCurrent ? (
            <span className={`roadmap-step__summary${locked ? " is-locked" : ""}`}>
              {locked ? copy.lockedTitle : stateName === "done" ? copy.weekDoneTitle : statuses[stateName]}
            </span>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{shown?.configured ? copy.personalizedDescription ?? copy.description : copy.description}</p>
        </div>
        {shown?.configured ? (
          <div className="cabinet-page-head__actions">
            {shown.target.company ? (
              <span className="cabinet-next-hint">
                {copy.personalizedHintCompany ?? "фокус"} · <em>{shown.target.company.name}</em>
              </span>
            ) : (
              <span className="cabinet-next-hint"><em>{copy.coreLabel ?? "core plan"}</em></span>
            )}
            {countdown ? <span className="cabinet-next-hint">{countdown}</span> : null}
            <span className="cabinet-next-hint"><em>{shown.horizonWeeks}</em> {copy.personalizedHintWeeks ?? "недель"}</span>
            <span className="cabinet-next-hint"><em>{shown.overallProgress}%</em> {copy.overallLabel}</span>
            <button
              className="cabinet-next-hint cabinet-next-hint--action"
              type="button"
              disabled={deleting}
              onClick={() => void handleDeleteRoadmap()}
            >
              {deleting ? copy.deleteRoadmapPending ?? "удаляем…" : copy.deleteRoadmap ?? "удалить roadmap"}
            </button>
          </div>
        ) : null}
      </section>

      {error && loadState !== "error" ? <div className="cabinet-banner" role="alert">{error}</div> : null}

      {loadState === "loaded" && shown && !shown.configured ? (
        <div className="cabinet-banner" role="status">
          <span>{copy.emptyStateDescription ?? copy.empty}</span>
          <Link className="cabinet-ghost-link" href="/onboarding/profile?force=1">
            {copy.emptyStateAction ?? "построить roadmap"}
            <CabinetIcon name="arrow" />
          </Link>
        </div>
      ) : null}

      {loadState === "loading" ? (
        <CabinetPanel title={copy.loading} padded>
          <p role="status" aria-live="polite">{copy.loading}</p>
        </CabinetPanel>
      ) : null}

      {loadState === "error" ? (
        <CabinetPanel title={copy.errorTitle} padded>
          <p role="alert">{error || copy.errorTitle}</p>
          <button className="review-action review-action--ghost" type="button" onClick={() => setReloadVersion((version) => version + 1)}>
            {copy.retry}
          </button>
        </CabinetPanel>
      ) : null}

      {loadState === "loaded" && shown?.configured ? (
        <>
          <div className="roadmap-flow">
            {plans.length > 1 ? (
              <nav className="roadmap-plan-switcher" aria-label={copy.plansLabel}>
                <span>{copy.plansLabel}</span>
                <div>
                  {plans.map((plan) => (
                    <button
                      className={plan.active ? "is-active" : ""}
                      disabled={switchingPlan}
                      key={plan.planKey}
                      type="button"
                      onClick={() => void handlePlanSwitch(plan.planKey)}
                    >
                      {plan.company?.name || "Core"}
                    </button>
                  ))}
                </div>
                {switchingPlan ? <small>{copy.switchingPlan}</small> : null}
              </nav>
            ) : null}

            <CabinetPanel
              eyebrow={copy.panelEyebrow}
              title={copy.personalizedPanelTitle ?? copy.panelTitle}
              meta={<span className="cabinet-panel__meta">{shown.overallProgress}% {copy.overallLabel}</span>}
            >
              <ol className="roadmap-track">{weeks.map(renderScheduleWeek)}</ol>
            </CabinetPanel>

            {currentWeek && !draft ? (
            <section className="roadmap-current-plan" id="current-plan" aria-labelledby="current-plan-title">
              <header className="roadmap-current-plan__head">
                <div>
                  <span className="cabinet-eyebrow">{copy.currentPlanEyebrow} · {currentWeek.label}</span>
                  <h2 id="current-plan-title">{planTitle}</h2>
                  <p>{copy.currentPlanDescription}</p>
                </div>
                <div className={`roadmap-pace roadmap-pace--${paceState}`}>
                  <strong>{pace}</strong>
                  {currentRange ? <span>{copy.scheduledLabel} · {currentRange}</span> : null}
                </div>
              </header>

              <div className="roadmap-current-plan__next">
                <div>
                  <span>{copy.nextStepLabel}</span>
                  <strong>{nextAction?.title ?? copy.weekDoneTitle}</strong>
                  <small>{nextAction?.description ?? copy.aheadDescription}</small>
                </div>
                {nextAction ? (
                  nextAction.href.startsWith("http") ? (
                    <button
                      className="cabinet-cta"
                      type="button"
                      disabled={!nextTask}
                      onClick={() => nextTask && setActiveTask(nextTask)}
                    >
                      {copy.solveAction}
                      <CabinetIcon name="arrow" />
                    </button>
                  ) : (
                    <Link className="cabinet-cta" href={withRoadmapContext(nextAction.href)}>
                      {nextAction.stage === "theory"
                        ? copy.learnAction
                        : nextAction.stage === "cards"
                          ? copy.reviewCardsAction
                          : copy.solveAction}
                      <CabinetIcon name="arrow" />
                    </Link>
                  )
                ) : null}
              </div>

              <div className="roadmap-current-plan__items">
                {currentWeek.items.map((item, itemIndex) => {
                  const isCurrentPattern = item.code === nextAction?.patternCode;
                  const tasks = item.tasks ?? [];
                  const completedTasks = tasks.filter((task) => taskIsComplete(task.status)).length;
                  const unavailableTasks = tasks.filter(taskIsUnavailable).length;
                  const settledTasks = completedTasks + unavailableTasks;
                  const cards = item.cardProgress ?? { total: 0, reviewed: 0, due: 0 };
                  const stages = [
                    { key: "theory", label: copy.stageTheory, done: item.theory?.completed ?? false },
                    { key: "tasks", label: copy.stageTasks, done: tasks.length === 0 || settledTasks >= tasks.length },
                    { key: "cards", label: copy.stageCards, done: cards.total === 0 || cards.reviewed >= cards.total },
                  ];
                  const nextReview = formatRoadmapDate(item.reinforcement?.nextReviewAt);
                  return (
                    <article
                      className={`roadmap-plan-item roadmap-plan-item--${item.stage}${isCurrentPattern ? " is-current" : ""}`}
                      key={item.code}
                    >
                      <div className="roadmap-plan-item__head">
                        <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                        <div>
                          <h3>{item.name}</h3>
                          <p>{copy.masteryLabel} · {item.masteryPercent}%</p>
                        </div>
                        <div className="roadmap-plan-item__status">
                          <strong>{planProgress(item)}%</strong>
                          {item.stage !== "complete" ? (
                            <small>{isCurrentPattern ? copy.currentPattern : copy.queuedPattern}</small>
                          ) : null}
                        </div>
                      </div>
                      <div className="roadmap-stage-track" aria-label={`${copy.stagesLabel}: ${item.name}`}>
                        {stages.map((stage, stageIndex) => {
                          const currentStage = item.stage === stage.key;
                          const active = isCurrentPattern && currentStage;
                          return (
                            <div className={stage.done ? "is-done" : active ? "is-active" : currentStage ? "is-queued" : ""} key={stage.key}>
                              <span>{stage.done ? "✓" : stageIndex + 1}</span>
                              <strong>{stage.label}</strong>
                              <small>{stage.done ? copy.stageDone : active ? copy.stageCurrent : currentStage ? copy.stageQueued : ""}</small>
                            </div>
                          );
                        })}
                      </div>
                      {item.stage === "theory" && isCurrentPattern ? (
                        <div className="roadmap-plan-item__stage-action">
                          <p>{copy.theoryDescription}</p>
                          <Link className="cabinet-cta" href={`/patterns/${encodeURIComponent(item.code)}?from=roadmap`}>
                            {copy.learnAction}
                            <CabinetIcon name="arrow" />
                          </Link>
                        </div>
                      ) : null}
                      <div className="roadmap-plan-item__group">
                        <div className="roadmap-plan-item__group-head">
                          <strong>{copy.tasksTitle}</strong>
                          <span>{completedTasks}/{tasks.length} {copy.completedLabel}{unavailableTasks > 0 ? ` · ${unavailableTasks} ${copy.unavailableLabel}` : ""}</span>
                        </div>
                        {tasks.length > 0 ? (
                          <ul>
                            {tasks.map((task) => {
                              const complete = taskIsComplete(task.status);
                              const unavailable = taskIsUnavailable(task);
                              const taskReview = formatRoadmapDate(task.nextReviewAt);
                              return (
                                <li className={complete ? "is-complete" : unavailable ? "is-unavailable" : ""} key={task.id}>
                                  <button
                                    className="roadmap-task-card"
                                    type="button"
                                    onClick={() => setActiveTask({ task, patternCode: item.code })}
                                  >
                                    <span className="roadmap-task-card__state" aria-hidden="true">{complete ? "✓" : unavailable ? "—" : "○"}</span>
                                    <span className="roadmap-task-card__copy">
                                      <strong>{task.title}</strong>
                                      <small>
                                        {unavailable
                                          ? copy.taskUnavailableHint
                                          : complete && taskReview
                                          ? `${copy.nextReviewPrefix} ${taskReview}`
                                          : complete && !task.lastRating
                                            ? copy.rateTasksAction
                                          : complete
                                              ? copy.taskReopenAction
                                              : task.status === "in_progress"
                                                ? copy.taskInProgressHint
                                                : copy.taskAssignedHint}
                                      </small>
                                    </span>
                                    <em>{copy.difficultyLabels?.[task.difficulty] ?? task.difficulty}</em>
                                    <span className="roadmap-task-card__action">
                                      {unavailable ? copy.taskUnavailableAction : complete ? copy.taskReopenAction : copy.taskOpenAction}
                                      <CabinetIcon name="arrow" />
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p>{copy.remainingLabel}</p>
                        )}
                        {item.stage === "tasks" ? <p>{copy.tasksDescription}</p> : null}
                      </div>
                      <div className="roadmap-plan-item__cards">
                        <div>
                          <strong>{copy.cardsTitle}</strong>
                          <span>{cards.reviewed}/{cards.total} {copy.completedLabel}{cards.due > 0 ? ` · ${cards.due} ${copy.remainingLabel}` : ""}</span>
                        </div>
                        {item.stage === "cards" && cards.total > 0 && cards.reviewed < cards.total ? (
                          <Link href={`/patterns/${encodeURIComponent(item.code)}/session?from=roadmap`}>
                            {copy.reviewCardsAction}
                          </Link>
                        ) : null}
                      </div>
                      {item.stage === "cards" ? <p className="roadmap-plan-item__stage-note">{copy.cardsDescription}</p> : null}
                      {item.stage === "complete" ? (
                        <div className="roadmap-pattern-complete">
                          <strong>{copy.patternComplete}</strong>
                          <small>{copy.reinforcementTitle}</small>
                          <span>
                            {item.reinforcement?.due > 0
                              ? `${item.reinforcement.due} ${copy.reinforcementDue}`
                              : nextReview
                                ? `${copy.reinforcementScheduled} ${nextReview}`
                                : copy.reinforcementNone}
                          </span>
                          {item.reinforcement?.due > 0 ? <Link href="/queue">{copy.reviewCardsAction}</Link> : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
            ) : null}

            <section className="roadmap-priority-panel" aria-label={copy.priorityTitle ?? "Настройка плана"}>
            <div className="roadmap-priority-panel__copy">
              <strong>{copy.priorityTitle ?? "Настройка плана"}</strong>
              <span>{copy.priorityChangeLater ?? "Можно перестроить будущие недели"}</span>
            </div>
            <div className="roadmap-priority-panel__modes">
              {shown.availableModes.map((mode) => (
                <button
                  aria-pressed={shown.priorityMode === mode}
                  className={shown.priorityMode === mode ? "selected" : ""}
                  disabled={modePending}
                  key={mode}
                  type="button"
                  title={modes[mode].description}
                  onClick={() => void handleMode(mode)}
                >
                  {modes[mode].title}
                </button>
              ))}
            </div>
            <div className="roadmap-priority-panel__stats">
              <span><em>{shown.selectedCount}</em> {copy.selectedLabel ?? "тем в плане"}</span>
              {shown.reserveCount > 0 ? <span><em>{shown.reserveCount}</em> {copy.reserveLabel ?? "в резерве"}</span> : null}
            </div>
            </section>

            {draft ? (
              <div className="roadmap-rebuild-banner" role="status">
                <span>{copy.priorityPreview ?? "Предпросмотр: завершённые и текущая недели сохранятся."}</span>
                <div>
                  <button type="button" disabled={modePending} onClick={() => setDraft(null)}>{copy.priorityCancel ?? "отмена"}</button>
                  <button type="button" disabled={modePending} onClick={() => void applyDraft()}>
                    {modePending ? copy.priorityPending ?? "сохраняем…" : copy.priorityApply ?? "перестроить будущие недели"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {activeTask ? (
            <RoadmapTaskDialog
              key={`${activeTask.patternCode}-${activeTask.task.id}`}
              task={activeTask.task}
              patternCode={activeTask.patternCode}
              difficultyLabel={copy.difficultyLabels?.[activeTask.task.difficulty] ?? activeTask.task.difficulty}
              copy={copy.taskDialog}
              onClose={() => setActiveTask(null)}
              onRecorded={refreshAfterAttempt}
              onRefreshTask={refreshTask}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}
