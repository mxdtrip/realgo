import type { SubmitResult } from "../lib/types";
import {
  classifyVerdict,
  extractDescription,
  findButtonByText,
  findText,
  type PlatformAdapter,
  type TaskInfo,
} from "./types";

/** Adapter for GeeksForGeeks practice pages: /problems/<slug>/<resource>. */
export const geeksforgeeksAdapter: PlatformAdapter = {
  platform: "geeksforgeeks",

  matches(url: string): boolean {
    try {
      const parsed = new URL(url);
      return isGeeksForGeeksHost(parsed.hostname) && Boolean(slugFromPath(parsed.pathname));
    } catch {
      return false;
    }
  },

  extractTaskInfo(): TaskInfo | null {
    const slug = slugFromPath(location.pathname);
    if (!slug) return null;

    return {
      taskTitle: extractTitle(slug),
      taskUrl: canonicalProblemUrl(location.href),
      platformTaskSlug: slug,
      tags: extractTags(),
      difficulty: extractDifficulty(),
      taskDescription: extractDescription([
        "[class*='problem_content']",
        "[class*='problem-statement']",
        "[class*='problemStatement']",
        "article",
      ]),
    };
  },

  findSubmitButton(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>("button[class*='submit_button']") ||
      findButtonByText((text) => text === "submit" || text === "submit solution")
    );
  },

  detectSubmitResult(): SubmitResult {
    const text = findText([
      "[class*='problem_solved_successfully']",
      "[class*='compile_result']",
      "[class*='submission_result']",
      "[class*='result']",
    ]);
    return classifyVerdict(text);
  },
};

function isGeeksForGeeksHost(hostname: string): boolean {
  return hostname === "geeksforgeeks.org" || hostname.endsWith(".geeksforgeeks.org");
}

function slugFromPath(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const problemsIndex = parts.indexOf("problems");
  return problemsIndex >= 0 ? parts[problemsIndex + 1] : undefined;
}

function canonicalProblemUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function extractTitle(slug: string): string {
  const documentTitle = document.title
    .replace(/\s*\|\s*Practice\s*\|\s*GeeksforGeeks.*$/i, "")
    .replace(/\s*-\s*GeeksforGeeks.*$/i, "")
    .trim();
  return (
    findText([
      "[class*='header_content__title']",
      "[class*='header_content'] h1",
      "[class*='header_content'] h2",
      "h1",
    ]) ||
    documentTitle ||
    slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

function extractDifficulty(): string | undefined {
  const text = findText([
    "[class*='header_description']",
    "[class*='problem_difficulty']",
    "[class*='difficulty']",
  ]).toLowerCase();
  if (text.includes("basic") || text.includes("easy")) return "easy";
  if (text.includes("medium")) return "medium";
  if (text.includes("hard")) return "hard";
  return undefined;
}

function extractTags(): string[] {
  const nodes = document.querySelectorAll<HTMLElement>(
    "a[href*='/tag/'], a[href*='/explore?page='][href*='category']"
  );
  const tags = new Set<string>();
  for (const node of nodes) {
    const tag = (node.textContent ?? "").trim().toLowerCase();
    if (!tag || tag.length > 32 || tag.includes("\n")) continue;
    tags.add(tag);
    if (tags.size >= 6) break;
  }
  return [...tags];
}
