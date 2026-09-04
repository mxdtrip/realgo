import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

export function sentryTraceSampleRate(environment: string | undefined): number {
  return environment === "production" ? 0.1 : environment === "staging" ? 1 : 0;
}

function stripUrlDetails(value: string): string {
  return value.split(/[?#]/, 1)[0];
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  event.user = event.user?.id ? { id: String(event.user.id) } : undefined;

  if (event.request) {
    event.request.data = undefined;
    event.request.cookies = undefined;
    event.request.query_string = undefined;
    if (event.request.url) event.request.url = stripUrlDetails(event.request.url);
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (
          /^(authorization|cookie|referer|forwarded|x-forwarded-for|x-real-ip|cf-connecting-ip)$/i.test(
            name,
          )
        ) {
          delete event.request.headers[name];
        }
      }
    }
  }

  return event;
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (!breadcrumb.data) return breadcrumb;
  for (const key of ["url", "from", "to"]) {
    const value = breadcrumb.data[key];
    if (typeof value === "string") breadcrumb.data[key] = stripUrlDetails(value);
  }
  return breadcrumb;
}
