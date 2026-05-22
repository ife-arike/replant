// ─────────────────────────────────────────────
// DailyScriptureStrip — pure logic (KAN-16)
//
// Separated from the React component so the helpers can be unit-tested
// under jest-expo's node env without dragging Expo font modules into
// the require chain (theme.ts → @expo-google-fonts/* → expo-font is not
// resolvable in Jest's node runtime).
//
// Anything imported by both the component AND the test belongs here.
// React-specific code lives in `DailyScriptureStrip.tsx`.
// ─────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────

export interface ScriptureDisplay {
  content: string;
  reference: string;
  translation: string;
}

// ─── Fallback verses (Founder designation 2026-05-21) ─────────────────
//
// Hardcoded FE constants — NOT DB rows. Used when:
//   (a) No daily_scripture row exists for today (local-tz calendar date)
//   (b) The daily_scripture query fails (network / RLS error)
// Alternation by day-of-month: even → II Sam 22:31 KJV; odd → Rev 22:20 KJV.

export const FALLBACK_EVEN: ScriptureDisplay = {
  content:
    'As for God, his way is perfect; the word of the LORD is tried: he is a buckler to all them that trust in him.',
  reference: 'II Samuel 22:31',
  translation: 'KJV',
};

export const FALLBACK_ODD: ScriptureDisplay = {
  content:
    'He which testifieth these things saith, Surely I come quickly. Amen. Even so, come, Lord Jesus.',
  reference: 'Revelation 22:20',
  translation: 'KJV',
};

// ─── Local-tz date helpers ────────────────────────────────────────────

/**
 * Format `now` as YYYY-MM-DD in the user's LOCAL timezone — JS Date's
 * `getFullYear / getMonth / getDate` return local-tz components, so no
 * tz library needed. The output is a valid Postgres `date` literal,
 * compatible with `scripture_date` comparison.
 */
export function getLocalDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Select the fallback verse for `now`. Even day-of-month → II Sam 22:31;
 * odd → Rev 22:20. Both KJV.
 */
export function pickFallbackForDate(now: Date = new Date()): ScriptureDisplay {
  return now.getDate() % 2 === 0 ? FALLBACK_EVEN : FALLBACK_ODD;
}
