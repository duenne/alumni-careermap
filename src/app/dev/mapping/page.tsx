import type { Metadata } from "next";
import MappingEditor from "./mapping-editor";

export const metadata: Metadata = { title: "JSON → Datenbank – vertikaler Test", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function MappingPage() { return <MappingEditor />; }
