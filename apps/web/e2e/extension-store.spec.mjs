import { expect, test } from "@playwright/test";

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";
const TOUR_KEY = "realgo.cabinet.tour";
const STORE_URL =
  "https://chromewebstore.google.com/detail/jkddgdkghndclniojojbpgjeblkoejop?utm_source=item-share-cb";

async function openExtensionPage(page) {
  await page.goto("/extension");
  await page.evaluate(
    ([accessKey, refreshKey, tourKey]) => {
      localStorage.setItem(accessKey, "LIVE.access");
      localStorage.setItem(refreshKey, "LIVE.refresh");
      localStorage.setItem(tourKey, "done");
    },
    [AKEY, RKEY, TOUR_KEY],
  );
  await page.goto("/extension");
}

test("Chromium browser gets a direct Chrome Web Store action", async ({ page }) => {
  await openExtensionPage(page);

  await expect(page.getByRole("link", { name: "Открыть в Chrome Web Store" })).toHaveAttribute(
    "href",
    STORE_URL,
  );
});

test("non-Chromium browser does not get the Chrome Web Store action", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgentData", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 Firefox/142.0",
    });
  });
  await openExtensionPage(page);

  await expect(page.getByRole("link", { name: "Открыть в Chrome Web Store" })).toHaveCount(0);
});
