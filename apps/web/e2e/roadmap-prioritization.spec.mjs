import { expect, test } from "@playwright/test";

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:session:v2";
const TOUR_KEY = "realgo.cabinet.tour";

async function authenticate(page) {
  await page.goto("/dashboard");
  await page.evaluate(
    ([accessKey, refreshKey, tourKey]) => {
      localStorage.removeItem(accessKey);
      localStorage.setItem(refreshKey, String("LIVE.refresh").split(".")[0]+".session");
      document.cookie = "realgo-refresh-"+String("LIVE.refresh").split(".")[0]+".session="+String("LIVE.refresh").split(".")[0]+".refresh; Path=/; SameSite=Strict";
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
  const companyInput = page.getByLabel("компании");
  await expect(companyInput).toHaveAttribute("autocomplete", "off");
  await expect(companyInput).not.toHaveAttribute("list", /.+/);
  await companyInput.fill("Google");
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

test("onboarding selects multiple companies from comma input and the catalog", async ({ page }) => {
  const savedCompanies = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().endsWith("/api/v1/me/roadmap")) {
      savedCompanies.push(request.postDataJSON().companyName);
    }
  });

  await authenticate(page);
  await page.goto("/onboarding/profile?force=1");
  await page.getByRole("radio", { name: "LeetCode" }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  await page.getByLabel("компании").fill("Google, Meta,");
  const selected = page.getByLabel("Выбранные компании");
  await expect(selected.getByRole("button", { name: /Google/ })).toBeVisible();
  await expect(selected.getByRole("button", { name: /Meta/ })).toBeVisible();

  await page.getByRole("button", { name: "Показать все компании в базе" }).click();
  await expect(page.getByLabel("Все компании в базе ReAlgo")).toContainText("Yandex");
  await page.getByLabel("Все компании в базе ReAlgo").getByRole("button", { name: "Yandex" }).click();

  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Месяц интервью: вперёд" }).click();
  const dayList = page.getByRole("listbox", { name: "День интервью" });
  await dayList.getByRole("option", { name: "15", exact: true }).click();
  const before = await page.locator(".onboarding-wheels-result").innerText();
  await page.getByRole("button", { name: "День интервью: вперёд" }).click();
  await expect(page.locator(".onboarding-wheels-result")).not.toHaveText(before);
  const selectedDay = dayList.getByRole("option", { selected: true });
  const dayAfterArrow = Number(await selectedDay.innerText());
  await page.getByRole("listbox", { name: "День интервью" }).hover();
  await page.mouse.wheel(0, -800);
  await expect(selectedDay).toHaveText(String(dayAfterArrow - 1).padStart(2, "0"));
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  await expect(page.getByText("Добро пожаловать в ReAlgo")).toBeVisible();
  expect(savedCompanies).toEqual(["Yandex", "Meta", "Google"]);
});

test("roadmap previews mode changes before rebuilding future weeks", async ({ page }) => {
  await authenticate(page);
  await page.goto("/roadmap");

  await expect(page.getByRole("heading", { name: "План следующей недели" })).toBeVisible();
  await expect(page.getByText("Выполнение опережает график")).toBeVisible();
  await expect(page.getByText("Изучить Two Pointers", { exact: true })).toBeVisible();
  await expect(page.locator(".roadmap-current-plan__next").getByRole("link", { name: "Изучить тему" })).toHaveAttribute(
    "href",
    "/patterns/two_pointers?from=roadmap",
  );
  const currentPattern = page.locator(".roadmap-plan-item.is-current");
  await expect(currentPattern).toContainText("1/2 готово");
  await expect(currentPattern).toContainText("1/3 готово");
  const stages = currentPattern.locator(".roadmap-stage-track");
  await expect(stages.getByText("Теория", { exact: true })).toBeVisible();
  await expect(stages.getByText("Задачи", { exact: true })).toBeVisible();
  await expect(stages.getByText("Карточки", { exact: true })).toBeVisible();
  await expect(page.locator(".roadmap-plan-item.is-current")).toHaveCount(1);
  await expect(page.locator(".roadmap-plan-item__stage-action")).toHaveCount(1);
  await expect(page.locator(".roadmap-stage-track").getByText("сейчас", { exact: true })).toHaveCount(1);
  await expect(page.getByText("следующий в плане", { exact: true })).toHaveCount(1);

  await expect(page.getByText("Настройка плана")).toBeVisible();
  await page.getByRole("button", { name: "Чаще спрашивают" }).click();
  await expect(page.getByText(/Предпросмотр: завершённые и текущая недели/)).toBeVisible();
  await page.getByRole("button", { name: "перестроить будущие недели" }).click();
  await expect(page.getByRole("button", { name: "Чаще спрашивают" })).toHaveAttribute("aria-pressed", "true");
});

test("roadmap shows schedule, current plan, then plan settings", async ({ page }) => {
  await authenticate(page);
  await page.goto("/roadmap");

  const schedule = page.getByRole("heading", { name: "График подготовки" });
  const currentPlan = page.getByRole("heading", { name: "План следующей недели" });
  const settings = page.locator(".roadmap-priority-panel");

  await expect(schedule).toBeVisible();
  await expect(currentPlan).toBeVisible();
  await expect(settings).toContainText("Настройка плана");
  await expect(page.getByRole("link", { name: "Открыть план недели" })).toHaveCount(0);

  const [scheduleTop, currentPlanTop, settingsTop] = await Promise.all([
    schedule.evaluate((element) => element.getBoundingClientRect().top),
    currentPlan.evaluate((element) => element.getBoundingClientRect().top),
    settings.evaluate((element) => element.getBoundingClientRect().top),
  ]);
  expect(scheduleTop).toBeLessThan(currentPlanTop);
  expect(currentPlanTop).toBeLessThan(settingsTop);
});

test("roadmap switches between company preparation plans", async ({ page }) => {
  await authenticate(page);
  await page.goto("/roadmap");

  const switcher = page.getByRole("navigation", { name: "Подготовка к компании" });
  await expect(switcher).toBeVisible();
  await switcher.getByRole("button", { name: "Meta" }).click();
  await expect(page.locator(".cabinet-page-head__actions")).toContainText("Meta");
  await expect(switcher.getByRole("button", { name: "Meta" })).toHaveClass(/is-active/);
});

test("completing theory advances the guided route to the first unsolved task", async ({ page }) => {
  await authenticate(page);
  await page.goto("/roadmap");

  await page.locator(".roadmap-current-plan__next").getByRole("link", { name: "Изучить тему" }).click();
  await expect(page).toHaveURL(/\/patterns\/two_pointers\?from=roadmap/);
  await expect(page.getByText("этап 1 из 3 · теория")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Готов перейти к задачам?" })).toBeVisible();

  await page.getByRole("button", { name: /Теория понятна/ }).click();

  await expect(page).toHaveURL(/\/roadmap#current-plan/);
  await expect(page.getByText("Two Sum II", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Решить задачу" }).click();
  await expect(page.getByRole("dialog", { name: "Two Sum II" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Открыть задачу" })).toHaveAttribute(
    "href",
    "https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/",
  );
});

test("roadmap records a manual task rating without the extension", async ({ page }) => {
  await authenticate(page);
  await page.goto("/roadmap");

  await page.getByRole("button", { name: /Two Sum II/ }).click();
  const openTask = page.getByRole("link", { name: "Открыть задачу" });
  await openTask.evaluate((element) => {
    element.addEventListener("click", (event) => event.preventDefault(), { once: true });
  });
  await openTask.click();

  await expect(page.getByRole("heading", { name: "Как далась задача?" })).toBeVisible();
  await page.getByRole("button", { name: /Нормально/ }).click();
  await expect(page.getByRole("heading", { name: "Результат сохранён" })).toBeVisible();
  await page.getByRole("button", { name: "Вернуться к плану" }).click();

  const currentPattern = page.locator(".roadmap-plan-item").filter({ hasText: "Two Pointers" }).first();
  await expect(currentPattern).toContainText("2/2 готово");
  await expect(page.locator(".roadmap-current-plan__next")).toContainText("Вопросы по Two Pointers");
});

test("roadmap lets a user replace an inaccessible external task", async ({ page }) => {
  await authenticate(page);
  await page.goto("/roadmap");

  await page.getByRole("button", { name: /Two Sum II/ }).click();
  const openTask = page.getByRole("link", { name: "Открыть задачу" });
  await openTask.evaluate((element) => {
    element.addEventListener("click", (event) => event.preventDefault(), { once: true });
  });
  await openTask.click();

  await page.getByRole("button", { name: "Нет доступа к задаче?" }).click();
  await expect(page.getByRole("heading", { name: "Нет доступа к задаче?" })).toBeVisible();
  await page.getByRole("button", { name: "Заменить задачу" }).click();
  await expect(page.getByRole("heading", { name: "Задача заменена" })).toBeVisible();
  await page.getByRole("button", { name: "Вернуться к плану" }).click();

  await expect(page.getByRole("button", { name: /3Sum/ })).toBeVisible();
});

test("roadmap keeps card-session return context in the next action", async ({ page }) => {
  await page.route("**/api/v1/me/roadmap", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.nextAction = {
      stage: "cards",
      title: "Вопросы по Two Pointers",
      description: "Two Pointers · этап 3 из 3 · карточки",
      href: "/patterns/two_pointers/session",
      patternCode: "two_pointers",
      weekId: "week_02",
    };
    await route.fulfill({ response, json: payload });
  });

  await authenticate(page);
  await page.goto("/roadmap");

  await expect(
    page.locator(".roadmap-current-plan__next").getByRole("link", { name: "Пройти карточки" }),
  ).toHaveAttribute("href", "/patterns/two_pointers/session?from=roadmap");
});

test("card session entered from roadmap returns to the current plan", async ({ page }) => {
  await authenticate(page);
  await page.goto("/patterns/two_pointers/session?from=roadmap");

  const exit = page.getByRole("link", { name: "Выйти из сессии" });
  await expect(exit).toHaveAttribute("href", "/roadmap#current-plan");
  await exit.click();
  await expect(page).toHaveURL(/\/roadmap#current-plan/);
});

test("roadmap card session ignores a completed stored session", async ({ page }) => {
  await authenticate(page);
  await page.goto("/dashboard");
  await page.evaluate(() => {
    localStorage.setItem(
      "realgo:card-review-session:v2:roadmap:two_pointers",
      JSON.stringify({
        queue: [],
        history: [],
        sessionCardIds: ["9101", "9102"],
      }),
    );
  });

  await page.goto("/patterns/two_pointers/session?from=roadmap");

  await expect(page.locator(".focus-card")).toBeVisible();
  await expect(page.getByText("Повторение завершено")).toHaveCount(0);
});

test("roadmap keeps an unsolved manual attempt active", async ({ page }) => {
  await authenticate(page);
  await page.goto("/roadmap");

  await page.getByRole("button", { name: /Maximum Average Subarray I/ }).click();
  const openTask = page.getByRole("link", { name: "Открыть задачу" });
  await openTask.evaluate((element) => {
    element.addEventListener("click", (event) => event.preventDefault(), { once: true });
  });
  await openTask.click();
  await page.getByRole("button", { name: /Не решил/ }).click();

  await expect(page.getByRole("heading", { name: "Задача остаётся в плане" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Повторить теорию" })).toBeVisible();
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
        stage: "tasks",
        theory: { completed: true, completedAt: new Date().toISOString() },
        tasks: item.tasks.map((task) => ({ ...task, status: "not_started" })),
        cardProgress: { ...item.cardProgress, reviewed: 0 },
      })),
    };
    payload.data.weeks[1] = { ...payload.data.weeks[1], status: "todo" };
    payload.data.nextAction = {
      stage: "tasks",
      title: "Two Sum",
      description: "Arrays & Hashing · этап 2 из 3 · задача",
      href: "https://leetcode.com/problems/two-sum/",
      patternCode: "arrays_hashing",
      weekId: "week_01",
    };
    await route.fulfill({ response, json: payload });
  });

  await authenticate(page);
  await page.goto("/roadmap");

  await expect(page.getByText("Выполнение опережает график")).toHaveCount(0);
  await expect(page.getByText("Выполнение соответствует графику")).toBeVisible();
  await expect(page.getByText("Сначала завершить предыдущие недели")).toBeVisible();
});
