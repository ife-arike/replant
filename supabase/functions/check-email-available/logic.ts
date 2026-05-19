// KAN-11 check-email-available — pure logic (validation + types).
//
// Pulled out of the handler so it's unit-testable without the Deno runtime,
// a Supabase client, or Upstash. The handler stays thin: validate via
// parsePayload, look the email up via deps.findUserByEmail, return
// `{ available: boolean }`.
//
// Contract source: KAN-11 (Account Setup Page 1 build dispatch).

// ─── Field caps (mirrors auth.users.email max practical length) ───
//
// RFC 5321 sets the practical maximum at 320 chars (64 local + @ + 255 domain).
// auth.users.email is `text`, but accepting >320 is a code smell — Supabase
// Auth itself will reject longer values, so we shed them at validation.
export const MAX_EMAIL = 320;

// Basic email shape — single @, non-empty local part, non-empty domain with
// at least one dot. Identical to the register-church regex; kept inline so
// each function is self-contained.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CheckEmailPayload {
  email: string;
}

export type ParseResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

/**
 * Validate + normalise the JSON body. Returns the lowercased + trimmed email
 * (so we can match consistently against auth.users.email, which Supabase
 * Auth itself canonicalises to lowercase) or a single `error` string
 * suitable for a 400 body.
 *
 * Normalisation is non-destructive — the FE sends what the user typed; we
 * just canonicalise for the lookup. AC #10 ("email already registered")
 * MUST match case-insensitively because auth.users stores lowercased.
 */
export function parsePayload(body: unknown): ParseResult {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const p = body as Record<string, unknown>;

  if (typeof p.email !== "string") {
    return { ok: false, error: "email is required" };
  }
  const trimmed = p.email.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "email is required" };
  }
  if (trimmed.length > MAX_EMAIL) {
    return { ok: false, error: "email is too long" };
  }
  if (!EMAIL_RE.test(trimmed)) {
    return { ok: false, error: "email is not a valid email address" };
  }

  return { ok: true, email: trimmed.toLowerCase() };
}

// ─── Rate-limit config ───
//
// 10 requests per hour per IP per AC #11. The window is rolling-by-IP, not
// rolling-by-email — we don't want a hostile probe to be able to bypass by
// rotating the email parameter, and we don't want a typo-prone user on a
// shared IP to permanently lock out a teammate. INCR + EX-NX gives us a
// fixed 1-hour window per IP starting at the first request in the window.
export const RATE_LIMIT_MAX_REQUESTS = 10;
export const RATE_LIMIT_WINDOW_SECONDS = 3600;

export function rateLimitKey(ip: string): string {
  return `check-email-available:ratelimit:${ip}`;
}
