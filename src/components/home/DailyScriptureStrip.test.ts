// KAN-16 — pure-function tests for DailyScriptureStrip helpers.
//
// Component rendering / Supabase mocking isn't tested here — that would
// need RN Testing Library, which isn't set up. The valuable surface to
// pin is:
//   - getLocalDateString: YYYY-MM-DD shape from a JS Date in local-tz
//   - pickFallbackForDate: even/odd alternation matches the AC
//   - Fallback verse copy: exact strings (Founder designation 2026-05-21)

import {
  FALLBACK_EVEN,
  FALLBACK_ODD,
  getLocalDateString,
  pickFallbackForDate,
} from './DailyScriptureStripLogic';

describe('getLocalDateString', () => {
  it('formats local-timezone Date as YYYY-MM-DD with zero-padded month/day', () => {
    // Construct a Date in local tz — single-digit month + day exercise padding.
    const d = new Date(2026, 0, 5); // 2026-01-05 local
    expect(getLocalDateString(d)).toBe('2026-01-05');
  });

  it('handles double-digit month and day without padding artifacts', () => {
    const d = new Date(2026, 11, 31); // 2026-12-31 local
    expect(getLocalDateString(d)).toBe('2026-12-31');
  });

  it('uses local-timezone calendar date, not UTC', () => {
    // Manufacture a Date that is "tomorrow in UTC, today in local" depending
    // on tz — we can't pin the test to a specific tz without env hackery,
    // but we CAN confirm the function reads local-tz components (getDate
    // returns local-tz day-of-month, not UTC day-of-month).
    const d = new Date(2026, 4, 21, 0, 0, 0); // 2026-05-21 local midnight
    expect(getLocalDateString(d)).toBe('2026-05-21');
  });
});

describe('pickFallbackForDate', () => {
  it('picks II Samuel 22:31 (FALLBACK_EVEN) on even days', () => {
    for (const day of [2, 4, 8, 10, 16, 20, 24, 28, 30]) {
      const d = new Date(2026, 4, day);
      expect(pickFallbackForDate(d)).toBe(FALLBACK_EVEN);
    }
  });

  it('picks Revelation 22:20 (FALLBACK_ODD) on odd days', () => {
    for (const day of [1, 3, 5, 7, 11, 15, 19, 25, 29, 31]) {
      const d = new Date(2026, 4, day);
      expect(pickFallbackForDate(d)).toBe(FALLBACK_ODD);
    }
  });
});

describe('fallback verse constants', () => {
  // Pinning the EXACT Founder-designated strings — character-for-character.
  // If any of these strings change the test fails — protecting against
  // accidental copy edits.
  it('FALLBACK_EVEN is II Samuel 22:31 KJV verbatim', () => {
    expect(FALLBACK_EVEN.reference).toBe('II Samuel 22:31');
    expect(FALLBACK_EVEN.translation).toBe('KJV');
    expect(FALLBACK_EVEN.content).toBe(
      'As for God, his way is perfect; the word of the LORD is tried: he is a buckler to all them that trust in him.',
    );
  });

  it('FALLBACK_ODD is Revelation 22:20 KJV verbatim', () => {
    expect(FALLBACK_ODD.reference).toBe('Revelation 22:20');
    expect(FALLBACK_ODD.translation).toBe('KJV');
    expect(FALLBACK_ODD.content).toBe(
      'He which testifieth these things saith, Surely I come quickly. Amen. Even so, come, Lord Jesus.',
    );
  });
});
