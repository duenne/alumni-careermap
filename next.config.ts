import type { NextConfig } from "next";
import { PHASE_PRODUCTION_SERVER } from "next/constants";
import { assertDemoWorkspace } from "./src/lib/local-demo/build-workspace";
import { assertLocalDemoStartArguments, readLocalDemoConfiguration } from "./src/lib/local-demo/config";

const localDemo = process.env.CAREERMAP_LOCAL_DEMO !== undefined;
if (localDemo) {
  if (!["v5-synthetic", "v5-participation"].includes(process.env.CAREERMAP_LOCAL_DEMO ?? "") || process.env.NODE_ENV !== "production") throw new Error("Invalid local demo build profile");
  assertDemoWorkspace(process.cwd());
}

const config: NextConfig = {
  // Keep automated dev-import tests separate from an already running local app.
  distDir: process.env.CAREERMAP_SURVEYS_E2E === "1" ? ".next-surveys-e2e" : process.env.CAREERMAP_DONATION_E2E === "1" ? ".next-integrated-e2e" : process.env.CAREERMAP_DEV_SURVEYS === "1" ? ".next-surveys-test" : process.env.CAREERMAP_ANALYTICS_E2E === "1" ? ".next-analytics-e2e" : process.env.CAREERMAP_DEV_ANALYTICS === "1" ? ".next-analytics" : process.env.CAREERMAP_WORKFLOW_E2E === "1" ? ".next-workflow-e2e" : process.env.CAREERMAP_DEV_WORKFLOW === "1" ? ".next-workflow-test" : process.env.CAREERMAP_DEV_MAPPING === "1" ? ".next-mapping-test" : process.env.CAREERMAP_DEV_IMPORT_TEST === "1" ? ".next-import-test" : ".next",
  output: localDemo ? undefined : "standalone",
  // Local input originals must never become production/standalone artifacts.
  outputFileTracingExcludes: { "/*": ["./.local-fixtures/**/*", "./.local-demo/**/*", "./.env*", "./.careermap-v5-build.json"] },
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  // OAuth callback URLs contain short-lived authorization codes. Never log them.
  logging: { incomingRequests: { ignore: [/\/api\/dev\/import\/linkedin(?:\/|\?|$)/, /\/auth\/linkedin\/portability\/callback(?:\?|$)/] }, browserToTerminal: false },
};

export default function nextConfiguration(phase: string): NextConfig {
  if (localDemo && phase === PHASE_PRODUCTION_SERVER) {
    assertDemoWorkspace(process.cwd(), true);
    assertLocalDemoStartArguments(process.argv, readLocalDemoConfiguration());
  }
  return config;
}
