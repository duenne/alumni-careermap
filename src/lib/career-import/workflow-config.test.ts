import { expect, it } from "vitest";
import { prepareWorkflowEnvironment } from "./workflow-config";

it("fills missing local credentials without exposing or replacing configured LinkedIn secrets", () => {
  const source = '# private config\nLINKEDIN_CLIENT_ID=synthetic-client\nLINKEDIN_CLIENT_SECRET="synthetic-secret"\nDATABASE_URL=postgresql://careermap:REPLACE_WITH_URL_ENCODED_PASSWORD@db:5432/careermap\n';
  const result = prepareWorkflowEnvironment(source);
  expect(result.values.POSTGRES_PASSWORD.length).toBeGreaterThanOrEqual(32);
  const url = new URL(result.values.DATABASE_URL);
  expect([url.hostname, url.port, url.pathname]).toEqual(["localhost", "5433", "/careermap_workflow_test"]);
  expect(url.password).toBe(result.values.POSTGRES_PASSWORD);
  expect(result.values.CAREERMAP_MAPPING_DATABASE_URL).toBe(result.values.DATABASE_URL);
  expect(result.text).toContain('LINKEDIN_CLIENT_SECRET="synthetic-secret"');
  expect(prepareWorkflowEnvironment(result.text).text).toBe(result.text);
});
it("keeps an existing password and custom loopback port, and rejects arbitrary database targets", () => {
  const result = prepareWorkflowEnvironment("POSTGRES_PASSWORD=synthetic-existing\nCAREERMAP_WORKFLOW_DB_PORT=55432\n");
  expect(result.values.POSTGRES_PASSWORD).toBe("synthetic-existing");
  expect(new URL(result.values.DATABASE_URL).port).toBe("55432");
  for (const text of ["CAREERMAP_WORKFLOW_DB_PORT=0", "CAREERMAP_WORKFLOW_DB_PORT=not-a-port", "DATABASE_URL=postgresql://real:secret@db.example.com/production"]) {
    expect(() => prepareWorkflowEnvironment(text)).toThrow();
  }
});
