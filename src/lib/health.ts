export async function checkHealth(checkDatabase: () => Promise<void>) {
  try {
    await checkDatabase();
    return { statusCode: 200, body: { status: "ok" } } as const;
  } catch {
    return { statusCode: 503, body: { status: "unavailable" } } as const;
  }
}
