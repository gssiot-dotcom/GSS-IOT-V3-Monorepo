import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 30_000,
    include: ["test/e2e/*.e2e-spec.ts"],
    setupFiles: ["test/setup-e2e-env.ts"],
  },
});
