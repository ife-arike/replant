// useBlockUser — typed wrappers for the KAN-305 block RPCs.
//
// All writes go through owner-scoped SECURITY DEFINER RPCs (no direct table
// writes from the FE — the blocked_users table is deny-all RLS with zero
// grants). The caller's identity is resolved server-side via auth.uid() inside
// each RPC; we never pass a blocker_id.
//
// Doctrine: BE gates are load-bearing. This hook is a thin convenience over
// block_user / unblock_user / get_blocked_users — enforcement lives entirely
// in the DB (trigger + RPC checks). The FE never carries enforcement.
//
// SAFE-LOG: never log a blocked party's name; the RPCs already keep the audit
// trail id-only and mask-free.

import { supabase } from '../lib/supabase';

// Acquisition context — must match blocked_users_acquired_via_check in
// 20260707000002_kan305_0001. Drives the SEC §3.3 de-masking-oracle rule:
// only 'identity_known' blocks suppress directory surfaces server-side.
export type BlockAcquiredVia =
  | 'identity_known'
  | 'masked_dm'
  | 'masked_prayer'
  | 'masked_other';

// A masked blocked-list row as projected by get_blocked_users. display_name is
// NULL for an anonymous leader (FE composes "A fellow [Role]"); church_name is
// the literal 'Underground Church' for UG (never a real UG name/location).
export interface BlockedUserRow {
  blockedUserId: string;
  displayName: string | null;
  role: string;
  anonymous: boolean;
  churchName: string | null;
  underground: boolean;
  acquiredVia: BlockAcquiredVia;
  blockedAt: string;
}

const BLOCK_ERROR_DISPLAY_MESSAGES: Record<string, string> = {
  invalid_target: "You can't block this account.",
  invalid_acquired_via: "Something went wrong. Please try again.",
  target_not_found: 'This leader is no longer available.',
  not_authorized: "You don't have permission to do that.",
  // Cap-of-200 (Founder-ratified). Rare; kept honest and non-alarming.
  block_cap_reached:
    "You've reached the maximum number of blocked accounts. Unblock someone to add another.",
};

export class BlockUserError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BlockUserError';
  }
}

function extractErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'unknown';
  const e = error as Record<string, unknown>;
  const raw = `${String(e.message ?? '')} ${String(e.hint ?? '')} ${String(
    e.details ?? '',
  )}`.toLowerCase();
  for (const code of Object.keys(BLOCK_ERROR_DISPLAY_MESSAGES)) {
    if (raw.includes(code)) return code;
  }
  return 'unknown';
}

function toDisplayError(rawError: unknown): BlockUserError {
  const code = extractErrorCode(rawError);
  const message =
    BLOCK_ERROR_DISPLAY_MESSAGES[code] ??
    'Something went wrong. Please try again.';
  return new BlockUserError(code, message);
}

// ── blockUser ─────────────────────────────────────────────────────────
// Blocks p_target from the caller. Idempotent server-side (re-block is a
// no-op). acquiredVia records the surface the block was placed from; it MUST
// reflect whether the block was identity-known or masked (drives directory
// suppression). Defaults to 'identity_known' (named thread / search profile).
export async function blockUser(
  targetUserId: string,
  acquiredVia: BlockAcquiredVia = 'identity_known',
): Promise<void> {
  const { error } = await supabase.rpc('block_user', {
    p_target: targetUserId,
    p_acquired_via: acquiredVia,
  });
  if (error) throw toDisplayError(error);
}

// ── unblockUser ───────────────────────────────────────────────────────
// Removes only the caller's own block row (never the reverse). Idempotent.
export async function unblockUser(targetUserId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', {
    p_target: targetUserId,
  });
  if (error) throw toDisplayError(error);
}

// ── getBlockedUsers ───────────────────────────────────────────────────
// Returns the caller's own blocked list, masked. Never leaks a real name for
// an anonymous leader or a real church for underground.
export async function getBlockedUsers(): Promise<BlockedUserRow[]> {
  const { data, error } = await supabase.rpc('get_blocked_users');
  if (error) throw toDisplayError(error);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    blockedUserId: String(r.blocked_user_id),
    displayName: (r.display_name as string | null) ?? null,
    role: String(r.role ?? 'other'),
    anonymous: Boolean(r.anonymous),
    churchName: (r.church_name as string | null) ?? null,
    underground: Boolean(r.underground),
    acquiredVia: (r.acquired_via as BlockAcquiredVia) ?? 'identity_known',
    blockedAt: String(r.blocked_at),
  }));
}
