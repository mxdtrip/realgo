"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  deleteRoadmap,
  getRoadmap,
  previewRoadmap,
  saveRoadmap,
  type RoadmapPriorityMode,
  type RoadmapResponse,
  type RoadmapWeek,
} from "../../../_api/roadmap";
import { ApiError } from "../../../_api/types";
import { clearRoadmap, readRoadmap } from "../../../_profile/roadmapGenerator";
import { CabinetPanel, ProgressBar } from "../../_components";
import { CabinetIcon } from "../../_icons";

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
  currentPlanDescription: string;
  paceAhead: string;
  paceOnTrack: string;
  paceBehind: string;
  weekPlanAction: string;
  weekDoneTitle: string;
  learnAction: string;
  tasksTitle: string;
  cardsTitle: string;
  solveAction: string;
  reviewCardsAction: string;
  completedLabel: string;
  remainingLabel: string;
  masteryLabel: string;
  scheduledLabel: string;
  nextStepLabel: string;
  difficultyLabels: Readonly<Record<string, string>>;
  reviewEyebrow?: string;
  reviewTitle?: string;
  empty: string;
  loading: string;
  errorTitle: string;
  retry: string;
  personalizedTitle?: string;
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

function planProgress(item: RoadmapWeek["items"][number]) {
  return Number.isFinite(item.planProgress) ? item.planProgress : item.masteryPercent;
}

const roadmapDateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

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
  const pace =
    currentWeekIndex > expectedWeekIndex
      ? copy.paceAhead
      : currentWeekIndex < expectedWeekIndex
        ? copy.paceBehind
        : copy.paceOnTrack;
  const currentRange = weekDateRange(shown?.generatedAt, currentWeekIndex);
  const nextTask = currentWeek?.items
    .flatMap((item) => (item.tasks ?? []).map((task) => ({ item, task })))
    .find(({ task }) => !taskIsComplete(task.status));
  const nextCardItem = currentWeek?.items.find(
    (item) => (item.cardProgress?.reviewed ?? 0) < (item.cardProgress?.total ?? 0),
  );
  const countdown = interviewCountdown(shown?.target.interviewDate ?? null);

  const renderWeek = (week: RoadmapWeek, index: number) => {
    const stateName = week.status in statuses ? week.status : "todo";
    const locked = isWeekLocked(index);
    const visibleProgress = locked ? 0 : week.progress;
    const hasTopics = week.topics.length > 0;
    return (
      <li className={`roadmap-step roadmap-step--${stateName}`} id={week.id} key={week.id}>
        <div className="roadmap-step__rail">
          <span className="roadmap-step__node">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <div className="roadmap-step__body">
          <div className="roadmap-step__main">
            <div className="roadmap-step__head">
              <span className="roadmap-step__week">{week.label}</span>
              <span className="roadmap-step__state">{statuses[stateName]}</span>
              {index === firstActive ? (
                <span className="roadmap-step__now">{copy.nowLabel}</span>
              ) : null}
            </div>
            <h2>{week.title}</h2>
            <p>{week.focus}</p>
            <div className="roadmap-step__progress">
              <ProgressBar value={visibleProgress} label={`${week.title} progress`} />
              <strong>{visibleProgress}%</strong>
            </div>
          </div>
          {locked ? (
            <div className="roadmap-step__practice-card roadmap-step__practice-card--locked">
              <span className="roadmap-step__practice-eyebrow">{copy.lockedEyebrow}</span>
              <strong>{copy.lockedTitle}</strong>
            </div>
          ) : stateName === "done" ? (
            <div className="roadmap-step__practice-card roadmap-step__practice-card--done">
              <span className="roadmap-step__practice-eyebrow">{copy.completedLabel}</span>
              <strong>{copy.weekDoneTitle}</strong>
            </div>
          ) : !hasTopics ? (
            <div className="roadmap-step__practice-card roadmap-step__practice-card--locked">
              <span className="roadmap-step__practice-eyebrow">{copy.reviewEyebrow ?? "review week"}</span>
              <strong>{copy.reviewTitle ?? "Повторение и mock interview"}</strong>
            </div>
          ) : (
            <Link className="roadmap-step__practice-card" href="#current-plan">
              <span className="roadmap-step__practice-eyebrow">{copy.practiceEyebrow}</span>
              <strong>{copy.weekPlanAction}</strong>
              <em>
                {copy.nextStepLabel}
                <CabinetIcon name="arrow" />
              </em>
            </Link>
          )}
        </div>
      </li>
    );
  };

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{copy.eyebrow}</span>
          <h1>{shown?.configured ? copy.personalizedTitle ?? copy.title : copy.title}</h1>
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
          {currentWeek && !draft ? (
            <section className="roadmap-current-plan" id="current-plan" aria-labelledby="current-plan-title">
              <header className="roadmap-current-plan__head">
                <div>
                  <span className="cabinet-eyebrow">{copy.currentPlanEyebrow} · {currentWeek.label}</span>
                  <h2 id="current-plan-title">{copy.currentPlanTitle}</h2>
                  <p>{copy.currentPlanDescription}</p>
                </div>
                <div className={`roadmap-pace roadmap-pace--${pace === copy.paceBehind ? "behind" : pace === copy.paceAhead ? "ahead" : "track"}`}>
                  <strong>{pace}</strong>
                  {currentRange ? <span>{copy.scheduledLabel} · {currentRange}</span> : null}
                </div>
              </header>

              <div className="roadmap-current-plan__next">
                <div>
                  <span>{copy.nextStepLabel}</span>
                  <strong>
                    {nextTask?.task.title ?? nextCardItem?.name ?? copy.weekDoneTitle}
                  </strong>
                  <small>
                    {nextTask
                      ? `${nextTask.item.name} · ${copy.tasksTitle}`
                      : nextCardItem
                        ? `${nextCardItem.cardProgress.reviewed}/${nextCardItem.cardProgress.total} · ${copy.cardsTitle}`
                        : copy.aheadDescription}
                  </small>
                </div>
                {nextTask ? (
                  <a className="cabinet-cta" href={nextTask.task.url} target="_blank" rel="noreferrer">
                    {copy.solveAction}
                    <CabinetIcon name="arrow" />
                  </a>
                ) : nextCardItem ? (
                  <Link className="cabinet-cta" href={`/patterns/${encodeURIComponent(nextCardItem.code)}/session`}>
                    {copy.reviewCardsAction}
                    <CabinetIcon name="arrow" />
                  </Link>
                ) : currentWeekIndex + 1 < weeks.length ? (
                  <Link className="cabinet-cta" href={`#${weeks[currentWeekIndex + 1].id}`}>
                    {copy.aheadAction}
                    <CabinetIcon name="arrow" />
                  </Link>
                ) : null}
              </div>

              <div className="roadmap-current-plan__items">
                {currentWeek.items.map((item, itemIndex) => {
                  const tasks = item.tasks ?? [];
                  const completedTasks = tasks.filter((task) => taskIsComplete(task.status)).length;
                  const cards = item.cardProgress ?? { total: 0, reviewed: 0, due: 0 };
                  return (
                    <article className="roadmap-plan-item" key={item.code}>
                      <div className="roadmap-plan-item__head">
                        <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                        <div>
                          <h3>{item.name}</h3>
                          <p>{copy.masteryLabel} · {item.masteryPercent}%</p>
                        </div>
                        <strong>{planProgress(item)}%</strong>
                      </div>
                      <Link className="roadmap-plan-item__learn" href={`/patterns/${encodeURIComponent(item.code)}`}>
                        {copy.learnAction}
                        <CabinetIcon name="arrow" />
                      </Link>
                      <div className="roadmap-plan-item__group">
                        <div className="roadmap-plan-item__group-head">
                          <strong>{copy.tasksTitle}</strong>
                          <span>{completedTasks}/{tasks.length} {copy.completedLabel}</span>
                        </div>
                        {tasks.length > 0 ? (
                          <ul>
                            {tasks.map((task) => {
                              const complete = taskIsComplete(task.status);
                              return (
                                <li className={complete ? "is-complete" : ""} key={task.id}>
                                  <span aria-hidden="true">{complete ? "✓" : "○"}</span>
                                  <a href={task.url} target="_blank" rel="noreferrer">{task.title}</a>
                                  <em>{copy.difficultyLabels?.[task.difficulty] ?? task.difficulty}</em>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p>{copy.remainingLabel}</p>
                        )}
                      </div>
                      <div className="roadmap-plan-item__cards">
                        <div>
                          <strong>{copy.cardsTitle}</strong>
                          <span>{cards.reviewed}/{cards.total} {copy.completedLabel}{cards.due > 0 ? ` · ${cards.due} ${copy.remainingLabel}` : ""}</span>
                        </div>
                        {cards.total > 0 && cards.reviewed < cards.total ? (
                          <Link href={`/patterns/${encodeURIComponent(item.code)}/session`}>
                            {copy.reviewCardsAction}
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="roadmap-priority-panel" aria-label={copy.priorityTitle ?? "Приоритет тем"}>
            <div className="roadmap-priority-panel__copy">
              <strong>{copy.priorityTitle ?? "Порядок тем"}</strong>
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

          <CabinetPanel
            eyebrow={copy.panelEyebrow}
            title={copy.personalizedPanelTitle ?? copy.panelTitle}
            meta={<span className="cabinet-panel__meta">{shown.overallProgress}% {copy.overallLabel}</span>}
          >
            <ol className="roadmap-track">{weeks.map(renderWeek)}</ol>
          </CabinetPanel>
        </>
      ) : null}
    </main>
  );
}
