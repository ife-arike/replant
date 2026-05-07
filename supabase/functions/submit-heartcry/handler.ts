// submit-heartcry HTTP handler — KAN-66.
//
// 401 PATH SPLIT — same shape as auth-status-check (load-bearing per SEC):
//   Gateway 401 (verify_jwt=true at platform): malformed / expired / forged JWT.
//     Response shape is platform default — NOT this handler's UNAUTHORIZED.
//   Function 401 (this code): well-formed JWT but auth.role()==='anon'. Explicit
//     entry-point rejection.
//
// AC error envelope:
//   200 → { success: true }                              — only success shape
//   400 → { error: "validation_failed", detail: string } — FE-safe detail string
//   401 → { error, code: "UNAUTHORIZED" }
//   403 → { error, code: "FORBIDDEN_NOT_VERIFIED" }
//   405 → { error, code: "METHOD_NOT_ALLOWED" }
//   5xx → { error, code: "INTERNAL_ERROR" }              — generic, no internals
//
// No audit_log write — submission is not in the v2.2 canonical 18-action audit
// set; admin reads (KAN-67) are what get logged.
//
// ─── operation_id correlation contract (SEC item-4(a) ruling) ────────────────
//
// Every request generates a fresh `operation_id = crypto.randomUUID()` at
// handler entry and threads it through EVERY centralized deps.log() call.
// Per SEC's exact framing: "Substitute user_id with random per-request
// operation_id in SAFE LOGS" and "Stash in logs only = breaks the correlation
// path."
//
// For KAN-66 there are no audit_log writes per AC, so operation_id is set in
// safe logs only. KAN-67 (admin reads — audit_log writes are in scope there)
// MUST persist the same operation_id into the audit_log row so a forensic
// investigator can correlate the safe log line back to the audit_log row that
// names the user.
//
// This handler is the SOLE writer of operation_id; nothing downstream in the
// deps surface generates one. The id has request-scope only — never persisted
// here, never returned to the client, never logged outside the centralized
// deps.log envelope.

import {
  type HeartcrySubmitterRow,
  type ValidatedBody,
  isUserVerified,
  validateBody,
} from "./logic.ts";

export interface InsertHeartcryRow {
  church_id: string;
  user_id: string;
  content: string; // ciphertext
  severity: string;
  request_type: string[] | null;
  triage_lead_id: string;
}

export interface EmailLogRow {
  user_id: string; // recipient = triage lead user.id
  template: string;
  resend_id: string | null;
}

export interface EmailLogResult {
  ok: boolean;
  error?: string;
}

export interface ResendSendResult {
  ok: boolean;
  resend_id: string | null;
  error?: string;
}

// SAFE-LOG envelope shape. operation_id is REQUIRED. Other safe fields may
// appear (resend_ok, error_class, reason). Callers MUST NOT include
// content / severity / request_type / church_id / user_id — drift-guarded by
// handler.test.ts.
export interface LogFields {
  operation_id: string;
  resend_ok?: boolean;
  error_class?: string;
  reason?: string;
}

export interface Deps {
  validateJwt(authHeader: string): Promise<{ authUid: string; role: string } | null>;
  fetchSubmitter(authUid: string): Promise<HeartcrySubmitterRow | null>;
  encryptContent(plaintext: string): Promise<string>;
  insertHeartcry(row: InsertHeartcryRow): Promise<void>;
  resolveTriageLeadId(): Promise<string>;
  resolveTriageLeadEmail(): Promise<string>;
  sendTriageEmail(to: string): Promise<ResendSendResult>;
  logEmail(row: EmailLogRow): Promise<EmailLogResult>;
  log(level: "info" | "warn" | "error", event: string, fields: LogFields): void;
  // Hook for tests — defaults to crypto.randomUUID() in the production deps.
  // Allows handler.test.ts to assert deterministic operation_id values.
  newOperationId(): string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error400 = (detail: string) =>
  json(400, { error: "validation_failed", detail });
const error401 = () =>
  json(401, { error: "Invalid or expired session", code: "UNAUTHORIZED" });
const error403 = () =>
  json(403, { error: "Forbidden", code: "FORBIDDEN_NOT_VERIFIED" });
const error405 = () =>
  json(405, { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
const error500 = () =>
  json(500, { error: "Submission failed", code: "INTERNAL_ERROR" });

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    // Random per-request correlation token. See operation_id correlation
    // contract in the file preamble.
    const operation_id = deps.newOperationId();
    try {
      if (req.method !== "POST") {
        deps.log("info", "submit-heartcry.method_not_allowed", { operation_id });
        return error405();
      }

      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
        deps.log("info", "submit-heartcry.unauthorized", {
          operation_id,
          reason: "missing_or_malformed_header",
        });
        return error401();
      }
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) {
        deps.log("info", "submit-heartcry.unauthorized", {
          operation_id,
          reason: "empty_token",
        });
        return error401();
      }

      const validated = await deps.validateJwt(authHeader);
      if (!validated) {
        deps.log("info", "submit-heartcry.unauthorized", {
          operation_id,
          reason: "validate_jwt_null",
        });
        return error401();
      }
      if (validated.role === "anon") {
        deps.log("info", "submit-heartcry.unauthorized", {
          operation_id,
          reason: "anon_role",
        });
        return error401();
      }

      let bodyJson: unknown;
      try {
        bodyJson = await req.json();
      } catch {
        deps.log("info", "submit-heartcry.validation_failed", {
          operation_id,
          reason: "json_parse",
        });
        return error400("Request body must be valid JSON.");
      }
      const validation = validateBody(bodyJson);
      if (!validation.ok) {
        // No `detail` in the safe-log — would echo user input, redundantly.
        deps.log("info", "submit-heartcry.validation_failed", {
          operation_id,
          reason: "schema",
        });
        return error400(validation.detail);
      }
      const body: ValidatedBody = validation.body;

      const submitter: HeartcrySubmitterRow | null = await deps.fetchSubmitter(
        validated.authUid,
      );
      if (!submitter) {
        deps.log("info", "submit-heartcry.forbidden", {
          operation_id,
          reason: "submitter_lookup_failed",
        });
        return error403();
      }
      if (!isUserVerified(submitter)) {
        deps.log("info", "submit-heartcry.forbidden", {
          operation_id,
          reason: "not_verified",
        });
        return error403();
      }

      const ciphertext = await deps.encryptContent(body.content);
      const triageLeadId = await deps.resolveTriageLeadId();

      await deps.insertHeartcry({
        church_id: submitter.church_id,
        user_id: submitter.id,
        content: ciphertext,
        severity: body.severity,
        request_type: body.request_type,
        triage_lead_id: triageLeadId,
      });

      // Triage notification — fire-and-forget per AC. Send failures must not
      // roll back the DB insert; failures route through the centralized
      // deps.log path (via the email_log result), never bubble out of scope.
      const triageEmail = await deps.resolveTriageLeadEmail();
      let sendResult: ResendSendResult;
      try {
        sendResult = await deps.sendTriageEmail(triageEmail);
      } catch (e) {
        sendResult = { ok: false, resend_id: null, error: (e as Error).message };
      }

      const logResult = await deps.logEmail({
        user_id: triageLeadId,
        template: "heartcry_triage_notification",
        resend_id: sendResult.resend_id,
      });
      if (!logResult.ok) {
        // SAFE-LOG: best-effort observability for OPS. Never blocks success.
        deps.log("warn", "submit-heartcry.email_log_failed", {
          operation_id,
          reason: "insert_failed",
        });
      }

      deps.log("info", "submit-heartcry.ok", {
        operation_id,
        resend_ok: sendResult.ok,
      });
      return json(200, { success: true });
    } catch (e) {
      // SAFE-LOG: failure trace WITHOUT user payload. error_class is the
      // exception's constructor name (e.g. "TypeError"); never includes
      // operands or messages.
      deps.log("error", "submit-heartcry.error", {
        operation_id,
        error_class: (e as Error)?.name ?? "Error",
      });
      return error500();
    }
  };
}
