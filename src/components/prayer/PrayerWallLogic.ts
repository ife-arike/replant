// ─────────────────────────────────────────────
// PrayerWallLogic — KAN-23
//
// Pure helpers + type shapes for the Prayer Wall tab. Mirror of the
// NetworkFeedLogic pattern (Home / KAN-17): everything that can be
// tested without React/RN sits here. Component rendering is left to
// PrayerWallScreen + PrayerWallCard.
//
// Data source: public.get_prayer_wall(page_offset integer) RPC on
// Supabase project jiyetphxxvyiicrnwlnx. Verified live 2026-05-24 —
// RETURNS TABLE(id uuid, church_name text, church_type church_type,
// country text, category text, prayer_text text, urgency boolean,
// created_at timestamptz, church_id uuid, leader_display_name text,
// leader_role text). LIMIT 20, ORDER BY urgent DESC, created_at DESC.
//
// Underground masking + anonymous masking are handled by the RPC
// (church_name → 'Underground Church', country → NULL when underground;
// leader_display_name → NULL when anonymous, with super_admin bypass
// per Founder ruling 2026-05-24). The FE never re-derives or guards
// these — display helpers below trust the wire shape.
// ─────────────────────────────────────────────

// AC #pagination — 20 per page; matches the LIMIT 20 inside the RPC.
// Page size is server-locked; this constant just mirrors it for the
// hasMore guard.
export const PAGE_SIZE = 20;

// Category filter values per AC. Stored case-sensitive as shown to the
// user; matched case-insensitively against the wire `category` field
// (`category` in the DB is free text, nullable).
export const CATEGORIES = ['Healing', 'Protection', 'Provision', 'Unity', 'Other'] as const;
export type PrayerCategory = (typeof CATEGORIES)[number];
export type CategoryFilter = 'All' | PrayerCategory;
export type UrgencyFilter = 'All' | 'Urgent';

export const CATEGORY_FILTERS: CategoryFilter[] = ['All', ...CATEGORIES];
export const URGENCY_FILTERS: UrgencyFilter[] = ['All', 'Urgent'];

// Default filter state — applied on tab mount and re-applied on tab
// blur per AC ("reset on tab leave").
export const DEFAULT_CATEGORY: CategoryFilter = 'All';
export const DEFAULT_URGENCY: UrgencyFilter = 'All';

// Founder ruling 2026-05-24 — anonymous posts (leader_display_name
// NULL on the wire) render under this label. Never omit the line.
export const ANONYMOUS_LEADER_LABEL = 'A fellow leader';

// Wire shape exactly matches the RPC RETURNS TABLE — kept in lockstep.
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
}

// Client-side filter — AC: "no network call on change". The RPC has no
// filter params, so we paginate then narrow locally.
export function applyFilters(
  rows: PrayerRow[],
  category: CategoryFilter,
  urgency: UrgencyFilter,
): PrayerRow[] {
  return rows.filter((row) => {
    if (urgency === 'Urgent' && !row.urgency) return false;
    if (category !== 'All') {
      if (!row.category) return false;
      if (row.category.toLowerCase() !== category.toLowerCase()) return false;
    }
    return true;
  });
}

export function isDefaultFilter(category: CategoryFilter, urgency: UrgencyFilter): boolean {
  return category === DEFAULT_CATEGORY && urgency === DEFAULT_URGENCY;
}

// Location line composer. Underground rows arrive with country=null per
// the RPC's CASE WHEN c.type='underground' THEN NULL — render only the
// church_name. No "· null", no placeholder. AC explicit.
export function getLocationLine(churchName: string, country: string | null): string {
  if (country === null) return churchName;
  return `${churchName} · ${country}`;
}

// Leader line. Anonymous (null name) renders as ANONYMOUS_LEADER_LABEL.
// AC explicit: do not omit the line.
export function getLeaderLine(leaderDisplayName: string | null): string {
  return leaderDisplayName ?? ANONYMOUS_LEADER_LABEL;
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
