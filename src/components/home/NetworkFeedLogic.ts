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

// Resolve a display name from a leader's structured name fields.
// Mirrors the server-side public.resolve_display_name() helper exactly
// (KAN-229). Format: "{honorific OR role-label} {given names per pref}
// {family name}", with the family/given order flipped when
// lastNameFirst=true.
//
// A non-empty first OR last name is required: without one we fall back
// to the masked constant rather than surface a bare title ("Pastor" with
// no name is not a valid attribution — and an absent name is treated as
// held). Masking is the safe default on every leader-resolution path.
export function resolveDisplayName(
  parts: {
    firstName: string | null;
    middleName?: string | null;
    lastName: string | null;
    honorific?: string | null;
    role: string | null;
    displayNamePreference?: 'first_name_only' | 'full_name' | null;
    lastNameFirst?: boolean | null;
  },
): string {
  const first = (parts.firstName ?? '').trim();
  const middle = (parts.middleName ?? '').trim();
  const last = (parts.lastName ?? '').trim();
  if (!first && !last) return MASKED_LEADER_NAME;

  const honorific = (parts.honorific ?? '').trim();
  const prefix = honorific
    ? honorific
    : (parts.role ? (ROLE_DISPLAY[parts.role] ?? '') : '');

  const useFull = parts.displayNamePreference === 'full_name';
  const given = useFull && middle ? `${first} ${middle}`.trim() : first;

  const body = parts.lastNameFirst
    ? `${last} ${given}`.trim()
    : `${given} ${last}`.trim();

  return prefix ? `${prefix} ${body}`.trim() : body;
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

// ─── badge model (KAN-335 cutover 2026-07-22) ─────────────────────────
//
// `announcements.badge` replaces `tag_type` as the letterhead-eyebrow
// authority. CHECK (live): badge = ANY('none','new','urgent'); backfilled
// from the legacy `tag_type`. `tag_type` stays in the projection as a
// shadow until a later migration drops it — gated on the app floor
// version, since older clients still read tag_type. The feed prefers
// `badge` (resolveEyebrowTag) and falls back to `tag_type` for rows
// cached before this app version shipped.
export type Badge = 'none' | 'new' | 'urgent';

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
  // KAN-335 badge cutover 2026-07-22 — `badge` is the post-cutover
  // authority for the letterhead eyebrow register; `tag_type` above is
  // retained as the shadow (dropped in a later migration, gated on the
  // app floor version). null when the row was cached before `badge`
  // entered the projection — resolveEyebrowTag then falls back to
  // tag_type. Typed to the CHECK union; the resolver still accepts any
  // string defensively so a stale cache can never crash a card.
  badge: Badge | null;
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

// ─── Home-card eyebrow mapping (KAN-201 → KAN-335 badge cutover) ──────
//
// The Home cards read a `Tags` register key from theme for the letterhead
// eyebrow. Post-cutover the register is driven by `announcements.badge`
// via resolveEyebrowTag, with `tag_type` as the fallback for older cached
// rows. Registers: 'urgent' (red), 'new' (sky), 'update' (neutral —
// badge 'none' / everything else). The retired 'notice' register is never
// produced here (KAN-335: "Notice" must not appear post-cutover). This is
// a render-only mapping; it does NOT replace getTagChipMeta (kept for the
// legacy chip + its tests).

export type HomeCardTag = 'update' | 'urgent' | 'new';

// Legacy `tag_type` → eyebrow register. FALLBACK path only — reached when
// `badge` is absent or unrecognised (rows cached before badge entered the
// projection). 'urgent' and 'new' carry their own registers; the retired
// 'notice', plus 'update' / 'none' / null / undefined / any unknown
// value, collapse to the neutral 'update' register. Never throws.
export function toHomeCardTag(raw: string | null | undefined): HomeCardTag {
  if (raw === 'urgent') return 'urgent';
  if (raw === 'new') return 'new';
  return 'update';
}

// Resolve the letterhead-eyebrow register for a feed row, PREFERRING the
// `badge` column and falling back to the legacy `tag_type` shadow when
// badge is absent or unrecognised (older cached rows). Defensive on both
// shapes — never throws, and never yields the retired 'notice' register.
//   badge 'urgent' → 'urgent'   badge 'new' → 'new'   badge 'none' → 'update'
export function resolveEyebrowTag(
  badge: string | null | undefined,
  tagType: string | null | undefined,
): HomeCardTag {
  switch (badge) {
    case 'urgent':
      return 'urgent';
    case 'new':
      return 'new';
    case 'none':
      return 'update'; // neutral default eyebrow
    default:
      // badge absent / unrecognised → legacy tag_type fallback.
      return toHomeCardTag(tagType);
  }
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

// ─── Article standfirst derivation (Founder round-2, 2026-07-22) ──────
//
// `announcements` carries no standfirst column, but the CD article frame
// wants an italic standfirst above the body. We derive it: the first
// sentence becomes the standfirst, the remainder becomes the body.
//
// Guards (in priority order):
//   • Empty / whitespace body → no standfirst; body returned as-is.
//   • Single sentence (no second sentence after the boundary) → NO
//     standfirst; the whole text stays the body. Never split into an
//     empty body (Founder ruling: guard one-sentence bodies).
//   • The terminator must be real: an honorific abbreviation (Rev., Fr.,
//     Dr., St., Ps. …), a single-letter initial ("C. S. Lewis"), a
//     decimal ("3.5"), or an ellipsis run ("waited…") is NOT a sentence
//     boundary — a standfirst is never cut to "Rev.".
//
// Intended for card_type 'article' | 'long_read' only; the caller gates.
// Pure + string-only so it unit-tests under jest-expo's node env.

// Common leader-domain + prose abbreviations whose trailing period is NOT
// a sentence end. Lower-cased, punctuation-stripped for the lookup.
const STANDFIRST_ABBREVIATIONS: ReadonlySet<string> = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'rev', 'fr', 'st', 'pr', 'ps', 'bp',
  'sr', 'jr', 'min', 'apostle', 'pastor', 'bishop', 'elder', 'mt', 'ch',
  'vs', 'no', 'etc', 'al', 'cf', 'e.g', 'i.e',
]);

export function deriveArticleStandfirst(
  raw: string | null | undefined,
): { standfirst?: string; body: string } {
  const text = (raw ?? '').trim();
  if (!text) return { body: text };

  // A boundary is a terminator (. ! ?), any closing quotes/brackets, then
  // whitespace, then more text. The closing group deliberately excludes
  // '.' so an ellipsis run is not swallowed as closing punctuation.
  const boundary = /([.!?])([”’"')\]]*)\s+/g;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(text)) !== null) {
    const terminatorIdx = m.index;
    const remainderStart = m.index + m[0].length;
    const remainder = text.slice(remainderStart).trim();
    if (!remainder) break; // terminator sat at the end → single sentence.

    // Ellipsis / terminator run: the char before the matched terminator is
    // itself a terminator → this is the tail of "…" or "?!", not a boundary.
    const prevChar = text.charAt(terminatorIdx - 1);
    if (prevChar === '.' || prevChar === '!' || prevChar === '?') continue;

    // Honorific abbreviation or single-letter initial immediately before
    // the period → not a real sentence end.
    const before = text.slice(0, terminatorIdx);
    const lastToken = (before.match(/(\S+)$/)?.[1] ?? '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    if (STANDFIRST_ABBREVIATIONS.has(lastToken)) continue;
    if (/^[a-z]$/.test(lastToken)) continue; // single initial e.g. "C."

    const standfirst = text.slice(0, terminatorIdx + 1 + m[2].length).trim();
    return { standfirst, body: remainder };
  }

  // No valid boundary anywhere → treat the whole text as one sentence.
  return { body: text };
}
