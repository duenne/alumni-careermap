import type { Metadata } from "next";
import ImportEditor from "./import-editor";
import MappingEditor from "../mapping/mapping-editor";

export const metadata: Metadata = {
  title: "LinkedIn-Testimport – Entwicklung",
  robots: { index: false, follow: false },
  // Native form POSTs need a non-null Origin for the unchanged CSRF check.
  // same-origin still suppresses referrers to LinkedIn and other external sites.
  referrer: "same-origin",
};

// The narrowly matched server-side proxy enforces the development gate before
// React renders this page. No asynchronous/notFound Flight error path is needed.
export default function ImportPage() {
  return process.env.CAREERMAP_DEV_WORKFLOW === "1" ? <MappingEditor workflow /> : <ImportEditor />;
}
