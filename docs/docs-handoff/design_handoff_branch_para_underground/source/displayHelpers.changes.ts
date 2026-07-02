// ─────────────────────────────────────────────
// displayHelpers — changes for this batch
// Drop these into src/utils/displayHelpers.ts (shown as a focused diff, not a
// full-file replacement). Three edits: CHURCH_TYPES array, getChurchTypeLabel
// map, and the para "organization" copy-swap helper.
// ─────────────────────────────────────────────

// 1 ── CHURCH_TYPES (registration dropdown) ───────────────────────────────────
//
// Changes vs current:
//   • 'underground'  REMOVED from the dropdown (entry is the chooser tile now).
//   • 'branch'       label "Church (Branch)" → "Church branch".
//   • 'para_ministry' ADDED, label "Para-ministry / Organization".
//   • NO 'headquarters' entry — HQ is a boolean flag, not a type (see #4).
//
// The standalone RegCP1 picker filters 'branch' out of THIS list at render time
// (branch has its own entry tile); see RegisterChurchPage1 notes in README.

export const CHURCH_TYPES = [
  { label: 'Main Campus',                 value: 'main_campus' },
  { label: 'Church branch',               value: 'branch' },          // was "Church (Branch)"
  { label: 'House Church',                value: 'house_church' },
  { label: 'Ministry',                    value: 'ministry' },
  { label: 'Church Without Walls',        value: 'without_walls' },
  { label: 'Para-ministry / Organization', value: 'para_ministry' },  // NEW
  // 'underground' intentionally NOT listed — surfaced via the RegisterIntro tile.
] as const;

// Tooltip for the Para-ministry / Organization row. Shown via a tap-reveal ⓘ
// pill on that row only (hidden by default — NOT always-on).
export const PARA_MINISTRY_TOOLTIP =
  "Any Christian organization that isn't a local church — missions, training, " +
  "media, campus ministry, counseling, relief & development, advocacy.";


// 2 ── getChurchTypeLabel (display surfaces) ──────────────────────────────────
//
// Admin / network surfaces still render every value, incl. 'underground'.
// 'branch' display becomes "Church branch". No 'headquarters' value.

export function getChurchTypeLabel(apiValue: string): string {
  const map: Record<string, string> = {
    main_campus:   'Church (Main Campus)',
    branch:        'Church branch',          // was "Church (Branch)"
    house_church:  'House Church',
    ministry:      'Ministry',
    without_walls: 'Church Without Walls',
    para_ministry: 'Para-ministry / Organization',
    underground:   'Underground',
  };
  return map[apiValue] ?? apiValue;
}


// 3 ── Para "organization" copy swap ──────────────────────────────────────────
//
// When type === 'para_ministry', RegCP1 swaps "Church" → "Organization" copy.
// Use the FULL word "Organization" (not abbreviated "Org") everywhere.

export const isParaMinistry = (type: string): boolean => type === 'para_ministry';

export function orgCopy(type: string) {
  const para = isParaMinistry(type);
  return {
    stepLabel:   para ? 'REGISTER ORGANIZATION · 1 OF 2' : 'REGISTER CHURCH · 1 OF 2',
    screenTitle: para ? 'Organization Details' : 'Church Details',
    nameLabel:   para ? 'Organization Name' : 'Church Name',
    namePlaceholder: para ? 'Enter organization name' : 'Enter church name',
    typeLabel:   para ? 'Organization Type' : 'Church Type',
    sizeLabel:   para ? 'Organization Size' : 'Congregation Size',
    // RAG status is NOT shown for para. Branch attachment is blocked for para.
    showRag:     !para,
    allowBranchAttach: !para,
  };
}


// 4 ── Headquarters is a flag, not a type ─────────────────────────────────────
//
// New boolean `is_headquarters` on churches (DB column). Any non-para church
// type can set it via a "Mark as Headquarters" checkbox under the type picker.
// Renders a blue "HQ" badge on the expanded church card in the network (and on
// HQ parents in ParentChurchPicker results).
//
//   • Show the checkbox when a type is selected AND type !== 'para_ministry'
//     AND the leader is on the standalone path (branch/underground can't be HQ).
//   • Persist as churches.is_headquarters (default false).

export const canMarkHeadquarters = (type: string): boolean =>
  !!type && type !== 'para_ministry' && type !== 'branch' && type !== 'underground';
