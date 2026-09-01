// KAN-346 — the church-verified read's outcome, made explicit. A failed
// read must be distinguishable from a genuinely unverified church: only a
// positive read may claim 'verified', and 'error' is its own truth that
// consumers map to the conservative church-pending variant by explicit
// choice (never by a silent default that could mislabel the account).
export type ChurchVerifiedStatus = 'verified' | 'not_verified' | 'error' | null;

export function resolveChurchVerifiedStatus(
  error: unknown,
  verificationStatus: string | null | undefined,
): Exclude<ChurchVerifiedStatus, null> {
  if (error) return 'error';
  return verificationStatus === 'verified' ? 'verified' : 'not_verified';
}
