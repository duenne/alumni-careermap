"use client";
import { useEffect, useRef, useState } from "react";
import { portabilityMessage, snapshotDiagnosticLabel } from "../../../lib/dev-import/linkedin/errors";

export function useLinkedInImport() {
  const [connection, setConnection] = useState({ configured: false, connected: false, checked: false });
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const outcome = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    if (outcome.current === undefined) outcome.current = new URLSearchParams(location.search).get("linkedin");
    if (outcome.current) history.replaceState(null, "", location.pathname);
    void fetch("/api/dev/import/linkedin/status", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (active) {
        setConnection({ configured: data.configured === true, connected: data.connected === true, checked: true });
        if (outcome.current && outcome.current !== "connected") setError(portabilityMessage(outcome.current));
      }
    }).catch(() => { if (active) setError("Der LinkedIn-Verbindungsstatus konnte nicht geladen werden."); });
    return () => { active = false; controller.current?.abort(); };
  }, []);
  const cancel = () => { controller.current?.abort(); };
  async function disconnect() {
    cancel();
    const response = await fetch("/api/dev/import/linkedin/disconnect", { method: "POST", cache: "no-store" });
    if (!response.ok) throw new Error("DISCONNECT_FAILED");
    setConnection(current => ({ ...current, connected: false })); setError(null);
  }
  async function read() {
    cancel(); const request = new AbortController(); controller.current = request; setError(null);
    const response = await fetch("/api/dev/import/linkedin/snapshot", { method: "POST", cache: "no-store", signal: request.signal });
    const data = await response.json();
    if (!response.ok || response.status === 202) {
      if ([401, 403].includes(response.status)) setConnection(current => ({ ...current, connected: false }));
      setError([portabilityMessage(data.code), snapshotDiagnosticLabel(data.diagnostic)].filter(Boolean).join(" "));
      throw new Error("LINKEDIN_READ_FAILED");
    }
    if (request.signal.aborted || data.source !== "linkedin") throw new Error("LINKEDIN_READ_FAILED");
    return data.snapshot as unknown;
  }
  return { ...connection, error, read, disconnect, cancel };
}
