import { test, expect } from "@playwright/test";

test.describe("sell", () => {
  test("buy then sell updates the position", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("MSFT", { exact: true }).first()).toBeVisible();

    const tradeBar = page.locator("div.panel", { has: page.getByText("Trade") });
    const tickerInput = tradeBar.getByPlaceholder("Ticker");
    const qtyInput = tradeBar.getByPlaceholder("Qty");
    const positions = page.locator("div.panel", { has: page.getByText("Positions") });

    await tickerInput.fill("MSFT");
    await qtyInput.fill("8");
    await page.getByRole("button", { name: "Buy", exact: true }).click();

    const msftRow = positions.locator("tr", { has: page.getByText("MSFT", { exact: true }) });
    await expect(msftRow).toBeVisible({ timeout: 10000 });

    await tickerInput.fill("MSFT");
    await qtyInput.fill("8");
    await page.getByRole("button", { name: "Sell", exact: true }).click();

    await expect(positions.getByText("MSFT", { exact: true })).toHaveCount(0, {
      timeout: 10000,
    });
  });
});
