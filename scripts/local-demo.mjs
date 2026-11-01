import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LocalDemoOperations } from "../src/lib/local-demo/operations.ts";
import { InstallationError } from "../src/lib/local-demo/installation.ts";

try {
  const [major, minor, patch] = process.versions.node.split(".").map(Number);
  if (major !== 22 || minor < 23 || minor === 23 && patch < 3) throw new InstallationError("NODE_22_23_3_REQUIRED");
  const [command, ...args] = process.argv.slice(2), ops = new LocalDemoOperations(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
  let result;
  if (command === "seed" && args.length === 1 && args[0] === "--confirm-synthetic-references") result = await ops.seed(true);
  else if (command === "record-b" && args.length === 2 && args[0] === "--survey-id") result = await ops.recordB(args[1]);
  else if (!args.length) {
    switch (command) {
      case "init": result = await ops.init(); break;
      case "db-up": result = await ops.dbUp(); break;
      case "migrate": result = await ops.migrate(); break;
      case "catalog-init": result = await ops.catalogInit(); break;
      case "build": result = await ops.build(); break;
      case "start": result = await ops.start(); break;
      case "stop": result = await ops.stop(); break;
      case "db-stop": result = await ops.dbStop(); break;
      case "db-restart": result = await ops.dbRestart(); break;
      case "db-recreate": result = await ops.dbRestart(true); break;
      case "verify": result = await ops.verify(); break;
      default: throw new InstallationError("INVALID_DEMO_OPERATION");
    }
  } else throw new InstallationError("INVALID_DEMO_OPERATION");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof InstallationError ? error.code : "DEMO_OPERATION_FAILED"); process.exitCode = 1;
}
