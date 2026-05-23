// B35 (KAN-12) SEC Condition 3 — unit test locking the
// setOptimisticPending guard in CI. The runtime guard must reject any
// context value other than the audited 'asp2_skip_after_create' literal,
// even when TypeScript narrowing is bypassed (e.g., via `as any`).
//
// Test target: shouldFireOptimisticPending. tryAutoSignIn in ASP2 calls
// setOptimisticPending only when this helper returns true; testing the
// helper proves the contract holds without rendering the component.

import {
  shouldFireOptimisticPending,
  type CallerContext,
} from './asp2OptimisticPending';

describe('shouldFireOptimisticPending — SEC B35 Condition 3', () => {
  it('returns true for the audited asp2_skip_after_create literal', () => {
    expect(shouldFireOptimisticPending('asp2_skip_after_create')).toBe(true);
  });

  it('returns false for any other string, even when TS narrowing is bypassed', () => {
    // Bypass the literal-union type to exercise the runtime guard.
    // A future caller passing a non-audited context (via `as any` or
    // a stale type definition) must NOT trigger the optimistic flip.
    expect(shouldFireOptimisticPending('login' as unknown as CallerContext)).toBe(false);
    expect(shouldFireOptimisticPending('asp2_skip_after_login' as unknown as CallerContext)).toBe(false);
    expect(shouldFireOptimisticPending('' as unknown as CallerContext)).toBe(false);
    expect(shouldFireOptimisticPending('ASP2_SKIP_AFTER_CREATE' as unknown as CallerContext)).toBe(false);
  });

  it('returns false for null / undefined / non-string values', () => {
    expect(shouldFireOptimisticPending(null as unknown as CallerContext)).toBe(false);
    expect(shouldFireOptimisticPending(undefined as unknown as CallerContext)).toBe(false);
    expect(shouldFireOptimisticPending(0 as unknown as CallerContext)).toBe(false);
    expect(shouldFireOptimisticPending({} as unknown as CallerContext)).toBe(false);
  });
});
