import { createHash, timingSafeEqual } from "node:crypto";
import { allowDevImport } from "../dev-import/access";
import { validateOperatorScope, type SurveyResponseServiceConfiguration } from "../operator-scope";
import { localDemoRequested, readLocalDemoConfiguration } from "../local-demo/config";
import { allowLocalDemoRequest } from "../local-demo/request";

/** Local demonstration only. The operator password is never a URL parameter. */
export function surveyAccess(headers: Headers, administrator: boolean): 200 | 401 | 404 {
  const localHeaders = new Headers(headers);
  // Invitation links can arrive from another site. Only public top-level
  // document navigation gets this exception; origins/host checks remain intact.
  if (!administrator && !headers.has("origin") && headers.get("sec-fetch-mode") === "navigate"
    && headers.get("sec-fetch-dest") === "document") localHeaders.delete("sec-fetch-site");
  let token = process.env.CAREERMAP_SURVEY_ADMIN_TOKEN;
  if (localDemoRequested()) {
    try {
      const configuration = readLocalDemoConfiguration();
      if (!allowLocalDemoRequest(localHeaders, configuration)) return 404;
      token = configuration.administratorPassword;
    } catch { return 404; }
  } else if (process.env.CAREERMAP_DEV_SURVEYS !== "1" || !allowDevImport(localHeaders, { NODE_ENV: process.env.NODE_ENV, CAREERMAP_DEV_IMPORT: "1" })) return 404;
  if (!administrator) return 200;
  if (!token || token.length < 32) return 404;
  const supplied = headers.get("authorization") ?? "";
  const expected = `Basic ${Buffer.from(`operator:${token}`).toString("base64")}`;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(supplied), hash(expected)) ? 200 : 401;
}

export function surveyConfiguration(): SurveyResponseServiceConfiguration {
  if (localDemoRequested()) return { operatorScope: readLocalDemoConfiguration().operatorScope };
  const kind = process.env.CAREERMAP_SURVEY_OPERATOR_KIND;
  return { operatorScope: validateOperatorScope({
    kind, institutionId: process.env.CAREERMAP_MAPPING_OPERATOR_ID,
    ...(kind === "FACULTY" ? { faculty: process.env.CAREERMAP_SURVEY_OPERATOR_FACULTY } : {}),
  }) };
}

export function surveyPilotProgramId(): string | undefined {
  return localDemoRequested() ? readLocalDemoConfiguration().pilotProgramId : process.env.CAREERMAP_MSI_PROGRAM_ID;
}

export const surveyHeaders = {
  "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
};

export function surveyAccessResponse(status: 401 | 404): Response {
  return new Response("Nicht verfügbar.", { status, headers: {
    ...surveyHeaders, ...(status === 401 ? { "WWW-Authenticate": 'Basic realm="CareerMap Betreiber", charset="UTF-8"' } : {}),
  } });
}
