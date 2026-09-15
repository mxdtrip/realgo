import { expect, test } from "@playwright/test";

// The reworked cabinet mechanics: /reviews is the journal of problems solved
// on platforms (status, hints used, self-rating), /problems tracks the
// practice set of subpatterns per stage. /cards separates due repetition from
// active-subpattern practice. Backed by the PROBLEMS / PRACTICE fixtures in
// auth-stub.mjs.

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";

async function openAuthed(page, path) {
  await page.goto("/dashboard");
  await page.evaluate(
    ([a, r]) => {
      localStorage.setItem(a, "LIVE.access");
      localStorage.setItem(r, "LIVE.refresh");
      localStorage.setItem("realgo.cabinet.tour", "done");
    },
    [AKEY, RKEY],
  );
  await page.goto(path);
}

test.describe("/reviews — журнал решённых задач", () => {
  test("rows carry status, hints used, self-rating and due marker", async ({ page }) => {
    await openAuthed(page, "/reviews");

    const journal = page.locator("table.data-table");
    const koko = journal.getByRole("link", { name: /Stub Problem: Koko Eating Bananas/ });
    await expect(koko).toHaveAttribute("href", "https://example.test/koko");

    const kokoRow = journal.getByRole("row", { name: /Koko Eating Bananas/ });
    // Difficulty renders as bare colored text, not a pill.
    await expect(kokoRow.locator(".difficulty-text--medium")).toHaveText("средняя");
    // Hints used comes from the assistant log join.
    await expect(kokoRow.getByText("2", { exact: true })).toBeVisible();
    // Self-rating from the extension popup.
    await expect(kokoRow.locator(".review-badge--warning")).toHaveText("тяжело");

    // Pattern cell deep-links into the Atlas node.
    await expect(page.getByRole("link", { name: "Binary Search on Answer" })).toHaveAttribute(
      "href",
      "/patterns/binary_search_on_answer",
    );

    // Search and status tabs narrow the journal.
    await page.getByRole("searchbox").fill("two sum");
    await expect(journal.getByText("Stub Problem: Two Sum")).toBeVisible();
    await expect(journal.getByText("Stub Problem: Koko Eating Bananas")).toHaveCount(0);

    await page.getByRole("searchbox").fill("");
    await page.getByRole("button", { name: /освоена/ }).click();
    await expect(journal.getByText("Stub Problem: Two Sum")).toBeVisible();
    await expect(journal.getByText("Stub Problem: Koko Eating Bananas")).toHaveCount(0);
  });

  test("mobile journal becomes readable cards instead of a clipped table", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAuthed(page, "/reviews");

    const row = page.locator("table.data-table tbody tr").first();
    await expect(row).toBeVisible();
    await expect(row.locator("td").nth(1)).toHaveCSS("display", "grid");
    await expect(page.locator(".reviews-journal-table")).toHaveCSS("overflow", "visible");
  });
});

test.describe("/queue — очередь повторений", () => {
  test("shows all due types and lets a problem review be completed", async ({ page }) => {
    await openAuthed(page, "/queue");

    await expect(page.getByRole("heading", { name: "Повторения на сегодня" })).toBeVisible();
    await expect(page.locator(".review-queue-card")).toHaveCount(3);
    await expect(page.getByRole("link", { name: /Открыть задачу/ })).toHaveAttribute(
      "href",
      "https://example.test/koko",
    );
    await expect(page.getByRole("link", { name: /Повторить карточки/ })).toHaveAttribute(
      "href",
      "/cards/session",
    );

    const problem = page.locator(".review-queue-card", { hasText: "Koko Eating Bananas" });
    const rate = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().includes("/me/reviews/501/rate"),
    );
    await problem.getByRole("button", { name: "Нормально" }).click();
    await rate;
    await expect(problem).toHaveCount(0);
  });
});

test.describe("/problems — практика подпаттернов", () => {
  test("stages derive from mastery; a row can leave the practice set", async ({ page }) => {
    await openAuthed(page, "/problems");

    // Three fixtures → three distinct stages.
    const working = page.locator(".practice-item", { hasText: "Binary Search on Answer" });
    await expect(working.locator(".status-pill")).toHaveText("в работе");
    const mastered = page.locator(".practice-item", { hasText: "Lower / Upper Bound" });
    await expect(mastered.locator(".status-pill")).toHaveText("освоен");
    const added = page.locator(".practice-item", { hasText: "Fixed-Size Window" });
    await expect(added.locator(".status-pill")).toHaveText("добавлен");

    // Name links into the Atlas node page.
    await expect(page.getByRole("link", { name: "Binary Search on Answer" })).toHaveAttribute(
      "href",
      "/patterns/binary_search_on_answer",
    );

    // Stage tabs filter the list.
    await page.getByRole("button", { name: /освоен/ }).click();
    await expect(page.getByText("Lower / Upper Bound")).toBeVisible();
    await expect(page.getByText("Binary Search on Answer")).toHaveCount(0);
    await page.getByRole("button", { name: /^все/ }).click();

    // Removing one row must not disable every other row. Hold the first
    // request open, then verify a second row can be removed concurrently.
    let releaseFirst;
    const firstCanFinish = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    await page.route("**/api/v1/me/practice/subpatterns/*", async (route) => {
      if (route.request().url().includes("binary_search_on_answer")) {
        await firstCanFinish;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { status: "removed" } }),
      });
    });
    await working.getByRole("button", { name: "убрать из практики" }).click();
    await expect(working.getByRole("button", { name: "убрать из практики" })).toBeDisabled();
    await expect(mastered.getByRole("button", { name: "убрать из практики" })).toBeEnabled();

    const secondDelete = page.waitForRequest(
      (request) =>
        request.method() === "DELETE" &&
        request.url().includes("/me/practice/subpatterns/lower_upper_bound"),
    );
    await mastered.getByRole("button", { name: "убрать из практики" }).click();
    await secondDelete;
    releaseFirst();
    await expect(working).toHaveCount(0);
    await expect(mastered).toHaveCount(0);

    // Removing fires DELETE /me/practice/subpatterns/{code} and drops the row.
    const del = page.waitForRequest(
      (request) =>
        request.method() === "DELETE" &&
        request.url().includes("/me/practice/subpatterns/fixed_size_window"),
    );
    await added.getByRole("button", { name: "убрать из практики" }).click();
    await del;
    await expect(page.locator(".practice-item", { hasText: "Fixed-Size Window" })).toHaveCount(0);
  });
});

test.describe("/dashboard — лаунчер практики", () => {
  test("launcher shows live practice numbers and starts scope=practice", async ({ page }) => {
    await openAuthed(page, "/dashboard");

    const launcher = page.locator(".next-up");
    await expect(launcher.getByText("Практика по активным подпаттернам")).toBeVisible();
    // One of the two cards already has an attempt, so the launcher shows one remaining.
    await expect(launcher.locator(".next-up__meta")).toContainText("3");
    await expect(launcher.locator(".next-up__meta")).toContainText("1");
    await expect(launcher.getByRole("link", { name: /начать практику/ })).toHaveAttribute(
      "href",
      "/cards/session?scope=practice",
    );
    await expect(page.locator(".review-when").first()).toContainText(/просрочено на 3 дня/);
    await expect(page.locator(".dashboard-next-action")).toContainText("2 повторения на сегодня");
    await expect(page.locator(".dashboard-next-action").getByRole("link", { name: /Начать/ })).toHaveAttribute(
      "href",
      "/queue",
    );
  });

  test("finished day never links the primary action to an empty due session", async ({ page }) => {
    await page.route("**/api/v1/me/dashboard", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      payload.data.stats = payload.data.stats.map((stat) =>
        stat.key === "today_queue" ? { ...stat, value: 0, displayValue: "0" } : stat,
      );
      payload.data.nextAction = {
        type: "roadmap_step",
        title: "На сегодня всё готово",
        description: "Следующее повторение: Two Pointers",
        href: "/roadmap",
        dueAt: "2026-09-17T09:00:00Z",
      };
      await route.fulfill({ response, json: payload });
    });

    await openAuthed(page, "/dashboard");

    const next = page.locator(".dashboard-next-action");
    await expect(next).toContainText("На сегодня всё готово");
    await expect(next.getByRole("link", { name: "Продолжить по плану" })).toHaveAttribute(
      "href",
      "/roadmap",
    );
    await expect(next.getByRole("link", { name: "Посмотреть очередь" })).toHaveCount(0);
  });
});

test.describe("атлас — добавить подпаттерн в практику", () => {
  test("hero toggle reflects state and posts the change", async ({ page }) => {
    await openAuthed(page, "/patterns/binary_search_on_answer");

    // Already in the stub practice set → active state.
    const toggle = page.getByRole("button", { name: /в практике/ });
    await expect(toggle).toBeVisible();

    // Toggling off fires DELETE, label flips to "add".
    const del = page.waitForRequest(
      (request) =>
        request.method() === "DELETE" &&
        request.url().includes("/me/practice/subpatterns/binary_search_on_answer"),
    );
    await toggle.click();
    await del;
    const addButton = page.getByRole("button", { name: /добавить в практику/ });
    await expect(addButton).toBeVisible();

    // Toggling back on posts the code.
    const post = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().includes("/me/practice/subpatterns"),
    );
    await addButton.click();
    const request = await post;
    expect(request.postDataJSON()).toMatchObject({ code: "binary_search_on_answer" });
    await expect(page.getByRole("button", { name: /в практике/ })).toBeVisible();
  });
});
