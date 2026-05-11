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
// checks the DB value directly per spec.
export type DbVerificationStatus = "pending" | "verified" | "deactivated";

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

// flag_reason carries a single auto-flag token at MVP. KAN-124 replaces
// this with full taxonomy (collect-all matched codes per AC-2 + AC-3).
// 18 chars; well under the 500-char column ceiling.
export const KEYWORD_FLAG_REASON = "auto:keyword_match";

// RFC 4122 UUID, any version. Used only for basic shape validation
// before DB calls — full validation happens at the DB FK layer.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// Escape user-controlled / env-controlled string for safe regex
// embedding. Mandatory — a malformed keyword (e.g., "(broken")
// silently breaks the entire scan without this, masking detection
// failure as "no match". Per SEC keyword-scan discipline.
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

// MVP keyword stub. KAN-124 replaces this with the full taxonomy + the
// collect-all-codes iteration + the source-prefix convention. Until
// then: comma-separated KEYWORD_BLOCKLIST env var → word-boundary
// regex per keyword → on any match, flagged=true with the single
// stub reason.
//
// Per spec: empty or absent KEYWORD_BLOCKLIST returns { flagged: false,
// flag_reason: null } unconditionally. Whitespace-only entries inside
// the comma-split are skipped (an env value of "a,,b" or ",,," does
// not produce a regex with empty keyword — which would silently match
// every message).
export function scanKeywordBlocklist(
  content: string,
  blocklistEnv: string | undefined | null,
): { flagged: boolean; flag_reason: string | null } {
  if (!blocklistEnv) return { flagged: false, flag_reason: null };

  const keywords = blocklistEnv
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keywords.length === 0) return { flagged: false, flag_reason: null };

  for (const keyword of keywords) {
    const pattern = new RegExp("\\b" + escapeRegex(keyword) + "\\b", "i");
    if (pattern.test(content)) {
      return { flagged: true, flag_reason: KEYWORD_FLAG_REASON };
    }
  }
  return { flagged: false, flag_reason: null };
}
