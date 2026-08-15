import { expect, test } from "@playwright/test";

// Regression cover for the scroll-driven Three.js background and FAQ state.

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
