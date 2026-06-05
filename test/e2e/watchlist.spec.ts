import { test, expect } from "@playwright/test";

test.describe("watchlist", () => {
  test("add and remove a ticker", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("AAPL", { exact: true }).first()).toBeVisible();

    const tickerInput = page.getByPlaceholder("Ticker").first();
    await tickerInput.fill("PYPL");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText("PYPL", { exact: true }).first()).toBeVisible({
      timeout: 10000,
    });

    const removeBtn = page.getByTitle("Remove PYPL");
    await removeBtn.click();

    await expect(page.getByText("PYPL", { exact: true })).toHaveCount(0, {
      timeout: 10000,
    });
  });
});
