import {
  ASSISTANT_STATE_KEY_PREFIX,
  DEFAULT_API_BASE_URL,
  DEFAULT_WEB_BASE_URL,
  STORAGE_KEYS,
  type AssistantPersistedState,
  type AuthSource,
  type DetectedSubmission,
  type TokenPair,
} from "./types";
import {
  buildReviewUrl,
  normalizeServiceBaseUrl,
  resolveWebBaseUrl,
} from "./navigation";

export { normalizeServiceBaseUrl } from "./navigation";

/**
 * Thin wrapper over chrome.storage.local. Kept out of the popup component so the
 * popup stays a pure React view that can also render in the Vite preview.
 */

async function get<T>(key: string): Promise<T | undefined> {
  const res = await chrome.storage.local.get(key);
  return res[key] as T | undefined;
}

async function set(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getApiBaseUrl(): Promise<string> {
  const stored = await get<string>(STORAGE_KEYS.apiBaseUrl);
  try {
    return normalizeServiceBaseUrl(stored || DEFAULT_API_BASE_URL);
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

export function setApiBaseUrl(url: string): Promise<void> {
  return set(STORAGE_KEYS.apiBaseUrl, normalizeServiceBaseUrl(url));
}

export async function getWebBaseUrl(): Promise<string> {
  return resolveWebBaseUrl(
    await get<string>(STORAGE_KEYS.webBaseUrl),
    DEFAULT_WEB_BASE_URL
  );
}

export function setWebBaseUrl(url: string): Promise<void> {
  return set(STORAGE_KEYS.webBaseUrl, normalizeServiceBaseUrl(url));
}

/** Absolute URL of the review cards section, e.g. https://realgo.dev/cards. */
export async function getReviewUrl(): Promise<string> {
  return buildReviewUrl(await getWebBaseUrl());
}

export function getAccessToken(): Promise<string | undefined> {
  return get<string>(STORAGE_KEYS.accessToken);
}

export function setAccessToken(token: string): Promise<void> {
  return set(STORAGE_KEYS.accessToken, token.trim());
}

export function getRefreshToken(): Promise<string | undefined> {
  return get<string>(STORAGE_KEYS.refreshToken);
}

export function getWebSessionFingerprint(): Promise<string | undefined> {
  return get<string>(STORAGE_KEYS.webSessionFingerprint);
}

export function setWebSessionFingerprint(fingerprint: string): Promise<void> {
  return set(STORAGE_KEYS.webSessionFingerprint, fingerprint);
}

/** Persists an access + refresh pair returned by the auth endpoints. */
export async function setTokens(tokens: TokenPair, source?: AuthSource): Promise<void> {
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.accessToken]: tokens.access_token,
    [STORAGE_KEYS.refreshToken]: tokens.refresh_token,
  };
  if (source) values[STORAGE_KEYS.authSource] = source;
  await chrome.storage.local.set(values);
}

export function getAuthSource(): Promise<AuthSource | undefined> {
  return get<AuthSource>(STORAGE_KEYS.authSource);
}

export function setAuthSource(source: AuthSource): Promise<void> {
  return set(STORAGE_KEYS.authSource, source);
}

/**
 * Clears the account session and all account-scoped cached data. API/Web URL
 * preferences are intentionally retained because they belong to the extension
 * installation rather than to a particular user.
 */
export async function clearTokens(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const accountKeys = Object.keys(all).filter((key) =>
    key.startsWith(ASSISTANT_STATE_KEY_PREFIX)
  );
  await chrome.storage.local.remove([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.refreshToken,
    STORAGE_KEYS.authSource,
    STORAGE_KEYS.userEmail,
    STORAGE_KEYS.webSessionFingerprint,
    STORAGE_KEYS.lastSubmission,
    ...accountKeys,
  ]);
}

export function getUserEmail(): Promise<string | undefined> {
  return get<string>(STORAGE_KEYS.userEmail);
}

export function setUserEmail(email: string): Promise<void> {
  return set(STORAGE_KEYS.userEmail, email);
}

export function getLastSubmission(): Promise<DetectedSubmission | undefined> {
  return get<DetectedSubmission>(STORAGE_KEYS.lastSubmission);
}

export function setLastSubmission(submission: DetectedSubmission): Promise<void> {
  return set(STORAGE_KEYS.lastSubmission, submission);
}

export function clearLastSubmission(): Promise<void> {
  return chrome.storage.local.remove(STORAGE_KEYS.lastSubmission);
}

/** A day: assistant state older than this is stale (limits reset per task/day). */
const ASSISTANT_STATE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Loads the persisted assistant conversation for a task and, piggybacking on
 * the same storage read, prunes stale entries for other tasks so the store
 * doesn't accumulate one record per problem ever opened.
 */
export async function getAssistantState(
  taskKey: string
): Promise<AssistantPersistedState | undefined> {
  const all = await chrome.storage.local.get(null);
  const staleKeys: string[] = [];
  const cutoff = Date.now() - ASSISTANT_STATE_TTL_MS;
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(ASSISTANT_STATE_KEY_PREFIX)) continue;
    const savedAt = (value as AssistantPersistedState | undefined)?.savedAt ?? 0;
    if (savedAt < cutoff) staleKeys.push(key);
  }
  if (staleKeys.length > 0) {
    await chrome.storage.local.remove(staleKeys);
  }

  const key = ASSISTANT_STATE_KEY_PREFIX + taskKey;
  if (staleKeys.includes(key)) return undefined;
  return all[key] as AssistantPersistedState | undefined;
}

export function setAssistantState(
  taskKey: string,
  state: AssistantPersistedState
): Promise<void> {
  return set(ASSISTANT_STATE_KEY_PREFIX + taskKey, state);
}
