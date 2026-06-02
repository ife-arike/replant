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
  resolveDisplayName,
  toHomeCardTag,
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

describe('toHomeCardTag — Home redesign card-eyebrow mapping', () => {
  it('maps notice → notice', () => {
    expect(toHomeCardTag('notice')).toBe('notice');
  });
  it('maps urgent → urgent', () => {
    expect(toHomeCardTag('urgent')).toBe('urgent');
  });
  it('maps update → update', () => {
    expect(toHomeCardTag('update')).toBe('update');
  });
  it("collapses 'new' to the neutral update register", () => {
    expect(toHomeCardTag('new')).toBe('update');
  });
  it("collapses 'none', null, undefined, and unknown values to update", () => {
    expect(toHomeCardTag('none')).toBe('update');
    expect(toHomeCardTag(null)).toBe('update');
    expect(toHomeCardTag(undefined)).toBe('update');
    expect(toHomeCardTag('emergency')).toBe('update');
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
    // KAN-201 home redesign — card-routing columns added to AnnouncementRow.
    link_url: null,
    author_type: 'admin',
    comment_count: 0,
    card_type: 'standard',
    author_id: null,
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

describe('resolveDisplayName — KAN-201 card system (role humanisation)', () => {
  it('formats as "{RoleDisplay} {firstName}"', () => {
    expect(resolveDisplayName('Ruth James', 'ministry_leader')).toBe('Minister Ruth');
    expect(resolveDisplayName('Ife Arike', 'evangelist')).toBe('Evangelist Ife');
    expect(resolveDisplayName('Daniel Okoro', 'pastor')).toBe('Pastor Daniel');
  });

  it('takes only the first whitespace-delimited token as the first name', () => {
    expect(resolveDisplayName('Grace Mary Mbeki', 'bishop')).toBe('Bishop Grace');
  });

  it("maps 'other' role per the Founder ruling (Minister prefix)", () => {
    // Founder ruling 2026-06-02: 'other' displays the same as ministry_leader.
    expect(resolveDisplayName('Sam Lee', 'other')).toBe('Minister Sam');
  });

  it('renders first name only when role is null (no prefix)', () => {
    expect(resolveDisplayName('Sam Lee', null)).toBe('Sam');
  });

  it('renders first name only for an unknown role (defensive — no crash)', () => {
    expect(resolveDisplayName('Sam Lee', 'archdeacon')).toBe('Sam');
  });

  it('falls back to the masked constant when no name remains', () => {
    expect(resolveDisplayName(null, 'pastor')).toBe('A leader in the network');
    expect(resolveDisplayName('', 'pastor')).toBe('A leader in the network');
    expect(resolveDisplayName(null, null)).toBe('A leader in the network');
  });
});
