import { expect, it, vi } from "vitest";
import { DonationSessions } from "./sessions";
it("binds a random capability to one survey, expires and serializes save retries without raw data", async () => {
  const store = new DonationSessions(); const s = store.create("survey-a", "synthetic");
  expect(store.get(s.id, "survey-b")).toBeNull();
  const save = vi.fn(async () => ({ saved: true }));
  expect(await Promise.all([store.save(s, "digest", save), store.save(s, "digest", save)])).toEqual([{ saved: true }, { saved: true }]);
  await store.save(s, "digest", save);
  expect(save).toHaveBeenCalledOnce();
  await expect(store.save(s, "changed", save)).rejects.toThrow();
  s.expires = 0; expect(store.get(s.id, "survey-a")).toBeNull();
});
