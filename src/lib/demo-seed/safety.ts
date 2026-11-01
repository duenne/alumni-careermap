export class DemoSeedPersistenceError extends Error {
  constructor(readonly code: string) { super(code); this.name = "DemoSeedPersistenceError"; }
}

/** Explicit URL only; no ambient DATABASE_URL, host override or shared role.
 * The persistence entry point constructs its OWN client from this exact URL.
 */
export function validateDemoDatabaseUrl(value: unknown): string {
  try {
    if (typeof value !== "string") throw new Error();
    const url = new URL(value);
    if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.username !== "careermap_v5_demo" || !url.password
      || !["/careermap_v5_demo", "/careermap_v5_demo_test"].includes(url.pathname) || url.search || url.hash
      || !url.port || Number(url.port) < 1024 || Number(url.port) > 65535) throw new Error();
    return value;
  } catch { throw new DemoSeedPersistenceError("UNSAFE_DEMO_DATABASE"); }
}
