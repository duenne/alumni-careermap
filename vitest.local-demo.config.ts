import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["tests/local-demo/**/*.test.ts"], fileParallelism: false, testTimeout: 10000, hookTimeout: 10000 } });
