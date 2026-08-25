"use client";

const MAX_BREADCRUMBS = 10;
const MAX_ERRORS = 3;
const MAX_STACK_LENGTH = 2_000;

export type BrowserInfo = {
  name: string;
  version: string;
  engine: string;
};

export type OsInfo = {
  name: string;
  version: string;
};

export type NetworkMetadata = {
  method: string;
  endpoint: string;
  status: number | "pending" | "network_error" | "aborted";
  statusText?: string;
  responseTimeMs: number;
  startedAt: string;
  requestId?: string;
};

type Breadcrumb =
  | { time: string; type: "navigation"; to: string }
  | { time: string; type: "click"; target: string }
  | {
      time: string;
      type: "network";
      method: string;
      url: string;
      status: NetworkMetadata["status"];
      responseTimeMs?: number;
      requestId?: string;
    };

type CapturedError = {
  time: string;
  type: "error" | "unhandledrejection";
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
};

type StoredBreadcrumb = {
  id: number;
  createdAt: number;
  value: Breadcrumb;
};

export type DiagnosticReport = {
  schemaVersion: 2;
  description: string;
  reportedAt: string;
  page: {
    route: string;
    viewport: { width: number; height: number };
    locale: string;
    timezone: string;
    online: boolean;
  };
  browser: BrowserInfo;
  os: OsInfo;
  network: NetworkMetadata | null;
  breadcrumbs: Breadcrumb[];
  errors: CapturedError[];
  release: { version: string; commit: string };
};

let nextBreadcrumbId = 1;
let breadcrumbs: StoredBreadcrumb[] = [];
let errors: CapturedError[] = [];
let lastNetwork: (NetworkMetadata & { id: number; startedAtMs: number }) | null = null;

function version(value: string | undefined): string {
  return value?.replace(/_/g, ".") ?? "";
}

/** Parses the stable parts of browser UA strings into fields suitable for filtering. */
export function parseUserAgent(userAgent: string): { browser: BrowserInfo; os: OsInfo } {
  const edge = userAgent.match(/(?:EdgA|EdgiOS|Edg)\/([\d.]+)/);
  const opera = userAgent.match(/(?:OPR|Opera)\/([\d.]+)/);
  const chrome = userAgent.match(/(?:CriOS|Chrome)\/([\d.]+)/);
  const firefox = userAgent.match(/(?:FxiOS|Firefox)\/([\d.]+)/);
  const safari = userAgent.match(/Version\/([\d.]+).*Safari\//);
  const isIos = /(?:iPhone|iPad|iPod)/.test(userAgent);

  let browser: BrowserInfo;
  if (edge) browser = { name: "Edge", version: version(edge[1]), engine: isIos ? "WebKit" : "Blink" };
  else if (opera) browser = { name: "Opera", version: version(opera[1]), engine: "Blink" };
  else if (chrome) browser = { name: "Chrome", version: version(chrome[1]), engine: isIos ? "WebKit" : "Blink" };
  else if (firefox) browser = { name: "Firefox", version: version(firefox[1]), engine: isIos ? "WebKit" : "Gecko" };
  else if (safari) browser = { name: "Safari", version: version(safari[1]), engine: "WebKit" };
  else {
    const engine = /AppleWebKit\//.test(userAgent)
      ? "WebKit"
      : /Gecko\//.test(userAgent)
        ? "Gecko"
        : "Unknown";
    browser = { name: "Unknown", version: "", engine };
  }

  const windows = userAgent.match(/Windows NT ([\d.]+)/);
  const android = userAgent.match(/Android ([\d.]+)/);
  const ios = userAgent.match(/(?:CPU(?: iPhone)? OS|iPhone OS) ([\d_]+)/);
  const macos = userAgent.match(/Mac OS X ([\d_]+)/);

  let os: OsInfo;
  if (android) os = { name: "Android", version: version(android[1]) };
  else if (ios) os = { name: "iOS", version: version(ios[1]) };
  else if (windows) os = { name: "Windows", version: version(windows[1]) };
  else if (macos) os = { name: "macOS", version: version(macos[1]) };
  else if (/Linux/.test(userAgent)) os = { name: "Linux", version: "" };
  else os = { name: "Unknown", version: "" };

  return { browser, os };
}

function localTime(date = new Date()): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

/** Keeps query parameter names for debugging while dropping their potentially sensitive values. */
export function diagnosticRoute(input: string): string {
  try {
    const url = new URL(input, typeof window === "undefined" ? "https://realgo.invalid" : window.location.origin);
    const keys = [...new Set(url.searchParams.keys())].sort();
    return `${url.pathname}${keys.length > 0 ? `?${keys.join("&")}` : ""}`;
  } catch {
    return input.split("?")[0] || "/";
  }
}

function addBreadcrumb(value: Breadcrumb): number {
  const now = Date.now();
  const previous = breadcrumbs.at(-1);
  if (
    value.type === "navigation" &&
    previous?.value.type === "navigation" &&
    previous.value.to === value.to &&
    now - previous.createdAt < 1_000
  ) {
    return previous.id;
  }

  const id = nextBreadcrumbId++;
  breadcrumbs = [...breadcrumbs, { id, createdAt: now, value }].slice(-MAX_BREADCRUMBS);
  return id;
}

export function recordNavigation(to: string) {
  addBreadcrumb({ time: localTime(), type: "navigation", to: diagnosticRoute(to) });
}

function safeSelector(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id && /^[\w-]{1,64}$/.test(element.id) ? `#${element.id}` : "";
  const classes = [...element.classList]
    .filter((name) => /^[\w-]{1,48}$/.test(name))
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join("");
  return `${tag}${id}${classes}`.slice(0, 140);
}

export function recordClick(target: EventTarget | null) {
  if (!(target instanceof Element)) return;
  const actionable = target.closest("button, a, [role='button'], input, select, textarea");
  if (!actionable) return;
  addBreadcrumb({ time: localTime(), type: "click", target: safeSelector(actionable) });
}

export function recordNetworkStart(method: string, input: string): number {
  const startedAtMs = Date.now();
  const endpoint = diagnosticRoute(input);
  const normalizedMethod = method.toUpperCase();
  const breadcrumbId = addBreadcrumb({
    time: localTime(),
    type: "network",
    method: normalizedMethod,
    url: endpoint,
    status: "pending",
  });
  lastNetwork = {
    id: breadcrumbId,
    method: normalizedMethod,
    endpoint,
    status: "pending",
    responseTimeMs: 0,
    startedAt: new Date(startedAtMs).toISOString(),
    startedAtMs,
  };
  return breadcrumbId;
}

export function recordNetworkEnd(
  breadcrumbId: number,
  result: Pick<NetworkMetadata, "status" | "statusText" | "requestId">,
) {
  const storedBreadcrumb = breadcrumbs.find((stored) => stored.id === breadcrumbId);
  const responseTimeMs = storedBreadcrumb
    ? Math.max(0, Date.now() - storedBreadcrumb.createdAt)
    : 0;

  // A slower, older request may finish after a newer one was started. It still
  // updates its breadcrumb, but must not replace the metadata of the last call.
  if (lastNetwork?.id === breadcrumbId) {
    lastNetwork = { ...lastNetwork, ...result, responseTimeMs };
  }

  breadcrumbs = breadcrumbs.map((stored) => {
    if (stored.id !== breadcrumbId || stored.value.type !== "network") return stored;
    return {
      ...stored,
      value: { ...stored.value, status: result.status, responseTimeMs },
    };
  });
}

function sanitiseStack(stack: string): string {
  return stack
    .split("\n")
    .map((line) => line.replace(/https?:\/\/[^\s)]+/g, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}${parsed.search ? "?<redacted>" : ""}`;
      } catch {
        return url;
      }
    }))
    .join("\n")
    .slice(0, MAX_STACK_LENGTH);
}

export function captureError(
  type: CapturedError["type"],
  message: string,
  details: Partial<Omit<CapturedError, "time" | "type" | "message">> = {},
) {
  const captured: CapturedError = {
    time: new Date().toISOString(),
    type,
    message: message.slice(0, 500),
    ...(details.stack ? { stack: sanitiseStack(details.stack) } : {}),
    ...(details.source ? { source: diagnosticRoute(details.source) } : {}),
    ...(details.line ? { line: details.line } : {}),
    ...(details.column ? { column: details.column } : {}),
  };
  errors = [...errors, captured].slice(-MAX_ERRORS);
}

export function createDiagnosticReport(description: string): DiagnosticReport {
  const { browser, os } = parseUserAgent(navigator.userAgent);
  const now = Date.now();
  const network = lastNetwork
    ? {
        method: lastNetwork.method,
        endpoint: lastNetwork.endpoint,
        status: lastNetwork.status,
        ...(lastNetwork.statusText ? { statusText: lastNetwork.statusText } : {}),
        responseTimeMs:
          lastNetwork.status === "pending"
            ? Math.max(0, now - lastNetwork.startedAtMs)
            : lastNetwork.responseTimeMs,
        startedAt: lastNetwork.startedAt,
        ...(lastNetwork.requestId ? { requestId: lastNetwork.requestId } : {}),
      }
    : null;

  return {
    schemaVersion: 2,
    description: description.trim(),
    reportedAt: new Date(now).toISOString(),
    page: {
      route: diagnosticRoute(window.location.href),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      online: navigator.onLine,
    },
    browser,
    os,
    network,
    breadcrumbs: breadcrumbs.map(({ value }) => ({ ...value })),
    errors: errors.map((error) => ({ ...error })),
    release: {
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "development",
      commit: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "unknown",
    },
  };
}
