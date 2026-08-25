import { expect, test } from "@playwright/test";

// Cabinet shell UX pack: hotkeys (#118), report-a-problem (#119),
// welcome tour (#122). Page transitions (#117) are pure CSS and not asserted.

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";
const TOUR_KEY = "realgo.cabinet.tour";
const HOTKEYS_KEY = "realgo.cabinet.hotkeys";

async function enterCabinet(page, { tourDone = true } = {}) {
  await page.goto("/dashboard");
  await page.evaluate(
    ([a, r, tourKey, done]) => {
      localStorage.setItem(a, "LIVE.access");
      localStorage.setItem(r, "LIVE.refresh");
      if (done) localStorage.setItem(tourKey, "done");
      else localStorage.removeItem(tourKey);
    },
    [AKEY, RKEY, TOUR_KEY, tourDone],
  );
  await page.goto("/dashboard");
  await expect(page.locator(".cabinet-content")).toBeVisible({ timeout: 15_000 });
}

test.describe("#122 welcome tour", () => {
  test("shows once, skip persists the flag", async ({ page }) => {
    await enterCabinet(page, { tourDone: false });

    const card = page.locator(".tour-card");
    await expect(card).toBeVisible({ timeout: 10_000 });

    await card.locator(".shell-btn--ghost").click(); // «пропустить»
    await expect(card).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), TOUR_KEY)).toBe("done");

    await page.reload();
    await expect(page.locator(".cabinet-content")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1200); // тур стартует с задержкой 600мс — даём ему шанс
    await expect(page.locator(".tour-card")).toHaveCount(0);
  });

  test("walk through all steps to the end", async ({ page }) => {
    await enterCabinet(page, { tourDone: false });
    const card = page.locator(".tour-card");
    await expect(card).toBeVisible({ timeout: 10_000 });

    for (let i = 0; i < 4; i += 1) {
      await card.locator(".shell-btn--primary").click();
    }
    await expect(card).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), TOUR_KEY)).toBe("done");
  });
});

test.describe("#118 hotkeys", () => {
  test("g r navigates to reviews, ? toggles help", async ({ page }) => {
    await enterCabinet(page);

    // Hydration attaches the listener late — retry the sequence until it lands.
    await expect(async () => {
      await page.keyboard.press("g");
      await page.keyboard.press("r");
      await expect(page).toHaveURL(/\/reviews/, { timeout: 1500 });
    }).toPass({ timeout: 20_000 });

    await page.keyboard.press("?");
    const dialog = page.locator(".shell-dialog--hotkeys");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("disable toggle turns navigation off but keeps ?", async ({ page }) => {
    await enterCabinet(page);

    await expect(async () => {
      await page.keyboard.press("?");
      await expect(page.locator(".shell-dialog--hotkeys")).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });

    await page.locator(".hotkeys-toggle input").check();
    expect(await page.evaluate((key) => localStorage.getItem(key), HOTKEYS_KEY)).toBe("off");
    await page.keyboard.press("Escape");

    await page.keyboard.press("g");
    await page.keyboard.press("p");
    await page.waitForTimeout(700);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.keyboard.press("?"); // справка обязана работать даже при off
    await expect(page.locator(".shell-dialog--hotkeys")).toBeVisible();
  });
});

test.describe("#119 report a problem", () => {
  test("dialog opens from the user menu, attaches context, ignores hotkeys while typing", async ({
    page,
  }) => {
    const safariUserAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/18.6 Safari/605.1.15";
    await page.addInitScript((ua) => {
      Object.defineProperty(Navigator.prototype, "userAgent", { configurable: true, get: () => ua });
    }, safariUserAgent);
    await enterCabinet(page);

    const userChip = page.locator(".user-chip");
    const reportItem = page.locator(".user-menu__report");
    const dialog = page.locator(".shell-dialog--report");
    await expect(async () => {
      await userChip.click();
      await reportItem.click({ timeout: 1500 });
      await expect(dialog).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });

    const send = dialog.locator(".shell-btn--primary");
    await expect(send).toBeDisabled(); // пустой текст — отправлять нечего

    const textarea = dialog.locator(".report-textarea");
    await textarea.fill("");
    await textarea.pressSequentially("g r что-то сломалось", { delay: 10 });
    await expect(page).toHaveURL(/\/dashboard/); // ввод в поле не дёргает навигацию
    await expect(send).toBeEnabled();

    // Технический контекст отправляется скрыто и не перегружает форму.
    await expect(dialog.locator(".report-context")).toHaveCount(0);
    await expect(dialog.getByText(/значения форм, токены/i)).toBeVisible();

    await dialog.locator(".report-attachment-input").setInputFiles({
      name: "console.log",
      mimeType: "text/plain",
      buffer: Buffer.from("loading never finished"),
    });
    await expect(dialog.getByText("console.log")).toBeVisible();

    await page.evaluate(() => {
      const error = new Error("diagnostic smoke error");
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: error.message,
          error,
          filename: `${location.origin}/app.js?token=secret`,
          lineno: 12,
          colno: 4,
        }),
      );
    });

    // Копия — готовый структурированный JSON без сырой строки User-Agent.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__reportClipboard = value;
          },
        },
      });
    });
    await dialog.getByRole("button", { name: "скопировать отчёт" }).click();
    const report = JSON.parse(await page.evaluate(() => window.__reportClipboard));
    const rawUserAgent = await page.evaluate(() => navigator.userAgent);
    expect(report).toMatchObject({
      schemaVersion: 2,
      description: "g r что-то сломалось",
      page: { route: "/dashboard" },
      browser: { name: "Safari", version: "18.6", engine: "WebKit" },
      os: { name: "macOS", version: "10.15.7" },
      network: {
        method: expect.any(String),
        endpoint: expect.stringContaining("/api/v1/"),
        status: expect.anything(),
        responseTimeMs: expect.any(Number),
        requestId: expect.stringContaining("stub-request-"),
      },
      breadcrumbs: expect.any(Array),
      errors: expect.any(Array),
      release: { version: expect.any(String), commit: expect.any(String) },
    });
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "error",
          message: "diagnostic smoke error",
          source: "/app.js?token",
          line: 12,
          column: 4,
          stack: expect.any(String),
        }),
      ]),
    );
    expect(report.breadcrumbs.length).toBeGreaterThanOrEqual(5);
    expect(report.breadcrumbs.length).toBeLessThanOrEqual(10);
    expect(report.breadcrumbs.map((item) => item.type)).toEqual(
      expect.arrayContaining(["navigation", "click", "network"]),
    );
    expect(report).not.toHaveProperty("ua");
    expect(JSON.stringify(report)).not.toContain(rawUserAgent);

    // Даже при низком viewport верхняя граница диалога остаётся на экране.
    await page.setViewportSize({ width: 820, height: 420 });
    const box = await dialog.boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(0);

    const reportRequest = page.waitForRequest((request) =>
      request.method() === "POST" && request.url().endsWith("/api/v1/me/problem-reports"),
    );
    await dialog.getByRole("button", { name: "отправить отчёт" }).click();
    const submitted = await reportRequest;
    expect(submitted.headers()["content-type"]).toContain("multipart/form-data");
    await expect(dialog.getByText("отчёт доставлен", { exact: true })).toBeVisible();
    await expect(dialog.getByText("12b3b7f9-7b92-4ea6-b745-7ae9c0199a92")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("keeps the draft and offers retry when report delivery fails", async ({ page }) => {
    await enterCabinet(page);
    await page.locator(".user-chip").click();
    await page.locator(".user-menu__report").click();
    const dialog = page.locator(".shell-dialog--report");
    await dialog.locator(".report-textarea").fill("Не загружается сессия повторения");
    await dialog.getByRole("button", { name: "отправить отчёт" }).click();

    await expect(dialog.getByRole("alert")).toContainText("Не удалось доставить отчёт");
    await expect(dialog.getByRole("button", { name: "повторить отправку" })).toBeVisible();
    await expect(dialog.locator(".report-textarea")).toHaveValue("Не загружается сессия повторения");
  });
});
