// KAN-23 v2 — pure-function tests for Prayer Wall helpers.
//
// Component rendering / Supabase mocking isn't tested here (no RN
// Testing Library set up). What IS pinned:
//   - PAGE_SIZE = 20, TESTIMONY_PAGE_SIZE = 10 (mirror RPC LIMITs)
//   - CATEGORIES is the locked 8-set with exact casing
//   - DEFAULT_CATEGORY / DEFAULT_URGENCY = 'All' / 'All'
//   - hasActiveFilter true iff either axis is non-default
//   - buildRpcFilters maps the 2-axis state to the v2 RPC payload
//     (filter_urgent, filter_categories), with the four canonical
//     cases from the dispatch spelled out
//   - Card-formatting helpers (church type label, location line,
//     leader line) still satisfy the underground + anonymous +
//     "Church (Branch)" rules
//   - formatRelativeTime boundary cases

import { getChurchTypeLabel } from '../../utils/displayHelpers';
import {
  ANONYMOUS_LEADER_LABEL,
  CATEGORIES,
  DEFAULT_URGENCY,
  PAGE_SIZE,
  TESTIMONY_PAGE_SIZE,
  URGENCY_FILTERS,
  buildRpcFilters,
  formatRelativeTime,
  getLeaderLine,
  getLocationLine,
  hasActiveFilter,
  hasPrayedStateChanged,
  type PrayerCategory,
} from './PrayerWallLogic';

describe('PAGE_SIZE / TESTIMONY_PAGE_SIZE', () => {
  it('PAGE_SIZE is 20 — mirrors the get_prayer_wall LIMIT 20', () => {
    expect(PAGE_SIZE).toBe(20);
  });
  it('TESTIMONY_PAGE_SIZE is 10 — mirrors get_testimonies / get_landing_testimonies', () => {
    expect(TESTIMONY_PAGE_SIZE).toBe(10);
  });
});

describe('CATEGORIES — Founder lock 2026-05-24 (8 categories, exact casing)', () => {
  it('is the locked 8-set in the dispatch order', () => {
    expect(CATEGORIES).toEqual([
      'Healing',
      'Protection',
      'Provision',
      'Salvation',
      'Unity',
      'Guidance',
      'Endurance',
      'Laborers',
    ]);
  });

  it('URGENCY_FILTERS is exactly ["All", "Urgent"]', () => {
    expect(URGENCY_FILTERS).toEqual(['All', 'Urgent']);
  });

  it('every literal in CATEGORIES is a valid PrayerCategory', () => {
    const each: PrayerCategory[] = [...CATEGORIES];
    expect(each.length).toBe(8);
  });
});

describe('defaults + hasActiveFilter (multi-select)', () => {
  it('DEFAULT_URGENCY equals "All"', () => {
    expect(DEFAULT_URGENCY).toBe('All');
  });

  it('hasActiveFilter is false when both axes are at default (empty Set + All)', () => {
    expect(hasActiveFilter(new Set(), 'All')).toBe(false);
  });

  it('hasActiveFilter is true when one category is selected', () => {
    expect(hasActiveFilter(new Set(['Healing']), 'All')).toBe(true);
    expect(hasActiveFilter(new Set(['Salvation']), 'All')).toBe(true);
  });

  it('hasActiveFilter is true when many categories are selected', () => {
    expect(hasActiveFilter(new Set(['Healing', 'Protection', 'Provision']), 'All')).toBe(true);
  });

  it('hasActiveFilter is true when urgency is narrowed (empty Set + Urgent)', () => {
    expect(hasActiveFilter(new Set(), 'Urgent')).toBe(true);
  });

  it('hasActiveFilter is true when both axes are narrowed', () => {
    expect(hasActiveFilter(new Set(['Healing']), 'Urgent')).toBe(true);
  });
});

describe('buildRpcFilters — Set-based v2 RPC payload shape', () => {
  it('(empty Set, "All") → wide-open feed (both filters null)', () => {
    expect(buildRpcFilters(new Set(), 'All')).toEqual({
      filter_urgent: null,
      filter_categories: null,
    });
  });

  it('(["Healing"], "All") → single-category filter', () => {
    expect(buildRpcFilters(new Set(['Healing']), 'All')).toEqual({
      filter_urgent: null,
      filter_categories: ['Healing'],
    });
  });

  it('(["Healing", "Protection"], "All") → multi-category filter', () => {
    expect(buildRpcFilters(new Set(['Healing', 'Protection']), 'All')).toEqual({
      filter_urgent: null,
      filter_categories: ['Healing', 'Protection'],
    });
  });

  it('(empty Set, "Urgent") → urgent-only filter', () => {
    expect(buildRpcFilters(new Set(), 'Urgent')).toEqual({
      filter_urgent: true,
      filter_categories: null,
    });
  });

  it('(["Salvation"], "Urgent") → both filters set', () => {
    expect(buildRpcFilters(new Set(['Salvation']), 'Urgent')).toEqual({
      filter_urgent: true,
      filter_categories: ['Salvation'],
    });
  });

  it('3+ categories selected → all sent on the wire (reachable stack branch)', () => {
    expect(buildRpcFilters(new Set(['Healing', 'Protection', 'Provision']), 'All')).toEqual({
      filter_urgent: null,
      filter_categories: ['Healing', 'Protection', 'Provision'],
    });
  });

  it('all 8 categories selected → full enumeration on the wire', () => {
    const all = new Set(CATEGORIES);
    const out = buildRpcFilters(all, 'Urgent');
    expect(out.filter_urgent).toBe(true);
    expect(out.filter_categories?.length).toBe(8);
    expect(new Set(out.filter_categories ?? [])).toEqual(all);
  });

  it('preserves exact category casing on the wire', () => {
    // RPC compares filter_categories case-sensitively against
    // prayer_requests.category, so the FE must not down-case here.
    for (const cat of CATEGORIES) {
      const out = buildRpcFilters(new Set([cat]), 'All');
      expect(out.filter_categories).toEqual([cat]);
    }
  });
});

describe('getChurchTypeLabel — "Church (Branch)" pinned (NOT "Church Branch")', () => {
  it('branch → "Church (Branch)" with parentheses', () => {
    expect(getChurchTypeLabel('branch')).toBe('Church (Branch)');
    expect(getChurchTypeLabel('branch')).not.toBe('Church Branch');
  });

  it('every live church_type enum value has a display label', () => {
    const enumValues = ['main_campus', 'branch', 'house_church', 'ministry', 'without_walls', 'underground', 'para_ministry'];
    for (const v of enumValues) {
      expect(getChurchTypeLabel(v)).not.toBe(v);
    }
  });
});

describe('getLocationLine — underground masking', () => {
  it('underground (country=null) renders church name only, no "· null"', () => {
    const line = getLocationLine('Underground Church', null);
    expect(line).toBe('Underground Church');
    expect(line).not.toContain('null');
    expect(line).not.toContain(' · ');
  });

  it('standard renders "Church · Country"', () => {
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

describe('hasPrayedStateChanged — detail-sheet dismiss fan-out gate', () => {
  // Test (a) from the dispatch — fires when the leader toggled
  // stand-in-the-gap during the sheet session (i_prayed flipped AND
  // prayed_count adjusted by ±1). Sheet dismiss must fan the new state
  // back to the feed row.
  it('returns true when the leader toggled in (false → true, count +1)', () => {
    expect(
      hasPrayedStateChanged(
        { i_prayed: false, prayed_count: 12 },
        { i_prayed: true, prayed_count: 13 },
      ),
    ).toBe(true);
  });

  it('returns true when the leader toggled out (true → false, count -1)', () => {
    expect(
      hasPrayedStateChanged(
        { i_prayed: true, prayed_count: 13 },
        { i_prayed: false, prayed_count: 12 },
      ),
    ).toBe(true);
  });

  // Test (b) from the dispatch — silent dismiss (no toggle) must NOT
  // fire onPrayedChange. A leader who opened the sheet to read and
  // closed it without tapping should not trigger a feed-state update.
  it('returns false when state is unchanged from row initial (silent dismiss)', () => {
    expect(
      hasPrayedStateChanged(
        { i_prayed: false, prayed_count: 12 },
        { i_prayed: false, prayed_count: 12 },
      ),
    ).toBe(false);
  });

  it('returns false when the row was already prayed and stays that way', () => {
    expect(
      hasPrayedStateChanged(
        { i_prayed: true, prayed_count: 7 },
        { i_prayed: true, prayed_count: 7 },
      ),
    ).toBe(false);
  });

  it('returns true when only the count diverged (defensive — should not happen normally)', () => {
    // i_prayed and prayed_count are expected to move together via the
    // sheet's handleStandInTheGap. This case is here so a future bug
    // that drifts count without flipping the flag still trips the
    // fan-out and surfaces the stale-display problem on the card.
    expect(
      hasPrayedStateChanged(
        { i_prayed: true, prayed_count: 7 },
        { i_prayed: true, prayed_count: 8 },
      ),
    ).toBe(true);
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
