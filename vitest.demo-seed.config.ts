import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node", include: ["tests/demo-seed/**/*.test.ts"],
    fileParallelism: false, testTimeout: 30000, hookTimeout: 15000,
  },
});
