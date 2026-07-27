// Underground edge-function wrappers.
//
// Two endpoints:
//   joinUndergroundChurch — pre-auth (verify_jwt=false). Second-leader
//                           code redemption. Maps server errors to FE
//                           outcomes for JoinByCodeScreen.
//   revealJoinCode        — post-auth (verify_jwt=true). One-shot reveal
//                           of the founding leader's join code. Returns
//                           plaintext exactly once.
//
// Security invariants enforced on the FE side:
//   - Plaintext join code is NEVER logged. Anywhere. Not in console, not
//     in analytics, not in error payloads.
//   - The same idempotency key MUST be passed across retries for a single
//     user-intent submission; caller mints with newIdempotencyKey() and
//     holds it until success or hard failure.
//   - The reveal endpoint returns plaintext exactly once per code; the
//     410 code_already_consumed branch is the ONLY recovery path on the
//     FE side. Admin rotation is out-of-band.

import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../lib/supabase';
import type { Role } from './types';

const JOIN_URL = `${SUPABASE_URL}/functions/v1/join-underground-church`;
const REVEAL_URL = `${SUPABASE_URL}/functions/v1/reveal-join-code`;

// ── joinUndergroundChurch ───────────────────────────────────────────

export interface JoinLeaderPayload {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
  anonymous?: boolean;
}

export type JoinUndergroundResult =
  | { ok: true; userId: string; churchId: string }
  // Single generic string for invalid / consumed / cap / deactivated /
  // any internal code failure (Founder ruling #4).
  | { ok: false; reason: 'invalid_or_consumed_code' }
  // Founder override 2026-06-20 — email collision surfaces distinctly so
  // the leader gets a "sign in instead" CTA.
  | { ok: false; reason: 'email_already_registered' }
  | { ok: false; reason: 'rate_limited' }
  | { ok: false; reason: 'idempotency_key_required' }
  | { ok: false; reason: 'validation_error' }
  | { ok: false; reason: 'internal_error' };

export async function joinUndergroundChurch(args: {
  idempotencyKey: string;
  joinCode: string;
  leader: JoinLeaderPayload;
}): Promise<JoinUndergroundResult> {
  // Do NOT include the plaintext code in any error log. Even on a
  // network throw, callers should surface a generic "couldn't reach"
  // message rather than echo args back.
  const res = await fetch(JOIN_URL, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': args.idempotencyKey,
    },
    body: JSON.stringify({
      idempotencyKey: args.idempotencyKey,
      joinCode: args.joinCode,
      leader: args.leader,
    }),
  });

  if (res.ok) {
    const body = (await res.json()) as { userId: string; churchId: string };
    return { ok: true, userId: body.userId, churchId: body.churchId };
  }

  // Map server error codes. Unknown / 5xx → internal_error (caller
  // renders the existing connection-failure copy).
  let code: string | null = null;
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body?.error === 'string') code = body.error;
  } catch {
    // 5xx-no-body — fall through to internal_error.
  }

  switch (code) {
    case 'invalid_or_consumed_code':
      return { ok: false, reason: 'invalid_or_consumed_code' };
    case 'email_already_registered':
      return { ok: false, reason: 'email_already_registered' };
    case 'rate_limited':
      return { ok: false, reason: 'rate_limited' };
    case 'idempotency_key_required':
      return { ok: false, reason: 'idempotency_key_required' };
    case 'validation_error':
      return { ok: false, reason: 'validation_error' };
    default:
      return { ok: false, reason: 'internal_error' };
  }
}

// ── revealJoinCode ──────────────────────────────────────────────────

export type RevealJoinCodeResult =
  // Plaintext code held in memory only. Caller MUST NOT persist it.
  | { ok: true; joinCode: string }
  | { ok: false; reason: 'code_already_consumed' }
  | { ok: false; reason: 'unauthorized' }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'not_authorized' }
  | { ok: false; reason: 'internal_error' };

export async function revealJoinCode(args: {
  idempotencyKey: string;
}): Promise<RevealJoinCodeResult> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) {
    return { ok: false, reason: 'unauthorized' };
  }

  const res = await fetch(REVEAL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': args.idempotencyKey,
    },
    body: JSON.stringify({ idempotencyKey: args.idempotencyKey }),
  });

  if (res.ok) {
    const body = (await res.json()) as { joinCode: string };
    return { ok: true, joinCode: body.joinCode };
  }

  let code: string | null = null;
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body?.error === 'string') code = body.error;
  } catch {
    // ignore
  }

  switch (code) {
    case 'code_already_consumed':
      return { ok: false, reason: 'code_already_consumed' };
    case 'unauthorized':
      return { ok: false, reason: 'unauthorized' };
    case 'not_found':
      return { ok: false, reason: 'not_found' };
    case 'not_authorized':
      return { ok: false, reason: 'not_authorized' };
    default:
      return { ok: false, reason: 'internal_error' };
  }
}
