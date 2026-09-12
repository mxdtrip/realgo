"use client";

// "Sign in with Yandex ID" — browser side of the OAuth authorization code flow
// (https://yandex.ru/dev/id/doc/ru/access). startYandexAuth() redirects the
// whole page to https://oauth.yandex.ru/authorize; Yandex redirects back to
// /auth/yandex/callback with ?code=&state=, which YandexCallbackClient reads
// and exchanges via POST /auth/yandex (see app/_api/auth.ts). The client
// secret never reaches the browser — only the backend calls oauth.yandex.ru/token.

const YANDEX_AUTHORIZE_URL = "https://oauth.yandex.ru/authorize";
const STATE_STORAGE_KEY = "realgo:yandex-oauth-state:v1";
// login:email is required to get default_email back from login.yandex.ru/info
// — without it the backend has nothing to register or link the account with.
const YANDEX_SCOPE = "login:email";

/** The fixed redirect target Yandex sends the user back to after consent. */
export function yandexRedirectURI(): string {
  return `${window.location.origin}/auth/yandex/callback`;
}

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Whether NEXT_PUBLIC_YANDEX_CLIENT_ID is configured for this build. */
export function isYandexAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID?.trim());
}

/**
 * Stores a fresh CSRF state and navigates the browser to Yandex's consent
 * screen. Never resolves on success — the page unloads.
 */
export function startYandexAuth(): void {
  const clientId = process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID?.trim();
  if (!clientId) throw new Error("NEXT_PUBLIC_YANDEX_CLIENT_ID is not configured");

  const state = randomState();
  window.sessionStorage.setItem(STATE_STORAGE_KEY, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: yandexRedirectURI(),
    scope: YANDEX_SCOPE,
    state,
    force_confirm: "yes",
  });
  window.location.href = `${YANDEX_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Verifies the callback's `state` against the one stashed before redirecting
 * and consumes it (one-shot, so a replayed callback URL fails). Returns false
 * on any mismatch — including a missing stored state (e.g. the callback URL
 * was opened directly, or in a different browser/tab than the redirect).
 */
export function consumeYandexState(state: string | null): boolean {
  const expected = window.sessionStorage.getItem(STATE_STORAGE_KEY);
  window.sessionStorage.removeItem(STATE_STORAGE_KEY);
  return Boolean(state) && Boolean(expected) && state === expected;
}
