// KAN-192 register-church-delete — pure logic (payload validation + types).
//
// Backs the AccountSetupPage2 bypass-card "Delete and search again"
// button. The handler stays thin: parse, rate-limit, call deps.
// Anything testable without supabase-js / Upstash / Deno runtime lives
// here so unit tests can hit pure functions.

// Locked SESSION window. A church can only be deleted via this function
// within 1 hour of its register-church creation. After that the row is
// abandoned and waits for KAN-202 pg_cron orphan sweep. This bound is
// intentionally tight: the only legitimate caller is a leader who is
// still in the middle of the same sign-up session.
export const SESSION_WINDOW_SECONDS = 3600;

// Lower/upper bounds for the church id (UUID v4 string) and
// contact_email payload fields. UUID validation is a regex over the
// canonical 8-4-4-4-12 shape — defense-in-depth ahead of the supabase-js
// .eq() call (which would reject the malformed value anyway).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same email shape register-church accepts. Single-quote + bracket
// constructs are intentionally banned by the stricter shape — we don't
// expect them in any real church contact email and the parser would
// otherwise pass through obvious garbage.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_EMAIL_LENGTH = 254;

export interface DeleteChurchPayload {
  churchId: string;
  contactEmail: string;
}

export type ParseResult =
  | { ok: true; payload: DeleteChurchPayload }
  | { ok: false; error: string };

/**
 * Validate + normalise the JSON body. Returns the typed payload or an
 * `error` string suitable for a 400 body.
 *
 * Both fields are required. contact_email is downcased + trimmed to
 * match how register-church stores it (the comparison in handler.ts
 * is a case-sensitive .eq() — both sides need to come from the same
 * normalisation function).
 */
export function parsePayload(body: unknown): ParseResult {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const p = body as Record<string, unknown>;

  if (typeof p.churchId !== "string") {
    return { ok: false, error: "churchId is required" };
  }
  if (!UUID_RE.test(p.churchId)) {
    return { ok: false, error: "churchId must be a UUID" };
  }
  if (typeof p.contactEmail !== "string") {
    return { ok: false, error: "contactEmail is required" };
  }
  const email = normaliseEmail(p.contactEmail);
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) {
    return { ok: false, error: "contactEmail length is invalid" };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "contactEmail is not a valid email address" };
  }
  return {
    ok: true,
    payload: { churchId: p.churchId, contactEmail: email },
  };
}

/**
 * Canonical email normalisation. Lower-cased + whitespace-trimmed. Used
 * BOTH at parse time (above) and in handler.ts when comparing to the
 * row's stored contact_email so both sides go through the same shape.
 */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// ── Diagnostic outcomes — discriminated union surfaced by handler.ts ──
//
// When the delete fails, the handler runs a diagnostic SELECT and maps
// the result to one of these outcomes; each is translated to an HTTP
// status + body in the response builder. Keeping this as a pure type
// here lets us unit-test the disambiguation logic without standing up
// supabase-js.

export type DeleteOutcome =
  | { kind: "deleted" }
  // 404 — no church row with that id (or it was already deleted)
  | { kind: "not_found" }
  // 403 — contact_email mismatch (proof-of-ownership failure)
  | { kind: "ownership_mismatch" }
  // 410 — row exists but was created > SESSION_WINDOW_SECONDS ago
  | { kind: "session_expired" }
  // 409 — row has at least one linked user (race with create-account
  // or, more likely, the leader hit the delete button after their
  // account was already linked)
  | { kind: "leader_linked" }
  // 500 — diagnostic select succeeded but couldn't classify the failure
  // (shouldn't normally happen; defense-in-depth for unknown edge case)
  | { kind: "unknown_failure" };

/**
 * Pure classifier — given the diagnostic SELECT result, return the
 * canonical DeleteOutcome. Inputs are the same payload that was
 * attempted + the row (or null) + a flag indicating whether any user
 * rows reference the church_id. Unit tests cover each branch.
 */
export function classifyDeleteFailure(
  payload: DeleteChurchPayload,
  row: { contact_email: string | null; created_at: string } | null,
  hasLinkedUsers: boolean,
  now: Date,
): DeleteOutcome {
  if (row === null) {
    return { kind: "not_found" };
  }
  if (
    row.contact_email === null ||
    normaliseEmail(row.contact_email) !== payload.contactEmail
  ) {
    return { kind: "ownership_mismatch" };
  }
  const created = new Date(row.created_at).getTime();
  const sessionExpiresAt = created + SESSION_WINDOW_SECONDS * 1000;
  if (now.getTime() > sessionExpiresAt) {
    return { kind: "session_expired" };
  }
  if (hasLinkedUsers) {
    return { kind: "leader_linked" };
  }
  return { kind: "unknown_failure" };
}

// ── Rate-limit config (read-only surface, mirrors search-churches) ─────
//
// Tighter than search-churches' 10/hr because the delete surface is a
// rare action — a leader registers + deletes maybe once or twice in
// their entire onboarding. A higher cap would invite enumeration.

export const RATE_LIMIT_MAX_REQUESTS = 5;
export const RATE_LIMIT_WINDOW_SECONDS = 3600;

export function rateLimitKey(ip: string): string {
  return `register-church-delete:ratelimit:${ip}`;
}
