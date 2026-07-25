// wallNewLogic tests — Prayer Wall rebuild (design_handoff_prayer_wall_NEW).
// House style mirrors PrayerWallLogic.test.ts: pure jest, no RN imports.

import {
  answeredThisMonth,
  byNewest,
  counterStage,
  effectiveView,
  rpcAppError,
  sentencePreview,
  sortRows,
  windowStanding,
  staggerDelay,
  COMPOSE_AMBER_AT,
  COMPOSE_RED_AT,
  STAGGER_CAP_ROWS,
  STAGGER_STEP_MS,
} from './wallNewLogic';
import type { PrayerRow, TestimonyRow } from './PrayerWallLogic';

// ─── sentencePreview ─────────────────────────────────────────────────

describe('sentencePreview', () => {
  it('returns the first sentence with ellipsis when more follows', () => {
    const r = sentencePreview(
      'Our pastor was hospitalized after the flood recovery efforts. He has served for thirty years without rest.',
    );
    expect(r.preview).toBe('Our pastor was hospitalized after the flood recovery efforts.…');
    expect(r.truncated).toBe(true);
  });

  it('carries a second sentence when the first is short', () => {
    const r = sentencePreview('Pray for rain. The wells are low and the herds are thinning fast.');
    expect(r.preview).toBe('Pray for rain. The wells are low and the herds are thinning fast.');
    expect(r.truncated).toBe(false);
  });

  it('short first + more than two sentences still truncates', () => {
    const r = sentencePreview('Pray for rain. The wells are low. The elders called a fast for Friday.');
    expect(r.preview).toBe('Pray for rain. The wells are low.…');
    expect(r.truncated).toBe(true);
  });

  it('single sentence passes through untouched', () => {
    const r = sentencePreview('Surgery at dawn for a pastor’s daughter.');
    expect(r.preview).toBe('Surgery at dawn for a pastor’s daughter.');
    expect(r.truncated).toBe(false);
  });

  it('text with no sentence punctuation is not truncated', () => {
    const r = sentencePreview('a burden carried quietly without end');
    expect(r.preview).toBe('a burden carried quietly without end');
    expect(r.truncated).toBe(false);
  });

  it('trailing prose without a terminator counts as more-to-read', () => {
    const r = sentencePreview('The team crossed the border on Tuesday. Since then no word');
    expect(r.truncated).toBe(true);
    expect(r.preview.endsWith('…')).toBe(true);
  });

  it('handles empty and whitespace-only input', () => {
    expect(sentencePreview('').preview).toBe('');
    expect(sentencePreview('   ').truncated).toBe(false);
  });
});

// ─── sortRows ────────────────────────────────────────────────────────

function row(partial: Partial<PrayerRow>): PrayerRow {
  return {
    id: partial.id ?? 'x',
    church_name: 'Church',
    church_type: 'standard',
    country: null,
    category: null,
    prayer_text: 'text',
    urgency: false,
    created_at: '2026-07-20T00:00:00Z',
    church_id: null,
    leader_display_name: null,
    leader_role: null,
    prayed_count: 0,
    i_prayed: false,
    status: 'open',
    rag_status: null,
    ...partial,
  };
}

describe('sortRows', () => {
  const a = row({ id: 'a', created_at: '2026-07-22T00:00:00Z', prayed_count: 4 });
  const b = row({ id: 'b', created_at: '2026-07-24T00:00:00Z', prayed_count: 9 });
  const c = row({ id: 'c', created_at: '2026-07-23T00:00:00Z', prayed_count: 9, urgency: true });

  it('newest sorts by created_at desc', () => {
    expect(sortRows([a, b, c], 'newest').map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('most sorts by prayed_count desc, ties to newest', () => {
    expect(sortRows([a, b, c], 'most').map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('urgent floats urgency true, then newest', () => {
    expect(sortRows([a, b, c], 'urgent').map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate the input array', () => {
    const input = [a, b, c];
    sortRows(input, 'urgent');
    expect(input.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});

// ─── effectiveView (gate fallback) ───────────────────────────────────

describe('effectiveView', () => {
  it('passes views through when verified', () => {
    expect(effectiveView('journal', true)).toBe('journal');
    expect(effectiveView('compose', true)).toBe('compose');
  });

  it('falls gated journal/compose back to feed', () => {
    expect(effectiveView('journal', false)).toBe('feed');
    expect(effectiveView('compose', false)).toBe('feed');
  });

  it('keeps mine reachable when gated (gate panel renders there)', () => {
    expect(effectiveView('mine', false)).toBe('mine');
    expect(effectiveView('testimonies', false)).toBe('testimonies');
  });
});

// ─── counterStage ────────────────────────────────────────────────────

describe('counterStage', () => {
  it('crosses amber at exactly 250 and red at exactly 280', () => {
    expect(counterStage(COMPOSE_AMBER_AT - 1)).toBe('muted');
    expect(counterStage(COMPOSE_AMBER_AT)).toBe('amber');
    expect(counterStage(COMPOSE_RED_AT - 1)).toBe('amber');
    expect(counterStage(COMPOSE_RED_AT)).toBe('red');
    expect(counterStage(0)).toBe('muted');
  });
});

// ─── answeredThisMonth ───────────────────────────────────────────────

function testimony(createdAt: string): TestimonyRow {
  return {
    id: createdAt,
    church_name: 'Church',
    country: null,
    testimony_text: 't',
    original_request_id: null,
    original_text: null,
    created_at: createdAt,
    celebrated_count: 0,
    i_celebrated: false,
    leader_display_name: null,
    leader_role: null,
  };
}

describe('answeredThisMonth', () => {
  const now = new Date('2026-07-24T12:00:00Z');

  it('counts only the current calendar month', () => {
    const rows = [
      testimony('2026-07-01T08:00:00Z'),
      testimony('2026-07-23T08:00:00Z'),
      testimony('2026-06-30T23:00:00Z'),
      testimony('2025-07-10T08:00:00Z'), // same month, wrong year
    ];
    expect(answeredThisMonth(rows, now)).toBe(2);
  });

  it('reads 0 on an empty list (counts must read 0, not hide)', () => {
    expect(answeredThisMonth([], now)).toBe(0);
  });
});

// ─── staggerDelay ────────────────────────────────────────────────────

describe('staggerDelay', () => {
  it('steps 55ms per row and caps', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBe(3 * STAGGER_STEP_MS);
    expect(staggerDelay(200)).toBe(STAGGER_CAP_ROWS * STAGGER_STEP_MS);
  });
});

// ─── byNewest (testimony chronology guard, device pass r2) ───────────────
describe('byNewest — enforces created_at DESC regardless of wire order', () => {
  const t = (id: string, created_at: string) => ({ id, created_at });
  it('re-orders an urgent-biased page to strict chronology', () => {
    const wire = [t('old-urgent', '2026-06-01T00:00:00Z'), t('new', '2026-07-24T00:00:00Z'), t('mid', '2026-07-01T00:00:00Z')];
    expect(byNewest(wire).map((r) => r.id)).toEqual(['new', 'mid', 'old-urgent']);
  });
  it('does not mutate the input array', () => {
    const wire = [t('a', '2026-06-01T00:00:00Z'), t('b', '2026-07-01T00:00:00Z')];
    byNewest(wire);
    expect(wire[0].id).toBe('a');
  });
});

// ─── windowStanding (30-day window · 25 visible, Founder 2026-07-25) ─────
describe('windowStanding — journal gap list is a windowed view', () => {
  const NOW = new Date('2026-07-25T00:00:00Z');
  const r = (id: number, daysAgo: number) => ({
    prayer_request_id: String(id),
    prayed_at: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  });
  it('drops entries older than 30 days', () => {
    const rows = [r(1, 2), r(2, 31), r(3, 29)];
    expect(windowStanding(rows, NOW).map((x) => x.prayer_request_id)).toEqual(['1', '3']);
  });
  it('caps at 25 most recent, newest first', () => {
    const rows = Array.from({ length: 40 }, (_, i) => r(i, i * 0.5));
    const out = windowStanding(rows, NOW);
    expect(out).toHaveLength(25);
    expect(out[0].prayer_request_id).toBe('0');
    expect(out[24].prayer_request_id).toBe('24');
  });
  it('ignores unparseable timestamps rather than crashing', () => {
    expect(windowStanding([{ prayer_request_id: 'x', prayed_at: 'not-a-date' }], NOW)).toHaveLength(0);
  });
});

// ─── rpcAppError (payload contract, device pass r3) ──────────────────────
describe('rpcAppError — app-level refusals ride the 200 payload', () => {
  it('extracts a non-empty error code', () => {
    expect(rpcAppError({ error: 'self_interaction_blocked' })).toBe('self_interaction_blocked');
    expect(rpcAppError({ error: 'not_verified' })).toBe('not_verified');
  });
  it('returns null for success payloads and non-objects', () => {
    expect(rpcAppError({ action: 'added', prayed: true })).toBeNull();
    expect(rpcAppError(null)).toBeNull();
    expect(rpcAppError(undefined)).toBeNull();
    expect(rpcAppError('ok')).toBeNull();
    expect(rpcAppError({ error: '' })).toBeNull();
    expect(rpcAppError({ error: 42 })).toBeNull();
  });
});
