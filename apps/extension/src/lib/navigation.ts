const FALLBACK_WEB_BASE_URL = "https://realgo.dev";

export const REVIEW_PATH = "/cards";

/** HTTPS is required off-device; plaintext HTTP is limited to loopback dev. */
export function normalizeServiceBaseUrl(raw: string): string {
  const parsed = new URL(raw.trim());
  const loopback = isLoopbackHostname(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new Error("Используй HTTPS; HTTP разрешён только для localhost.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URL не должен содержать логин или пароль.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("URL не должен содержать query-параметры или fragment.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

function isLoopbackUrl(value: string): boolean {
  try {
    return isLoopbackHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}

function normalizeConfiguredWebUrl(value: string): string {
  try {
    return normalizeServiceBaseUrl(value);
  } catch {
    return FALLBACK_WEB_BASE_URL;
  }
}

/**
 * Development keeps an explicitly saved local origin. Production ignores a
 * loopback value left in storage when the build points at a public web origin.
 */
export function resolveWebBaseUrl(
  storedUrl: string | undefined,
  configuredUrl: string,
  production = process.env.NODE_ENV === "production"
): string {
  const configured = normalizeConfiguredWebUrl(configuredUrl);
  let stored: string;
  try {
    stored = normalizeServiceBaseUrl(storedUrl ?? "");
  } catch {
    return configured;
  }
  if (production && isLoopbackUrl(stored) && !isLoopbackUrl(configured)) {
    return configured;
  }
  return stored;
}

/** Builds the existing cards route without relying on slash concatenation. */
export function buildReviewUrl(webBaseUrl: string): string {
  const base = normalizeServiceBaseUrl(webBaseUrl);
  return new URL(REVIEW_PATH, `${base}/`).toString();
}
