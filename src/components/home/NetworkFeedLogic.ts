// ─────────────────────────────────────────────
// NetworkFeed — pure logic (KAN-17)
//
// Separated from the React surface so helpers + constants can be unit-
// tested under jest-expo's node env without dragging Expo font modules
// into the require chain (theme.ts → @expo-google-fonts/* → expo-font
// is not resolvable in Jest's node runtime). Same pattern as
// DailyScriptureStripLogic.ts.
//
// Anything imported by both the component AND the test belongs here.
// React-specific code lives in `NetworkFeed.tsx` / `AnnouncementCard.tsx`.
// ─────────────────────────────────────────────

// ─── D-56 author attribution (locked 2026-05-20) ──────────────────────
//
// Every card renders this string in place of the actual admin's name /
// email / ID. The DB column `announcements.author_id` is retained for
// audit purposes (KAN-200 `announcement_created` audit row joins on it)
// but MUST NEVER surface to app users. The attribution constant is the
// only string the FE renders in the author slot.

export const AUTHOR_ATTRIBUTION = 'Replant Team';

// ─── Leader display-name resolution (KAN-201 card system 2026-06-02) ──
//
// get_comments now returns the raw role enum value for non-masked rows,
// and the LeaderFeedItem secondary lookup fetches `role` from
// public.users. Both surfaces humanise the role into a title prefix via
// this single locked table (Founder confirmed 2026-06-02).
//
// 'other' → 'Minister' (Founder ruling 2026-06-02: same display as ministry_leader).
// An unknown / null role → no prefix (defensive — never crash a card).
// Masking is handled by the caller; this map is purely cosmetic.
export const ROLE_DISPLAY: Record<string, string> = {
  pastor:          'Pastor',
  apostle:         'Apostle',
  prophet:         'Prophet',
  evangelist:      'Evangelist',
  teacher:         'Teacher',
  elder:           'Elder',
  bishop:          'Bishop',
  reverend:        'Reverend',
  intercessor:     'Intercessor',
  psalmist:        'Psalmist',
  ministry_leader: 'Minister', // Founder ruling 2026-06-02
  other:           'Minister', // Founder ruling 2026-06-02
};

// Masked / unresolved leaders surface this constant — never a real name.
export const MASKED_LEADER_NAME = 'A leader in the network';

// Resolve a display name from a full name + raw role enum value.
// Format: "{RoleDisplay} {name}" — e.g. "Minister Ruth" or "Minister Ruth James".
// Respects display_name_preference: 'full_name' uses the full name;
// 'first_name_only' (default when omitted) uses the first token only.
//
// A non-empty name is required: without one we fall back to the masked
// constant rather than surface a bare title ("Pastor" with no name is
// not a valid attribution — and an absent name is treated as held).
// Masking is the safe default on every leader-resolution path.
export function resolveDisplayName(
  fullName: string | null,
  role: string | null,
  displayNamePreference?: 'first_name_only' | 'full_name',
): string {
  const useFullName = displayNamePreference === 'full_name';
  const nameToken = useFullName
    ? (fullName ?? '')
    : (fullName?.split(' ')[0] ?? '');
  if (!nameToken) return MASKED_LEADER_NAME;
  const title = role ? (ROLE_DISPLAY[role] ?? '') : '';
  return [title, nameToken].filter(Boolean).join(' ');
}

// ─── Pagination (AC: cursor-based, 20 per page, cursor on published_at) ─

export const PAGE_SIZE = 20;

// ─── tag_type model ───────────────────────────────────────────────────
//
// CHECK constraint live on `announcements.tag_type`:
//   ((tag_type IS NULL) OR (tag_type = ANY (ARRAY['urgent', 'update',
//   'notice', 'new', 'none']::text[])))
//
// AC #13 — chip rendering:
//   urgent → red,       weight 1
//   update → green,     weight 2
//   notice → amber,     weight 3
//   new    → sky-blue,  weight 4
// Null and 'none' render NO chip. Weight is a visual priority hint
// from SPEC, NOT a sort order — sort is `published_at DESC` regardless.

export type TagType = 'urgent' | 'update' | 'notice' | 'new' | 'none';

export interface TagChipMeta {
  /** Human label that appears in the chip (title-cased per wireframe). */
  label: string;
  /** SPEC visual-priority hint — kept for future ordering rules; not used for sort. */
  weight: 1 | 2 | 3 | 4;
  /** Brand-palette key the chip styles against. */
  palette: 'red' | 'green' | 'amber' | 'sky';
}

const TAG_META: Record<Exclude<TagType, 'none'>, TagChipMeta> = {
  urgent: { label: 'Urgent', weight: 1, palette: 'red' },
  update: { label: 'Update', weight: 2, palette: 'green' },
  notice: { label: 'Notice', weight: 3, palette: 'amber' },
  new:    { label: 'New',    weight: 4, palette: 'sky'   },
};

/**
 * Returns chip rendering metadata for the given `tag_type` column value,
 * or `null` when no chip should render (null input or `'none'`). Unknown
 * strings — which a future CHECK-constraint extension could introduce —
 * return null defensively rather than crashing the card.
 */
export function getTagChipMeta(raw: string | null | undefined): TagChipMeta | null {
  if (!raw || raw === 'none') return null;
  return (TAG_META as Record<string, TagChipMeta>)[raw] ?? null;
}

// ─── D-54 Posted-only predicate (FE belt-and-suspenders) ──────────────
//
// The RLS policy `leaders_can_read_posted_announcements` enforces this
// predicate at the DB layer (verified live 2026-05-21). The FE mirror
// here is defense-in-depth: if a future policy change accidentally
// widens leader read access, the FE filter still gates the card render.
// AC #5 — Posted-only gate, explicit exclusions:
//   - Draft       (published_at IS NULL)
//   - Scheduled   (published_at > now())
//   - Inactive    (is_active = false)

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  published_at: string | null;
  is_active: boolean;
  source_label: string | null;
  tag_type: string | null;
  // KAN-201 home redesign 2026-06-01 — new card-routing columns.
  link_url: string | null;
  author_type: 'admin' | 'leader';
  comment_count: number;
  // KAN-201 card system 2026-06-02 — card_type drives routing (takes
  // priority over the legacy author_type === 'leader' check). CHECK:
  // standard | article | long_read | leader_word | encouragement |
  // together | call_to_action. Defaults to 'standard' at the DB layer.
  card_type:
    | 'standard'
    | 'article'
    | 'long_read'
    | 'leader_word'
    | 'encouragement'
    | 'together'
    | 'call_to_action';
  // author_id is selected ONLY to resolve leader-card attribution via a
  // secondary users/churches lookup in NetworkFeed. It is NEVER rendered
  // and NEVER passed to a display component (D-56 / SEC Observation D).
  author_id: string | null;
}

// ─── Home-card tag mapping (KAN-201 home redesign) ────────────────────
//
// The new Home cards use the three-tag `Tags` export from theme
// (update | notice | urgent). The DB `tag_type` CHECK additionally
// permits 'new' and 'none'; both — plus null and any unknown value —
// collapse to the neutral 'update' register for the letterhead eyebrow.
// This is a render-only mapping; it does NOT replace getTagChipMeta
// (kept for the legacy chip + its tests).

export type HomeCardTag = 'update' | 'notice' | 'urgent';

export function toHomeCardTag(raw: string | null | undefined): HomeCardTag {
  if (raw === 'notice') return 'notice';
  if (raw === 'urgent') return 'urgent';
  return 'update';
}

export function isPosted(row: AnnouncementRow, now: Date = new Date()): boolean {
  if (!row.is_active) return false;
  if (!row.published_at) return false;
  const ts = Date.parse(row.published_at);
  if (Number.isNaN(ts)) return false;
  return ts <= now.getTime();
}

// ─── Relative timestamp helper ────────────────────────────────────────
//
// AC #2 — "2h ago", "3d ago". The boundaries below are chosen for human
// legibility, not statistical accuracy: anything under a minute reads
// as "just now"; minutes / hours / days / weeks / months / years roll up
// in turn. All times are computed in the user's local context (the
// caller passes Date.now()-derived values; no UTC arithmetic).

const MINUTE_MS = 60 * 1000;
const HOUR_MS   = 60 * MINUTE_MS;
const DAY_MS    = 24 * HOUR_MS;
const WEEK_MS   = 7 * DAY_MS;
const MONTH_MS  = 30 * DAY_MS;
const YEAR_MS   = 365 * DAY_MS;

export function formatRelativeTime(
  publishedAt: string,
  now: Date = new Date(),
): string {
  const ts = Date.parse(publishedAt);
  if (Number.isNaN(ts)) return '';
  const diff = now.getTime() - ts;
  if (diff < MINUTE_MS) return 'just now';
  if (diff < HOUR_MS)   return `${Math.floor(diff / MINUTE_MS)}m ago`;
  if (diff < DAY_MS)    return `${Math.floor(diff / HOUR_MS)}h ago`;
  if (diff < WEEK_MS)   return `${Math.floor(diff / DAY_MS)}d ago`;
  if (diff < MONTH_MS)  return `${Math.floor(diff / WEEK_MS)}w ago`;
  if (diff < YEAR_MS)   return `${Math.floor(diff / MONTH_MS)}mo ago`;
  return `${Math.floor(diff / YEAR_MS)}y ago`;
}
