import "server-only";
import { mappingClient } from "../career-import/sandbox-db";
import { localDemoClient } from "../local-demo/database";
import { localDemoRequested } from "../local-demo/config";

export async function surveyClient() {
  if (localDemoRequested()) return localDemoClient();
  if (process.env.NODE_ENV !== "development") throw new Error("Survey database unavailable");
  return mappingClient();
}
