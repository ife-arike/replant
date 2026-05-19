// KAN-83 — getLeaderDisplayName unit tests.
//
// Two-path coverage (anonymous true / false) plus empty-string edges.
// Pure function, no RN imports — runs cleanly under jest-expo's node env.

import { getLeaderDisplayName } from './getLeaderDisplayName';

describe('getLeaderDisplayName', () => {
  describe('anonymous = false (Show my name)', () => {
    it('returns "FirstName LastName · ChurchName"', () => {
      expect(
        getLeaderDisplayName({
          firstName: 'James',
          lastName: 'Mwangi',
          roleLabel: 'Pastor',
          churchName: 'Maranatha Ministries',
          anonymous: false,
        }),
      ).toBe('James Mwangi · Maranatha Ministries');
    });

    it('uses the onboarding "Your Church" placeholder when church not yet selected', () => {
      expect(
        getLeaderDisplayName({
          firstName: 'James',
          lastName: 'Mwangi',
          roleLabel: 'Pastor',
          churchName: 'Your Church',
          anonymous: false,
        }),
      ).toBe('James Mwangi · Your Church');
    });

    it('does NOT collapse double-spaces when lastName is empty (caller responsibility)', () => {
      // Documenting current behavior: a missing lastName produces a trailing
      // space artifact. Callers should pass real values; this test pins the
      // contract so future refactors can't silently change it.
      expect(
        getLeaderDisplayName({
          firstName: 'James',
          lastName: '',
          roleLabel: 'Pastor',
          churchName: 'Your Church',
          anonymous: false,
        }),
      ).toBe('James  · Your Church');
    });
  });

  describe('anonymous = true (Keep it private)', () => {
    it('returns "RoleLabel · ChurchName" with no name', () => {
      expect(
        getLeaderDisplayName({
          firstName: 'James',
          lastName: 'Mwangi',
          roleLabel: 'Pastor',
          churchName: 'Maranatha Ministries',
          anonymous: true,
        }),
      ).toBe('Pastor · Maranatha Ministries');
    });

    it('uses the multi-word role label verbatim (e.g. "Ministry Leader")', () => {
      expect(
        getLeaderDisplayName({
          firstName: 'James',
          lastName: 'Mwangi',
          roleLabel: 'Ministry Leader',
          churchName: 'Your Church',
          anonymous: true,
        }),
      ).toBe('Ministry Leader · Your Church');
    });

    it('ignores firstName / lastName entirely (privacy invariant)', () => {
      const withName = getLeaderDisplayName({
        firstName: 'Sensitive',
        lastName: 'Identity',
        roleLabel: 'Pastor',
        churchName: 'Your Church',
        anonymous: true,
      });
      const withoutName = getLeaderDisplayName({
        firstName: '',
        lastName: '',
        roleLabel: 'Pastor',
        churchName: 'Your Church',
        anonymous: true,
      });
      expect(withName).toBe(withoutName);
      expect(withName).toBe('Pastor · Your Church');
    });
  });

  describe('empty-string edges', () => {
    it('renders empty churchName as a trailing separator (caller responsibility)', () => {
      expect(
        getLeaderDisplayName({
          firstName: 'James',
          lastName: 'Mwangi',
          roleLabel: 'Pastor',
          churchName: '',
          anonymous: false,
        }),
      ).toBe('James Mwangi · ');
    });

    it('renders empty roleLabel when anonymous=true (caller responsibility)', () => {
      expect(
        getLeaderDisplayName({
          firstName: 'James',
          lastName: 'Mwangi',
          roleLabel: '',
          churchName: 'Your Church',
          anonymous: true,
        }),
      ).toBe(' · Your Church');
    });
  });
});
