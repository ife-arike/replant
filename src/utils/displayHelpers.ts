// ─────────────────────────────────────────────
// Replant — Display Helpers
// Presentation-layer mappings only.
// API values are never changed — only display strings.
// ─────────────────────────────────────────────

// Church type: API value → display label
// Values mirror the canonical `church_type` enum in public.churches.
// Labels locked Founder 2026-06-18:
//   - 'branch'         → "Church branch" (drop parens; always lead with "Church")
//   - 'para_ministry'  → "Christian Organization (Para-ministry)"
// Admin / network surfaces still render every value, incl. 'underground'.
export function getChurchTypeLabel(apiValue: string): string {
  const map: Record<string, string> = {
    main_campus: 'Church (Main Campus)',
    branch: 'Church branch',
    house_church: 'House Church',
    ministry: 'Ministry',
    without_walls: 'Church Without Walls',
    para_ministry: 'Christian Organization (Para-ministry)',
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

// KAN-20 — Congregation size: API enum → display label (never raw enum).
// Mirrors public.congregation_size_enum. `not_specified` and unknown
// values return null so the caller can omit the row (or render its own
// "Not specified" fallback).
export function getCongregationSizeLabel(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined || value === 'not_specified') {
    return null;
  }
  const map: Record<string, string> = {
    under_50: 'Under 50',
    '50_to_200': '50–200',
    '200_to_500': '200–500',
    over_500: '500+',
  };
  return map[value] ?? null;
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
// the feed card author line ("Pastor Priya", "Apostle Felipe").
// Full ROLES enum coverage. Fallback 'Minister' is a last resort for
// unknown future values only.
// Exported for CAML leader-line composition (KAN-18). getRoleLabel
// stays as the convenience helper; CAML reaches for the raw map so it
// can fall back to a custom default ("Minister") inline.
export const PRAYER_WALL_ROLE_LABELS: Record<string, string> = {
  ministry_leader:  'Minister',
  pastor:           'Pastor',
  elder:            'Elder',
  deacon:           'Deacon',
  missionary:       'Missionary',
  youth_leader:     'Youth Leader',
  worship_leader:   'Worship Leader',
  psalmist:         'Psalmist',
  // Added — full ROLES enum coverage (fix/role-label-gap)
  apostle:          'Apostle',
  prophet:          'Prophet',
  evangelist:       'Evangelist',
  teacher:          'Teacher',
  bishop:           'Bishop',
  reverend:         'Reverend',
  intercessor:      'Intercessor',
  other:            'Minister',      // Founder ruling 2026-06-02 — same as ministry_leader
};

export function getRoleLabel(role: string | null | undefined): string {
  if (role === null || role === undefined) return 'Minister';
  return PRAYER_WALL_ROLE_LABELS[role] ?? 'Minister';
}

// KAN-23 v8 Item 05 / H5 — one canonical attribution-string builder
// for every Prayer Wall card type (prayer card + prayer detail sheet
// + testimony card + testimony detail sheet).
//
// Founder bug 2026-06-18: the DB function resolve_display_name already
// prepends the role/honorific prefix to `name` (e.g. "Pastor Priya").
// Re-prefixing here produced "Pastor Pastor Priya" across every Prayer
// Wall surface. BE is the canonical owner of the display string (it
// knows about honorific overrides + display_name_preference +
// last_name_first); FE should trust it and just pass it through.
//
// The `role` parameter is retained for signature compatibility — every
// caller threads it through and updating each one is unnecessary churn.
// Anonymous still wins because it short-circuits before name.
export function formatLeaderLine(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  role: string | null | undefined,
  name: string | null | undefined,
  isAnonymous: boolean,
): string {
  if (isAnonymous) return 'A fellow leader';
  return (name ?? '').trim();
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

// Church type options for the RegCP1 registration dropdown.
// 2026-06-18 — Founder rulings:
//   - 'underground' REMOVED from this dropdown; underground is surfaced via the
//     RegisterIntroScreen chooser tile (see branch-flow plan §1).
//   - 'branch' filtered out at render time (its own entry tile on the chooser;
//     RegCP1 in entry='branch' mode hides the type picker entirely).
//   - 'para_ministry' added with label "Christian Organization (Para-ministry)".
export const CHURCH_TYPES = [
  { label: 'Main Campus',                            value: 'main_campus' },
  { label: 'Church branch',                          value: 'branch' },
  { label: 'House Church',                           value: 'house_church' },
  { label: 'Ministry',                               value: 'ministry' },
  { label: 'Church Without Walls',                   value: 'without_walls' },
  { label: 'Christian Organization (Para-ministry)', value: 'para_ministry' },
  // 'underground' intentionally NOT listed.
] as const;

// Tooltip for the Para-ministry row. Tap-reveal ⓘ pill on that row only
// (hidden by default — NOT always-on). Locked 2026-06-18 (CONTENT F2):
// leads with affirmation, not exclusion.
export const PARA_MINISTRY_TOOLTIP =
  "Christian organizations serving the wider Body — missions, training, media, " +
  "campus, counseling, relief & development, advocacy. " +
  "Choose this if your work isn't centered on a local congregation.";

// True when the type is para_ministry — drives the conditional "church" → "organization" copy swap.
export const isParaMinistry = (type: string | null | undefined): boolean =>
  type === 'para_ministry';

// orgCopy(type) — single source of truth for the church/organization copy swap.
// Use everywhere; no per-screen string forking.
// 2026-06-18 — Founder + CONTENT F7 locked the FULL word "Organization" (not "Org").
export function orgCopy(type: string | null | undefined) {
  const para = isParaMinistry(type);
  return {
    stepLabel:               para ? 'REGISTER ORGANIZATION · 1 OF 2' : 'REGISTER CHURCH · 1 OF 2',
    stepLabel2:              para ? 'REGISTER ORGANIZATION · 2 OF 2' : 'REGISTER CHURCH · 2 OF 2',
    screenTitle:             para ? 'Organization Details' : 'Church Details',
    screenTitle2:            para ? 'Confirm Your Organization' : 'Confirm Your Church',
    asp2Title:               para ? 'Your Organization' : 'Your Church',
    nameLabel:               para ? 'Organization Name' : 'Church Name',
    namePlaceholder:         para ? 'Enter organization name' : 'Enter church name',
    typeLabel:               para ? 'Organization Type' : 'Church Type',
    sizeLabel:               para ? 'Organization Size' : 'Congregation Size',
    contactNamePlaceholder:  para ? 'Primary contact for this organization' : 'Primary contact for this church',
    contactValidationNote:   para
      ? 'We will reach out to this email and/or phone to validate your organization.'
      : 'We will reach out to this email address and/or phone number to validate your church.',
    emergencyPlanLabel:      para
      ? 'Does your organization have an emergency action plan…'
      : 'Does your church have an emergency action plan…',
    collaborationLabel:      para
      ? 'Would you be willing to strategize with nearby churches and organizations on emergency preparedness?'
      : 'Would you be willing to strategize with nearby churches on emergency preparedness?',
    // 2026-06-19 — Founder ruling: keep "What we have" / "What we need" for church,
    // swap to "What we can offer" / "What we're seeking" for org. Placeholders kept
    // generic ("your ministry") since they already work for both per the
    // "some 'church' copy can stay" rule from the same ruling.
    whatWeHaveLabel:         para ? 'What we can offer' : 'What we have',
    whatWeNeedLabel:         para ? "What we're seeking" : 'What we need',
    submitButtonLabel:       para ? 'Register Organization' : 'Register Church',
    // 2026-06-19 — RAG section is now rendered for para too. Founder revoked the
    // earlier hide-for-para lock: "a para can be under persecution and not free to
    // bring assistance." Field stays gated by the same RAG_OPTIONS as church.
    showRag:                 true,
    // Para cannot be a branch (Founder ruling MVP).
    allowBranchAttach:       !para,
  };
}

// HQ "Mark as Headquarters" checkbox visibility. HQ is a self-asserted boolean
// on parentable church types only. Excluded for branch / para / underground per
// Founder ruling 2026-06-18 + branch-flow trigger fence.
export const canMarkHeadquarters = (type: string | null | undefined): boolean =>
  !!type && type !== 'para_ministry' && type !== 'branch' && type !== 'underground';

// viewerOrgCopy(viewerChurchType) — for post-verification surfaces (Home/Settings/
// Connect/Persecuted/Church/PrayerWall) that say "your church" today. Para directors
// see "your organization" instead. BA-para #1 / CONTENT F7 expansion.
export function viewerOrgCopy(viewerChurchType: string | null | undefined) {
  const para = isParaMinistry(viewerChurchType);
  return {
    yourChurchOrOrg:     para ? 'your organization' : 'your church',
    yourChurchOrOrgCap:  para ? 'Your organization' : 'Your church',
    churchOrOrgNoun:     para ? 'organization' : 'church',
    churchOrOrgNounCap:  para ? 'Organization' : 'Church',
  };
}

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
