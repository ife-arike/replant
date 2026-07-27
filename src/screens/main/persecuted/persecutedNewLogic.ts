// ─────────────────────────────────────────────
// persecutedNewLogic — Persecuted refinement pure helpers
// (design_handoff_persecuted_NEW/README.md — the README wins over the
// .dc.html mock. Founder rulings 2026-07-26: anonymisation stays
// CONTINENT (6-continent UN M.49, matching the live pipeline — the
// byline, filter, and share-card promise all render continent);
// "Standing this week" ships as its empty state until the RPC + admin
// tagging exist — never fabricate.)
//
// Shares the Prayer Wall's generic helpers (sentencePreview,
// staggerDelay, rpcAppError, byNewest) — imported by the views straight
// from wallNewLogic rather than duplicated here. This module holds only
// what is persecuted-specific: the tier system and the tab set.
// ─────────────────────────────────────────────

import type { HeartcrySeverity } from '../persecutedLogic';
import type { WallTabDef } from '../../../components/prayer/WallPrimitives';

// Colors.red literal — pure logic modules must not import theme.ts
// (its @expo-google-fonts chain cannot load under jest's node env;
// same rule as wallNewLogic / PrayerWallLogic). Keep in lockstep with
// Colors.red in src/constants/theme.ts.
export const TIER_RED = '#E05555';

// Three tabs, not four pills (README move #1). My Voice is a header
// text action, not a tab.
export const PERSECUTED_TABS: readonly WallTabDef[] = [
  { id: 'heartcries', label: 'Heartcries' },
  { id: 'witnesses', label: 'Witnesses' },
  { id: 'takeheart', label: 'Take heart' },
];

export type PersecutedTab = 'heartcries' | 'witnesses' | 'takeheart';

// ─── The tier system (README "The red system") ────────────────────────
//
// Every heartcry is red, in two intensities: filled dot for the top two
// tiers, hollow red ring for the rest. The tier WORD is Colors.red for
// the top two and brightness below (values lifted from the reviewed
// prototype). Only `critical` pulses.

export function isFilledTier(severity: string): boolean {
  return severity === 'critical' || severity === 'urgent' || severity === 'active_persecution';
}

export function tierTint(severity: string): string {
  switch (severity) {
    case 'critical':
    case 'active_persecution': // legacy alias — renders as Critical
    case 'urgent':
      return TIER_RED;
    case 'serious':
      return 'rgba(240,237,230,0.72)';
    case 'ongoing':
      return 'rgba(240,237,230,0.55)';
    default: // informational + anything unknown reads quietest
      return 'rgba(240,237,230,0.42)';
  }
}

// The tier word rendered on cards/rows — the SENDER'S own choice
// reported back (README §2). Must match SeverityTag byte-for-byte.
export function tierWord(severity: string): string {
  switch (severity) {
    case 'critical':
    case 'active_persecution':
      return 'Critical';
    case 'urgent':
      return 'Urgent';
    case 'serious':
      return 'Serious';
    case 'ongoing':
      return 'Ongoing';
    case 'informational':
      return 'Informational';
    default:
      return severity.charAt(0).toUpperCase() + severity.slice(1);
  }
}

export function pulsesTier(severity: string): boolean {
  return severity === 'critical' || severity === 'active_persecution';
}

// Type guard used by the form state.
export type { HeartcrySeverity };

// Wire shape of get_heartcry_feed rows (mirrors FeedScene's local
// interface — hoisted here so the host and view share one type).
export interface HeartcryRow {
  id: string;
  feed_content: string | null;
  continent: string | null;
  region: string | null;
  severity: string;
  created_at: string;
  hold_count: number;
  viewer_held: boolean;
}

// ─── Continent filter (Founder ruling: continent, not country) ────────
//
// Options are derived from the continents PRESENT in the loaded feed —
// which naturally drops Antarctica and any empty continent (the README
// cut the fixed taxonomy row). 'all' is always first.

export const ALL_CONTINENTS = 'all';

export function continentOptions(rows: readonly { continent: string | null }[]): string[] {
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.continent) seen.add(r.continent);
  }
  return [ALL_CONTINENTS, ...Array.from(seen).sort()];
}

// Section label doubles as the heading (README): "Heartcries from the
// body" wide-open, "Heartcries from {Continent}" when narrowed.
export function feedSectionLabel(continent: string): string {
  return continent === ALL_CONTINENTS
    ? 'Heartcries from the body'
    : `Heartcries from ${continent}`;
}
