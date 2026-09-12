"use client";

// "Sign in with GitHub" — browser side of the OAuth App authorization code
// flow (https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).
// startGithubAuth() redirects the whole page to
// https://github.com/login/oauth/authorize; GitHub redirects back to
// /auth/github/callback with ?code=&state=, which GithubCallbackClient reads
// and exchanges via POST /auth/github (see app/_api/auth.ts). The client
// secret never reaches the browser — only the backend calls
// github.com/login/oauth/access_token.

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const STATE_STORAGE_KEY = "realgo:github-oauth-state:v1";
// user:email is required to read a (possibly private) verified email via
// /user/emails when the profile has none public — see app/_auth for the
// mirrored Yandex flow this one follows.
const GITHUB_SCOPE = "read:user user:email";

/** The fixed redirect target GitHub sends the user back to after consent. */
export function githubRedirectURI(): string {
  return `${window.location.origin}/auth/github/callback`;
}

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Whether NEXT_PUBLIC_GITHUB_CLIENT_ID is configured for this build. */
export function isGithubAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID?.trim());
}

/**
 * Stores a fresh CSRF state and navigates the browser to GitHub's consent
 * screen. Never resolves on success — the page unloads.
 */
export function startGithubAuth(): void {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID?.trim();
  if (!clientId) throw new Error("NEXT_PUBLIC_GITHUB_CLIENT_ID is not configured");

  const state = randomState();
  window.sessionStorage.setItem(STATE_STORAGE_KEY, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: githubRedirectURI(),
    scope: GITHUB_SCOPE,
    state,
    allow_signup: "true",
  });
  window.location.href = `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Verifies the callback's `state` against the one stashed before redirecting
 * and consumes it (one-shot, so a replayed callback URL fails). Returns false
 * on any mismatch — including a missing stored state (e.g. the callback URL
 * was opened directly, or in a different browser/tab than the redirect).
 */
export function consumeGithubState(state: string | null): boolean {
  const expected = window.sessionStorage.getItem(STATE_STORAGE_KEY);
  window.sessionStorage.removeItem(STATE_STORAGE_KEY);
  return Boolean(state) && Boolean(expected) && state === expected;
}
