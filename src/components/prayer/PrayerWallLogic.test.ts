// KAN-23 — pure-function tests for Prayer Wall helpers.
//
// Component rendering / Supabase mocking isn't tested here — that would
// need RN Testing Library which isn't set up (same constraint as the
// KAN-17 NetworkFeed surface). What IS pinned:
//   - PAGE_SIZE = 20 (mirrors RPC LIMIT)
//   - 12 filter combinations (6 category × 2 urgency) — dispatch
//     explicitly requires every combination as a test case
//   - Church type 'Church (Branch)' label assertion (NOT 'Church Branch')
//   - Underground card: country field absent from the composed location
//     line (no "· null")
//   - Anonymous card: 'A fellow leader' rendered when wire name is NULL
//   - Default filter state matches the resetOnTabLeave contract

import { getChurchTypeLabel } from '../../utils/displayHelpers';
import {
  ANONYMOUS_LEADER_LABEL,
  CATEGORIES,
  CATEGORY_FILTERS,
  DEFAULT_CATEGORY,
  DEFAULT_URGENCY,
  PAGE_SIZE,
  URGENCY_FILTERS,
  applyFilters,
  formatRelativeTime,
  getLeaderLine,
  getLocationLine,
  isDefaultFilter,
  type CategoryFilter,
  type PrayerCategory,
  type PrayerRow,
  type UrgencyFilter,
} from './PrayerWallLogic';

// Fixture builder — minimal valid PrayerRow. Override the fields each
// test cares about and rely on defaults for the rest.
const row = (overrides: Partial<PrayerRow> = {}): PrayerRow => ({
  id: 'row-id',
  church_name: 'Test Church',
  church_type: 'main_campus',
  country: 'United States',
  category: 'Healing',
  prayer_text: 'Please pray.',
  urgency: false,
  created_at: '2026-05-24T12:00:00.000Z',
  church_id: 'church-id',
  leader_display_name: 'Jane',
  leader_role: 'pastor',
  ...overrides,
});

// Mixed fixture so each filter combination has something to keep and
// something to drop. One row per category, both urgency flavours.
const fixture: PrayerRow[] = [
  row({ id: 'h-std', category: 'Healing', urgency: false }),
  row({ id: 'h-urg', category: 'Healing', urgency: true }),
  row({ id: 'pr-std', category: 'Protection', urgency: false }),
  row({ id: 'pr-urg', category: 'Protection', urgency: true }),
  row({ id: 'pv-std', category: 'Provision', urgency: false }),
  row({ id: 'pv-urg', category: 'Provision', urgency: true }),
  row({ id: 'u-std', category: 'Unity', urgency: false }),
  row({ id: 'u-urg', category: 'Unity', urgency: true }),
  row({ id: 'o-std', category: 'Other', urgency: false }),
  row({ id: 'o-urg', category: 'Other', urgency: true }),
  // Defensive: a row with category=null + urgency=false. Should be
  // visible under (All, All) but dropped under any specific category
  // filter regardless of urgency.
  row({ id: 'null-std', category: null, urgency: false }),
];

describe('PAGE_SIZE', () => {
  it('is 20 — mirrors the RPC LIMIT 20 (server-locked)', () => {
    expect(PAGE_SIZE).toBe(20);
  });
});

describe('CATEGORY_FILTERS / URGENCY_FILTERS — AC enumerations', () => {
  it('lists the 6 category options exactly as the dispatch spelled them', () => {
    expect(CATEGORY_FILTERS).toEqual(['All', 'Healing', 'Protection', 'Provision', 'Unity', 'Other']);
  });
  it('lists the 2 urgency options', () => {
    expect(URGENCY_FILTERS).toEqual(['All', 'Urgent']);
  });
  it('All-filter is the default on both axes', () => {
    expect(DEFAULT_CATEGORY).toBe('All');
    expect(DEFAULT_URGENCY).toBe('All');
    expect(isDefaultFilter(DEFAULT_CATEGORY, DEFAULT_URGENCY)).toBe(true);
  });
  it('isDefaultFilter is false when any axis is narrowed', () => {
    expect(isDefaultFilter('Healing', 'All')).toBe(false);
    expect(isDefaultFilter('All', 'Urgent')).toBe(false);
    expect(isDefaultFilter('Healing', 'Urgent')).toBe(false);
  });
});

// ───────── 12 filter combinations (6 category × 2 urgency) ─────────
// Dispatch requirement: every combination exercised.

describe('applyFilters — 12 combinations × fixture', () => {
  const expectations: Array<{
    category: CategoryFilter;
    urgency: UrgencyFilter;
    expectedIds: string[];
  }> = [
    // category × urgency = expected ids from fixture
    { category: 'All',        urgency: 'All',    expectedIds: ['h-std','h-urg','pr-std','pr-urg','pv-std','pv-urg','u-std','u-urg','o-std','o-urg','null-std'] },
    { category: 'All',        urgency: 'Urgent', expectedIds: ['h-urg','pr-urg','pv-urg','u-urg','o-urg'] },
    { category: 'Healing',    urgency: 'All',    expectedIds: ['h-std','h-urg'] },
    { category: 'Healing',    urgency: 'Urgent', expectedIds: ['h-urg'] },
    { category: 'Protection', urgency: 'All',    expectedIds: ['pr-std','pr-urg'] },
    { category: 'Protection', urgency: 'Urgent', expectedIds: ['pr-urg'] },
    { category: 'Provision',  urgency: 'All',    expectedIds: ['pv-std','pv-urg'] },
    { category: 'Provision',  urgency: 'Urgent', expectedIds: ['pv-urg'] },
    { category: 'Unity',      urgency: 'All',    expectedIds: ['u-std','u-urg'] },
    { category: 'Unity',      urgency: 'Urgent', expectedIds: ['u-urg'] },
    { category: 'Other',      urgency: 'All',    expectedIds: ['o-std','o-urg'] },
    { category: 'Other',      urgency: 'Urgent', expectedIds: ['o-urg'] },
  ];

  // Sanity: 12 cases.
  it('covers exactly 12 combinations', () => {
    expect(expectations.length).toBe(12);
    expect(expectations.length).toBe(CATEGORY_FILTERS.length * URGENCY_FILTERS.length);
  });

  for (const { category, urgency, expectedIds } of expectations) {
    it(`(${category}, ${urgency}) → ${expectedIds.length} row(s)`, () => {
      const got = applyFilters(fixture, category, urgency).map((r) => r.id);
      expect(got).toEqual(expectedIds);
    });
  }
});

describe('applyFilters — case-insensitive category matching', () => {
  it('matches a wire row whose category casing differs from the filter', () => {
    const rows = [row({ id: 'lower', category: 'healing' }), row({ id: 'mixed', category: 'HeAlInG' })];
    const got = applyFilters(rows, 'Healing', 'All').map((r) => r.id);
    expect(got).toEqual(['lower', 'mixed']);
  });

  it('null wire category never matches a narrowed filter', () => {
    const rows = [row({ category: null }), row({ category: 'Healing' })];
    expect(applyFilters(rows, 'Other', 'All').length).toBe(0);
  });
});

describe('applyFilters — narrowing both axes is the intersection', () => {
  it('matches only urgent rows of the chosen category', () => {
    const rows = [
      row({ id: 'a', category: 'Provision', urgency: true }),
      row({ id: 'b', category: 'Provision', urgency: false }),
      row({ id: 'c', category: 'Healing', urgency: true }),
    ];
    const got = applyFilters(rows, 'Provision', 'Urgent').map((r) => r.id);
    expect(got).toEqual(['a']);
  });
});

// ───────── Card-formatting helpers (dispatch-required assertions) ─────

describe('getChurchTypeLabel — branch label is "Church (Branch)" (NOT "Church Branch")', () => {
  // Dispatch: "assert this in tests". Pinned character-exact so a
  // future map edit can't silently regress to the wrong label.
  it('branch → "Church (Branch)" with parentheses, never "Church Branch"', () => {
    expect(getChurchTypeLabel('branch')).toBe('Church (Branch)');
    expect(getChurchTypeLabel('branch')).not.toBe('Church Branch');
  });

  it('every church_type enum value the RPC may emit has a display label', () => {
    // The DB enum has 7 values per pg_enum check (main_campus, branch,
    // house_church, ministry, without_walls, underground, para_ministry).
    // displayHelpers maps 7 of them; assert no value falls through to
    // the verbatim API string.
    const enumValues = ['main_campus', 'branch', 'house_church', 'ministry', 'without_walls', 'underground', 'para_ministry'];
    for (const v of enumValues) {
      expect(getChurchTypeLabel(v)).not.toBe(v);
    }
  });
});

describe('getLocationLine — underground masking', () => {
  it('underground card (country=null) renders church name only, no "· null"', () => {
    const line = getLocationLine('Underground Church', null);
    expect(line).toBe('Underground Church');
    expect(line).not.toContain('null');
    expect(line).not.toContain(' · ');
  });

  it('standard card renders "Church · Country"', () => {
    expect(getLocationLine('Maranatha Ministries', 'United States')).toBe('Maranatha Ministries · United States');
  });
});

describe('getLeaderLine — anonymous fallback', () => {
  it('null leader_display_name → "A fellow leader" (Founder ruling 2026-05-24)', () => {
    expect(getLeaderLine(null)).toBe(ANONYMOUS_LEADER_LABEL);
    expect(getLeaderLine(null)).toBe('A fellow leader');
  });

  it('non-null name passes through verbatim', () => {
    expect(getLeaderLine('Pastor Daniel')).toBe('Pastor Daniel');
    expect(getLeaderLine('Jane')).toBe('Jane');
  });
});

describe('formatRelativeTime — boundary cases', () => {
  const NOW = new Date('2026-05-24T12:00:00.000Z');

  it('< 1 minute → "just now"', () => {
    expect(formatRelativeTime('2026-05-24T11:59:30.000Z', NOW)).toBe('just now');
  });

  it('exactly 1 minute → "1m ago"', () => {
    expect(formatRelativeTime('2026-05-24T11:59:00.000Z', NOW)).toBe('1m ago');
  });

  it('1 hour → "1h ago"', () => {
    expect(formatRelativeTime('2026-05-24T11:00:00.000Z', NOW)).toBe('1h ago');
  });

  it('1 day → "1d ago"', () => {
    expect(formatRelativeTime('2026-05-23T12:00:00.000Z', NOW)).toBe('1d ago');
  });

  it('invalid timestamp → empty string (no crash)', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('');
  });
});

// Type-only sanity — confirms PrayerCategory and CategoryFilter aren't
// drifting from CATEGORIES. If someone widens the runtime enum without
// updating types, tsc + this test should both notice.
describe('PrayerCategory ↔ CATEGORIES alignment', () => {
  it('all CATEGORIES entries are valid PrayerCategory values', () => {
    const each: PrayerCategory[] = [...CATEGORIES];
    expect(each.length).toBe(5);
  });
});
