import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { surveyAccess, surveyAccessResponse, surveyConfiguration, surveyHeaders } from "./access";
import { createSurvey, changeSurveyStatus, InvalidSurveyInputError, isSurveyId, listSurveyAdministration, parseSurveyCreation, parseSurveyStatus, readSurveyInvitation } from "./service";
import { SurveyOutsideOperatorScopeError } from "../survey-response-service";
import { SurveyNotFoundError } from "../survey-service";
import { CatalogOutsideOperatorScopeError, createCatalogProgram, parseCatalogProgram } from "./catalog";

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: surveyHeaders });
function failure(error: unknown) {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") return json({ code: "ALREADY_EXISTS" }, 409);
  if (error instanceof InvalidSurveyInputError || error instanceof SyntaxError) return json({ code: "INVALID_REQUEST" }, 400);
  if (error instanceof SurveyOutsideOperatorScopeError || error instanceof SurveyNotFoundError || error instanceof CatalogOutsideOperatorScopeError) return json({ code: "NOT_FOUND" }, 404);
  if (error && typeof error === "object" && "code" in error && error.code === "P2003") return json({ code: "INVALID_PROGRAM" }, 400);
  return json({ code: "UNAVAILABLE" }, 503);
}

export function createSurveyHandlers(deps: { client: () => Promise<PrismaClient> }) {
  return {
    async GET(request: Request) {
      const access = surveyAccess(request.headers, true);
      if (access !== 200) return surveyAccessResponse(access);
      try { return json(await listSurveyAdministration(await deps.client(), surveyConfiguration())); }
      catch (error) { return failure(error); }
    },
    async POST(request: Request) {
      const access = surveyAccess(request.headers, true);
      if (access !== 200) return surveyAccessResponse(access);
      if (request.headers.get("origin") !== `${new URL(request.url).protocol}//${request.headers.get("host")}`) return surveyAccessResponse(404);
      try {
        if (!request.body || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new InvalidSurveyInputError();
        const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
        try {
          for (;;) {
            const chunk = await reader.read(); if (chunk.done) break;
            size += chunk.value.length;
            if (size > 4096) { await reader.cancel(); return json({ code: "TOO_LARGE" }, 413); }
            chunks.push(chunk.value);
          }
        } finally { reader.releaseLock(); }
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new InvalidSurveyInputError();
        const { action, ...input } = body;
        if (action === "program-create") {
          const parsed = parseCatalogProgram(input);
          return json(await createCatalogProgram(await deps.client(), parsed, surveyConfiguration()), 201);
        }
        if (action === "create") {
          const parsed = parseSurveyCreation(input);
          return json(await createSurvey(await deps.client(), parsed, surveyConfiguration()), 201);
        }
        if (action === "status") {
          const parsed = parseSurveyStatus(input);
          return json(await changeSurveyStatus(await deps.client(), parsed, surveyConfiguration()));
        }
        throw new InvalidSurveyInputError();
      } catch (error) { return failure(error); }
    },
    async invitation(request: Request, surveyId: string) {
      const access = surveyAccess(request.headers, false);
      if (access !== 200) return surveyAccessResponse(access);
      if (!isSurveyId(surveyId)) return json({ code: "NOT_FOUND" }, 404);
      try {
        const context = await readSurveyInvitation(await deps.client(), surveyId, surveyConfiguration());
        return context ? json(context) : json({ code: "NOT_FOUND" }, 404);
      } catch (error) { return failure(error); }
    },
  };
}
