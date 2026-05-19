// KAN-12 search-churches — pure logic (validation, types, ILIKE-escape).
//
// Handler stays thin: parse, rate-limit, search via deps, respond. Anything
// testable without supabase-js / Upstash / Deno runtime lives here.

// Lower bound matches the FE debounce minimum. Server-side enforcement is
// defense-in-depth — a hostile client could call with 1-char queries to
// scan the church list. 3 chars also reduces ILIKE-with-leading-wildcard
// load (still slow with a wildcard prefix, but at least less frequent).
export const MIN_QUERY_LENGTH = 3;

// Bounded to keep ILIKE from doing anything wild on a paste. Church names
// + cities are well below 100; 200 leaves headroom without enabling abuse.
export const MAX_QUERY_LENGTH = 200;

// Server LIMIT — matches dispatch ("LIMIT 20"). FE only needs a short list
// for the inline picker; deeper lookups are out of scope for MVP.
export const SEARCH_RESULT_LIMIT = 20;

export interface SearchChurchesPayload {
  query: string;
}

export interface ChurchResult {
  id: string;
  name: string;
  type: string;
  city: string;
  country: string;
  rag_status: string;
  verification_status: string;
  at_capacity: boolean;
}

export type ParseResult =
  | { ok: true; query: string }
  | { ok: false; error: string };

/**
 * Validate + normalise the JSON body. Returns the trimmed query string or
 * a single `error` string suitable for a 400 body.
 *
 * The query is trimmed (whitespace on either end is meaningless) and
 * length-bounded. ILIKE wildcards in the user input (`%` and `_`) are NOT
 * escaped here — the FE-facing contract is "substring search," and a
 * user typing `%` is implicitly asking to match anything. The
 * substring-wildcards in the SQL come from server-side concatenation in
 * the handler, not from the user.
 *
 * For SQL-injection safety: callers MUST parameterise the query — never
 * concat the raw string into SQL. supabase-js .ilike() does this; raw SQL
 * via postgres-js with template-tag also does this. Defense-in-depth here
 * is the length cap.
 */
export function parsePayload(body: unknown): ParseResult {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const p = body as Record<string, unknown>;

  if (typeof p.query !== "string") {
    return { ok: false, error: "query is required" };
  }
  const trimmed = p.query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return {
      ok: false,
      error: `query must be at least ${MIN_QUERY_LENGTH} characters`,
    };
  }
  if (trimmed.length > MAX_QUERY_LENGTH) {
    return {
      ok: false,
      error: `query must be at most ${MAX_QUERY_LENGTH} characters`,
    };
  }

  return { ok: true, query: trimmed };
}

// ── Rate-limit config (read-only surface, same shape as check-email) ───
//
// 10 requests per hour per IP. Generous enough that a leader's debounced
// typing through "Maranatha Ministries" (~6-8 fires) doesn't trip; tight
// enough that a hostile probe is throttled.

export const RATE_LIMIT_MAX_REQUESTS = 10;
export const RATE_LIMIT_WINDOW_SECONDS = 3600;

export function rateLimitKey(ip: string): string {
  return `search-churches:ratelimit:${ip}`;
}

// ── Capacity computation (pure, unit-testable) ──────────────────────────

/**
 * Capacity threshold per Replant onboarding rule: a church accepts at
 * most 2 active leaders. The FE blocks selection on `at_capacity: true`;
 * the server's atomic capacity guard in `create-account` enforces the
 * same threshold defensively at write time.
 */
export const CHURCH_LEADER_CAP = 2;

export function isAtCapacity(activeLeaderCount: number): boolean {
  return activeLeaderCount >= CHURCH_LEADER_CAP;
}
