import type { AssistantTask, Platform } from "../lib/types";
import type { TaskInfo } from "./types";

type AssistantPlatform = Exclude<Platform, "unknown">;

export function supportsAssistant(platform: Platform): platform is AssistantPlatform {
  return (
    platform === "leetcode" ||
    platform === "hackerrank" ||
    platform === "geeksforgeeks"
  );
}

export function buildAssistantTask(
  platform: Platform,
  info: TaskInfo
): AssistantTask | null {
  if (!supportsAssistant(platform)) return null;
  const slug = info.platformTaskSlug?.trim();
  if (!slug) return null;
  return {
    platform,
    taskTitle: info.taskTitle,
    taskUrl: info.taskUrl,
    platformTaskSlug: slug,
    tags: info.tags,
    difficulty: info.difficulty,
    taskDescription: info.taskDescription,
  };
}

/** GFG keeps Compile & Run / Submit in the editor footer; stay above it. */
export function assistantHostPosition(platform: AssistantPlatform): string {
  const bottom = platform === "geeksforgeeks" ? 88 : 18;
  if (platform === "hackerrank") return `left: 16px; bottom: ${bottom}px;`;
  return `right: 16px; bottom: ${bottom}px;`;
}

/** Finds the semantic Run Code control without generated CSS class names. */
export function findHackerRankRunButton(root: Document = document): HTMLElement | null {
  return findHackerRankActionButton("run code", root);
}

function findHackerRankActionButton(
  label: string,
  root: Document = document
): HTMLElement | null {
  for (const element of root.querySelectorAll<HTMLElement>("button, [role='button']")) {
    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (text === label) return element;
  }
  return null;
}

/** Inserts the launcher before HackerRank's Run/Submit primary action group. */
export function mountHackerRankLauncher(
  host: HTMLElement,
  root: Document = document
): boolean {
  const runButton = findHackerRankRunButton(root);
  if (!runButton) return false;
  const submitButton = findHackerRankActionButton("submit code", root);
  const common = submitButton ? lowestCommonAncestor(runButton, submitButton) : null;

  const commonContainsSecondaryActions = common
    ? [...common.querySelectorAll<HTMLElement>("button, [role='button']")].some((element) => {
        const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
        return text === "upload code as file" || text.includes("custom input");
      })
    : false;
  const canMountBeforeGroup =
    common &&
    !commonContainsSecondaryActions &&
    common.parentElement &&
    common.parentElement !== root.body;
  const anchor = canMountBeforeGroup ? common : runButton;
  const actions = anchor.parentElement;
  if (!actions) return false;
  if (host.parentElement !== actions || host.nextElementSibling !== anchor) {
    actions.insertBefore(host, anchor);
  }
  return true;
}

function lowestCommonAncestor(first: HTMLElement, second: HTMLElement): HTMLElement | null {
  let candidate: HTMLElement | null = first;
  while (candidate) {
    if (candidate.contains(second)) return candidate;
    candidate = candidate.parentElement;
  }
  return null;
}
