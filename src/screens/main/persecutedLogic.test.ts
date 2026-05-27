// KAN-65 / KAN-64 — pure-function tests for the Persecuted tab + Heartcry
// submission shared logic. Pins:
//   - SEVERITY_DISPLAY: 5 keys matching the live severity_level enum, with
//     exact labels + one-liners verbatim from the content file
//   - trackerCopy: 3 enum states + the defensive 'responded + null
//     responded_at' fall-through
//   - REQUEST_TYPE_OPTIONS: 4 entries with exact DB literals matching the
//     heartcries.request_type CHECK constraint
//   - SEVERITY_RADIO_OPTIONS: 5 entries with descriptors verbatim
//   - truncateExcerpt: word-boundary cut, ellipsis glyph, short-string
//     passthrough, empty/null safety
//   - formatRelativeTime: just-now / minutes / hours / days / >30d fallback

import {
  REQUEST_TYPE_OPTIONS,
  SEVERITY_DISPLAY,
  SEVERITY_RADIO_OPTIONS,
  formatRelativeTime,
  trackerCopy,
  truncateExcerpt,
} from './persecutedLogic';

describe('SEVERITY_DISPLAY — feed card label + one-liner', () => {
  it('has exactly the 5 live severity_level values as keys', () => {
    expect(Object.keys(SEVERITY_DISPLAY).sort()).toEqual(
      ['critical', 'informational', 'ongoing', 'serious', 'urgent'],
    );
  });
  it('critical → "Critical" + "In immediate danger now"', () => {
    expect(SEVERITY_DISPLAY.critical).toEqual({
      label: 'Critical',
      oneLiner: 'In immediate danger now',
    });
  });
  it('urgent → "Urgent" + "Danger is escalating"', () => {
    expect(SEVERITY_DISPLAY.urgent).toEqual({
      label: 'Urgent',
      oneLiner: 'Danger is escalating',
    });
  });
  it('serious → "Serious" + "Under real pressure"', () => {
    expect(SEVERITY_DISPLAY.serious).toEqual({
      label: 'Serious',
      oneLiner: 'Under real pressure',
    });
  });
  it('ongoing → "Ongoing" + "Enduring for the faith"', () => {
    expect(SEVERITY_DISPLAY.ongoing).toEqual({
      label: 'Ongoing',
      oneLiner: 'Enduring for the faith',
    });
  });
  it('informational → "Informational" + "Bearing witness to this"', () => {
    expect(SEVERITY_DISPLAY.informational).toEqual({
      label: 'Informational',
      oneLiner: 'Bearing witness to this',
    });
  });
});

describe('trackerCopy — status tracker (KAN-65 AC 7, Founder-ratified 2026-05-26)', () => {
  it('received → "Your heartcry has been received. We will be praying alongside you."', () => {
    expect(trackerCopy('received', null)).toBe(
      'Your heartcry has been received. We will be praying alongside you.',
    );
  });
  it('seen → "Your heartcry has been read and we are interceding for your case."', () => {
    expect(trackerCopy('seen', null)).toBe(
      'Your heartcry has been read and we are interceding for your case.',
    );
  });
  it('responded + non-null responded_at → "We have sent a word — please check your inbox."', () => {
    expect(trackerCopy('responded', '2026-05-26T00:00:00Z')).toBe(
      'We have sent a word — please check your inbox.',
    );
  });
  it('defensive — responded + null responded_at falls back to received copy', () => {
    // BE invariant — these should never coincide. Defensive fall-through
    // keeps the FE contract total without crashing.
    expect(trackerCopy('responded', null)).toBe(
      'Your heartcry has been received. We will be praying alongside you.',
    );
  });
});

describe('REQUEST_TYPE_OPTIONS — KAN-64 AC 4 chip values', () => {
  it('has 4 entries with the live CHECK constraint literals', () => {
    expect(REQUEST_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      'prayer',
      'practical_support',
      'guidance',
      'just_to_be_heard',
    ]);
  });
  it('display labels match CONTENT 2026-05-26', () => {
    expect(REQUEST_TYPE_OPTIONS.map((o) => o.label)).toEqual([
      'Prayer',
      'Practical support',
      'Guidance',
      'Just to be heard',
    ]);
  });
});

describe('SEVERITY_RADIO_OPTIONS — KAN-64 AC 5 descriptors', () => {
  it('has 5 entries with the live severity_level enum values in dispatch order', () => {
    expect(SEVERITY_RADIO_OPTIONS.map((o) => o.value)).toEqual([
      'critical',
      'urgent',
      'serious',
      'ongoing',
      'informational',
    ]);
  });
  it('critical descriptor verbatim', () => {
    expect(SEVERITY_RADIO_OPTIONS[0].descriptor).toBe(
      'Immediate threat to life or freedom.',
    );
  });
  it('urgent descriptor verbatim', () => {
    expect(SEVERITY_RADIO_OPTIONS[1].descriptor).toBe(
      'The situation is worsening and needs prayer now.',
    );
  });
  it('serious descriptor verbatim', () => {
    expect(SEVERITY_RADIO_OPTIONS[2].descriptor).toBe(
      'Significant pressure — not yet at immediate risk.',
    );
  });
  it('ongoing descriptor verbatim', () => {
    expect(SEVERITY_RADIO_OPTIONS[3].descriptor).toBe(
      'Persistent persecution, not currently escalating.',
    );
  });
  it('informational descriptor verbatim', () => {
    expect(SEVERITY_RADIO_OPTIONS[4].descriptor).toBe(
      'I want the Replant team to know what is happening here.',
    );
  });
});

describe('truncateExcerpt — ~120 chars with single-glyph ellipsis', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(truncateExcerpt(null)).toBe('');
    expect(truncateExcerpt(undefined)).toBe('');
    expect(truncateExcerpt('')).toBe('');
  });
  it('passes through short strings unchanged', () => {
    expect(truncateExcerpt('short and sweet')).toBe('short and sweet');
  });
  it('passes through strings at exactly 120 chars unchanged', () => {
    const exact = 'x'.repeat(120);
    expect(truncateExcerpt(exact)).toBe(exact);
  });
  it('cuts at the last whitespace within the 120-char budget and appends …', () => {
    // 130 chars with spaces, last word starting before 120 — cut at the
    // last space and add the single-glyph ellipsis.
    const text =
      'The brothers gathered before dawn and we walked under the moon to the well outside the village; the children carried jars';
    const result = truncateExcerpt(text);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(121); // 120 + ellipsis
    expect(result).not.toContain('  '); // no double space before ellipsis
  });
  it('hard-cuts when a single word exceeds the budget (no space available)', () => {
    const oneWord = 'A' + 'B'.repeat(200);
    const result = truncateExcerpt(oneWord);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBe(121);
  });
});

describe('formatRelativeTime — feed card timestamps', () => {
  const now = new Date('2026-05-26T12:00:00Z');
  it('returns empty string on invalid input', () => {
    expect(formatRelativeTime('not-a-timestamp', now)).toBe('');
  });
  it('< 1 minute → "just now"', () => {
    expect(formatRelativeTime('2026-05-26T11:59:30Z', now)).toBe('just now');
  });
  it('exactly 1 minute → "1m ago"', () => {
    expect(formatRelativeTime('2026-05-26T11:59:00Z', now)).toBe('1m ago');
  });
  it('1 hour → "1h ago"', () => {
    expect(formatRelativeTime('2026-05-26T11:00:00Z', now)).toBe('1h ago');
  });
  it('3 days → "3d ago"', () => {
    expect(formatRelativeTime('2026-05-23T12:00:00Z', now)).toBe('3d ago');
  });
  it('beyond 30 days → falls back to YYYY-MM-DD slice', () => {
    expect(formatRelativeTime('2026-01-01T00:00:00Z', now)).toBe('2026-01-01');
  });
  it('future timestamps clamp to "just now" (no negative delta)', () => {
    expect(formatRelativeTime('2026-05-26T12:00:30Z', now)).toBe('just now');
  });
});
