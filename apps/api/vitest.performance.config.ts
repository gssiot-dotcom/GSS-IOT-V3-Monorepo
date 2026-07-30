import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 300_000,
    include: ["test/performance/*.performance-spec.ts"],
    setupFiles: ["test/setup-performance-env.ts"],
    testTimeout: 300_000,
  },
});
