import { expect, test } from "@playwright/test";

// Regression cover for the scroll-driven Three.js background and FAQ state.

test.describe("landing conversion path", () => {
  test("renders the interactive word on the first client frame", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".word-letter")).toHaveCount(6);
    await expect(page.locator(".word-letter").first()).toHaveCSS("font-family", /JetBrains Mono/);
    await expect(page.locator(".code-sheet")).toHaveCSS("font-family", /JetBrains Mono/);
    await expect(page.locator(".site-strip .site-brand")).toHaveCSS("font-family", /JetBrains Mono/);
    await expect(page.locator(".site-footer")).toHaveCSS("font-family", /JetBrains Mono/);
    await expect(page.locator(".site-footer__brand p")).toHaveCSS("font-family", /JetBrains Mono/);
    await expect(page.locator(".landing-proof strong")).toHaveText(["4", "111", "FSRS"]);
    await expect(page.locator(".landing-proof strong").first()).toHaveCSS("font-family", /JetBrains Mono/);
    await expect(page.locator(".site-nav a")).toHaveText(["Tasks", "Plan", "Reviews", "Pricing", "FAQ"]);
  });

  test("keeps the hero at the top while the extension demo hydrates", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1_500);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("places the hero object band 15px below the script field on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator(".minimal-scene")).toHaveAttribute("data-scene-ready", "true");

    const targetOffset = 15;

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const code = document.querySelector(".code-editor")?.getBoundingClientRect();
          const letterRects = [...document.querySelectorAll(".word-letter")]
            .map((element) => element.getBoundingClientRect())
            .filter((rect) => rect.width > 0 && rect.height > 0);
          const wordTop = Math.min(...letterRects.map((rect) => rect.top));

          return wordTop - (code?.top ?? 0);
        }).then((offset) => Math.abs(offset - targetOffset)),
      )
      .toBeLessThanOrEqual(12);

    const metrics = await page.evaluate(() => {
      const code = document.querySelector(".code-editor")?.getBoundingClientRect();
      const letterRects = [...document.querySelectorAll(".word-letter")]
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const wordTop = Math.min(...letterRects.map((rect) => rect.top));
      const canvas = document.querySelector(".scroll-card-flow-bg canvas");
      const canvasTransform = canvas ? getComputedStyle(canvas).transform : "";
      const canvasY = canvasTransform === "none" ? 0 : new DOMMatrixReadOnly(canvasTransform).m42;

      return {
        codeTop: code?.top ?? 0,
        wordTop,
        canvasY,
      };
    });

    expect(Math.abs(metrics.wordTop - metrics.codeTop - targetOffset)).toBeLessThanOrEqual(12);
    expect(metrics.canvasY).toBeGreaterThanOrEqual(-210);
    expect(metrics.canvasY).toBeLessThanOrEqual(-180);
  });

  test("states the product offer and repeats contextual registration CTAs", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Подготовка к алгоритмическим собеседованиям, которая помогает не забывать решения",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Подготовка к алгоритмическим собеседованиям, которая помогает не забывать решения",
      }),
    ).toHaveCSS("font-weight", "400");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Подготовка к алгоритмическим собеседованиям, которая помогает не забывать решения",
      }),
    ).toHaveCSS("color", "rgb(230, 237, 243)");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Подготовка к алгоритмическим собеседованиям, которая помогает не забывать решения",
      }),
    ).toHaveCSS("background-image", "none");
    await expect(page.getByRole("link", { name: /Начать подготовку сейчас/ }).first()).toHaveAttribute(
      "href",
      "/register?intent=hero",
    );
    await expect(page.getByRole("link", { name: "Купить PRO" })).toHaveAttribute(
      "href",
      "/register?intent=pricing-pro",
    );
    await expect(page.locator('a[href^="/register?intent="]')).toHaveCount(7);
    await expect(page.locator('#pricing a[href^="/register?intent=pricing-"]')).toHaveCount(2);
    await expect(page.locator('a[href="/register?intent=faq"]')).toHaveCount(0);
    await expect(page.locator(".landing-cta__note")).toHaveCount(0);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
  });

  test("matches the landing CTA treatment and brightens on hover", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator(".hero-cta a").first();

    const readStyle = () =>
      cta.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          borderColor: style.borderColor,
          borderStyle: style.borderStyle,
          borderWidth: style.borderWidth,
          radius: style.borderRadius,
          shadow: style.boxShadow,
          color: style.color,
          family: style.fontFamily,
          size: style.fontSize,
          weight: style.fontWeight,
        };
      });

    const initial = await readStyle();
    expect(initial).toMatchObject({
      backgroundImage: expect.stringContaining("linear-gradient"),
      borderStyle: "none",
      borderWidth: "0px",
      radius: "8px",
      shadow: "none",
      color: "rgb(255, 255, 255)",
      size: "14px",
      weight: "600",
    });
    expect(initial.family).toContain("Winston");

    await cta.hover();
    await expect.poll(async () => (await readStyle()).backgroundImage).toContain("linear-gradient");

    await page.mouse.move(0, 0);
    await expect.poll(async () => (await readStyle()).backgroundImage).toContain("linear-gradient");

    const signup = page.getByRole("button", { name: "Регистрация" });
    if (await signup.count()) {
      await expect(signup).toHaveCSS("background-image", /linear-gradient/);
      await expect(signup).toHaveCSS("border-radius", "8px");
    }

    const login = page.getByRole("button", { name: "Войти" });
    if (await login.count()) {
      await expect(login).toHaveCSS("background-color", "rgba(255, 255, 255, 0.05)");
    }
  });

  test("keeps landing frame dividers removed", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".site-strip")).toHaveCSS("border-bottom-width", "0px");
    await expect(page.locator("#memory")).toHaveCSS("border-top-width", "0px");
    await expect(page.locator("#roadmap")).toHaveCSS("border-top-width", "0px");
    await expect(page.locator("#pricing")).toHaveCSS("border-top-width", "0px");
    await expect(page.locator(".site-footer")).toHaveCSS("border-top-width", "0px");
    await expect(page.locator(".site-footer__bar")).toHaveCSS("border-top-width", "0px");
  });

  test("keeps the footer legal links inside the page width", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");
    await page.locator(".site-footer").scrollIntoViewIfNeeded();

    await expect(page.getByRole("link", { name: "Конфиденциальность" })).toBeVisible();
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  });

  test("keeps section 01 popup static while switching copy into the saved-task state", async ({ page }) => {
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
    await expect(page.locator("#memory .landing-gradient-text", { hasText: "ReAlgo подскажет" })).toHaveCSS(
      "background-image",
      /linear-gradient/,
    );

    const popup = page.locator("#memory .realgo-popup");
    const initialPopupBox = await popup.boundingBox();
    expect(initialPopupBox?.width).toBe(400);
    expect(initialPopupBox?.height).toBe(372);

    await page.getByRole("button", { name: "получить подсказку" }).click();
    await expect(page.getByText("Массив уже отсортирован.", { exact: false })).toBeVisible();

    const sectionEnd = metrics.top + metrics.height - 900;
    const scrollRange = sectionEnd - metrics.top;

    await page.evaluate(({ top, range }) => window.scrollTo(0, top + range * 0.25), {
      top: metrics.top,
      range: scrollRange,
    });
    await expect
      .poll(() =>
        section.evaluate((element) =>
          Number.parseFloat(element.style.getPropertyValue("--memory-copy-ribbon-progress") || "0"),
        ),
      )
      .toBeGreaterThan(0.2);
    const quarterProgress = await section.evaluate((element) =>
      Number.parseFloat(element.style.getPropertyValue("--memory-copy-ribbon-progress") || "0"),
    );
    expect(quarterProgress).toBeLessThan(0.35);

    await page.evaluate(({ top, range }) => window.scrollTo(0, top + range * 0.62), {
      top: metrics.top,
      range: scrollRange,
    });
    await expect
      .poll(() =>
        section.evaluate((element) =>
          Number.parseFloat(element.style.getPropertyValue("--memory-copy-ribbon-progress") || "0"),
        ),
      )
      .toBeGreaterThan(0.58);
    const partialProgress = await section.evaluate((element) =>
      Number.parseFloat(element.style.getPropertyValue("--memory-copy-ribbon-progress") || "0"),
    );
    expect(partialProgress).toBeLessThan(0.7);
    await page.waitForTimeout(700);
    expect(
      await section.evaluate((element) =>
        Number.parseFloat(element.style.getPropertyValue("--memory-copy-ribbon-progress") || "0"),
      ),
    ).toBeCloseTo(partialProgress, 2);

    await expect(
      page.getByRole("heading", {
        name: "Ты решил задачу. ReAlgo сохраняет то, к чему нужно вернуться.",
      }),
    ).toBeVisible();
    await expect(page.locator("#memory .landing-gradient-text", { hasText: "ReAlgo сохраняет то" })).toHaveCSS(
      "background-image",
      /linear-gradient/,
    );
    const ratingTitleBox = await page.locator(".memory-journey__copy--rating h2").boundingBox();
    const copyStackBox = await page.locator(".memory-journey__copy-stack").boundingBox();
    expect((ratingTitleBox?.x ?? 0) + (ratingTitleBox?.width ?? 0)).toBeLessThanOrEqual(
      (copyStackBox?.x ?? 0) + (copyStackBox?.width ?? 0) + 1,
    );
    await expect(page.getByText("Как далась задача?")).toBeVisible();
    await expect(page.getByRole("link", { name: /Сохранить первую задачу/ })).toHaveAttribute(
      "href",
      "/register?intent=memory",
    );

    const finalPopupBox = await popup.boundingBox();
    expect(Math.abs((finalPopupBox?.x ?? 0) - (initialPopupBox?.x ?? 0))).toBeLessThan(1);
    expect(finalPopupBox?.width).toBe(400);
    expect(finalPopupBox?.height).toBe(372);
    await expect(page.locator(".memory-demo-layer--agent")).toHaveCSS("opacity", "1");
    await expect(page.locator(".memory-demo-layer--rating")).toHaveCSS("opacity", "1");
    await expect(page.locator(".memory-demo-layer--agent")).toHaveCSS("z-index", "2");
    await expect(page.locator(".memory-demo-layer--rating")).toHaveCSS("z-index", "1");

    await page.evaluate((end) => window.scrollTo(0, end + 80), sectionEnd);
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

test.describe("landing review cards", () => {
  test("uses the referenced tiled shine effect on hover", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("#reviews .review-card").first();
    const face = card.locator(".review-flip__face--front");

    await expect(face.locator(".review-flip__shine")).toHaveCount(1);
    await expect(face.locator(".review-flip__tile")).toHaveCount(10);
    await expect(face.locator(".review-flip__line")).toHaveCount(3);
    await expect(face.locator(".review-flip__shine")).toHaveCSS("opacity", "0");
    await expect(face.locator(".review-flip__tiles")).toHaveCSS("opacity", "0");

    await card.hover();
    await expect(face.locator(".review-flip__shine")).toHaveCSS("opacity", "1");
    await expect(face.locator(".review-flip__tiles")).toHaveCSS("opacity", "1");
    await expect(face.locator(".review-flip__line").first()).toHaveCSS("opacity", "1");
    await expect(face.locator(".review-flip__tile").first()).toHaveCSS("animation-name", "review-flip-tile");
    await expect(face.locator(".review-flip__tile").first()).toHaveCSS("background-color", "rgba(16, 185, 129, 0.12)");
  });
});

test.describe("landing scroll-story stability", () => {
  test("scrubs section 01 directly from scroll position without wheel capture", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const section = page.locator("#memory");
    const metrics = await section.evaluate((element) => ({
      top: element.getBoundingClientRect().top + window.scrollY,
      height: element.offsetHeight,
    }));
    const sectionEnd = metrics.top + metrics.height - 900;
    const scrollRange = sectionEnd - metrics.top;

    await page.evaluate((top) => window.scrollTo(0, top - 160), metrics.top);
    await page.waitForTimeout(80);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(180);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(metrics.top);
    await expect
      .poll(() =>
        section.evaluate((element) =>
          Number.parseFloat(element.style.getPropertyValue("--memory-copy-ribbon-progress") || "0"),
        ),
      )
      .toBeGreaterThan(0);
    const wheelProgress = await section.evaluate((element) =>
      Number.parseFloat(element.style.getPropertyValue("--memory-copy-ribbon-progress") || "0"),
    );
    expect(wheelProgress).toBeLessThan(1);
    await page.waitForTimeout(700);
    expect(
      await section.evaluate((element) =>
        Number.parseFloat(element.style.getPropertyValue("--memory-copy-ribbon-progress") || "0"),
      ),
    ).toBeCloseTo(wheelProgress, 2);

    await expect
      .poll(async () => {
        await page.evaluate(({ top, range }) => window.scrollTo(0, top + range * 0.5), {
          top: metrics.top,
          range: scrollRange,
        });
        return section.evaluate((element) =>
          Number.parseFloat(element.style.getPropertyValue("--memory-copy-ribbon-progress") || "0"),
        );
      })
      .toBeGreaterThan(0.45);
  });
});

test.describe("landing pricing interaction", () => {
  test("keeps plan identity fixed while revealing features and CTA on hover", async ({ page }) => {
    await page.goto("/");
    const ctas = page.locator("#pricing .price-card > .price-cta");
    await expect(ctas).toHaveCount(2);
    const pricingTitleEmphasis = page.locator("#pricing .section-copy h2 .landing-gradient-text");
    await expect(pricingTitleEmphasis).toHaveText(["Free", "Pro"]);
    await expect(pricingTitleEmphasis.first()).toHaveCSS("background-image", /linear-gradient/);
    await expect(pricingTitleEmphasis.last()).toHaveCSS("background-image", /linear-gradient/);
    const planNames = page.locator("#pricing .price-card > .price-card__name");
    await expect(planNames).toHaveText(["Free", "Pro"]);
    await expect(planNames.first()).toHaveCSS("background-image", /linear-gradient/);
    await expect(planNames.last()).toHaveCSS("background-image", /linear-gradient/);
    const ctaSizes = await ctas.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      }),
    );
    expect(ctaSizes[0]).toEqual(ctaSizes[1]);

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
    await expect(page.locator("#faq .section-kicker")).toContainText("FAQ");
    await expect(page.locator("#faq .landing-cta__button")).toHaveCount(0);
    await expect(page.locator("#faq-button-0")).toHaveAttribute("aria-expanded", "false");
  });

  test("clicking a question expands it", async ({ page }) => {
    await page.goto("/");
    await page.locator("#faq").scrollIntoViewIfNeeded();
    await page.click("#faq-button-1");
    await expect(page.locator("#faq-button-1")).toHaveAttribute("aria-expanded", "true");
  });
});
