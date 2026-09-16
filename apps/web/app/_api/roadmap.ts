"use client";

import { apiFetch } from "./client";

export type RoadmapPriorityMode =
  | "balanced"
  | "easy_first"
  | "company_frequency"
  | "knowledge_gaps";

export type RoadmapTargetCompany = {
  code: string | null;
  name: string;
};

export type RoadmapTarget = {
  company: RoadmapTargetCompany | null;
  interviewDate: string | null;
  topics: string[];
};

export type RoadmapItem = {
  code: string;
  name: string;
  relevantProblemCount: number;
  difficultyCounts: Record<string, number>;
  masteryPercent: number;
  planProgress: number;
  stage: "theory" | "tasks" | "cards" | "complete";
  theory: {
    completed: boolean;
    completedAt?: string;
  };
  tasks: RoadmapTask[];
  cardProgress: {
    total: number;
    reviewed: number;
    due: number;
    reinforcement: number;
    nextReviewAt?: string;
  };
  reinforcement: {
    count: number;
    due: number;
    nextReviewAt?: string;
  };
};

export type RoadmapTask = {
  id: number;
  originalId?: number;
  title: string;
  url: string;
  difficulty: string;
  tier: string;
  status: string;
  accessStatus?: "replaced" | "unavailable";
  lastRating?: "hard" | "normal" | "easy";
  nextReviewAt?: string;
  reviewCount: number;
};

export type RoadmapTaskAccessAction = "replace" | "skip";

export type RoadmapTaskAccessResolution = {
  action: RoadmapTaskAccessAction;
  originalProblemId: number;
  replacementProblemId?: number;
};

export type RoadmapNextAction = {
  stage: "theory" | "tasks" | "cards";
  title: string;
  description: string;
  href: string;
  patternCode: string;
  weekId: string;
};

export type RoadmapWeek = {
  id: string;
  label: string;
  title: string;
  progress: number;
  focus: string;
  status: "done" | "active" | "todo" | string;
  topics: string[];
  items: RoadmapItem[];
};

export type RoadmapResponse = {
  planKey?: string;
  overallProgress: number;
  target: RoadmapTarget;
  priorityMode: RoadmapPriorityMode;
  availableModes: RoadmapPriorityMode[];
  algorithmVersion: number;
  source: "company" | "core";
  horizonWeeks: number;
  weeklyCapacity: number;
  selectedCount: number;
  reserveCount: number;
  configured: boolean;
  generatedAt?: string;
  nextAction?: RoadmapNextAction;
  weeks: RoadmapWeek[];
};

export type RoadmapSummary = {
  planKey: string;
  company: RoadmapTargetCompany | null;
  interviewDate: string | null;
  priorityMode: RoadmapPriorityMode;
  generatedAt?: string;
  active: boolean;
};

export type RoadmapConfig = {
  companyCode: string;
  companyName: string;
  interviewDate: string | null;
  priorityMode: RoadmapPriorityMode;
  preserveProgress?: boolean;
};

export function getRoadmap(signal?: AbortSignal) {
  return apiFetch<RoadmapResponse>("/me/roadmap", { signal });
}

export function getRoadmaps(signal?: AbortSignal) {
  return apiFetch<RoadmapSummary[]>("/me/roadmaps", { signal });
}

export function activateRoadmap(planKey: string, signal?: AbortSignal) {
  return apiFetch<RoadmapResponse>(`/me/roadmaps/${encodeURIComponent(planKey)}/activate`, {
    method: "PUT",
    signal,
  });
}

export function previewRoadmap(config: RoadmapConfig, signal?: AbortSignal) {
  return apiFetch<RoadmapResponse>("/me/roadmap/preview", {
    method: "POST",
    body: config,
    signal,
  });
}

export function saveRoadmap(config: RoadmapConfig, signal?: AbortSignal) {
  return apiFetch<RoadmapResponse>("/me/roadmap", {
    method: "PUT",
    body: config,
    signal,
  });
}

export function deleteRoadmap(signal?: AbortSignal) {
  return apiFetch<void>("/me/roadmap", { method: "DELETE", signal });
}

export function completeRoadmapTheory(code: string, signal?: AbortSignal) {
  return apiFetch<{ code: string; completedAt: string }>(
    `/me/roadmap/patterns/${encodeURIComponent(code)}/theory`,
    { method: "PUT", signal },
  );
}

export function resolveRoadmapTaskAccess(
  problemId: number,
  action: RoadmapTaskAccessAction,
  signal?: AbortSignal,
) {
  return apiFetch<RoadmapTaskAccessResolution>(
    `/me/roadmap/tasks/${encodeURIComponent(String(problemId))}/access`,
    { method: "POST", body: { action }, signal },
  );
}
