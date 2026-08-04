import { describe, expect, it } from "vitest";

import { refreshApiError } from "./api";
import { AuthError } from "./auth";

describe("refresh error classification", () => {
  it("reports a genuinely missing session as a disconnected account", () => {
    const error = refreshApiError(new AuthError("missing", 401, "no_session"));
    expect(error.code).toBe("no_session");
    expect(error.message).toContain("Аккаунт не подключён");
  });

  it("does not disguise a network failure as a disconnected account", () => {
    const error = refreshApiError(
      new AuthError("Не удалось связаться с realgo. Бэкенд запущен?", 0, "network")
    );
    expect(error.code).toBe("network");
    expect(error.status).toBe(503);
    expect(error.message).toContain("Не удалось связаться");
  });

  it("reports a rejected refresh token as an expired session", () => {
    const error = refreshApiError(new AuthError("unauthorized", 401, "invalid_token"));
    expect(error.message).toContain("Сессия истекла");
  });
});
