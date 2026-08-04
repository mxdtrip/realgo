import { beforeEach, describe, expect, it, vi } from "vitest";

import { syncWebSession } from "./auth";
import { getAuthSource, getRefreshToken, setTokens } from "./storage";

const values: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(values)) delete values[key];
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (key: string | null) => {
          if (key === null) return { ...values };
          return { [key]: values[key] };
        }),
        set: vi.fn(async (next: Record<string, unknown>) => Object.assign(values, next)),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
        }),
      },
    },
  });
});

const tokens = {
  access_token: "access",
  refresh_token: "refresh",
  token_type: "Bearer",
  expires_in: 900,
};

describe("web session ownership", () => {
  it("does not erase a login made in extension options", async () => {
    await setTokens(tokens, "options");

    await syncWebSession(null, null, "http://localhost:8080");

    expect(await getRefreshToken()).toBe("refresh");
    expect(await getAuthSource()).toBe("options");
  });

  it("clears a logged-out web session for the same origin", async () => {
    await setTokens(tokens, "web:http://localhost:8080");

    await syncWebSession(null, null, "http://localhost:8080");

    expect(await getRefreshToken()).toBeUndefined();
    expect(await getAuthSource()).toBeUndefined();
  });

  it("does not clear a web session owned by another origin", async () => {
    await setTokens(tokens, "web:http://localhost:8080");

    await syncWebSession(null, null, "http://127.0.0.1:8080");

    expect(await getRefreshToken()).toBe("refresh");
    expect(await getAuthSource()).toBe("web:http://localhost:8080");
  });
});
