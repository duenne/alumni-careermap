import { describe, expect, it } from "vitest";
import { validateDemoDatabaseUrl } from "./safety";

describe("D1.2 explicit isolated demo target", () => {
  it.each([undefined, "", "postgresql://u:p@127.0.0.1:5544/careermap_v5_demo", "postgresql://careermap_v5_demo:p@example.com:5544/careermap_v5_demo",
    "postgresql://careermap_v5_demo:p@127.0.0.1:5544/careermap", "postgresql://careermap_v5_demo:p@127.0.0.1:5544/careermap_analytics_demo",
    "postgresql://careermap_v5_demo:p@127.0.0.1/careermap_v5_demo", "postgresql://careermap_v5_demo:p@127.0.0.1:5544/careermap_v5_demo?host=example.com",
    "postgresql://careermap_v5_demo:p@127.0.0.1:5544/careermap_v5_demo#fragment", "postgresql://careermap_v5_demo@127.0.0.1:5544/careermap_v5_demo"])("rejects an unsafe or implicit target (%#)", value => {
    expect(() => validateDemoDatabaseUrl(value)).toThrow("UNSAFE_DEMO_DATABASE");
  });
  it.each(["careermap_v5_demo", "careermap_v5_demo_test"])("accepts only the dedicated local role and database %s", database => {
    const url = `postgresql://careermap_v5_demo:synthetic@127.0.0.1:5544/${database}`;
    expect(validateDemoDatabaseUrl(url)).toBe(url);
  });
});
