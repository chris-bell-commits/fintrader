import { test, expect } from "@playwright/test";

test.describe("portfolio visualization", () => {
  test("heatmap renders a tile after a trade", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("NVDA", { exact: true }).first()).toBeVisible();

    const tradeBar = page.locator("div.panel", { has: page.getByText("Trade") });
    await tradeBar.getByPlaceholder("Ticker").fill("NVDA");
    await tradeBar.getByPlaceholder("Qty").fill("5");
    await page.getByRole("button", { name: "Buy", exact: true }).click();

    const heatmap = page.locator("div.panel", {
      has: page.getByText("Allocation Heatmap"),
    });
    const tile = heatmap.getByTitle(/^NVDA/);
    await expect(tile).toBeVisible({ timeout: 10000 });
  });

  test("P&L chart panel is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("FinTrader", { exact: true })).toBeVisible();
    await expect(page.getByText("Portfolio Value", { exact: true })).toBeVisible();
  });
});
