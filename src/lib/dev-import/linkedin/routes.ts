import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { allowDevImport, allowLinkedInCallback } from "../access";
import { projectSnapshot } from "../json-preview";
import { CALLBACK_PATH, type LinkedInConfig } from "./config";
import { configKey, SESSION_SECONDS, type EphemeralLinkedInSessions } from "./sessions";
import { PortabilityError, type CareerDataProvider } from "./provider";
import { portabilityMessages, safeSnapshotDiagnostic, type PortabilityErrorCode } from "./errors";

const cookieName = "careermap_linkedin_dev";
const apiPath = "/api/dev/import/linkedin";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY" };
const unavailable = () => new NextResponse("Nicht verfügbar.", { status: 404, headers });
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const error = (code: PortabilityErrorCode, status = 400, diagnostic?: unknown) => json({ code, message: portabilityMessages[code], diagnostic: safeSnapshotDiagnostic(diagnostic) }, status);
function setCookie(response: NextResponse, request: NextRequest, value = "") {
  response.cookies.set(cookieName, value, { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:",
    path: "/", maxAge: value ? SESSION_SECONDS : 0 });
  return response;
}
type Dependencies = { config: () => LinkedInConfig | null; provider: (config: LinkedInConfig) => CareerDataProvider; store: EphemeralLinkedInSessions };

export function createLinkedInHandlers({ config: readConfig, provider, store }: Dependencies) {
  const cookie = (request: NextRequest) => request.cookies.get(cookieName)?.value;
  // NextURL normalizes 127.0.0.1 to localhost. Keep the gated Host spelling so
  // the OAuth redirect and the browser's Origin remain exactly identical.
  const requestOrigin = (request: NextRequest) => `${new URL(request.url).protocol}//${request.headers.get("host")}`;
  function configFor(request: NextRequest, config = readConfig()) {
    return config && new URL(config.redirectUri).origin === requestOrigin(request) ? config : null;
  }
  const action = (request: NextRequest) => {
    const path = new URL(request.url).pathname;
    return path === CALLBACK_PATH ? "callback" : path.startsWith(`${apiPath}/`) ? path.slice(apiPath.length + 1) : "";
  };
  const redirect = (request: NextRequest, result: string) => new NextResponse(null, {
    status: 303, headers: { ...headers, Location: `${requestOrigin(request)}/dev/import?linkedin=${result}` },
  });
  return {
    async GET(request: NextRequest): Promise<NextResponse> {
      const name = action(request);
      if (name === "callback") {
        if (!allowLinkedInCallback(request)) return unavailable();
        const config = configFor(request);
        if (!config) return setCookie(redirect(request, "NOT_CONFIGURED"), request);
        const params = new URL(request.url).searchParams;
        const session = params.getAll("state").length === 1 ? store.consumeState(cookie(request), configKey(config), params.get("state")) : null;
        if (!session) return setCookie(redirect(request, "INVALID_STATE"), request);
        if (params.has("error")) {
          store.remove(session.id);
          const cancelled = ["user_cancelled_login", "user_cancelled_authorize", "access_denied"].includes(params.get("error") ?? "");
          return setCookie(redirect(request, cancelled ? "CANCELLED" : "ACCESS_DENIED"), request);
        }
        const code = params.get("code");
        if (!code || code.length > 4096 || params.getAll("code").length !== 1) {
          store.remove(session.id);
          return setCookie(redirect(request, "TOKEN_EXCHANGE_FAILED"), request);
        }
        try {
          const token = await provider(config).exchange(code);
          const id = store.complete(session, token);
          if (!id) return setCookie(redirect(request, "SESSION_EXPIRED"), request);
          return setCookie(redirect(request, "connected"), request, id);
        } catch (failure) {
          store.remove(session.id);
          return setCookie(redirect(request, failure instanceof PortabilityError ? failure.code : "TOKEN_EXCHANGE_FAILED"), request);
        }
      }
      if (!allowDevImport(request.headers)) return unavailable();
      if (name !== "status") return unavailable();
      const localConfig = readConfig();
      const config = configFor(request, localConfig);
      const session = config ? store.get(cookie(request), configKey(config)) : null;
      // Only fixed reason codes leave the server, never environment values.
      return json({ configured: !!config, connected: !!session?.token, mode: config?.mode ?? null,
        configurationIssue: config ? null : localConfig ? "ORIGIN_MISMATCH" : "NOT_CONFIGURED" });
    },
    async POST(request: NextRequest): Promise<NextResponse> {
      // All state-changing entry points require same-origin POST, independently
      // of the proxy. A callback navigation is the only intentional exception.
      if (!allowDevImport(request.headers) || request.headers.get("origin") !== requestOrigin(request)) return unavailable();
      const name = action(request);
      if (name === "disconnect") {
        store.remove(cookie(request));
        return setCookie(json({ disconnected: true }), request);
      }
      const config = configFor(request);
      if (!config) return error("NOT_CONFIGURED", 503);
      if (name === "start") {
        store.remove(cookie(request));
        const session = store.create(configKey(config));
        if (!session) return error("BUSY", 429);
        return setCookie(new NextResponse(null, { status: 303, headers: { ...headers, Location: provider(config).authorizationUrl(session.state) } }), request, session.id);
      }
      if (name !== "snapshot" && name !== "raw-snapshot") return unavailable();
      const session = store.get(cookie(request), configKey(config));
      if (!session?.token) return setCookie(error("SESSION_EXPIRED", 401), request);
      if (session.activeRead) return error("BUSY", 409);
      const controller = new AbortController();
      session.activeRead = controller;
      try {
        const client = provider(config);
        const snapshot = name === "raw-snapshot" ? await client.rawSnapshot(session.token, controller.signal)
          : await client.snapshot(session.token, controller.signal);
        // Disconnect/source replacement wins even over an already completed read.
        if (store.get(session.id, session.key) !== session || controller.signal.aborted) return error("SESSION_EXPIRED", 401);
        return name === "raw-snapshot" ? json({ source: "linkedin-raw", dump: snapshot })
          : json({ source: "linkedin", snapshot: projectSnapshot(snapshot) });
      } catch (failure) {
        const code = failure instanceof PortabilityError ? failure.code : "PROVIDER_UNAVAILABLE";
        if (code === "SESSION_EXPIRED" || code === "ACCESS_DENIED") {
          store.remove(session.id);
          return setCookie(error(code, code === "ACCESS_DENIED" ? 403 : 401, failure instanceof PortabilityError ? failure.diagnostic : undefined), request);
        }
        return error(code, code === "SNAPSHOT_PENDING" ? 202 : code === "RATE_LIMITED" ? 429 : 502, failure instanceof PortabilityError ? failure.diagnostic : undefined);
      } finally { delete session.activeRead; }
    },
  };
}
