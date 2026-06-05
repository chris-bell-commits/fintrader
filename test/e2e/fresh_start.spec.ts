import { test, expect, Page } from "@playwright/test";

async function readAaplPrice(page: Page): Promise<string | null> {
  const row = page.locator("div").filter({ hasText: /^AAPL/ }).first();
  const text = await row.innerText().catch(() => "");
  const match = text.match(/[0-9][0-9.,]+/);
  return match ? match[0] : null;
}

test.describe("fresh start", () => {
  test("loads with header, default tickers, and cash balance", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("FinTrader", { exact: true })).toBeVisible();

    for (const ticker of ["AAPL", "GOOGL", "MSFT", "NVDA"]) {
      await expect(page.getByText(ticker, { exact: true }).first()).toBeVisible();
    }

    await expect(page.getByText("£10,000.00").first()).toBeVisible();
  });

  test("streams price updates within a few seconds", async ({ page }) => {
    await page.goto("/");

    await expect.poll(() => readAaplPrice(page), { timeout: 5000 }).not.toBeNull();
    const initial = await readAaplPrice(page);

    await expect
      .poll(() => readAaplPrice(page), { timeout: 8000 })
      .not.toBe(initial);
  });
});
