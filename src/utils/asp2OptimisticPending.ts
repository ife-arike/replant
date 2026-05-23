// B35 (KAN-12) — SEC-locked guard for AuthProvider.setOptimisticPending.
//
// SECURITY BOUNDARY — read before extending.
//
// Safety contract: setOptimisticPending flips `branch` to "pending"
// directly without consulting auth-status-check. It is acceptable ONLY
// for surfaces where the leader's account state is known a priori to
// be "pending" — i.e. immediately after a successful create-account.
// Every freshly created account begins as pending (verification_status
// = 'pending' on INSERT, KAN-12 BE-03 Step 5). Any other caller would
// either lie about the state (e.g. logging in as an active leader and
// claiming "pending") or race a real branch flip.
//
// Threat model reference: BE (RLS + auth-status-check) is the
// authoritative enforcement layer. setOptimisticPending is a UI-only
// optimistic display flip; it does not grant any access. RLS still
// gates every read/write by the leader's real verification_status.
// auth-status-check runs 1-3s later (fired by onAuthStateChange after
// signInWithPassword) and overwrites the optimistic branch with the
// server's truth — pending stays pending, active replaces pending,
// deactivated replaces pending. SEC ruling KAN-12 c.14155 approved
// the pattern with three conditions: this helper enforces Condition 1
// (type-checked caller context) and Condition 3 (unit-testable guard).
//
// Cross-reference: create-account edge function (supabase/functions/
// create-account/) guarantees verification_status = 'pending' on the
// INSERT into public.users. The optimistic branch matches that
// guaranteed state.
//
// FUTURE CALLERS REQUIRE SEC REVIEW. Adding a new CallerContext value
// is a SEC-reviewable change — every new context must justify why the
// leader's branch is provably "pending" at that call site, and the
// review must update this header.
//
// SEC ruling: KAN-12 c.14155 (APPROVE WITH CONDITIONS).

// String literal union — currently single-member. Extending this type
// requires SEC review (see header). The type narrowing forces every
// call site to pass a literal that's been audited.
export type CallerContext = 'asp2_skip_after_create';

// Runtime guard mirroring the type contract. tryAutoSignIn delegates
// to this helper so the contract is unit-testable (Condition 3).
// Returns true ONLY for known-safe contexts; any other value falls
// through to false even if a caller bypasses TS via `as any`.
export function shouldFireOptimisticPending(context: CallerContext): boolean {
  return context === 'asp2_skip_after_create';
}
