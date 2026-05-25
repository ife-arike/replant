// ─────────────────────────────────────────────
// Replant — Display Helpers
// Presentation-layer mappings only.
// API values are never changed — only display strings.
// ─────────────────────────────────────────────

// Church type: API value → display label
// Values mirror the canonical `church_type` enum in public.churches —
// `without_walls` (not `church_without_walls`) and `para_ministry` are
// the live values per migrations kan146_* and the register-church c.10167
// contract. Unknown values fall through to apiValue verbatim.
export function getChurchTypeLabel(apiValue: string): string {
  const map: Record<string, string> = {
    main_campus: 'Church (Main Campus)',
    branch: 'Church (Branch)',       // API: branch → Display: Church (Branch) per A-02 revised
    house_church: 'House Church',
    ministry: 'Ministry',
    without_walls: 'Church Without Walls',
    para_ministry: 'Para Ministry',
    underground: 'Underground',
  };
  return map[apiValue] ?? apiValue;
}

// RAG status: API value → plain language label
export function getRagLabel(ragStatus: string): string {
  const map: Record<string, string> = {
    green: 'Freely Operating',
    amber: 'Operating with Limitations',
    red: 'Not Operating Freely',
  };
  return map[ragStatus] ?? ragStatus;
}

// Distance: km float → locale-aware label
export function formatDistance(distanceKm: number, countryCode: string): string {
  const useImperial = countryCode === 'US';
  if (useImperial) {
    const miles = distanceKm * 0.621371;
    return `${miles.toFixed(1)} mi away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

// KAN-23 v7 Item 05 — getRoleLabel(role): label used as a prefix on
// the feed card author line ("Pastor Priya", "Minister Felipe"). The
// label set below is intentionally narrower than ROLES (which is the
// onboarding role-picker enum, order-locked per SPEC Doc 01). Per
// dispatch, any role NOT in this map (including 'other' and the
// charismatic-role values like 'apostle' / 'prophet' / 'evangelist'),
// plus null/undefined, falls back to "Minister" — the same fallback
// as the `ministry_leader` entry. Add new entries here as Founder
// expands the recognised set; keep ROLES untouched (its order is
// locked).
const PRAYER_WALL_ROLE_LABELS: Record<string, string> = {
  ministry_leader: 'Minister',
  pastor: 'Pastor',
  elder: 'Elder',
  deacon: 'Deacon',
  missionary: 'Missionary',
  youth_leader: 'Youth Leader',
  worship_leader: 'Worship Leader',
};

export function getRoleLabel(role: string | null | undefined): string {
  if (role === null || role === undefined) return 'Minister';
  return PRAYER_WALL_ROLE_LABELS[role] ?? 'Minister';
}

// Role list — 12 items, order locked per SPEC Doc 01 Amendment
export const ROLES = [
  { label: 'Pastor',          value: 'pastor' },
  { label: 'Apostle',         value: 'apostle' },
  { label: 'Prophet',         value: 'prophet' },
  { label: 'Evangelist',      value: 'evangelist' },
  { label: 'Teacher',         value: 'teacher' },
  { label: 'Elder',           value: 'elder' },
  { label: 'Bishop',          value: 'bishop' },
  { label: 'Reverend',        value: 'reverend' },
  { label: 'Intercessor',     value: 'intercessor' },
  { label: 'Psalmist',        value: 'psalmist' },
  { label: 'Minister',        value: 'ministry_leader' },
  { label: 'Other',           value: 'other' },   // label only — no free text at MVP
] as const;

// Church type options for registration dropdown
export const CHURCH_TYPES = [
  { label: 'Main Campus',          value: 'main_campus' },
  { label: 'Church (Branch)',        value: 'branch' },
  { label: 'House Church',         value: 'house_church' },
  { label: 'Ministry',             value: 'ministry' },
  { label: 'Church Without Walls', value: 'without_walls' },
  { label: 'Underground',          value: 'underground' },
] as const;

// RAG options for self-declaration. Descriptions added (KAN-13/KAN-12
// finalization 2026-05-22) — surfaced beneath each option on
// RegisterChurchPage2's Current Status picker so leaders read the
// concrete meaning of each level before choosing.
export const RAG_OPTIONS = [
  {
    label: 'Freely Operating',
    value: 'green',
    color: '#5BAD7A',
    description: 'Your ministry operates freely without restriction or known threat.',
  },
  {
    label: 'Operating with Limitations',
    value: 'amber',
    color: '#D4A855',
    description: 'You face challenges, scrutiny, or some level of restriction in your ministry.',
  },
  {
    label: 'Not Operating Freely',
    value: 'red',
    color: '#E05555',
    description: 'Your ministry is under active persecution, suppression, or serious threat.',
  },
] as const;
