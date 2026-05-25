// ─────────────────────────────────────────────
// PrayerWallLogic — KAN-23 v2 (locked Founder 2026-05-24)
//
// Pure helpers + type shapes for the Prayer Wall surface. Mirror of the
// NetworkFeedLogic pattern: everything that can be tested without
// React/RN sits here. Component rendering is owned by
// PrayerWallScreen / PrayerWallCard / PrayerWallFilterBar / etc.
//
// v2 changes:
//   * 8-category set (Healing, Protection, Provision, Salvation, Unity,
//     Guidance, Endurance, Laborers) replaces the earlier 5-category
//     set. Founder lock 2026-05-24.
//   * get_prayer_wall RPC now accepts 3 params — page_offset (int),
//     filter_urgent (bool|null), filter_categories (text[]|null) — so
//     filtering is server-side. applyFilters / isDefaultFilter from v1
//     are gone; buildRpcFilters + hasActiveFilter take their place.
//   * PrayerRow gains prayed_count, i_prayed, status to support the
//     detail-sheet "stand in the gap" affordance and (future) answered-
//     prayer surfacing. status is text — RPC WHERE clause keeps the
//     feed scoped to 'open', so the FE always sees that value today.
//   * TestimonyRow added to support get_testimonies +
//     get_landing_testimonies. original_text is nullable because
//     get_landing_testimonies skips the join.
//
// RPC-enforced masking trusted from the wire (underground country=null,
// anonymous leader_display_name=null). FE never re-derives.
// ─────────────────────────────────────────────

// AC #pagination — 20 per page; matches the LIMIT 20 inside the RPC.
export const PAGE_SIZE = 20;

// Testimony pagination — get_testimonies + get_landing_testimonies
// both ship 10 per call. Mirrored here for the hasMore guard.
export const TESTIMONY_PAGE_SIZE = 10;

// 8-category set locked Founder 2026-05-24. Casing is exact and
// load-bearing — the FE passes these strings verbatim to the RPC as the
// filter_categories[] payload, and the RPC compares them case-sensitively
// against prayer_requests.category. Add or rename only with a Founder ruling.
export const CATEGORIES = [
  'Healing',
  'Protection',
  'Provision',
  'Salvation',
  'Unity',
  'Guidance',
  'Endurance',
  'Laborers',
] as const;
export type PrayerCategory = (typeof CATEGORIES)[number];
export type UrgencyFilter = 'All' | 'Urgent';

// Multi-select category state — empty Set means "All" (wide-open feed).
// Read-only at the type level so consumers don't mutate the parent's
// Set instance; the screen always replaces with `new Set(...)` to keep
// React's identity-based change detection honest.
export type SelectedCategories = ReadonlySet<PrayerCategory>;

export const URGENCY_FILTERS: UrgencyFilter[] = ['All', 'Urgent'];

// Default filter state — applied on tab mount and re-applied on tab
// blur. The wide-open feed maps to (filter_urgent: null,
// filter_categories: null) on the wire.
export const DEFAULT_URGENCY: UrgencyFilter = 'All';

// Founder ruling 2026-05-24 — anonymous posts (leader_display_name
// NULL on the wire) render under this label. Never omit the line.
export const ANONYMOUS_LEADER_LABEL = 'A fellow leader';

// Wire shape exactly matches get_prayer_wall RETURNS TABLE in v2 — kept
// in lockstep with the RPC.
export interface PrayerRow {
  id: string;
  church_name: string;
  church_type: string;
  country: string | null;
  category: string | null;
  prayer_text: string;
  urgency: boolean;
  created_at: string;
  church_id: string;
  leader_display_name: string | null;
  leader_role: string | null;
  prayed_count: number;
  i_prayed: boolean;
  status: string;
}

// Wire shape covering both get_testimonies (with original-request join)
// and get_landing_testimonies (no join — original_text is null on the
// landing path). FE branches off original_request_id presence to decide
// whether to render the "Originally posted as:" quote block.
export interface TestimonyRow {
  id: string;
  church_name: string;
  country: string | null;
  testimony_text: string;
  original_request_id: string | null;
  original_text: string | null;
  created_at: string;
  celebrated_count: number;
  i_celebrated: boolean;
  leader_display_name: string | null;
}

// Server-side filter param builder. Maps the two-axis FE filter state
// to the v2 RPC payload shape. Empty Set or 'All' urgency collapses to
// null on the wire so the RPC can short-circuit the filter predicate.
// Category iteration order matches Set insertion order, which the
// caller controls — the screen's toggle helper appends on add, so the
// wire array preserves tap order. The RPC uses ANY(...) semantics so
// order does not affect the result.
export function buildRpcFilters(
  categories: SelectedCategories,
  urgency: UrgencyFilter,
): { filter_urgent: boolean | null; filter_categories: string[] | null } {
  return {
    filter_urgent: urgency === 'Urgent' ? true : null,
    filter_categories: categories.size === 0 ? null : Array.from(categories),
  };
}

// True when either axis is narrowed from the wide-open default. Used by
// the filter bar to decide whether to render the Clear chip + active-
// count strip.
export function hasActiveFilter(
  categories: SelectedCategories,
  urgency: UrgencyFilter,
): boolean {
  return categories.size > 0 || urgency !== DEFAULT_URGENCY;
}

// Used by PrayerWallDetailSheet to decide whether to fire
// onPrayedChange on dismiss. The sheet should only fan the new heart
// state back to the parent feed when the leader actually toggled
// stand-in-the-gap — silent dismisses (cancel, swipe-down with no
// change) must not trigger a state update on the feed row.
export function hasPrayedStateChanged(
  initial: { i_prayed: boolean; prayed_count: number },
  current: { i_prayed: boolean; prayed_count: number },
): boolean {
  return (
    initial.i_prayed !== current.i_prayed ||
    initial.prayed_count !== current.prayed_count
  );
}

// Location-line composer. Underground rows arrive from the RPC with
// country=null per the server-side CASE WHEN c.type='underground' branch
// — render only the church name. No "· null", no placeholder. Same
// helper is reused on testimony cards (where the RPC also masks
// underground country to null).
export function getLocationLine(churchName: string, country: string | null): string {
  if (country === null) return churchName;
  return `${churchName} · ${country}`;
}

// Leader-line composer. Anonymous (null name on the wire) renders as
// ANONYMOUS_LEADER_LABEL. Reused on both prayer cards and testimony
// cards. Founder ruling 2026-05-24: do not omit the line.
//
// v7 Item 05 — optional role argument: when provided AND the name is
// non-null, the line renders as `${getRoleLabel(role)} ${name}` (e.g.
// "Pastor Priya", "Minister Felipe"). A single space, no separator.
// Anonymous + underground-masked posts (name = null) always render
// "A fellow leader" with no role prefix, regardless of the role
// value on the wire. Other callers (testimony surfaces, rotator)
// can omit role and get the v6 behaviour: just the name.
import { getRoleLabel } from '../../utils/displayHelpers';

export function getLeaderLine(
  leaderDisplayName: string | null,
  leaderRole?: string | null,
): string {
  if (leaderDisplayName === null) return ANONYMOUS_LEADER_LABEL;
  if (leaderRole === undefined) return leaderDisplayName;
  return `${getRoleLabel(leaderRole)} ${leaderDisplayName}`;
}

// Relative-time format mirrors NetworkFeedLogic so the two surfaces
// read consistently. Kept parallel rather than imported so each
// surface's spec is self-contained.
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

export function formatRelativeTime(createdAt: string, now: Date = new Date()): string {
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return '';
  const diff = now.getTime() - ts;
  if (diff < MINUTE_MS) return 'just now';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`;
  if (diff < WEEK_MS) return `${Math.floor(diff / DAY_MS)}d ago`;
  if (diff < MONTH_MS) return `${Math.floor(diff / WEEK_MS)}w ago`;
  if (diff < YEAR_MS) return `${Math.floor(diff / MONTH_MS)}mo ago`;
  return `${Math.floor(diff / YEAR_MS)}y ago`;
}
