import type { SubmitResult } from "../lib/types";
import {
  classifyVerdict,
  extractDescription,
  findButtonByText,
  findText,
  looksLikeSubmitLabel,
  type PlatformAdapter,
  type TaskInfo,
} from "./types";

/**
 * GeeksforGeeks adapter.
 *
 * Practice problem pages live at
 * https://www.geeksforgeeks.org/problems/<slug>/<tab> (the trailing segment
 * is a tab index, e.g. "1" for the description tab, "0" for a resizable
 * layout — both are the same problem). GFG's practice IDE is an in-page
 * editor (same shape as LeetCode/HackerRank: submit and verdict both render
 * without leaving the page), so this follows the same same-page adapter
 * pattern. GFG ships no stable data-* hooks either, so detection degrades to
 * "unknown" the same way.
 */
export const geeksforgeeksAdapter: PlatformAdapter = {
  platform: "geeksforgeeks",
  resultTimeoutMs: 60_000,

  matches(url: string): boolean {
    try {
      const u = new URL(url);
      return u.hostname.endsWith("geeksforgeeks.org") && u.pathname.includes("/problems/");
    } catch {
      return false;
    }
  },

  extractTaskInfo(): TaskInfo | null {
    const slug = slugFromPath(location.pathname);
    if (!slug) return null;

    const title =
      findText(["h2", "h1", "[class*='problems_header'][class*='title']", "[class*='problem'][class*='title']"]) ||
      slugToTitle(slug) ||
      cleanDocTitle();

    return {
      taskTitle: title,
      taskUrl: location.href,
      platformTaskSlug: slug,
      tags: extractTags(),
      difficulty: extractDifficulty(),
      taskDescription: extractDescription([
        "[class*='problems_problem_content']",
        "[class*='problem-statement']",
        "[class*='problemtab']",
        "[role='tabpanel']",
      ]),
    };
  },

  findSubmitButton(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>("button[id*='submit' i]") ||
      findButtonByText(looksLikeSubmitLabel)
    );
  },

  detectSubmitResult(): SubmitResult {
    // GFG surfaces the verdict in a result panel/modal once a submit resolves
    // ("Correct Answer", "Wrong Answer", "Compilation Error", ...).
    const text = gfgResultText();
    const classified = classifyVerdict(text);
    if (classified !== "unknown") return classified;

    // Current GFG Compilation Results also exposes the authoritative count.
    // Accept only a non-zero exact total; partial runs must remain unknown.
    const cases = text.match(/test cases passed:\s*(\d+)\s*\/\s*(\d+)/i);
    return cases && Number(cases[1]) > 0 && cases[1] === cases[2]
      ? "accepted"
      : "unknown";
  },

  submissionResultFingerprint(): string {
    return gfgResultText();
  },

  didSubmissionResultMutate(records: MutationRecord[]): boolean {
    return records.some((record) => gfgResultMutation(record));
  },
};

const RESULT_SELECTORS = [
  "[class*='problem_solved_successfully']",
  "[class*='submission_result']",
  "[class*='compilation_result']",
  "[class*='compilation-results']",
  "[class*='compile_result']",
  "[class*='content_pane']",
  "[class*='verdict']",
  "[class*='modal'][class*='body']",
  "[role='dialog']",
  "[role='status']",
  "[aria-live]",
];

/** GFG renders several result fragments; aggregate them instead of trusting
    the first generic `[class*=result]` node, which is often only the tab shell. */
function gfgResultText(): string {
  const texts = new Set<string>();
  for (const selector of RESULT_SELECTORS) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const text = (element.innerText || element.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      if (text) texts.add(text);
    }
  }
  return [...texts].join("\n");
}

function gfgResultMutation(record: MutationRecord): boolean {
  if (record.type !== "childList") return false;
  if (
    record.target instanceof Element &&
    RESULT_SELECTORS.some(
      (selector) => record.target instanceof Element && record.target.matches(selector)
    )
  ) {
    return true;
  }
  return [...record.addedNodes, ...record.removedNodes].some(
    (node) => node instanceof Element && matchesResultTree(node)
  );
}

function matchesResultTree(element: Element): boolean {
  return RESULT_SELECTORS.some(
    (selector) => element.matches(selector) || Boolean(element.querySelector(selector))
  );
}

function slugFromPath(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("problems");
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  return undefined;
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function cleanDocTitle(): string {
  return document.title.replace(/\s*[-|]\s*(Practice\s*\|\s*)?GeeksforGeeks.*$/i, "").trim();
}

/**
 * Best-effort topic tags. GFG lists them under a "Topic Tags"/"Company Tags"
 * block on the problem page; no stable hook, so this scans likely
 * tag containers the same defensive way the other adapters do.
 */
function extractTags(): string[] {
  const nodes = document.querySelectorAll<HTMLElement>(
    "[class*='problems_tag'] a, [class*='problems_tag'] span, [class*='tag'] a, [class*='tag'] span"
  );
  const seen = new Set<string>();
  for (const el of nodes) {
    const t = (el.textContent ?? "").trim().toLowerCase();
    if (t && t.length <= 24 && !t.includes("\n")) seen.add(t);
    if (seen.size >= 6) break;
  }
  return [...seen];
}

function extractDifficulty(): string | undefined {
  const text = findText([
    "[class*='problems_difficulty']",
    "[class*='difficulty']",
    "[class*='badge']",
  ]).toLowerCase();
  if (text.includes("basic")) return "easy";
  if (text.includes("easy")) return "easy";
  if (text.includes("medium")) return "medium";
  if (text.includes("hard")) return "hard";
  return undefined;
}
