"use client";

// Access tokens live only in memory. Refresh credentials live in host-only
// HttpOnly cookies. localStorage contains only a non-secret session selector.

import type { AuthTokens } from "./types";

export const accessTokenStorageKey = "realgo:auth:access:v1";
export const refreshTokenStorageKey = "realgo:auth:session:v2";
let accessToken: string | null = null;
let accessSession: string | null = null;

function removeLegacyTokens() {
 window.localStorage.removeItem(accessTokenStorageKey);
 window.localStorage.removeItem("realgo:auth:refresh:v1");
}
export const authChangedEvent = "realgo:auth-changed";

const accountScopedStorageKeys = [
  "realgo:card-review-session:v1",
  "realgo:personal-roadmap:v1",
  "realgo:profile-settings:v1",
  "realgo:onboarding-profile:v1",
  "realgo:notification-settings:v1",
  "realgo.atlas.company",
  "realgo.atlas.platform",
] as const;

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  removeLegacyTokens();
 return accessSession === getRefreshToken() ? accessToken : null;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  removeLegacyTokens();
 return window.localStorage.getItem(refreshTokenStorageKey);
}

export function hasSession(): boolean {
  return getRefreshToken() !== null;
}

/** Persists a freshly issued token pair and notifies listeners. */
export function setTokens(tokens: AuthTokens, notify = true) {
  if (typeof window === "undefined") return;
  if (!tokens.session_id) throw new Error("Missing session identity");
  removeLegacyTokens();
  accessToken = tokens.access_token;
  accessSession = tokens.session_id;
  window.localStorage.setItem(refreshTokenStorageKey, tokens.session_id);
  if (notify) window.dispatchEvent(new Event(authChangedEvent));
}

/** Clears the session and notifies listeners. */
export function clearTokens() {
  if (typeof window === "undefined") return;
  removeLegacyTokens();
  accessToken = null;
  accessSession = null;
  window.localStorage.removeItem(refreshTokenStorageKey);
  for (const key of accountScopedStorageKeys) {
    window.localStorage.removeItem(key);
  }
  window.dispatchEvent(new Event(authChangedEvent));
}
