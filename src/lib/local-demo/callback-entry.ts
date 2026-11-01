import http from "node:http";
import type { LocalDemoConfiguration } from "./config";
import { participationOAuthStatePrefix } from "../donation/participation-session";

export function participationCallbackDestination(request: Request, config: LocalDemoConfiguration): URL | null {
  if (config.mode !== "v5-participation" || !config.linkedIn) return null;
  const registered = new URL(config.linkedIn.redirectUri), incoming = new URL(request.url);
  const headers = request.headers, host = headers.get("host");
  if (request.method !== "GET" || incoming.pathname !== registered.pathname || `${incoming.protocol}//${host}` !== registered.origin
    || headers.has("forwarded") || headers.get("x-forwarded-host") && headers.get("x-forwarded-host") !== host
    || headers.get("x-forwarded-for") && !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(headers.get("x-forwarded-for")!)
    || headers.has("origin") && headers.get("origin") !== registered.origin
    || ["cross-site", "same-site"].includes(headers.get("sec-fetch-site") ?? "") && (headers.get("sec-fetch-mode") !== "navigate" || headers.get("sec-fetch-dest") !== "document")
    || incoming.searchParams.getAll("state").length !== 1 || !incoming.searchParams.get("state")?.startsWith(participationOAuthStatePrefix)) return null;
  const destination = new URL(registered.pathname, config.origin);
  for (const key of ["state", "code", "error"]) for (const value of incoming.searchParams.getAll(key)) destination.searchParams.append(key, value);
  return destination;
}

/** The old localhost:3100 compatibility entry forwarded everything to 3111.
 * Keep that behavior for legacy traffic, but send prefixed participation OAuth
 * directly to the current installation. No codes/tokens are logged or exchanged.
 * The supported launcher owns this listener together with the actual app. */
export async function createLocalCallbackEntry(config: LocalDemoConfiguration): Promise<() => void> {
  const registered = new URL(config.linkedIn!.redirectUri);
  if (registered.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(registered.hostname) || !registered.port || registered.origin === config.origin) throw new Error("INVALID_LOCAL_CALLBACK_ENTRY");
  const sockets = new Set<import("node:net").Socket>();
  const valid = (request: http.IncomingMessage) => request.headers.host === registered.host && request.url?.startsWith("/") && !request.url.startsWith("//");
  const options = (request: http.IncomingMessage) => ({ hostname: "127.0.0.1", port: 3111, path: request.url, method: request.method, headers: request.headers });
  const server = http.createServer((request, response) => {
    if (!valid(request)) { response.writeHead(404); response.end(); request.resume(); return; }
    const incoming = new URL(request.url!, registered.origin);
    if (incoming.pathname === registered.pathname && incoming.searchParams.get("state")?.startsWith(participationOAuthStatePrefix)) {
      if (request.method !== "GET") { response.writeHead(404); response.end(); request.resume(); return; }
      const headers = new Headers(); for (const [key, value] of Object.entries(request.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(",") : value);
      const destination = participationCallbackDestination(new Request(incoming, { method: request.method, headers }), config);
      response.writeHead(destination ? 303 : 404, { ...(destination ? { Location: destination.href } : {}), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" }); response.end(); request.resume(); return;
    }
    const upstream = http.request(options(request), result => { response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response); });
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end("Lokale Anwendung nicht erreichbar."); });
    request.on("aborted", () => upstream.destroy()); response.on("close", () => upstream.destroy()); request.pipe(upstream);
  });
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  server.on("upgrade", (request, socket, head) => {
    if (!valid(request)) { socket.destroy(); return; }
    const upstream = http.request(options(request));
    upstream.on("upgrade", (response, upstreamSocket, upstreamHead) => {
      socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`);
      for (let index = 0; index < response.rawHeaders.length; index += 2) socket.write(`${response.rawHeaders[index]}: ${response.rawHeaders[index + 1]}\r\n`);
      socket.write("\r\n"); if (upstreamHead.length) socket.write(upstreamHead); if (head.length) upstreamSocket.write(head);
      socket.on("error", () => upstreamSocket.destroy()); upstreamSocket.on("error", () => socket.destroy()); socket.on("close", () => upstreamSocket.destroy()); socket.pipe(upstreamSocket).pipe(socket);
    });
    upstream.on("response", () => socket.destroy()); upstream.on("error", () => socket.destroy()); upstream.end();
  });
  await new Promise<void>((done, reject) => { server.once("error", reject); server.listen(Number(registered.port), registered.hostname, done); });
  return () => { server.close(); for (const socket of sockets) socket.destroy(); };
}
