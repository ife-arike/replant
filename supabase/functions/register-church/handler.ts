// KAN-13 register-church — handler factory (createHandler pattern).
//
// Mirrors auth-status-check / submit-heartcry: deps are injected so the
// handler is unit-testable without the Supabase client or Deno runtime.
// index.ts wires real deps; handler.test.ts wires fakes.

import {
  buildSuccessBody,
  computeVerificationDeadline,
  type InsertChurchRow,
  parsePayload,
} from "./logic.ts";

export interface Deps {
  // Insert into churches with verification_status='pending' + the supplied
  // verification_deadline. is_active / verified / created_at / church_code
  // are column-default-supplied (see migrations).
  insertChurch(
    row: InsertChurchRow,
    verificationDeadline: string,
  ): Promise<{ id: string }>;
  now(): Date;
  log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>): void;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error400 = (msg: string) => json(400, { error: msg });
const error405 = () => json(405, { error: "Method not allowed" });
const error409 = (code: string, msg: string) => json(409, { error: msg, code });
const error500 = () => json(500, { error: "Church registration failed" });

// KAN-230: detect the partial unique index 23505 from the new
// churches_contact_email_unique_excl_campus constraint. The supabase-js
// surface puts the Postgres error code in `.code` and the constraint
// detail in `.message` / `.details`. Any 23505 mentioning this constraint
// is a contact-email collision against a non-campus church.
function isContactEmailUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; message?: string; details?: string } | null;
  if (!err) return false;
  if (err.code !== "23505") return false;
  const haystack = `${err.message ?? ""} ${err.details ?? ""}`;
  return haystack.includes("churches_contact_email_unique_excl_campus");
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") return error405();

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return error400("Request body must be valid JSON");
      }

      const parsed = parsePayload(body);
      if (!parsed.ok) return error400(parsed.error);

      const verificationDeadline = computeVerificationDeadline(deps.now());

      let inserted: { id: string };
      try {
        inserted = await deps.insertChurch(parsed.row, verificationDeadline);
      } catch (e) {
        // KAN-230 — typed surface for the contact-email partial unique
        // index. Lets the FE map to the Founder-locked inline copy
        // without parsing raw Postgres text.
        if (isContactEmailUniqueViolation(e)) {
          deps.log("warn", "register_church_contact_email_taken", {
            type: parsed.row.type,
            name_length: parsed.row.name.length,
          });
          return error409(
            "contact_email_taken",
            "This email is already registered to another church. If this is your parent campus, change your church type to Main Campus or Branch. Otherwise use a different contact email.",
          );
        }
        // Never surface raw Postgres errors to the caller. Log structured for
        // observability; return a generic 500. (Validation has already happened
        // upstream — anything that lands here is a server-side fault.)
        deps.log("error", "register_church_insert_failed", {
          // Log the church name length only, not the value itself (PII for
          // Underground submitters whose church name is sensitive).
          name_length: parsed.row.name.length,
          type: parsed.row.type,
          message: (e as Error).message,
        });
        return error500();
      }

      deps.log("info", "register_church_success", {
        church_id: inserted.id,
        type: parsed.row.type,
      });

      return json(200, buildSuccessBody(inserted.id, verificationDeadline));
    } catch (e) {
      deps.log("error", "register_church_unexpected", {
        message: (e as Error).message,
      });
      return error500();
    }
  };
}
