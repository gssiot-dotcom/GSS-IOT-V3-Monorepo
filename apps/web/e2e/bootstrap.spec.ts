import { expect, test } from "@playwright/test";

test("renders the web bootstrap shell", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("app-root")).toBeVisible();
  await expect(page.getByText("GSS IoT V3")).toBeVisible();
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "비밀번호" })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
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

test("keeps the legacy node-type selection usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/phase-2/demo");

  await expect(page.getByTestId("phase-2-demo")).toBeVisible();
  await expect(page.getByTestId("node-type-card-door_node")).toBeVisible();
  await expect(page.getByTestId("node-type-card-angle_node")).toBeVisible();
  await expect(page.getByTestId("node-type-card-gangform_node")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test("redirects protected admin routes to the login shell without a placeholder", async ({
  page,
}) => {
  await page.goto("/admin/monitoring");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("GSS IoT V3")).toBeVisible();
  await expect(page.getByText("Page coming soon")).toHaveCount(0);
});
