import { randomBytes, randomUUID } from "node:crypto";
import { parse } from "dotenv";

/** Private local configuration only. Never log the returned values/text. */
export function prepareWorkflowEnvironment(text: string): { text: string; values: Record<string, string> } {
  const values = parse(text);
  const port = values.CAREERMAP_WORKFLOW_DB_PORT || "5433";
  if (!/^[0-9]+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error("Invalid local workflow port");
  let existing: URL | null = null;
  if (values.DATABASE_URL) {
    try { existing = new URL(values.DATABASE_URL); } catch { throw new Error("Invalid database configuration"); }
    const postgres = ["postgresql:", "postgres:"].includes(existing.protocol);
    const placeholder = postgres && ["db", "localhost", "127.0.0.1"].includes(existing.hostname) && existing.pathname === "/careermap"
      && /^(?:REPLACE_WITH_URL_ENCODED_PASSWORD|PASSWORD|CHANGEME)$/i.test(existing.password);
    if (!placeholder && (!postgres || !["localhost", "127.0.0.1"].includes(existing.hostname) || existing.pathname !== "/careermap_workflow_test" || existing.search || existing.hash)) {
      throw new Error("Existing database configuration requires a separate workflow target");
    }
  }
  const password = values.POSTGRES_PASSWORD || (existing?.pathname === "/careermap_workflow_test" ? decodeURIComponent(existing.password) : "") || randomBytes(32).toString("hex");
  const connection = new URL(`postgresql://careermap@localhost:${port}/careermap_workflow_test`);
  connection.password = password;
  const updates: Record<string, string> = {
    POSTGRES_PASSWORD: password, CAREERMAP_WORKFLOW_DB_PORT: port,
    DATABASE_URL: connection.href, CAREERMAP_MAPPING_DATABASE_URL: connection.href,
    CAREERMAP_MAPPING_OPERATOR_ID: values.CAREERMAP_MAPPING_OPERATOR_ID || randomUUID(),
  };
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${JSON.stringify(value)}`;
    let found = false;
    const lines = text.split("\n").flatMap(old => {
      if (!old.startsWith(`${key}=`)) return [old];
      if (found) return []; found = true; return [line];
    });
    text = found ? lines.join("\n") : `${text.replace(/\n*$/, "")}\n${line}\n`;
  }
  return { text, values: { ...values, ...updates } };
}
