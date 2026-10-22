import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Match the application's standalone deployment, including its static assets.
const buildDir = process.env.CAREERMAP_DEV_IMPORT_TEST === "1" ? ".next-import-test" : ".next";
cpSync("public", `${buildDir}/standalone/public`, { recursive: true });
cpSync(`${buildDir}/static`, `${buildDir}/standalone/${buildDir}/static`, { recursive: true });
await import(pathToFileURL(resolve(buildDir, "standalone/server.js")).href);
