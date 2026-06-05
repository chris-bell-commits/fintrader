import { test, expect } from "@playwright/test";

test.describe("trading", () => {
  test("buy shares decreases cash and creates a position", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("AAPL", { exact: true }).first()).toBeVisible();

    await page.getByText("AAPL", { exact: true }).first().click();

    const tradeBar = page.locator("div.panel", { has: page.getByText("Trade") });
    const tickerInput = tradeBar.getByPlaceholder("Ticker");
    const qtyInput = tradeBar.getByPlaceholder("Qty");

    await tickerInput.fill("AAPL");
    await qtyInput.fill("10");

    await page.getByRole("button", { name: "Buy", exact: true }).click();

    const positions = page.locator("div.panel", { has: page.getByText("Positions") });
    await expect(positions.getByText("AAPL", { exact: true })).toBeVisible({
      timeout: 10000,
    });

    await expect(page.getByText("£10,000.00")).toHaveCount(0, { timeout: 10000 });
  });
});
