import "server-only";
import { createHash } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";
import { allowDevImport } from "../dev-import/access";
import { fixtureOptions, loadMappingFixture } from "./local-fixtures";
import { CareerImportError, uuid } from "./mapping";
import { saveCareerImport, type ImportReceipt } from "./service";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
const allowed = (request: Request) => process.env.CAREERMAP_DEV_MAPPING === "1" && allowDevImport(request.headers);
type CachedSubmission = { digest: string; expires: number; pending: Promise<ImportReceipt> };

export function createMappingHandlers(deps: { client: () => Promise<PrismaClient> }) {
  // Only a content hash, receipt and pending promise are retained for retry.
  // No raw profile or review object. IDs confer no read/edit access.
  const submissions = new Map<string, CachedSubmission>();
  return {
    async GET(request: Request) {
      if (!allowed(request)) return json({ code: "UNAVAILABLE" }, 404);
      try {
        const fixtureId = new URL(request.url).searchParams.get("fixture");
        if (fixtureId) return json(await loadMappingFixture(fixtureId));
        const client = await deps.client();
        const institutionId = process.env.CAREERMAP_MAPPING_OPERATOR_ID;
        if (!uuid(institutionId)) throw new Error();
        const [surveys, institutions, programs, organisations, fixtures] = await Promise.all([
          client.survey.findMany({ where: { referenceProgram: { institutionId }, status: "OPEN" }, include: { referenceProgram: { include: { institution: true } } } }),
          client.institution.findMany({ select: { id: true, name: true }, take: 200 }),
          client.program.findMany({ select: { id: true, name: true, institution: { select: { name: true } } }, take: 200 }),
          client.organisation.findMany({ select: { id: true, name: true }, take: 200 }), fixtureOptions(),
        ]);
        return json({ surveys, institutions, programs, organisations, fixtures });
      } catch { return json({ code: "SANDBOX_UNAVAILABLE" }, 503); }
    },
    async POST(request: Request) {
      if (!allowed(request) || request.headers.get("origin") !== new URL(request.url).origin) return json({ code: "UNAVAILABLE" }, 404);
      try {
        if (!request.headers.get("content-type")?.startsWith("application/json") || !request.body) return json({ code: "INVALID_REQUEST" }, 400);
        const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
        try {
          for (;;) {
            const chunk = await reader.read(); if (chunk.done) break;
            bytes += chunk.value.length;
            if (bytes > 300_000) { await reader.cancel(); return json({ code: "SOURCE_TOO_LARGE" }, 413); }
            chunks.push(chunk.value);
          }
        } finally { reader.releaseLock(); }
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!body || typeof body !== "object" || Object.keys(body).length !== 2 || !uuid(body.submissionId) || !body.input) return json({ code: "INVALID_REQUEST" }, 400);
        const digest = createHash("sha256").update(JSON.stringify(body.input)).digest("hex");
        for (const [key, entry] of submissions) if (entry.expires < Date.now()) submissions.delete(key);
        const existing = submissions.get(body.submissionId);
        if (existing && existing.digest !== digest) return json({ code: "SUBMISSION_CHANGED" }, 409);
        if (!existing && submissions.size >= 200) return json({ code: "SANDBOX_BUSY" }, 429);
        let pending = existing?.pending;
        if (!pending) {
          const institutionId = process.env.CAREERMAP_MAPPING_OPERATOR_ID;
          if (!uuid(institutionId)) throw new Error();
          // Install the pending promise before yielding, serializing same-ID retries.
          pending = deps.client().then(client => saveCareerImport(client, body.input, { operatorScope: { kind: "INSTITUTION", institutionId } }));
          submissions.set(body.submissionId, { digest, expires: Date.now() + 15 * 60_000, pending });
          pending.catch(() => submissions.delete(body.submissionId));
        }
        return json({ receipt: await pending });
      } catch (error) {
        return json({ code: error instanceof CareerImportError ? error.code : "SAVE_FAILED" }, error instanceof CareerImportError || error instanceof SyntaxError ? 400 : 503);
      }
    },
  };
}
