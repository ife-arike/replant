// send-message HTTP handler.
//
// 401 PATH SPLIT — same shape as auth-status-check / submit-heartcry
// (load-bearing per SEC):
//   Gateway 401 (verify_jwt=true at platform): malformed / expired / forged JWT.
//     Response shape is platform default — NOT this handler's UNAUTHORIZED.
//   Function 401 (this code): well-formed JWT but auth.role()==='anon'. Explicit
//     entry-point rejection.
//
// Error envelope:
//   200 → { id, conversation_id, created_at, flagged }
//   400 → { error: "validation_failed", detail: string }
//   401 → { error, code: "UNAUTHORIZED" }
//   403 → { error, code: "FORBIDDEN" }
//   405 → { error, code: "METHOD_NOT_ALLOWED" }
//   5xx → { error, code: "INTERNAL_ERROR" }
//
// No audit_log write — DM send is not in the canonical audit action set.
// SAFE-LOG discipline: sender id, conversation id, success/failure, ts only.
// Content is NEVER logged. Zero exceptions.

import {
  isRecipientAcceptable,
  isSenderVerified,
  isUuid,
  type RecipientRow,
  scanKeywordBlocklist,
  type SenderRow,
  sortParticipants,
  type ValidatedBody,
  validateBody,
} from "./logic.ts";

export interface SendMessageResult {
  id: string;
  conversation_id: string;
  created_at: string;
  flagged: boolean;
}

export interface ConversationParticipants {
  id: string;
  participant_a: string;
  participant_b: string;
}

export interface Deps {
  validateJwt(
    authHeader: string,
  ): Promise<{ authUid: string; role: string } | null>;
  fetchSender(authUid: string): Promise<SenderRow | null>;
  fetchRecipient(recipientId: string): Promise<RecipientRow | null>;
  fetchConversation(conversationId: string): Promise<
    ConversationParticipants | null
  >;
  // Single-transaction send. Returns inserted message + resolved
  // conversation. Implementation owns the lazy-create-or-reuse race on
  // the conversations UNIQUE (participant_a, participant_b) constraint.
  sendInTransaction(input: {
    senderId: string;
    conversationId: string | null; // present when caller passed conversation_id
    participantA: string | null; // present when caller passed recipient_user_id
    participantB: string | null;
    content: string;
    receiverId: string; // resolved counterparty for messages.receiver_id
    flagged: boolean;
    flag_reason: string | null;
  }): Promise<SendMessageResult>;
  readKeywordBlocklist(): string | undefined;
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
    let conversationIdForLog: string | null = null;
    try {
      if (req.method !== "POST") return error405();

      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return error401();
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return error401();

      const validated = await deps.validateJwt(authHeader);
      if (!validated) return error401();
      if (validated.role === "anon") return error401();
      const authUid = validated.authUid;

      let bodyJson: unknown;
      try {
        bodyJson = await req.json();
      } catch {
        return error400("Request body must be valid JSON.");
      }
      const validation = validateBody(bodyJson);
      if (!validation.ok) return error400(validation.detail);
      const body: ValidatedBody = validation.body;

      // Sender — resolved server-side from JWT. Must be verified.
      const sender = await deps.fetchSender(authUid);
      if (!sender) return error403();
      if (!isSenderVerified(sender)) return error403();
      senderId = sender.id;

      // Branch on which UUID field the caller supplied. validateBody
      // guarantees exactly one is non-null.
      let conversationIdInput: string | null = null;
      let participantA: string | null = null;
      let participantB: string | null = null;
      let receiverId: string;

      if (body.conversation_id) {
        // Existing conversation path. 403 if conversation doesn't exist
        // OR caller is not a participant — both are authorization-shaped
        // failures and surface the same way (don't leak existence).
        const conv = await deps.fetchConversation(body.conversation_id);
        if (!conv) return error403();
        if (
          conv.participant_a !== sender.id &&
          conv.participant_b !== sender.id
        ) {
          return error403();
        }
        conversationIdInput = conv.id;
        conversationIdForLog = conv.id;
        receiverId = conv.participant_a === sender.id
          ? conv.participant_b
          : conv.participant_a;
      } else {
        // Lazy-create-or-reuse path. Validate the recipient first; the
        // DB CHECK (participant_a < participant_b) and the API-layer
        // self-DM check are belt-and-suspenders.
        if (!isUuid(body.recipient_user_id)) {
          return error400("recipient_user_id must be a UUID.");
        }
        const recipient = await deps.fetchRecipient(body.recipient_user_id);
        const check = isRecipientAcceptable(recipient, sender.id);
        if (!check.ok) return error400(check.detail);
        // Non-null after isRecipientAcceptable returned ok.
        const recipientId = recipient!.id;
        const { participant_a, participant_b } = sortParticipants(
          sender.id,
          recipientId,
        );
        participantA = participant_a;
        participantB = participant_b;
        receiverId = recipientId;
      }

      // KEYWORD STUB — KAN-124 replaces with full taxonomy. DELIVER-ALWAYS:
      // result feeds messages row only; it never gates INSERT or response.
      const { flagged, flag_reason } = scanKeywordBlocklist(
        body.content,
        deps.readKeywordBlocklist(),
      );

      const result = await deps.sendInTransaction({
        senderId: sender.id,
        conversationId: conversationIdInput,
        participantA,
        participantB,
        content: body.content,
        receiverId,
        flagged,
        flag_reason,
      });
      conversationIdForLog = result.conversation_id;

      // SAFE-LOG: caller user_id + conversation_id + flagged + ts. No
      // message content. No recipient_id (the conversation_id is the
      // forensic handle).
      deps.log("info", "send-message.ok", {
        sender_id: sender.id,
        conversation_id: result.conversation_id,
        flagged: result.flagged,
      });

      return json(200, result);
    } catch (e) {
      const err = e as Error & { code?: string; httpStatus?: number };
      // Structured-error escape hatch for deps to surface a clean
      // status without leaking internals. sendInTransaction throws
      // these on FK / CHECK / race-recovery failures.
      if (err?.httpStatus === 403) {
        deps.log("warn", "send-message.forbidden", {
          sender_id: senderId,
          conversation_id: conversationIdForLog,
          error_class: err.name ?? "Error",
        });
        return error403();
      }
      if (err?.httpStatus === 400) {
        deps.log("warn", "send-message.validation", {
          sender_id: senderId,
          conversation_id: conversationIdForLog,
          error_class: err.name ?? "Error",
        });
        return error400(err.message);
      }
      // SAFE-LOG on 500: sender id + error class only. No content, no
      // stack trace fields that might carry message text.
      deps.log("error", "send-message.error", {
        sender_id: senderId,
        conversation_id: conversationIdForLog,
        error_class: err?.name ?? "Error",
      });
      return error500();
    }
  };
}
