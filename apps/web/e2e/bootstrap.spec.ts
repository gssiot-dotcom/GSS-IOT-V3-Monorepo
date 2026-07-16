import { expect, test } from "@playwright/test";

test("renders the web bootstrap shell", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("app-root")).toBeVisible();
  await expect(page.getByText("GSS IoT V3")).toBeVisible();
});

test("renders Phase 2 demo with legacy node-type cards", async ({ page }) => {
  await page.goto("/phase-2/demo");

  await expect(page.getByTestId("phase-2-demo")).toBeVisible();
  await expect(page.getByTestId("node-type-card-door_node")).toBeVisible();
  await expect(page.getByTestId("node-type-card-angle_node")).toBeVisible();
  await expect(page.getByTestId("node-type-card-gangform_node")).toBeVisible();

  const cardShot = await page.getByTestId("node-type-card-door_node").screenshot();
  expect(cardShot.byteLength).toBeGreaterThan(10_000);
});
