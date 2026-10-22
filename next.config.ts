import type { NextConfig } from "next";

const config: NextConfig = {
  // Keep automated dev-import tests separate from an already running local app.
  distDir: process.env.CAREERMAP_DEV_IMPORT_TEST === "1" ? ".next-import-test" : ".next",
  output: "standalone",
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  // OAuth callback URLs contain short-lived authorization codes. Never log them.
  logging: { incomingRequests: { ignore: [/\/api\/dev\/import\/linkedin(?:\/|\?|$)/, /\/auth\/linkedin\/portability\/callback(?:\?|$)/] }, browserToTerminal: false },
};

export default config;
