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

    const title = cleanDocTitle() || slugToTitle(slug);

    return {
      taskTitle: title,
      taskUrl: `${location.origin}/challenges/${encodeURIComponent(slug)}/problem`,
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
    return findButtonByText((text) => text === "submit code" || text === "submit");
  },

  detectSubmitResult(): SubmitResult {
    // HackerRank surfaces the verdict in a result/status panel once a submit resolves.
    return classifyVerdict(hackerRankResultText());
  },

  submissionResultFingerprint(): string {
    return hackerRankResultText();
  },

  didSubmissionResultMutate(records: MutationRecord[]): boolean {
    return records.some((record) => hackerRankResultMutation(record));
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

function hackerRankResultText(): string {
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

function hackerRankResultMutation(record: MutationRecord): boolean {
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
  // HackerRank exposes Advanced and Expert as distinct labels. Preserve the
  // site's wording for the assistant badge instead of misrepresenting both as
  // Hard. The API currently stores unsupported catalog levels as unknown.
  if (text.includes("expert")) return "expert";
  if (text.includes("advanced")) return "advanced";
  if (text.includes("hard")) return "hard";
  return undefined;
}
