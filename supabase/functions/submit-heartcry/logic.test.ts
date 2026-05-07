// Pure-logic unit tests for submit-heartcry validation. No HTTP, no DB, no
// network — runs as `deno test logic.test.ts`. Mirrors the auth-status-check
// pattern of testing the validateBody pure function exhaustively.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ALLOWED_REQUEST_TYPES, ALLOWED_SEVERITIES, MAX_CONTENT_LENGTH, validateBody } from "./logic.ts";

Deno.test("rejects null body", () => {
  const r = validateBody(null);
  assertEquals(r.ok, false);
});

Deno.test("rejects array body", () => {
  const r = validateBody([]);
  assertEquals(r.ok, false);
});

Deno.test("rejects missing content", () => {
  const r = validateBody({ severity: "informational" });
  assertEquals(r.ok, false);
});

Deno.test("rejects empty content after trim", () => {
  const r = validateBody({ content: "   \n\t  ", severity: "informational" });
  assertEquals(r.ok, false);
});

Deno.test("trims content", () => {
  const r = validateBody({
    content: "  hello world  ",
    severity: "informational",
  });
  if (!r.ok) throw new Error(`expected ok: ${r.detail}`);
  assertEquals(r.body.content, "hello world");
});

Deno.test("rejects content over MAX_CONTENT_LENGTH", () => {
  const r = validateBody({
    content: "x".repeat(MAX_CONTENT_LENGTH + 1),
    severity: "informational",
  });
  assertEquals(r.ok, false);
});

Deno.test("accepts content at exactly MAX_CONTENT_LENGTH", () => {
  const r = validateBody({
    content: "x".repeat(MAX_CONTENT_LENGTH),
    severity: "informational",
  });
  assertEquals(r.ok, true);
});

Deno.test("rejects unknown severity", () => {
  const r = validateBody({ content: "hi", severity: "critical" });
  assertEquals(r.ok, false);
});

Deno.test("accepts every allowed severity", () => {
  for (const s of ALLOWED_SEVERITIES) {
    const r = validateBody({ content: "hi", severity: s });
    if (!r.ok) throw new Error(`severity ${s} rejected: ${r.detail}`);
    assertEquals(r.body.severity, s);
  }
});

Deno.test("normalizes empty request_type array to null", () => {
  const r = validateBody({
    content: "hi",
    severity: "urgent",
    request_type: [],
  });
  if (!r.ok) throw new Error(r.detail);
  assertEquals(r.body.request_type, null);
});

Deno.test("normalizes null request_type", () => {
  const r = validateBody({
    content: "hi",
    severity: "urgent",
    request_type: null,
  });
  if (!r.ok) throw new Error(r.detail);
  assertEquals(r.body.request_type, null);
});

Deno.test("accepts every allowed request_type value", () => {
  for (const t of ALLOWED_REQUEST_TYPES) {
    const r = validateBody({
      content: "hi",
      severity: "urgent",
      request_type: [t],
    });
    if (!r.ok) throw new Error(`request_type ${t} rejected: ${r.detail}`);
    assertEquals(r.body.request_type, [t]);
  }
});

Deno.test("rejects unknown request_type entries", () => {
  const r = validateBody({
    content: "hi",
    severity: "urgent",
    request_type: ["prayer", "money"],
  });
  assertEquals(r.ok, false);
});

Deno.test("rejects duplicate request_type entries", () => {
  const r = validateBody({
    content: "hi",
    severity: "urgent",
    request_type: ["prayer", "prayer"],
  });
  assertEquals(r.ok, false);
});

Deno.test("rejects non-array request_type", () => {
  const r = validateBody({
    content: "hi",
    severity: "urgent",
    request_type: "prayer",
  });
  assertEquals(r.ok, false);
});

Deno.test("accepts multiple request_type values", () => {
  const r = validateBody({
    content: "hi",
    severity: "active_persecution",
    request_type: ["prayer", "practical_support", "guidance"],
  });
  if (!r.ok) throw new Error(r.detail);
  assertEquals(r.body.request_type, ["prayer", "practical_support", "guidance"]);
});

Deno.test("treats omitted request_type as null", () => {
  const r = validateBody({ content: "hi", severity: "urgent" });
  if (!r.ok) throw new Error(r.detail);
  assertEquals(r.body.request_type, null);
});
