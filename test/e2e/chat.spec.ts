import { test, expect } from "@playwright/test";

test.describe("chat", () => {
  test("sending a message returns an assistant response", async ({ page }) => {
    await page.goto("/");

    const chatPanel = page.locator("div.panel", {
      has: page.getByText("AI Assistant"),
    });
    await expect(chatPanel).toBeVisible();

    const input = chatPanel.getByPlaceholder("Message FinTrader…");
    await input.fill("How is my portfolio doing?");
    await chatPanel.getByRole("button", { name: "Send", exact: true }).click();

    await expect(chatPanel.getByText("How is my portfolio doing?")).toBeVisible();
    await expect(chatPanel.getByText("Mock response")).toBeVisible({
      timeout: 10000,
    });
  });
});
