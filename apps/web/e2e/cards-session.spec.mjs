import { expect, test } from "@playwright/test";

// Focus card review session (/cards/session): api-backed session with rating
// persistence; unauthenticated visitors are redirected to /login.
// Backed by the CARD_SESSION fixtures in auth-stub.mjs.

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:session:v2";
const SESSION_KEYS = [
  "realgo:card-review-session:v2:due",
  "realgo:card-review-session:v2:practice",
];

async function seedAuthSession(page, kind) {
  await page.evaluate(
    ([accessKey, sessionKey, tokenKind]) => {
      localStorage.removeItem(accessKey);
      const session = `${tokenKind}.session`;
      localStorage.setItem(sessionKey, session);
      document.cookie = `realgo-refresh-${session}=${tokenKind}.refresh; Path=/; SameSite=Strict`;
    },
    [AKEY, RKEY, kind],
  );
}

async function openSession(page, { token = null } = {}) {
  await page.goto("/cards");
  await page.evaluate(
    ([a, r, sessionKeys, kind]) => {
      sessionKeys.forEach((sessionKey) => localStorage.removeItem(sessionKey));
      if (kind) {
        localStorage.removeItem(a);
        const session = `${kind}.session`;
        localStorage.setItem(r, session);
        document.cookie = `realgo-refresh-${session}=${kind}.refresh; Path=/; SameSite=Strict`;
      } else {
        localStorage.removeItem(a);
        localStorage.removeItem(r);
      }
    },
    [AKEY, RKEY, SESSION_KEYS, token],
  );
  await page.goto("/cards/session");
}

test.describe("card review session (api)", () => {
  test("cards overview separates due repetition from subpattern practice", async ({ page }) => {
    await page.goto("/cards");
    await seedAuthSession(page, "LIVE");
    await page.goto("/cards");

    const due = page.locator(".cards-mode-card--due");
    const practice = page.locator(".cards-mode-card--practice");
    await expect(due).toContainText("На сегодня всё повторено");
    await expect(due.locator(".cards-mode-card__count")).toContainText("0");
    await expect(practice.locator(".cards-mode-card__count")).toContainText("2");
    await expect(practice).toContainText("Stub Problem · Two Pointers");
    const startPractice = practice.getByRole("link", { name: "начать практику" });
    await expect(startPractice).toHaveAttribute(
      "href",
      "/cards/session?scope=practice",
    );
    await startPractice.click();
    await expect(page.getByText("Практика подпаттернов")).toBeVisible();
    await expect(page.getByRole("link", { name: "Выйти из сессии" })).toHaveAttribute(
      "href",
      "/cards#practice",
    );
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("realgo:card-review-session:v2:practice")))
      .not.toBeNull();
  });

  test("loads the api session, flips, and persists ratings", async ({ page }) => {
    await openSession(page, { token: "LIVE" });

    // First stub card, front side; the AI marker comes from createdByAi.
    // Both faces carry the badge in the DOM, so scope to the front face.
    await expect(page.getByText("STUB FRONT: which approach fits a sorted array?")).toBeVisible();
    await expect(page.locator(".focus-card__face--front .card-ai-badge")).toBeVisible();
    await expect(page.getByText("Карточка 1 из 2")).toBeVisible();
    await expect(page.getByText("Повторение на сегодня")).toBeVisible();

    await page.getByRole("button", { name: "Показать ответ" }).click();
    await expect(page.getByText("STUB BACK: two pointers moving inward.")).toBeVisible();

    // Rating fires POST /me/cards/{id}/rate with the session id.
    const ratePost = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().includes("/me/cards/9101/rate"),
    );
    await page.getByRole("button", { name: /Легко/ }).click();
    const request = await ratePost;
    expect(request.postDataJSON()).toMatchObject({ sessionId: "sess_stub", rating: "easy" });

    // Second card, then completion.
    await expect(page.getByText("STUB FRONT: what breaks on an empty input?")).toBeVisible();
    await page.getByRole("button", { name: "Показать ответ" }).click();
    await page.getByRole("button", { name: /Легко/ }).click();
    await expect(page.getByText("Повторение завершено.")).toBeVisible();
  });

  test("explicit practice restart ignores a completed local session", async ({ page }) => {
    await page.goto("/cards");
    await seedAuthSession(page, "LIVE");
    await page.evaluate(
      () => {
        localStorage.setItem(
          "realgo:card-review-session:v2:practice",
          JSON.stringify({
            queue: [],
            history: [],
            sessionCardIds: ["9101", "9102"],
          }),
        );
      },
    );

    await page.goto("/cards/session?scope=practice&restart=1");

    await expect(page.getByText("STUB FRONT: which approach fits a sorted array?")).toBeVisible();
    await expect(page.getByText("Карточка 1 из 2")).toBeVisible();
  });
});

test.describe("card review session (unauthenticated)", () => {
  test("redirects anonymous visitors to /login instead of a demo deck", async ({ page }) => {
    await openSession(page);

    await page.waitForURL("**/login");
    await expect(page.getByText("STUB FRONT: which approach fits a sorted array?")).toHaveCount(0);
  });
});
