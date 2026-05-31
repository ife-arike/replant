// send-message — pure logic. No HTTP, no DB, no network.
//
// D-45 clause 3: keyword match drives queue priority, NOT delivery gating.
//
// All exports here are deterministic, side-effect-free, and unit-testable
// via `deno test logic.test.ts`. The handler imports these helpers; the
// matcher (scanKeywordBlocklist) intentionally returns ONLY a
// { flagged, flag_reason } record — it never returns a delivery
// decision. Per the D-45 deliver-always invariant, no caller may infer a
// HOLD / REJECT from this module's output. A HOLD requires explicit
// admin action via a separate moderation surface.

// DB-level enum (verification_status_enum). API-layer translation
// (verified → "active") is auth-status-check's lane only; send-message
// checks the DB value directly per spec. KAN-65 tidy-up (2026-05-26) added
// 'rejected' — additive only; both isSenderVerified and
// isRecipientAcceptable already gate on `=== "verified"`, so rejected
// leaders correctly fall through as non-verified without further changes.
export type DbVerificationStatus = "pending" | "verified" | "rejected" | "deactivated";

export interface SenderRow {
  id: string; // public.users.id (FK target for messages.sender_id)
  verification_status: DbVerificationStatus;
}

export interface RecipientRow {
  id: string;
  verification_status: DbVerificationStatus;
}

export interface ValidatedBody {
  // Exactly one of these is non-null after validation.
  conversation_id: string | null;
  recipient_user_id: string | null;
  content: string; // trimmed, non-empty, ≤ MAX_CONTENT_LENGTH
}

export type ValidationResult =
  | { ok: true; body: ValidatedBody }
  | { ok: false; detail: string };

// Server-side ceiling per spec. FE form will have a soft cap; this is the
// hard cap. 5,000 chars chosen for storage discipline and to discourage
// accidental dump of large pastes — the underlying DM surface is for
// leader-to-leader correspondence, not document transfer.
export const MAX_CONTENT_LENGTH = 5_000;

// KAN-124 — the KAN-71 KEYWORD_BLOCKLIST stub matcher
// (scanKeywordBlocklist + KEYWORD_FLAG_REASON + escapeRegex) was
// removed in this commit. The full taxonomy matcher lives at
// ./matcher.ts; the FLAG_TAXONOMY secret loader lives at ./taxonomy.ts.
// Pattern strings are NEVER inlined here (or in any committed file)
// per AC-12.

// RFC 4122 UUID, any version. Used only for basic shape validation
// before DB calls — full validation happens at the DB FK layer.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// Canonical UUID-string sort for conversation participants. Both the
// participant_order CHECK (participant_a < participant_b) and the
// unique_participant_pair UNIQUE constraint depend on this ordering;
// every lookup AND every insert must sort first.
export function sortParticipants(
  a: string,
  b: string,
): { participant_a: string; participant_b: string } {
  if (a === b) {
    // The DB CHECK would also reject this, but enforcing here gives a
    // clean 400 instead of a 500 with a confusing constraint message.
    throw new Error("Cannot create a thread with self");
  }
  const [participant_a, participant_b] = [a, b].sort();
  return { participant_a, participant_b };
}

export function validateBody(input: unknown): ValidationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, detail: "Request body must be a JSON object." };
  }
  const obj = input as Record<string, unknown>;

  // Content — required string, non-empty after trim, capped.
  if (typeof obj.content !== "string") {
    return { ok: false, detail: "content is required and must be a string." };
  }
  const content = obj.content.trim();
  if (content.length === 0) {
    return { ok: false, detail: "content must not be empty after trim." };
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return {
      ok: false,
      detail:
        `content exceeds the maximum length of ${MAX_CONTENT_LENGTH} characters.`,
    };
  }

  // Exactly one of conversation_id / recipient_user_id required.
  const hasConv = obj.conversation_id !== undefined &&
    obj.conversation_id !== null;
  const hasRecipient = obj.recipient_user_id !== undefined &&
    obj.recipient_user_id !== null;

  if (hasConv === hasRecipient) {
    return {
      ok: false,
      detail:
        "Provide exactly one of conversation_id or recipient_user_id — not both, not neither.",
    };
  }

  if (hasConv) {
    if (!isUuid(obj.conversation_id)) {
      return { ok: false, detail: "conversation_id must be a UUID." };
    }
    return {
      ok: true,
      body: {
        conversation_id: obj.conversation_id as string,
        recipient_user_id: null,
        content,
      },
    };
  }

  // hasRecipient
  if (!isUuid(obj.recipient_user_id)) {
    return { ok: false, detail: "recipient_user_id must be a UUID." };
  }
  return {
    ok: true,
    body: {
      conversation_id: null,
      recipient_user_id: obj.recipient_user_id as string,
      content,
    },
  };
}

export function isSenderVerified(row: SenderRow): boolean {
  return row.verification_status === "verified";
}

// ──────────────────────── KAN-217 /internal ────────────────────────
// Internal route body shape. /internal is the BE-only path that the
// admin server uses for system-issued messages (welcome DM today).
// Contract is intentionally tighter than the external path:
//   - conversation_id is REQUIRED (admin BE does find-or-create first)
//   - sender_id is REJECTED (SEC AC-3c: resolved from Vault at startup,
//     never accepted from a request body — impersonation hardening)
//   - recipient_user_id is REJECTED (use conversation_id; the receiver
//     is the non-system participant on the conversation row)

export interface ValidatedInternalBody {
  conversation_id: string;
  content: string;
}

export type InternalValidationResult =
  | { ok: true; body: ValidatedInternalBody }
  | { ok: false; detail: string };

export function validateInternalBody(input: unknown): InternalValidationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, detail: "Request body must be a JSON object." };
  }
  const obj = input as Record<string, unknown>;

  // SEC AC-3(c) — sender_id from Vault only. Reject if the field is
  // present at all (even null) to keep the contract unambiguous and
  // avoid any future drift where a caller "accidentally" depends on
  // sender_id being honored.
  if (Object.prototype.hasOwnProperty.call(obj, "sender_id")) {
    return {
      ok: false,
      detail: "sender_id is not accepted on /internal — resolved from Vault.",
    };
  }
  // Keep the contract tight: /internal is conversation_id-only.
  if (Object.prototype.hasOwnProperty.call(obj, "recipient_user_id")) {
    return {
      ok: false,
      detail:
        "recipient_user_id is not accepted on /internal — use conversation_id.",
    };
  }

  if (typeof obj.content !== "string") {
    return { ok: false, detail: "content is required and must be a string." };
  }
  const content = obj.content.trim();
  if (content.length === 0) {
    return { ok: false, detail: "content must not be empty after trim." };
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return {
      ok: false,
      detail:
        `content exceeds the maximum length of ${MAX_CONTENT_LENGTH} characters.`,
    };
  }

  if (!isUuid(obj.conversation_id)) {
    return {
      ok: false,
      detail: "conversation_id is required and must be a UUID.",
    };
  }

  return {
    ok: true,
    body: {
      conversation_id: obj.conversation_id as string,
      content,
    },
  };
}

// Resolve receiver_id from a conversation row, given the system sender.
// The receiver is the participant that is NOT the system user. Returns
// null when the system user is not a participant of the conversation
// (defensive — admin BE find-or-create should guarantee this).
export function resolveInternalReceiverId(
  conversation: { participant_a: string; participant_b: string },
  systemSenderId: string,
): string | null {
  if (conversation.participant_a === systemSenderId) {
    return conversation.participant_b;
  }
  if (conversation.participant_b === systemSenderId) {
    return conversation.participant_a;
  }
  return null;
}

export function isRecipientAcceptable(
  recipient: RecipientRow | null,
  senderId: string,
): { ok: true } | { ok: false; detail: string } {
  if (!recipient) {
    return { ok: false, detail: "recipient_user_id does not exist." };
  }
  if (recipient.verification_status !== "verified") {
    return {
      ok: false,
      detail: "recipient is not a verified leader.",
    };
  }
  if (recipient.id === senderId) {
    return { ok: false, detail: "Cannot send a message to self." };
  }
  return { ok: true };
}

