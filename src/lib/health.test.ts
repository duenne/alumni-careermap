import { describe, expect, it } from "vitest";
import { checkHealth } from "./health";

describe("health status", () => {
  it("reports readiness when the database query succeeds", async () => {
    const result = await checkHealth(async () => {});
    expect(result).toEqual({ statusCode: 200, body: { status: "ok" } });
  });

  it("reports an unavailable database without exposing connection details", async () => {
    const result = await checkHealth(async () => {
      throw new Error("Internal database connection details");
    });
    expect(result).toEqual({ statusCode: 503, body: { status: "unavailable" } });
  });
});
