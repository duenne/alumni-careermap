export function validateMappingDatabaseUrl(value: string | undefined): string {
  try {
    const url = new URL(value ?? "");
    if (!["postgresql:", "postgres:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname)
      || url.pathname !== "/careermap_mapping_test" || url.search || url.hash) throw new Error();
    return value!;
  } catch { throw new Error("Mapping sandbox configuration required"); }
}
