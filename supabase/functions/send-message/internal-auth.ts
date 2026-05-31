// KAN-217 AC-3(a) — constant-time string comparison for the /internal
// route's auth-token check. Implements byte-wise XOR accumulation so
// the inner loop cost does not depend on where (or whether) a mismatch
// occurs. SEC c.15285 Item 3(a): no string equality, no regex
// shortcut, no substring match.
//
// device-pass-fixes-1 (2026-05-31) — the auth token rides on a
// dedicated `X-Internal-Token` request header, NOT the Authorization
// Bearer. Reason: the platform's verify_jwt=true gate rejects any
// Bearer value that isn't a valid Supabase JWT (`UNAUTHORIZED_
// INVALID_JWT_FORMAT`), and our Vault-stored token is a 64-char hex
// string — not a JWT. Callers send Authorization: Bearer <any-valid-
// JWT> (anon or SR key, either works) ONLY to pass the platform gate;
// the actual /internal route auth is the X-Internal-Token header
// compared against the Vault-resident `welcome_dm_internal_token`.
//
// Pure: no I/O, no globals, no logging. Unit-testable in isolation
// (see internal-auth.test.ts).
//
// On length mismatch we still walk the longer buffer to roughly
// equalize timing, then return false. The length itself leaks — the
// Vault token is a 64-char hex string (256 bits of entropy), a fixed
// public-knowledge shape; the secret material is the byte content.

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let result = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const ai = i < aBytes.length ? aBytes[i] : 0;
    const bi = i < bBytes.length ? bBytes[i] : 0;
    result |= ai ^ bi;
  }
  return result === 0;
}

// requireInternalAuthHeaders — applies AC-3(a) constant-time token
// compare AND AC-3(b) X-Replant-Internal sentinel together. Both
// checks always run (even if the first fails) so an attacker cannot
// time-distinguish which of the two failed. Returns true only if
// both pass.
//
// `tokenHeader` is the raw `X-Internal-Token` request header value
// (the dispatcher sends the Vault-loaded `welcome_dm_internal_token`
// here, NOT in the Authorization Bearer — see file header).
// `expectedToken` is the edge function's cold-start-loaded copy of
// the same Vault secret.
export function requireInternalAuthHeaders(
  tokenHeader: string | null,
  sentinelHeader: string | null,
  expectedToken: string,
): boolean {
  const tokenOk = timingSafeEqualStrings(tokenHeader ?? "", expectedToken);
  // SEC stamp c.15285 condition (b): X-Replant-Internal: true sentinel
  // is required as defense-in-depth. Exact-match "true" required.
  const sentinelOk = sentinelHeader === "true";
  return tokenOk && sentinelOk;
}
