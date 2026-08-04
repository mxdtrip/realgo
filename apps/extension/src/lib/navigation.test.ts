import { describe, expect, it } from "vitest";

import {
  buildReviewUrl,
  normalizeServiceBaseUrl,
  resolveWebBaseUrl,
} from "./navigation";

describe("review navigation URL", () => {
  it("builds the cards route without duplicate slashes", () => {
    expect(buildReviewUrl("https://realgo.dev/")).toBe("https://realgo.dev/cards");
  });

  it("keeps a local override in development", () => {
    expect(resolveWebBaseUrl("http://localhost:3000/", "https://realgo.dev", false)).toBe(
      "http://localhost:3000"
    );
  });

  it("replaces a legacy loopback override in production", () => {
    expect(resolveWebBaseUrl("http://127.0.0.1:3000", "https://realgo.dev", true)).toBe(
      "https://realgo.dev"
    );
  });

  it("uses the build-time configured production origin", () => {
    expect(resolveWebBaseUrl(undefined, "https://app.example.test/", true)).toBe(
      "https://app.example.test"
    );
  });

  it("falls back from a malformed stored URL", () => {
    expect(resolveWebBaseUrl("not a URL", "https://realgo.dev", true)).toBe(
      "https://realgo.dev"
    );
  });

  it("retains the existing HTTPS and loopback-only HTTP policy", () => {
    expect(normalizeServiceBaseUrl("http://localhost:8080/path/")).toBe(
      "http://localhost:8080/path"
    );
    expect(() => normalizeServiceBaseUrl("http://example.test")).toThrow(
      "HTTP разрешён только для localhost"
    );
  });
});
