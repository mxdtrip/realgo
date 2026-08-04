import type { SubmitResult } from "../lib/types";
import {
  classifyVerdict,
  extractDescription,
  findButtonByText,
  findText,
  type PlatformAdapter,
  type TaskInfo,
} from "./types";

/**
 * HackerRank adapter.
 *
 * Challenge pages live at https://www.hackerrank.com/challenges/<slug>/problem.
 * HackerRank is a SPA and ships no stable data-* hooks for the statement,
 * verdict or submit control, so detection degrades gracefully to "unknown"
 * rather than break (same convention as the other adapters in this folder).
 */
export const hackerrankAdapter: PlatformAdapter = {
  platform: "hackerrank",
  resultTimeoutMs: 60_000,

  matches(url: string): boolean {
    try {
      const u = new URL(url);
      const isHackerRank =
        u.hostname === "hackerrank.com" || u.hostname.endsWith(".hackerrank.com");
      return isHackerRank && /^\/challenges\/[^/]+\/problem\/?$/.test(u.pathname);
    } catch {
      return false;
    }
  },

  extractTaskInfo(): TaskInfo | null {
    const slug = slugFromPath(location.pathname);
    if (!slug) return null;

    const title =
      cleanDocTitle() ||
      findText([
        "[data-analytics*='challenge' i] h1",
        "[class*='challenge-title' i]",
        "[class*='problem-title' i]",
      ]) ||
      slugToTitle(slug);

    return {
      taskTitle: title,
      taskUrl: canonicalTaskUrl(slug),
      platformTaskSlug: slug,
      tags: extractTags(),
      difficulty: extractDifficulty(),
      taskDescription: extractDescription([
        "[class*='problem-statement']",
        "[class*='challenge-body']",
        "[role='tabpanel']",
      ]),
    };
  },

  findSubmitButton(): HTMLElement | null {
    return findButtonByText((t) => t === "submit code" || t === "submit");
  },

  detectSubmitResult(): SubmitResult {
    return classifyVerdict(hackerRankResultText());
  },

  submissionResultFingerprint(): string {
    return hackerRankResultText();
  },
};

const RESULT_SELECTORS = [
  "[data-testid*='submission' i]",
  "[data-analytics*='submission' i]",
  "[class*='submission-result' i]",
  "[class*='challenge-success' i]",
  "[class*='congrat' i]",
  "[class*='verdict' i]",
  "[class*='compile-status' i]",
  "[class*='compiler' i]",
  "[role='dialog']",
  "[role='status']",
  "[aria-live]",
  "h1",
  "h2",
  "h3",
];

/** Collects all live result panels; the first generic status node is often stale. */
function hackerRankResultText(): string {
  const texts = new Set<string>();
  for (const selector of RESULT_SELECTORS) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
      if (text) texts.add(text);
    }
  }
  return [...texts].join("\n");
}

function canonicalTaskUrl(slug: string): string {
  return `${location.origin}/challenges/${encodeURIComponent(slug)}/problem`;
}

function slugFromPath(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("challenges");
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
  return document.title.replace(/\s*[-|]\s*HackerRank.*$/i, "").trim();
}

/**
 * Best-effort topic tags (e.g. "arrays", "dynamic programming"). HackerRank
 * exposes no stable hooks, so we scan likely "topic/tag/track" containers and
 * keep a few short, sane labels. Returns [] when nothing trustworthy is found
 * — the popup simply renders no tags rather than guessing wrong.
 */
function extractTags(): string[] {
  const nodes = document.querySelectorAll<HTMLElement>(
    "[class*='track'] a, [class*='track'] span, [class*='tag'] a, [class*='topic'] a"
  );
  const seen = new Set<string>();
  for (const el of nodes) {
    const t = (el.textContent ?? "").trim().toLowerCase();
    if (t && t.length <= 24 && !t.includes("\n")) seen.add(t);
    if (seen.size >= 4) break;
  }
  return [...seen];
}

function extractDifficulty(): string | undefined {
  const text = findText([
    "[class*='difficulty']",
    "[class*='badge']",
    "[class*='label']",
  ]).toLowerCase();
  if (text.includes("easy")) return "easy";
  if (text.includes("medium")) return "medium";
  if (text.includes("hard") || text.includes("advanced") || text.includes("expert")) return "hard";
  return undefined;
}
