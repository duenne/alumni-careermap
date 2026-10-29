import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3100" }), cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("../../lib/career-import/sandbox-db", () => ({ mappingClient: vi.fn() }));
import Participate from "./[surveyId]/participate/page";
import { mappingClient } from "../../lib/career-import/sandbox-db";

beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CAREERMAP_DEV_SURVEYS", "1"); vi.stubEnv("CAREERMAP_DEV_DONATION", "1"); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("returns an unbound or expired participation link to its own invitation without reading profiles", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  await expect(Participate({ params: Promise.resolve({ surveyId: id }) })).rejects.toThrow(`REDIRECT:/surveys/${id}?session=missing`);
  expect(mappingClient).not.toHaveBeenCalled();
});
