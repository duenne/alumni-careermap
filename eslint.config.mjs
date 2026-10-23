import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", ".next-analytics/**", ".next-analytics-e2e/**", ".next-import-test/**", ".next-mapping-test/**", ".next-workflow-test/**", ".next-workflow-e2e/**", "src/generated/**", "next-env.d.ts", "coverage/**", "playwright-report*/**", "test-results*/**", "artifacts/**"]),
]);
