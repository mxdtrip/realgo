import type { AssistantTask, DetectedSubmission } from "../lib/types";

/** A just-detected submit may outlive transient SPA route and DOM state. */
export const RECENT_SUBMISSION_WINDOW_MS = 60_000;

export function selectPendingSubmission(
  submission: DetectedSubmission | undefined,
  task: AssistantTask | null,
  activeTabUrl: string | undefined,
  now = Date.now()
): DetectedSubmission | null {
  if (!submission || submission.submitResult !== "accepted") return null;

  if (
    task &&
    submission.platform === task.platform &&
    submission.platformTaskSlug === task.platformTaskSlug
  ) {
    return submission;
  }

  if (activeTabUrl && isSubmissionPage(submission, activeTabUrl)) return submission;

  const submittedAt = Date.parse(submission.submittedAt);
  if (
    Number.isFinite(submittedAt) &&
    now >= submittedAt &&
    now - submittedAt <= RECENT_SUBMISSION_WINDOW_MS
  ) {
    return submission;
  }

  return null;
}

function isSubmissionPage(submission: DetectedSubmission, pageUrl: string): boolean {
  try {
    const page = new URL(pageUrl);
    const taskSlug = submission.platformTaskSlug?.trim();
    if (!taskSlug) return false;
    const slug = encodeURIComponent(taskSlug);
    if (submission.platform === "leetcode") {
      return isHost(page.hostname, "leetcode.com") && page.pathname.includes(`/problems/${slug}`);
    }
    if (submission.platform === "hackerrank") {
      return isHost(page.hostname, "hackerrank.com") && page.pathname.includes(`/challenges/${slug}`);
    }
    if (submission.platform === "geeksforgeeks") {
      return (
        isHost(page.hostname, "geeksforgeeks.org") &&
        page.pathname.includes(`/problems/${slug}`)
      );
    }
  } catch {
    return false;
  }
  return false;
}

function isHost(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}
