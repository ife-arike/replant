// KAN-17 — pure-function tests for NetworkFeed helpers.
//
// Component rendering / Supabase mocking isn't tested here — that would
// need RN Testing Library, which isn't set up. The valuable surfaces
// to pin:
//   - D-56 author attribution constant ("Replant Team")
//   - PAGE_SIZE = 20 (AC #8 pagination literal)
//   - tag_type → chip meta mapping (AC #13 — colors, weights, labels)
//   - null and 'none' tag_type both yield no chip
//   - D-54 Posted-only predicate (mirror of RLS)
//   - Relative timestamp boundaries

import {
  AUTHOR_ATTRIBUTION,
  PAGE_SIZE,
  formatRelativeTime,
  getTagChipMeta,
  isPosted,
  type AnnouncementRow,
} from './NetworkFeedLogic';

describe('AUTHOR_ATTRIBUTION (D-56)', () => {
  it('is the literal string "Replant Team" (locked 2026-05-20)', () => {
    // Pinned character-exact — if anyone changes this we want a test
    // failure rather than a silent regression of the D-56 anti-leak
    // posture. Author name / email / ID must never reach app users.
    expect(AUTHOR_ATTRIBUTION).toBe('Replant Team');
  });
});

describe('PAGE_SIZE (AC #8)', () => {
  it('is the literal 20 (cursor pagination page size)', () => {
    expect(PAGE_SIZE).toBe(20);
  });
});

describe('getTagChipMeta — AC #13', () => {
  it('maps urgent → red, weight 1, label "Urgent"', () => {
    expect(getTagChipMeta('urgent')).toEqual({
      label: 'Urgent', weight: 1, palette: 'red',
    });
  });

  it('maps update → green, weight 2, label "Update"', () => {
    expect(getTagChipMeta('update')).toEqual({
      label: 'Update', weight: 2, palette: 'green',
    });
  });

  it('maps notice → amber, weight 3, label "Notice"', () => {
    expect(getTagChipMeta('notice')).toEqual({
      label: 'Notice', weight: 3, palette: 'amber',
    });
  });

  it('maps new → sky, weight 4, label "New"', () => {
    expect(getTagChipMeta('new')).toEqual({
      label: 'New', weight: 4, palette: 'sky',
    });
  });

  it('returns null for null (no chip)', () => {
    expect(getTagChipMeta(null)).toBeNull();
  });

  it('returns null for undefined (no chip)', () => {
    expect(getTagChipMeta(undefined)).toBeNull();
  });

  it("returns null for 'none' literal (no chip — AC explicit)", () => {
    expect(getTagChipMeta('none')).toBeNull();
  });

  it('returns null for unknown strings (defensive — future CHECK extension)', () => {
    expect(getTagChipMeta('emergency')).toBeNull();
    expect(getTagChipMeta('URGENT')).toBeNull(); // case-sensitive
    expect(getTagChipMeta('')).toBeNull();
  });
});

describe('isPosted — D-54 predicate (RLS mirror)', () => {
  const NOW = new Date('2026-05-22T12:00:00.000Z');
  const baseRow = (overrides: Partial<AnnouncementRow>): AnnouncementRow => ({
    id: 'row-1',
    title: 'T',
    body: 'B',
    published_at: '2026-05-21T00:00:00.000Z',
    is_active: true,
    source_label: null,
    tag_type: null,
    ...overrides,
  });

  it('Posted row (active + published in past) returns true', () => {
    expect(isPosted(baseRow({}), NOW)).toBe(true);
  });

  it('Draft row (published_at = null) returns false', () => {
    expect(isPosted(baseRow({ published_at: null }), NOW)).toBe(false);
  });

  it('Scheduled row (published_at in future) returns false', () => {
    expect(isPosted(baseRow({
      published_at: '2026-06-01T00:00:00.000Z',
    }), NOW)).toBe(false);
  });

  it('Inactive row (is_active = false) returns false', () => {
    expect(isPosted(baseRow({ is_active: false }), NOW)).toBe(false);
  });

  it('Equal-to-now published_at is Posted (boundary inclusive — matches RLS <= now())', () => {
    expect(isPosted(baseRow({
      published_at: NOW.toISOString(),
    }), NOW)).toBe(true);
  });

  it('Malformed published_at string returns false (defensive)', () => {
    expect(isPosted(baseRow({
      published_at: 'not-a-date',
    }), NOW)).toBe(false);
  });
});

describe('formatRelativeTime — AC #2', () => {
  const NOW = new Date('2026-05-22T12:00:00.000Z');

  it('less than a minute returns "just now"', () => {
    const ts = new Date(NOW.getTime() - 30 * 1000).toISOString();
    expect(formatRelativeTime(ts, NOW)).toBe('just now');
  });

  it('minutes return "Xm ago"', () => {
    const ts = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(ts, NOW)).toBe('5m ago');
  });

  it('hours return "Xh ago"', () => {
    const ts = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(ts, NOW)).toBe('2h ago');
  });

  it('days return "Xd ago"', () => {
    const ts = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(ts, NOW)).toBe('3d ago');
  });

  it('weeks return "Xw ago"', () => {
    const ts = new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(ts, NOW)).toBe('2w ago');
  });

  it('months return "Xmo ago"', () => {
    const ts = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(ts, NOW)).toBe('3mo ago');
  });

  it('years return "Xy ago"', () => {
    const ts = new Date(NOW.getTime() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(ts, NOW)).toBe('2y ago');
  });

  it('boundary: exactly 60 seconds rolls to "1m ago"', () => {
    const ts = new Date(NOW.getTime() - 60 * 1000).toISOString();
    expect(formatRelativeTime(ts, NOW)).toBe('1m ago');
  });

  it('boundary: exactly 60 minutes rolls to "1h ago"', () => {
    const ts = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(ts, NOW)).toBe('1h ago');
  });

  it('malformed ISO returns empty string (defensive)', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('');
  });
});
