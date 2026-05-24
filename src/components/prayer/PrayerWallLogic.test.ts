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
  CATEGORY_FILTERS,
  DEFAULT_CATEGORY,
  DEFAULT_URGENCY,
  PAGE_SIZE,
  TESTIMONY_PAGE_SIZE,
  URGENCY_FILTERS,
  buildRpcFilters,
  formatRelativeTime,
  getLeaderLine,
  getLocationLine,
  hasActiveFilter,
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

  it('CATEGORY_FILTERS prepends "All" to the 8-set', () => {
    expect(CATEGORY_FILTERS).toEqual([
      'All',
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

describe('defaults + hasActiveFilter', () => {
  it('DEFAULT_CATEGORY / DEFAULT_URGENCY both equal "All"', () => {
    expect(DEFAULT_CATEGORY).toBe('All');
    expect(DEFAULT_URGENCY).toBe('All');
  });

  it('hasActiveFilter is false when both axes are at default', () => {
    expect(hasActiveFilter('All', 'All')).toBe(false);
  });

  it('hasActiveFilter is true when category is narrowed', () => {
    expect(hasActiveFilter('Healing', 'All')).toBe(true);
    expect(hasActiveFilter('Salvation', 'All')).toBe(true);
  });

  it('hasActiveFilter is true when urgency is narrowed', () => {
    expect(hasActiveFilter('All', 'Urgent')).toBe(true);
  });

  it('hasActiveFilter is true when both axes are narrowed', () => {
    expect(hasActiveFilter('Healing', 'Urgent')).toBe(true);
  });
});

describe('buildRpcFilters — v2 RPC payload shape (4 canonical cases)', () => {
  it('("All", "All") → wide-open feed (both filters null)', () => {
    expect(buildRpcFilters('All', 'All')).toEqual({
      filter_urgent: null,
      filter_categories: null,
    });
  });

  it('("Healing", "All") → single-category filter', () => {
    expect(buildRpcFilters('Healing', 'All')).toEqual({
      filter_urgent: null,
      filter_categories: ['Healing'],
    });
  });

  it('("All", "Urgent") → urgent-only filter', () => {
    expect(buildRpcFilters('All', 'Urgent')).toEqual({
      filter_urgent: true,
      filter_categories: null,
    });
  });

  it('("Salvation", "Urgent") → both filters set', () => {
    expect(buildRpcFilters('Salvation', 'Urgent')).toEqual({
      filter_urgent: true,
      filter_categories: ['Salvation'],
    });
  });

  it('preserves exact category casing on the wire', () => {
    // RPC compares filter_categories case-sensitively against
    // prayer_requests.category, so the FE must not down-case here.
    for (const cat of CATEGORIES) {
      const out = buildRpcFilters(cat, 'All');
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
