import { NextResponse, type NextRequest } from "next/server";
import { allowDevImport, allowDevImportPage, allowLinkedInCallback } from "./lib/dev-import/access";
import { allowAnalytics } from "./lib/analytics/access";
import { surveyAccess, surveyAccessResponse, surveyHeaders } from "./lib/surveys/access";
import { integratedJourneyEnabled, journeyOrigin } from "./lib/donation/entry-config";

function unifiedJourney(request: NextRequest) {
  if (!integratedJourneyEnabled() || !["GET", "HEAD"].includes(request.method)) return;
  const path = request.nextUrl.pathname;
  const legacy: Record<string, string> = { "/dev/import": "/", "/dev/mapping": "/", "/review": "/", "/dev/analytics": "/admin/surveys" };
  if (path !== "/" && path !== "/admin/surveys" && !path.startsWith("/admin/surveys/") && !path.startsWith("/surveys/") && !(path in legacy)) return;
  // Redirect only local UI navigations, never OAuth callbacks, API requests or
  // writes. Authentication remains mandatory at the protected destination.
  if (surveyAccess(request.headers, false) !== 200) return surveyAccessResponse(404);
  const currentOrigin = `${request.nextUrl.protocol}//${request.headers.get("host")}`;
  const targetOrigin = journeyOrigin() ?? currentOrigin;
  if (targetOrigin === currentOrigin && !(path in legacy)) return;
  const target = new URL(targetOrigin);
  target.pathname = legacy[path] ?? path;
  target.search = path in legacy ? "" : request.nextUrl.search;
  const response = NextResponse.redirect(target);
  for (const [name, value] of Object.entries(surveyHeaders)) response.headers.set(name, value);
  return response;
}

/** Reject unavailable development tools before entering React/Flight rendering.
 * This is a local development gate, not participant authorization.
 */
export function proxy(request: NextRequest) {
  const unified = unifiedJourney(request);
  if (unified) return unified;
  if (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/review") {
    if (!integratedJourneyEnabled()) return NextResponse.next();
    if (surveyAccess(request.headers, false) !== 200) return surveyAccessResponse(404);
    const response = NextResponse.next();
    for (const [name, value] of Object.entries(surveyHeaders)) response.headers.set(name, value);
    return response;
  }
  if (request.nextUrl.pathname === "/auth/linkedin/portability/callback" && process.env.CAREERMAP_DEV_DONATION === "1" && request.cookies.has("careermap_linkedin_survey")) {
    if(surveyAccess(request.headers,false)!==200) return surveyAccessResponse(404);
    const response=NextResponse.next(); for(const [k,v] of Object.entries(surveyHeaders))response.headers.set(k,v);return response;
  }
  if (request.nextUrl.pathname.startsWith("/admin/surveys") || request.nextUrl.pathname.startsWith("/surveys/")) {
    const access = surveyAccess(request.headers, request.nextUrl.pathname.startsWith("/admin/"));
    if (access !== 200) return surveyAccessResponse(access);
    const response = NextResponse.next();
    for (const [name, value] of Object.entries(surveyHeaders)) response.headers.set(name, value);
    if(request.nextUrl.pathname.endsWith("/participate")) response.headers.set("Referrer-Policy","same-origin");
    return response;
  }
  if (request.nextUrl.pathname.startsWith("/dev/analytics")) {
    const response = allowAnalytics(request.headers) ? NextResponse.next() : new NextResponse("Nicht verfügbar.", { status: 404 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
  if (request.nextUrl.pathname.startsWith("/dev/mapping") && process.env.CAREERMAP_DEV_MAPPING !== "1") {
    return new NextResponse("Nicht verfügbar.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (!allowDevImport(request.headers) && !allowDevImportPage(request) && !allowLinkedInCallback(request)) {
    return new NextResponse("Nicht verfügbar.", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  // A no-referrer document turns the native OAuth form's Origin into "null".
  // Allow the local form origin; external navigations still get no referrer.
  response.headers.set("Referrer-Policy", request.nextUrl.pathname === "/dev/import" ? "same-origin" : "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: ["/", "/review", "/admin/surveys/:path*", "/surveys/:path*", "/dev/analytics/:path*", "/dev/import/:path*", "/dev/mapping/:path*", "/api/dev/import/:path*", "/auth/linkedin/portability/callback"],
};
