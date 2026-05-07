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

export interface ResendSendResult {
  ok: boolean;
  resend_id: string | null;
  error?: string;
}

export interface Deps {
  validateJwt(authHeader: string): Promise<{ authUid: string; role: string } | null>;
  fetchSubmitter(authUid: string): Promise<HeartcrySubmitterRow | null>;
  encryptContent(plaintext: string): Promise<string>;
  insertHeartcry(row: InsertHeartcryRow): Promise<void>;
  resolveTriageLeadId(): Promise<string>;
  resolveTriageLeadEmail(): Promise<string>;
  sendTriageEmail(to: string): Promise<ResendSendResult>;
  logEmail(row: EmailLogRow): Promise<void>;
  log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>): void;
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
    let authUid: string | null = null;
    try {
      if (req.method !== "POST") return error405();

      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return error401();
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return error401();

      const validated = await deps.validateJwt(authHeader);
      if (!validated) return error401();
      if (validated.role === "anon") return error401();
      authUid = validated.authUid;

      let bodyJson: unknown;
      try {
        bodyJson = await req.json();
      } catch {
        return error400("Request body must be valid JSON.");
      }
      const validation = validateBody(bodyJson);
      if (!validation.ok) return error400(validation.detail);
      const body: ValidatedBody = validation.body;

      const submitter: HeartcrySubmitterRow | null = await deps.fetchSubmitter(authUid);
      if (!submitter) return error403();
      if (!isUserVerified(submitter)) return error403();

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
      // roll back the DB insert; failures are logged to email_log for OPS
      // observability and never bubble out of this scope.
      const triageEmail = await deps.resolveTriageLeadEmail();
      let sendResult: ResendSendResult;
      try {
        sendResult = await deps.sendTriageEmail(triageEmail);
      } catch (e) {
        sendResult = { ok: false, resend_id: null, error: (e as Error).message };
      }
      try {
        await deps.logEmail({
          user_id: triageLeadId,
          template: "heartcry_triage_notification",
          resend_id: sendResult.resend_id,
        });
      } catch {
        // email_log is best-effort observability; do not fail the submission.
      }

      // SAFE-LOG: caller user_id, success — never content / severity /
      // request_type / church_id (per AC).
      deps.log("info", "submit-heartcry.ok", {
        user_id: submitter.id,
        resend_ok: sendResult.ok,
      });

      return json(200, { success: true });
    } catch (e) {
      // SAFE-LOG: failure trace WITHOUT user payload. Captures auth_uid (which
      // may be null if failure occurred pre-auth) + error class.
      deps.log("error", "submit-heartcry.error", {
        auth_uid: authUid,
        error_class: (e as Error)?.name ?? "Error",
      });
      return error500();
    }
  };
}
