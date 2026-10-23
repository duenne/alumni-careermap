import { NextResponse, type NextRequest } from "next/server";
import { allowDevImport, allowDevImportPage, allowLinkedInCallback } from "./lib/dev-import/access";
import { allowAnalytics } from "./lib/analytics/access";

/** Reject unavailable development tools before entering React/Flight rendering.
 * This is a local development gate, not participant authorization.
 */
export function proxy(request: NextRequest) {
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
  matcher: ["/dev/analytics/:path*", "/dev/import/:path*", "/dev/mapping/:path*", "/api/dev/import/:path*", "/auth/linkedin/portability/callback"],
};
