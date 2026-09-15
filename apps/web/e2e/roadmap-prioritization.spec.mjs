import { expect, test } from "@playwright/test";

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";
const TOUR_KEY = "realgo.cabinet.tour";

async function authenticate(page) {
  await page.goto("/dashboard");
  await page.evaluate(
    ([accessKey, refreshKey, tourKey]) => {
      localStorage.setItem(accessKey, "LIVE.access");
      localStorage.setItem(refreshKey, "LIVE.refresh");
      localStorage.setItem(tourKey, "done");
    },
    [AKEY, RKEY, TOUR_KEY],
  );
}

test("onboarding previews and saves a roadmap priority mode", async ({ page }) => {
  await authenticate(page);
  await page.goto("/onboarding/profile?force=1");

  await page.getByRole("radio", { name: "LeetCode" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByLabel("компания").fill("Google");
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  await expect(page.getByText("Как расставить темы?")).toBeVisible();
  await page.getByRole("button", { name: "Легче → сложнее" }).click();
  await expect(page.getByText("Сначала темы с большей долей easy-задач, затем medium и hard.")).toBeVisible();
  await expect(page.getByText("тем в резерве")).toBeVisible();

  await page.getByRole("button", { name: "Далее" }).click();
  await expect(page.getByText("Добро пожаловать в ReAlgo")).toBeVisible();
  await expect(page.getByText("Легче → сложнее")).toBeVisible();
});

test("roadmap previews mode changes before rebuilding future weeks", async ({ page }) => {
  await authenticate(page);
  await page.goto("/roadmap");

  await expect(page.getByRole("heading", { name: "План текущей недели" })).toBeVisible();
  await expect(page.getByText("идёшь с опережением")).toBeVisible();
  await expect(page.getByText("Two Sum II", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Решить задачу" })).toHaveAttribute(
    "href",
    "https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/",
  );
  await expect(page.locator(".roadmap-plan-item")).toContainText("1/2 готово");
  await expect(page.locator(".roadmap-plan-item")).toContainText("1/3 готово");

  await expect(page.getByText("Порядок тем")).toBeVisible();
  await page.getByRole("button", { name: "Чаще спрашивают" }).click();
  await expect(page.getByText(/Предпросмотр: завершённые и текущая недели/)).toBeVisible();
  await page.getByRole("button", { name: "перестроить будущие недели" }).click();
  await expect(page.getByRole("button", { name: "Чаще спрашивают" })).toHaveAttribute("aria-pressed", "true");
});

test("roadmap does not offer work ahead while the current stage is unfinished", async ({ page }) => {
  await page.route("**/api/v1/me/roadmap", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.weeks[0] = {
      ...payload.data.weeks[0],
      progress: 40,
      status: "active",
      items: payload.data.weeks[0].items.map((item) => ({
        ...item,
        masteryPercent: 40,
        planProgress: 25,
        tasks: item.tasks.map((task) => ({ ...task, status: "not_started" })),
        cardProgress: { ...item.cardProgress, reviewed: 0 },
      })),
    };
    payload.data.weeks[1] = { ...payload.data.weeks[1], status: "todo" };
    await route.fulfill({ response, json: payload });
  });

  await authenticate(page);
  await page.goto("/roadmap");

  await expect(page.getByText("идёшь с опережением")).toHaveCount(0);
  await expect(page.getByText("идёшь по плану")).toBeVisible();
  await expect(page.getByText("Сначала завершить предыдущие недели")).toBeVisible();
});
