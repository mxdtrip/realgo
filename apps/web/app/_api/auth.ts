"use client";

// Auth endpoint wrappers. The backend uses DisallowUnknownFields, so each call
// sends exactly the fields the handler expects — nothing extra.

import { apiFetch } from "./client";
import { clearTokens, getRefreshToken, setTokens } from "./tokens";
import type { AuthTokens, AuthUser } from "./types";

type AuthResponse = { user: AuthUser; tokens: AuthTokens };
type RegisterResponse = { status: string; email: string };

/**
 * POST /auth/register → creates an unverified account and sends a
 * confirmation link. Does not start a session: the account only becomes
 * usable once confirmEmail succeeds, so the caller should show a "check your
 * inbox" screen rather than redirecting into the app.
 */
export async function register(email: string, password: string): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}

/** POST /auth/confirm-email → verifies the magic link and starts a session. */
export async function confirmEmail(id: string, token: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>("/auth/confirm-email", {
    method: "POST",
    auth: false,
    body: { id, token },
  });
  setTokens(data.tokens);
  return data.user;
}

/**
 * POST /auth/resend-verification → sends a fresh confirmation link. Always
 * resolves regardless of whether the id/email is known (the backend never
 * reveals that), so callers should show a neutral "check your inbox" message
 * either way.
 */
export async function resendVerification(target: { id: string } | { email: string }): Promise<void> {
  await apiFetch<{ status: string }>("/auth/resend-verification", {
    method: "POST",
    auth: false,
    body: target,
  });
}

/**
 * POST /auth/request-password-reset → sends a password-reset link. Always
 * resolves regardless of whether the email is known (the backend never
 * reveals that), so callers should show a neutral "check your inbox" message
 * either way.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiFetch<{ status: string }>("/auth/request-password-reset", {
    method: "POST",
    auth: false,
    body: { email },
  });
}

/**
 * POST /auth/reset-password → sets a new password and starts a session
 * (auto-login). Every other session on the account is revoked server-side.
 */
export async function resetPassword(id: string, token: string, password: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>("/auth/reset-password", {
    method: "POST",
    auth: false,
    body: { id, token, password },
  });
  setTokens(data.tokens);
  return data.user;
}

/** POST /auth/login → authenticates and starts a session. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
  setTokens(data.tokens);
  return data.user;
}

/** GET /users/me → the current authenticated user. */
export async function getMe(): Promise<AuthUser> {
  const data = await apiFetch<{ user: AuthUser }>("/users/me");
  return data.user;
}

/** POST /auth/logout → best-effort refresh-token revocation, then clears state. */
export async function logout(): Promise<void> {
  const refresh = getRefreshToken();
  if (refresh) {
    try {
      await apiFetch<{ status: string }>("/auth/logout", {
        method: "POST",
        auth: false,
        body: { refresh_token: refresh },
      });
    } catch {
      // A failed revocation must not block local logout.
    }
  }
  // Do not wipe a newer login that completed in another tab while the
  // best-effort revoke request above was in flight.
  if (!refresh || getRefreshToken() === refresh) clearTokens();
}
