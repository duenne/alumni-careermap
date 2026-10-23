/** Known no-data wording only; an arbitrary 404 must never imply completion. */
export function isNoSnapshotData(body: unknown): boolean {
  if (!body || typeof body !== "object" || !("message" in body) || typeof body.message !== "string") return false;
  return /^\s*no\s+data\s+found\s+for\s+(?:(?:this\s+)?domain\s+and\s+)?(?:this\s+)?member\s*id\b(?:\s*:\s*[^\r\n]*)?\.?\s*$/i.test(body.message);
}
