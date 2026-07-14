import { expect, test } from "@playwright/test";

test("renders the web bootstrap shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("app-root")).toBeVisible();
  await expect(page.getByText("GSS IoT V3")).toBeVisible();
});
