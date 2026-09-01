// KAN-346 — pins that a failed read can never masquerade as a
// verification verdict in either direction.
import { resolveChurchVerifiedStatus } from './churchVerifiedStatus';

describe('resolveChurchVerifiedStatus (KAN-346)', () => {
  it('error wins over any status the payload carried', () => {
    expect(resolveChurchVerifiedStatus({ message: 'boom' }, 'verified')).toBe('error');
    expect(resolveChurchVerifiedStatus({ message: 'boom' }, null)).toBe('error');
  });

  it('only a positive read claims verified', () => {
    expect(resolveChurchVerifiedStatus(null, 'verified')).toBe('verified');
  });

  it('anything else is not_verified, never error', () => {
    expect(resolveChurchVerifiedStatus(null, 'pending')).toBe('not_verified');
    expect(resolveChurchVerifiedStatus(null, null)).toBe('not_verified');
    expect(resolveChurchVerifiedStatus(null, undefined)).toBe('not_verified');
  });
});
