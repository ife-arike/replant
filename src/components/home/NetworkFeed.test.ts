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
  deriveArticleStandfirst,
  formatRelativeTime,
  getTagChipMeta,
  isPosted,
  resolveDisplayName,
  resolveEyebrowTag,
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

describe('toHomeCardTag — legacy tag_type fallback (post KAN-335 cutover)', () => {
  it('maps urgent → urgent', () => {
    expect(toHomeCardTag('urgent')).toBe('urgent');
  });
  it("maps 'new' → new (its own register post-cutover)", () => {
    expect(toHomeCardTag('new')).toBe('new');
  });
  it('maps update → update', () => {
    expect(toHomeCardTag('update')).toBe('update');
  });
  it("collapses retired 'notice' to neutral update (never 'notice')", () => {
    expect(toHomeCardTag('notice')).toBe('update');
  });
  it("collapses 'none', null, undefined, and unknown values to update", () => {
    expect(toHomeCardTag('none')).toBe('update');
    expect(toHomeCardTag(null)).toBe('update');
    expect(toHomeCardTag(undefined)).toBe('update');
    expect(toHomeCardTag('emergency')).toBe('update');
  });
});

describe('resolveEyebrowTag — KAN-335 badge cutover (badge preferred, tag_type fallback)', () => {
  it('badge=urgent → urgent', () => {
    expect(resolveEyebrowTag('urgent', null)).toBe('urgent');
  });
  it('badge=new → new (renders "New", never the retired "Notice")', () => {
    expect(resolveEyebrowTag('new', null)).toBe('new');
  });
  it('badge=none → neutral update register', () => {
    expect(resolveEyebrowTag('none', null)).toBe('update');
  });
  it('badge wins over a conflicting legacy tag_type', () => {
    expect(resolveEyebrowTag('none', 'urgent')).toBe('update');
    expect(resolveEyebrowTag('urgent', 'none')).toBe('urgent');
  });
  it('falls back to tag_type when badge is absent (older cached rows)', () => {
    expect(resolveEyebrowTag(null, 'urgent')).toBe('urgent');
    expect(resolveEyebrowTag(undefined, 'new')).toBe('new');
    expect(resolveEyebrowTag(null, 'notice')).toBe('update'); // retired notice → neutral
    expect(resolveEyebrowTag(null, null)).toBe('update');
  });
  it('is defensive against unknown badge values (falls through to tag_type)', () => {
    expect(resolveEyebrowTag('emergency', 'urgent')).toBe('urgent');
    expect(resolveEyebrowTag('emergency', null)).toBe('update');
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
    // KAN-335 badge cutover — badge column added to AnnouncementRow.
    badge: null,
    // KAN-201 home redesign — card-routing columns added to AnnouncementRow.
    link_url: null,
    author_type: 'admin',
    comment_count: 0,
    card_type: 'standard',
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

describe('resolveDisplayName — KAN-229 structured-name display', () => {
  it('formats as "{role-label} {first} {last}" by default (first_name_only)', () => {
    expect(resolveDisplayName({ firstName: 'Ruth',   lastName: 'James',  role: 'ministry_leader' })).toBe('Minister Ruth James');
    expect(resolveDisplayName({ firstName: 'Ife',    lastName: 'Arike',  role: 'evangelist' })).toBe('Evangelist Ife Arike');
    expect(resolveDisplayName({ firstName: 'Daniel', lastName: 'Okoro',  role: 'pastor' })).toBe('Pastor Daniel Okoro');
  });

  it('includes middle name when displayNamePreference="full_name"', () => {
    expect(resolveDisplayName({
      firstName: 'Grace', middleName: 'Mary', lastName: 'Mbeki', role: 'bishop',
      displayNamePreference: 'full_name',
    })).toBe('Bishop Grace Mary Mbeki');
  });

  it('honours last_name_first toggle', () => {
    expect(resolveDisplayName({
      firstName: 'Dirk', middleName: 'Daniel', lastName: 'Van Wyk',
      role: 'reverend', displayNamePreference: 'full_name', lastNameFirst: true,
    })).toBe('Reverend Van Wyk Dirk Daniel');
  });

  it('honorific overrides role prefix', () => {
    expect(resolveDisplayName({
      firstName: 'Boutros', lastName: 'Mikhail', honorific: 'Anba', role: 'pastor',
    })).toBe('Anba Boutros Mikhail');
  });

  it("maps 'other' role per the Founder ruling (Minister prefix)", () => {
    expect(resolveDisplayName({ firstName: 'Sam', lastName: 'Lee', role: 'other' })).toBe('Minister Sam Lee');
  });

  it('renders without prefix when role is null', () => {
    expect(resolveDisplayName({ firstName: 'Sam', lastName: 'Lee', role: null })).toBe('Sam Lee');
  });

  it('renders without prefix for unknown role (defensive — no crash)', () => {
    expect(resolveDisplayName({ firstName: 'Sam', lastName: 'Lee', role: 'archdeacon' })).toBe('Sam Lee');
  });

  it('falls back to the masked constant when no name remains', () => {
    expect(resolveDisplayName({ firstName: null, lastName: null, role: 'pastor' })).toBe('A leader in the network');
    expect(resolveDisplayName({ firstName: '',   lastName: '',   role: 'pastor' })).toBe('A leader in the network');
    expect(resolveDisplayName({ firstName: null, lastName: null, role: null })).toBe('A leader in the network');
  });
});

describe('deriveArticleStandfirst — Founder round-2 (article/long_read)', () => {
  it('splits the first sentence into the standfirst, remainder into the body', () => {
    expect(deriveArticleStandfirst('The church gathered at dawn. They prayed for hours.')).toEqual({
      standfirst: 'The church gathered at dawn.',
      body: 'They prayed for hours.',
    });
  });

  it('keeps the exclamation / question terminator on the standfirst', () => {
    expect(deriveArticleStandfirst('Behold, He comes! The whole city stirred to meet Him.')).toEqual({
      standfirst: 'Behold, He comes!',
      body: 'The whole city stirred to meet Him.',
    });
    expect(deriveArticleStandfirst('Who is this King? Even the wind obeys His voice.')).toEqual({
      standfirst: 'Who is this King?',
      body: 'Even the wind obeys His voice.',
    });
  });

  it('returns NO standfirst for a single sentence (guard — never an empty body)', () => {
    expect(deriveArticleStandfirst('A single unbroken thought carried through to the end.')).toEqual({
      body: 'A single unbroken thought carried through to the end.',
    });
    // Trailing terminator, nothing after it → still one sentence.
    expect(deriveArticleStandfirst('He is risen indeed.')).toEqual({
      body: 'He is risen indeed.',
    });
  });

  it('does not split on an honorific abbreviation (Rev., Fr., St., Ps.)', () => {
    expect(deriveArticleStandfirst('Rev. Daniel Okoro opened in prayer. Then the choir sang.')).toEqual({
      standfirst: 'Rev. Daniel Okoro opened in prayer.',
      body: 'Then the choir sang.',
    });
    expect(deriveArticleStandfirst('We turned to Ps. 23 that morning. Grief lifted as we read.')).toEqual({
      standfirst: 'We turned to Ps. 23 that morning.',
      body: 'Grief lifted as we read.',
    });
  });

  it('does not split on single-letter initials ("C. S. Lewis")', () => {
    expect(deriveArticleStandfirst('C. S. Lewis wrote of a deeper joy. We remembered him gladly.')).toEqual({
      standfirst: 'C. S. Lewis wrote of a deeper joy.',
      body: 'We remembered him gladly.',
    });
  });

  it('does not split inside a decimal ("3.5")', () => {
    expect(deriveArticleStandfirst('Giving rose 3.5 percent this year. We gave thanks to God.')).toEqual({
      standfirst: 'Giving rose 3.5 percent this year.',
      body: 'We gave thanks to God.',
    });
  });

  it('treats an ellipsis run as continuation, not a boundary', () => {
    expect(deriveArticleStandfirst('We waited... and waited for the dawn. Then light broke over the hills.')).toEqual({
      standfirst: 'We waited... and waited for the dawn.',
      body: 'Then light broke over the hills.',
    });
  });

  it('carries closing quotes onto the standfirst', () => {
    expect(deriveArticleStandfirst('He whispered, "It is finished." The room fell silent.')).toEqual({
      standfirst: 'He whispered, "It is finished."',
      body: 'The room fell silent.',
    });
  });

  it('trims surrounding whitespace and handles empty input', () => {
    expect(deriveArticleStandfirst('   Grace found us. Mercy kept us.   ')).toEqual({
      standfirst: 'Grace found us.',
      body: 'Mercy kept us.',
    });
    expect(deriveArticleStandfirst('')).toEqual({ body: '' });
    expect(deriveArticleStandfirst('   ')).toEqual({ body: '' });
    expect(deriveArticleStandfirst(null)).toEqual({ body: '' });
    expect(deriveArticleStandfirst(undefined)).toEqual({ body: '' });
  });

  it('splits at the FIRST valid boundary only (multi-sentence remainder stays whole)', () => {
    expect(deriveArticleStandfirst('One. Two. Three.')).toEqual({
      standfirst: 'One.',
      body: 'Two. Three.',
    });
  });
});
