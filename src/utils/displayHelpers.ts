// ─────────────────────────────────────────────
// Replant — Display Helpers
// Presentation-layer mappings only.
// API values are never changed — only display strings.
// ─────────────────────────────────────────────

// Church type: API value → display label
export function getChurchTypeLabel(apiValue: string): string {
  const map: Record<string, string> = {
    main_campus: 'Main Campus',
    branch: 'Church Branch',       // API: branch → Display: Church Branch
    house_church: 'House Church',
    ministry: 'Ministry',
    church_without_walls: 'Church Without Walls',
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
  { label: 'Ministry Leader', value: 'ministry_leader' },
  { label: 'Other',           value: 'other' },   // label only — no free text at MVP
] as const;

// Church type options for registration dropdown
export const CHURCH_TYPES = [
  { label: 'Main Campus',          value: 'main_campus' },
  { label: 'Church Branch',        value: 'branch' },
  { label: 'House Church',         value: 'house_church' },
  { label: 'Ministry',             value: 'ministry' },
  { label: 'Church Without Walls', value: 'church_without_walls' },
  { label: 'Underground',          value: 'underground' },
] as const;

// RAG options for self-declaration
export const RAG_OPTIONS = [
  { label: 'Freely Operating',          value: 'green', color: '#5BAD7A' },
  { label: 'Operating with Limitations', value: 'amber', color: '#D4A855' },
  { label: 'Not Operating Freely',       value: 'red',   color: '#E05555' },
] as const;
