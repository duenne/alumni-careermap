import type { NextConfig } from "next";

const config: NextConfig = {
  // Keep automated dev-import tests separate from an already running local app.
  distDir: process.env.CAREERMAP_WORKFLOW_E2E === "1" ? ".next-workflow-e2e" : process.env.CAREERMAP_DEV_WORKFLOW === "1" ? ".next-workflow-test" : process.env.CAREERMAP_DEV_MAPPING === "1" ? ".next-mapping-test" : process.env.CAREERMAP_DEV_IMPORT_TEST === "1" ? ".next-import-test" : ".next",
  output: "standalone",
  // Local input originals must never become production/standalone artifacts.
  outputFileTracingExcludes: { "/*": ["./.local-fixtures/**/*"] },
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  // OAuth callback URLs contain short-lived authorization codes. Never log them.
  logging: { incomingRequests: { ignore: [/\/api\/dev\/import\/linkedin(?:\/|\?|$)/, /\/auth\/linkedin\/portability\/callback(?:\?|$)/] }, browserToTerminal: false },
};

export default config;
