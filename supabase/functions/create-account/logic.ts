// KAN-12 create-account — pure logic (validation, types, error codes).
//
// Handler stays thin: parse, rate-limit, run the three-layer duplicate
// detection + capacity guard + atomic INSERT + fire-and-forget Resend.
// Anything testable without supabase-js / Auth Admin API / Upstash /
// Deno runtime lives here.
//
// Contract source: KAN-12 description + DBA c.13321 (full_name format,
// no users.country, direct church_id FK).

// ─── Canonical user_role enum (mirrors `public.user_role`) ───
//
// 12 values per displayHelpers.ROLES (the FE picker is the source of
// truth for this list per SPEC Doc 01 Amendment). Locked order MUST
// match the FE — out-of-order acceptance would silently allow a stale
// FE picker to send a role the BE doesn't know about.
export const ROLES = [
  "pastor",
  "apostle",
  "prophet",
  "evangelist",
  "teacher",
  "elder",
  "bishop",
  "reverend",
  "intercessor",
  "psalmist",
  "ministry_leader",
  "other",
] as const;
export type Role = (typeof ROLES)[number];

// ─── Error codes (FE-mapped surface) ───
//
// Stable string codes the FE matches against. NEVER add a new code
// without coordinating with the FE — the screen renders a different
// inline message per code.
export const ERROR_CODES = {
  USER_ALREADY_EXISTS: "user_already_exists",
  LEADER_CAP_EXCEEDED: "LEADER_CAP_EXCEEDED",
  VALIDATION_ERROR: "validation_error",
  INTERNAL_ERROR: "internal_error",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ─── Field caps (defense-in-depth) ───
//
// Mirror the FE caps where they exist (KAN-11 AccountSetupPage1 password
// 64-char max; email 320 RFC 5321 max). Other caps are pragmatic ceilings
// well above any human input.
export const MAX_NAME_PART = 100;     // first/last name each
export const MAX_EMAIL = 320;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 64;       // matches AccountSetupPage1 cap
export const MAX_ROLE_LENGTH = 32;    // longest enum value is 'ministry_leader' (15) — generous

// Basic email shape — single @, non-empty local + domain with a dot.
// Identical to the regex on register-church / check-email-available.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// RFC-compliant-enough UUID v4-ish — accepts canonical 8-4-4-4-12 hex.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Payload + insert-row types ───

export interface CreateAccountPayload {
  firstName: string;
  // KAN-229: optional middle name. Empty string is the canonical "no
  // middle" value (~75% of leaders); stored as '' in users.middle_name
  // which is NOT NULL.
  middleName?: string;
  lastName: string;
  email: string;
  // KAN-231: optional personal phone. Empty string when not provided
  // (stored as NULL in users.phone). Used by the Replant team as a
  // fallback reach when the church contact email doesn't answer.
  phone?: string;
  password: string;
  role: Role;
  anonymous?: boolean;
  // Finalization fix 4 — churchId is now optional/nullable. A missing
  // or non-UUID value is the skip-flow signal (leader didn't pick or
  // register a church yet). The skip path writes a null church_id on
  // public.users and starts the 30-day verification window.
  churchId?: string | null;
  isNewChurch?: boolean;
}

/**
 * Validated, normalised row ready for INSERT INTO public.users.
 *
 * Note the deliberate absence of `country` per DBA c.13321 Q2 (column
 * does not exist on public.users).
 */
export interface ValidatedAccountInput {
  // Auth surface
  email: string;       // canonicalised lowercase
  password: string;    // unchanged
  // public.users surface
  fullName: string;    // legacy concat; phased out as RPCs migrate to structured fields (KAN-229).
  // KAN-229 structured-name surface — written to public.users alongside
  // fullName until full_name is dropped. middleName is '' when absent.
  firstName: string;   // → users.first_name (NOT NULL)
  middleName: string;  // → users.middle_name (NOT NULL; '' default)
  lastName: string;    // → users.last_name (NOT NULL)
  // KAN-231 — null when not provided; not normalised at MVP.
  phone: string | null;
  role: Role;
  anonymous: boolean;  // defaulted to false if absent
  // Finalization fix 4 — churchId is nullable. null = skip-flow path;
  // capacity guard + new-church email both gated downstream on non-null.
  churchId: string | null;
  // Side-effect controls
  isNewChurch: boolean; // defaulted to false; controls Step 7 email
}

export type ParseResult =
  | { ok: true; input: ValidatedAccountInput }
  | { ok: false; error: string };

function isNonEmptyString(v: unknown, max: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

/**
 * Validate + normalise the JSON body. Returns a ready-to-use input or a
 * single `error` string suitable for a 400 / validation_error body.
 *
 * Normalisation:
 *   - firstName, lastName, role: .trim() applied
 *   - email: .trim().toLowerCase() to match auth.users canonicalisation
 *     (the Layer 3 lookup compares against canonical lowercase)
 *   - password: NOT trimmed (a trailing space is a valid password char)
 *   - anonymous: defaults to false when absent / non-boolean
 *   - isNewChurch: defaults to false when absent / non-boolean
 *   - churchId: case-preserved (canonical UUIDs are lowercase but
 *     we accept either, Postgres compares case-insensitively)
 *
 * DBA c.13321 Q3 — full_name format invariant: single ASCII space (U+0020)
 * between the two parts, no DB-side trim. FE-side .trim() per-part is
 * the only sanitization; if a leader pasted whitespace in a field, it
 * lands as a hygiene issue, not a DB write failure.
 */
export function parsePayload(body: unknown): ParseResult {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const p = body as Record<string, unknown>;

  // Required strings (non-empty after trim)
  if (!isNonEmptyString(p.firstName, MAX_NAME_PART)) {
    return { ok: false, error: "firstName is required" };
  }
  if (!isNonEmptyString(p.lastName, MAX_NAME_PART)) {
    return { ok: false, error: "lastName is required" };
  }
  if (!isNonEmptyString(p.email, MAX_EMAIL)) {
    return { ok: false, error: "email is required" };
  }
  const trimmedEmail = (p.email as string).trim();
  if (!EMAIL_RE.test(trimmedEmail)) {
    return { ok: false, error: "email is not a valid email address" };
  }

  // Password — bound but NOT trimmed
  if (typeof p.password !== "string") {
    return { ok: false, error: "password is required" };
  }
  if (p.password.length < MIN_PASSWORD) {
    return { ok: false, error: `password must be at least ${MIN_PASSWORD} characters` };
  }
  if (p.password.length > MAX_PASSWORD) {
    return { ok: false, error: `password must be at most ${MAX_PASSWORD} characters` };
  }

  // Role — must be exactly one of the 12 canonical values
  if (
    typeof p.role !== "string" ||
    p.role.length > MAX_ROLE_LENGTH ||
    !(ROLES as readonly string[]).includes(p.role)
  ) {
    return {
      ok: false,
      error: `role must be one of: ${ROLES.join(", ")}`,
    };
  }

  // Finalization fix 4 — churchId is now optional. A string that doesn't
  // pass the UUID shape is treated the same as absent (skip path). The
  // FK is validated by Postgres on INSERT when a value is provided.
  const churchId: string | null =
    typeof p.churchId === "string" && UUID_RE.test(p.churchId)
      ? p.churchId
      : null;

  // Optional booleans — default false on absence / non-boolean.
  // DBA c.13321 forward-compat note: anonymous defaults false if KAN-83
  // hasn't shipped or the field is absent. Same defense here at BE layer.
  const anonymous = typeof p.anonymous === "boolean" ? p.anonymous : false;
  const isNewChurch = typeof p.isNewChurch === "boolean" ? p.isNewChurch : false;

  const firstName = (p.firstName as string).trim();
  const lastName = (p.lastName as string).trim();
  // KAN-229: middleName is optional. Trimmed; missing / non-string /
  // empty-after-trim all collapse to '' which is the canonical "no
  // middle" value for users.middle_name (NOT NULL).
  const middleNameRaw = typeof p.middleName === "string" ? p.middleName : "";
  if (middleNameRaw.length > MAX_NAME_PART) {
    return { ok: false, error: "middleName is too long" };
  }
  const middleName = middleNameRaw.trim();

  // KAN-231: phone is optional. Trim; empty / missing / non-string
  // collapses to null (users.phone is nullable). No format validation
  // at MVP — that's KAN-156's scope.
  const phoneRaw = typeof p.phone === "string" ? p.phone.trim() : "";
  if (phoneRaw.length > 64) {
    return { ok: false, error: "phone is too long" };
  }
  const phone: string | null = phoneRaw.length > 0 ? phoneRaw : null;

  return {
    ok: true,
    input: {
      email: trimmedEmail.toLowerCase(),
      password: p.password,
      // Legacy: full_name carries the full composed string (first + middle
      // + last) until the column is dropped (KAN-229 follow-up).
      fullName: middleName
        ? `${firstName} ${middleName} ${lastName}`
        : `${firstName} ${lastName}`,
      firstName,
      middleName,
      lastName,
      phone,
      role: p.role as Role,
      anonymous,
      churchId,
      isNewChurch,
    },
  };
}

// ─── Rate-limit config (STRICTER than read endpoints) ───
//
// 3 requests per hour per IP+email combination. Write surface; SEC bar.
// The window is per-IP-AND-email so a single shared NAT doesn't lock
// out genuine traffic for an unrelated email, but a single email being
// hammered from one IP is throttled hard.
export const RATE_LIMIT_MAX_REQUESTS = 3;
export const RATE_LIMIT_WINDOW_SECONDS = 3600;

export function rateLimitKey(ip: string, emailLower: string): string {
  return `create-account:ratelimit:${ip}:${emailLower}`;
}

// ─── Capacity threshold (mirrors search-churches.isAtCapacity) ───
//
// Same threshold the search uses for the `at_capacity` flag, re-applied
// at write time as defense-in-depth. The FE blocks selection of full
// churches; this guard rejects the write if the FE was bypassed or the
// church filled up between selection and submit.
export const CHURCH_LEADER_CAP = 2;

export function exceedsCapacity(activeLeaderCount: number): boolean {
  return activeLeaderCount >= CHURCH_LEADER_CAP;
}

// ─── Verification deadline (matches DBA c.13321 Q1 ruling) ───
//
// Set explicitly to `now() + 30 days` on insert. The column is NULLABLE
// per migration `kan12_users_verification_deadline_v1` (NULL allowed
// only for pre-existing test users; production rows always populated).
export const VERIFICATION_WINDOW_DAYS = 30;

export function computeVerificationDeadline(now: Date): string {
  const d = new Date(now.getTime() + VERIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return d.toISOString();
}
