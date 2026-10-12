import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { auditFixturePair } from "../src/lib/fixture-audit.ts";

// Node 22's built-in TypeScript stripping keeps this read-only tool independent
// of application/database setup and introduces no additional dependency.
const argumentsList = process.argv.slice(2);
const paths = argumentsList.length === 0 ? [
  ".local-fixtures/phase-d/all_linkedin_snapshots.json",
  ".local-fixtures/phase-d/all_expected_normalized.json",
] : argumentsList;

function fail(code, input) {
  // Never print an exception message, filename or JSON excerpt: those may
  // contain profile text, including in JSON.parse's SyntaxError message.
  console.log(JSON.stringify({ ok: false, diagnostics: [{ code, input }] }, null, 2));
  process.exitCode = 1;
}

if (paths.length !== 2) fail("INVALID_ARGUMENTS", "pair");
else {
  const values = [];
  const inputs = {};
  for (const [index, input] of ["snapshots", "expected"].entries()) {
    let buffer;
    try { buffer = await readFile(paths[index]); }
    catch { fail("FILE_READ_FAILED", input); break; }
    let value;
    try { value = JSON.parse(buffer.toString("utf8")); }
    catch { fail("INVALID_JSON", input); break; }
    values.push(value);
    inputs[input] = { bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") };
  }
  if (values.length === 2) {
    const report = auditFixturePair(values[0], values[1]);
    console.log(JSON.stringify({ ...report, inputs }, null, 2));
    if (!report.ok) process.exitCode = 1;
  }
}
