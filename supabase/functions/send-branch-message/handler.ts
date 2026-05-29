// send-branch-message HTTP handler.
//
// 401 PATH SPLIT — same shape as send-message:
//   Gateway 401 (verify_jwt=true): malformed / expired / forged JWT.
//     Response shape is platform default — NOT this handler's UNAUTHORIZED.
//   Function 401 (this code): well-formed JWT but auth.role()==='anon'.
//
// Error envelope:
//   200 → { success: true, message_id: uuid, branch_id: uuid }
//   400 → { error: "validation_failed", detail: string }
//   401 → { error, code: "UNAUTHORIZED" }
//   403 → { error, code: "FORBIDDEN" }       ← not a joined member
//   405 → { error, code: "METHOD_NOT_ALLOWED" }
//   5xx → { error, code: "INTERNAL_ERROR" }
//
// SAFE-LOG discipline (mirror send-message):
//   sender_id + branch_id + flagged + ts. Content NEVER logged.
//   Zero exceptions.
//
// DELIVER-ALWAYS — D-45 clause 3: keyword match writes flagged +
// flag_reason on the inserted row ONLY. NEVER gates the INSERT, the
// Realtime broadcast (messages is in supabase_realtime), or the 200
// response. Auditable separately via admin moderation surface.

import {
  isSenderVerified,
  type SenderRow,
  type ValidatedBody,
  validateBody,
} from "./logic.ts";
import { collectMatches, composeFlagReason } from "./matcher.ts";
import { type Taxonomy } from "./taxonomy.ts";

export interface SendBranchMessageResult {
  success: true;
  message_id: string;
  branch_id: string;
}

export interface Deps {
  validateJwt(
    authHeader: string,
  ): Promise<{ authUid: string; role: string } | null>;
  fetchSender(authUid: string): Promise<SenderRow | null>;
  // Returns true iff caller is consent_status='joined' on this branch.
  // False on every other condition (no row / 'invited' / 'declined' /
  // branch doesn't exist). Don't leak existence in the 403 shape.
  isCallerJoinedMember(
    senderId: string,
    branchId: string,
  ): Promise<boolean>;
  // Single statement insert into messages + branches.last_message_at
  // bump. Realtime fires automatically on commit (messages is in
  // supabase_realtime). receiver_id = NULL, conversation_id = NULL by
  // the OQ-1 path (a) 3-way CHECK contract.
  insertBranchMessage(input: {
    senderId: string;
    branchId: string;
    content: string;
    flagged: boolean;
    flag_reason: string | null;
  }): Promise<{ id: string }>;
  // KAN-124 — returns the parsed FLAG_TAXONOMY at cold-start, or null
  // if the secret is missing / malformed. Matcher folds null to no-
  // matches; DELIVER-ALWAYS preserved even on taxonomy unavailability.
  getTaxonomy(): Taxonomy | null;
  log(
    level: "info" | "warn" | "error",
    event: string,
    fields: Record<string, unknown>,
  ): void;
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
const error403 = () => json(403, { error: "Forbidden", code: "FORBIDDEN" });
const error405 = () =>
  json(405, { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
const error500 = () =>
  json(500, { error: "Send failed", code: "INTERNAL_ERROR" });

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    let senderId: string | null = null;
    let branchIdForLog: string | null = null;
    try {
      if (req.method !== "POST") return error405();

      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return error401();
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return error401();

      const validated = await deps.validateJwt(authHeader);
      if (!validated) return error401();
      if (validated.role === "anon") return error401();

      let bodyJson: unknown;
      try {
        bodyJson = await req.json();
      } catch {
        return error400("Request body must be valid JSON.");
      }
      const validation = validateBody(bodyJson);
      if (!validation.ok) return error400(validation.detail);
      const body: ValidatedBody = validation.body;
      branchIdForLog = body.branch_id;

      const sender = await deps.fetchSender(validated.authUid);
      if (!sender) return error403();
      if (!isSenderVerified(sender)) return error403();
      senderId = sender.id;

      // Branch membership gate. consent_status MUST be 'joined' to send
      // — an 'invited' or 'declined' row CANNOT send. The forming
      // banner / locked composer on the FE enforces this UX-side; this
      // check is defense-in-depth.
      const isMember = await deps.isCallerJoinedMember(sender.id, body.branch_id);
      if (!isMember) return error403();

      // DELIVER-ALWAYS — D-45 clause 3.
      // Keyword match populates `flagged` + `flag_reason` on the row,
      // NEVER gates delivery. Admin moderation queue reads these
      // columns to route — they don't change the sender's experience.
      const matchResult = collectMatches(body.content, deps.getTaxonomy());
      const { flag_reason, dropped_codes } = composeFlagReason(
        matchResult.matches,
      );
      const flagged = matchResult.matches.length > 0;

      // Observability: log dropped overflow codes (names only, never content).
      if (dropped_codes.length > 0) {
        deps.log("warn", "send-branch-message.flag-reason-overflow", {
          sender_id: sender.id,
          branch_id: branchIdForLog,
          dropped_codes: dropped_codes.join(","),
        });
      }
      if (matchResult.observability.cross_axis) {
        deps.log("warn", "send-branch-message.cross-axis-match", {
          sender_id: sender.id,
          branch_id: branchIdForLog,
        });
      }

      const inserted = await deps.insertBranchMessage({
        senderId: sender.id,
        branchId: body.branch_id,
        content: body.content,
        flagged,
        flag_reason,
      });

      // SAFE-LOG: sender + branch + flagged + ts. No content. No
      // recipient identifiers (branch broadcasts to N members; the
      // forensic anchor is branch_id + message_id).
      deps.log("info", "send-branch-message.ok", {
        sender_id: sender.id,
        branch_id: body.branch_id,
        flagged,
      });

      const result: SendBranchMessageResult = {
        success: true,
        message_id: inserted.id,
        branch_id: body.branch_id,
      };
      return json(200, result);
    } catch (e) {
      const err = e as Error & { code?: string; httpStatus?: number };
      if (err?.httpStatus === 403) {
        deps.log("warn", "send-branch-message.forbidden", {
          sender_id: senderId,
          branch_id: branchIdForLog,
          error_class: err.name ?? "Error",
        });
        return error403();
      }
      if (err?.httpStatus === 400) {
        deps.log("warn", "send-branch-message.validation", {
          sender_id: senderId,
          branch_id: branchIdForLog,
          error_class: err.name ?? "Error",
        });
        return error400(err.message);
      }
      deps.log("error", "send-branch-message.error", {
        sender_id: senderId,
        branch_id: branchIdForLog,
        error_class: err?.name ?? "Error",
      });
      return error500();
    }
  };
}
