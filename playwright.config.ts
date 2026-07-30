import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "apps/web/e2e",
  timeout: 300_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm --filter web dev --host 127.0.0.1",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://127.0.0.1:5173",
  },
});
