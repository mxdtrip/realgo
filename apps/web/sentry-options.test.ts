import assert from "node:assert/strict";
import test from "node:test";
import type { ErrorEvent } from "@sentry/nextjs";

import { scrubSentryEvent, sentryTraceSampleRate } from "./sentry-options.ts";

test("Sentry keeps only the internal user id and strips request secrets", () => {
  const event = scrubSentryEvent({
    type: "error",
    user: { id: "42", email: "user@example.com", ip_address: "127.0.0.1" },
    request: {
      url: "https://realgo.dev/cabinet?token=secret#fragment",
      query_string: "token=secret",
      cookies: "session=secret",
      data: "password=secret",
      headers: { Authorization: "Bearer secret", Accept: "application/json" },
    },
  } as unknown as ErrorEvent);

  assert.deepEqual(event.user, { id: "42" });
  assert.equal(event.request?.url, "https://realgo.dev/cabinet");
  assert.equal(event.request?.query_string, undefined);
  assert.equal(event.request?.cookies, undefined);
  assert.equal(event.request?.data, undefined);
  assert.deepEqual(event.request?.headers, { Accept: "application/json" });
  assert.equal(sentryTraceSampleRate("production"), 0.1);
  assert.equal(sentryTraceSampleRate("staging"), 1);
  assert.equal(sentryTraceSampleRate("local"), 0);
});
