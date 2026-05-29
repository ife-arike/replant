// send-branch-message — pure logic. No HTTP, no DB, no network.
//
// Twin to send-message/logic.ts (KAN-71) but scoped to branch sends:
// the validated body carries `branch_id` + `content` only. Recipient
// resolution is N-to-N (every joined branch member), so there's no
// per-message receiver_id to validate — `messages.receiver_id` is NULL
// for branch rows (OQ-1 path (a), KAN-214).
//
// DELIVER-ALWAYS — D-45 clause 3: this module returns ONLY validation
// outcomes. It NEVER returns a delivery decision. The matcher in
// matcher.ts is consulted by the handler for { flagged, flag_reason }
// metadata only — the INSERT path in index.ts MUST NOT branch on it.

export type DbVerificationStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "deactivated";

export interface SenderRow {
  id: string; // public.users.id (FK target for messages.sender_id)
  verification_status: DbVerificationStatus;
}

export interface ValidatedBody {
  branch_id: string;
  content: string; // trimmed, non-empty, ≤ MAX_CONTENT_LENGTH
}

export type ValidationResult =
  | { ok: true; body: ValidatedBody }
  | { ok: false; detail: string };

// MAX_CONTENT_LENGTH per KAN-214 brief: 2,000 chars (tighter than DM's
// 5,000). Branch threads are leader-to-leader group conversations —
// short, prayerful, frequent. The 2k cap mirrors the FE composer's
// soft limit and discourages dumping documents through the channel.
export const MAX_CONTENT_LENGTH = 2_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function validateBody(input: unknown): ValidationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, detail: "Request body must be a JSON object." };
  }
  const obj = input as Record<string, unknown>;

  // branch_id — required UUID.
  if (obj.branch_id === undefined || obj.branch_id === null) {
    return { ok: false, detail: "branch_id is required." };
  }
  if (!isUuid(obj.branch_id)) {
    return { ok: false, detail: "branch_id must be a UUID." };
  }

  // content — required string, non-empty after trim, capped.
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

  return {
    ok: true,
    body: {
      branch_id: obj.branch_id as string,
      content,
    },
  };
}

export function isSenderVerified(row: SenderRow): boolean {
  return row.verification_status === "verified";
}
