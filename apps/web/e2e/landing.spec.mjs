import { expect, test } from "@playwright/test";

// Regression cover for the scroll-driven Three.js background and FAQ state.

test.describe("landing conversion path", () => {
  test("renders the interactive word on the first client frame", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".word-letter")).toHaveCount(6);
  });

  test("states the product offer and repeats contextual registration CTAs", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Подготовка к алгоритмическим собеседованиям, которая помогает не забывать решения",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Начать подготовку сейчас/ }).first()).toHaveAttribute(
      "href",
      "/register?intent=hero",
    );
    await expect(page.getByRole("link", { name: "Купить PRO" })).toHaveAttribute(
      "href",
      "/register?intent=pricing-pro",
    );
    await expect(page.locator('a[href^="/register?intent="]')).toHaveCount(8);
    await expect(page.locator('#pricing a[href^="/register?intent=pricing-"]')).toHaveCount(2);
    await expect(page.locator(".landing-cta__note")).toHaveCount(0);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
  });

  test("keeps CTA centers black and expands the rotating rim symmetrically", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator(".hero-cta a").first();

    const readRim = () =>
      cta.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          halfSpan: style.getPropertyValue("--landing-cta-rim-blue-half-span").trim(),
          background: style.backgroundImage,
          duration: style.animationDuration,
        };
      });

    const initial = await readRim();
    expect(initial.halfSpan).toBe("21deg");
    expect(initial.background).toMatch(/^linear-gradient\(rgb\(5, 7, 12\)/);

    await cta.hover();
    await expect.poll(async () => (await readRim()).halfSpan).toBe("180deg");
    expect((await readRim()).duration).toBe(initial.duration);

    await page.mouse.move(0, 0);
    await expect.poll(async () => (await readRim()).halfSpan).toBe("21deg");
  });

  test("moves section 01 through the AI helper into the saved-task state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const section = page.locator("#memory");
    const metrics = await section.evaluate((element) => ({
      top: element.offsetTop,
      height: element.offsetHeight,
    }));

    await page.evaluate((top) => window.scrollTo(0, top), metrics.top);
    await expect(
      page.getByRole("heading", {
        name: "Застрял в задаче? ReAlgo подскажет следующий шаг.",
      }),
    ).toBeVisible();

    const popup = page.locator("#memory .realgo-popup");
    const initialPopupBox = await popup.boundingBox();
    expect(initialPopupBox?.width).toBe(400);
    expect(initialPopupBox?.height).toBe(372);

    await page.getByRole("button", { name: "получить подсказку" }).click();
    await expect(page.getByText("Массив уже отсортирован.", { exact: false })).toBeVisible();

    // The entering gesture snaps to anchor one. A fresh gesture starts the
    // transition immediately; there is no timed hold at either anchor.
    await page.evaluate((top) => window.scrollTo(0, top - 160), metrics.top);
    await page.waitForTimeout(60);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(60);
    expect(await section.evaluate((element) => element.style.getPropertyValue("--memory-journey-shift"))).toBe(
      "0px",
    );

    // A distinct second gesture may begin before anchor one finishes. It must
    // be queued and launch the scene as soon as the anchor settles, without a
    // third gesture or an extra quiet pause.
    await page.waitForTimeout(100);
    await page.mouse.wheel(0, 40);
    await expect
      .poll(() =>
        section.evaluate((element) =>
          Math.abs(Number.parseFloat(element.style.getPropertyValue("--memory-journey-shift"))),
        ),
      )
      .toBeGreaterThan(1);
    await page.waitForTimeout(1450);

    await expect(
      page.getByRole("heading", {
        name: "Ты решил задачу. ReAlgo сохраняет то, к чему нужно вернуться.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Как далась задача?")).toBeVisible();
    await expect(page.getByRole("link", { name: /Сохранить первую задачу/ })).toHaveAttribute(
      "href",
      "/register?intent=memory",
    );

    const finalPopupBox = await popup.boundingBox();
    expect(finalPopupBox?.x).toBeLessThan(initialPopupBox?.x ?? 0);
    expect(finalPopupBox?.width).toBe(400);
    expect(finalPopupBox?.height).toBe(372);
    await expect(page.locator(".memory-demo-layer--agent")).toHaveCSS("opacity", "1");
    await expect(page.locator(".memory-demo-layer--rating")).toHaveCSS("opacity", "1");
    await expect(page.locator(".memory-demo-layer--agent")).toHaveCSS("z-index", "2");
    await expect(page.locator(".memory-demo-layer--rating")).toHaveCSS("z-index", "1");

    await page.mouse.wheel(0, 40);
    const sectionEnd = metrics.top + metrics.height - 900;
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(sectionEnd);
  });
});

test.describe("landing card-flow background", () => {
  test("restores the matching Three.js frame after a deep reload", async ({ page }) => {
    await page.goto("/");
    const background = page.locator(".scroll-card-flow-bg");
    await expect(background).toHaveAttribute("data-state", "ready");
    await expect(background.locator("canvas")).toHaveCount(1);
    await expect(background).toHaveAttribute("data-card-count", "40");
    await expect(background).toHaveAttribute("data-visible-cards", "40");

    await page.locator("#memory").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.getElementById("memory").offsetTop + 800));
    await expect.poll(async () => Number(await background.getAttribute("data-progress"))).toBeGreaterThan(0.9);
    await expect(background).toHaveAttribute("data-visible-cards", "40");
    await expect(background).toHaveAttribute("data-on-curve-cards", "0");

    await page.reload();
    await expect
      .poll(async () => Number(await page.locator(".scroll-card-flow-bg").getAttribute("data-progress")), {
        timeout: 8000,
      })
      .toBeGreaterThan(0.9);
    await expect(page.locator(".scroll-card-flow-bg")).toHaveAttribute("data-visible-cards", "40");
    await expect(page.locator(".scroll-card-flow-bg")).toHaveAttribute("data-on-curve-cards", "0");
    await expect(page.locator("video[src='/realgo-hero.mp4']")).toHaveCount(0);
  });
});

test.describe("landing roadmap interaction", () => {
  test("moves the roadmap glow with the pointer", async ({ page }) => {
    await page.goto("/");
    const roadmap = page.locator(".roadmap-demo");
    await roadmap.scrollIntoViewIfNeeded();

    await roadmap.hover({ position: { x: 24, y: 24 } });
    const firstPosition = await roadmap.evaluate((element) => ({
      x: element.style.getPropertyValue("--roadmap-glow-x"),
      y: element.style.getPropertyValue("--roadmap-glow-y"),
      shiftX: element.style.getPropertyValue("--demo-gradient-shift-x"),
      shiftY: element.style.getPropertyValue("--demo-gradient-shift-y"),
      angle: element.style.getPropertyValue("--demo-gradient-angle"),
    }));

    await roadmap.hover({ position: { x: 220, y: 260 } });
    const secondPosition = await roadmap.evaluate((element) => ({
      x: element.style.getPropertyValue("--roadmap-glow-x"),
      y: element.style.getPropertyValue("--roadmap-glow-y"),
      shiftX: element.style.getPropertyValue("--demo-gradient-shift-x"),
      shiftY: element.style.getPropertyValue("--demo-gradient-shift-y"),
      angle: element.style.getPropertyValue("--demo-gradient-angle"),
    }));

    expect(firstPosition).not.toEqual(secondPosition);
  });
});

test.describe("landing pricing interaction", () => {
  test("keeps plan identity fixed while revealing features and CTA on hover", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("#pricing .price-card").first();

    const readState = () =>
      card.evaluate((element) => {
        const name = element.querySelector(":scope > span");
        const price = element.querySelector(":scope > strong");
        const features = element.querySelector(":scope > .price-features");
        const cta = element.querySelector(":scope > .price-cta");
        return {
          nameTransform: getComputedStyle(name).transform,
          priceTransform: getComputedStyle(price).transform,
          featuresTransform: getComputedStyle(features).transform,
          ctaTransform: getComputedStyle(cta).transform,
          ctaOpacity: getComputedStyle(cta).opacity,
          ctaFilter: getComputedStyle(cta).filter,
        };
      });

    const initial = await readState();
    expect(initial.nameTransform).toBe("none");
    expect(initial.priceTransform).toBe("none");
    expect(initial.featuresTransform).not.toBe("none");
    expect(initial.ctaOpacity).toBe("1");
    expect(initial.ctaFilter).toBe("none");

    await card.hover();
    await page.waitForTimeout(1550);
    const hovered = await readState();
    expect(hovered.nameTransform).toBe("none");
    expect(hovered.priceTransform).toBe("none");
    expect(hovered.featuresTransform).not.toBe(initial.featuresTransform);
    expect(hovered.ctaTransform).toMatch(/matrix\(1, 0, 0, 1, 0, 0\)/);
    expect(hovered.ctaOpacity).toBe("1");
    expect(hovered.ctaFilter).toBe("none");
  });
});

test.describe("landing FAQ", () => {
  test("renders with every question collapsed", async ({ page }) => {
    await page.goto("/");
    await page.locator("#faq").scrollIntoViewIfNeeded();

    const openCount = await page.locator(".faq-item.is-open").count();
    expect(openCount).toBe(0);
    await expect(page.locator("#faq-button-0")).toHaveAttribute("aria-expanded", "false");
  });

  test("clicking a question expands it", async ({ page }) => {
    await page.goto("/");
    await page.locator("#faq").scrollIntoViewIfNeeded();
    await page.click("#faq-button-1");
    await expect(page.locator("#faq-button-1")).toHaveAttribute("aria-expanded", "true");
  });
});
