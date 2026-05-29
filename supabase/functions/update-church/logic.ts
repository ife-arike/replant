// KAN-207 update-church — pure logic (validation + types + canonical enums).
//
// Sibling of register-church/logic.ts. Differences vs register:
//   - church_id REQUIRED (the target row to UPDATE).
//   - Every other field OPTIONAL (partial update). A leader can edit one
//     field at a time without re-sending everything.
//   - contact_name kept editable — same admin-only PII column.
//   - state_declaration is NOT editable from this function. The leader
//     declared it once at registration; editing church profile fields
//     should never let them rewrite the declaration of faith. If they
//     ever need to re-declare, that's a separate (much heavier) flow.
//
// Underground invariant identical to register: type==='underground' →
// force city = null, lat = null, lng = null on the row.

// ─── Canonical enums (mirror live `public.churches.type` + `rag_status_enum`) ───
//
// Same set as register-church. `para_ministry` remains out of scope at
// the FE-picker level; mirroring that here so we don't let a leader
// edit their type to `para_ministry` via this surface.
export const CHURCH_TYPES = [
  "main_campus",
  "branch",
  "house_church",
  "ministry",
  "without_walls",
  "underground",
] as const;
export type ChurchType = (typeof CHURCH_TYPES)[number];

export const RAG_STATUSES = ["green", "amber", "red"] as const;
export type RagStatus = (typeof RAG_STATUSES)[number];

export const CONGREGATION_SIZES = [
  "under_50",
  "50_to_200",
  "200_to_500",
  "over_500",
  "not_specified",
] as const;
export type CongregationSize = (typeof CONGREGATION_SIZES)[number];

// ─── Payload + update row types ───
//
// UpdateChurchRow uses `T | null` (not `T | undefined`) for fields so
// the partial-update step in index.ts can filter out null/undefined
// in one pass. `null` here means "not edited this submit" — not "set
// this column to NULL in the DB." If we ever need to nullify a column
// explicitly, we'd add an explicit sentinel; today no edit flow does.
export interface UpdateChurchPayload {
  church_id: string;
  name?: string | null;
  type?: ChurchType | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  rag_status?: RagStatus | null;
  lat?: number | null;
  lng?: number | null;
  needs?: string[] | null;
  resources?: string[] | null;
  has_emergency_plan?: boolean | null;
  open_to_collaboration?: boolean | null;
  website_url?: string | null;
  primary_language?: string | null;
  denomination_affiliation?: string | null;
  congregation_size_range?: CongregationSize | null;
  show_contact_on_profile?: boolean | null;
}

// Shape passed to deps.updateChurch. Same field set as the payload
// (minus church_id, which is the WHERE clause). Underground strip
// already applied in parseUpdatePayload.
export interface UpdateChurchRow {
  name: string | null;
  type: ChurchType | null;
  country: string | null;
  city: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  rag_status: RagStatus | null;
  lat: number | null;
  lng: number | null;
  needs: string[] | null;
  resources: string[] | null;
  has_emergency_plan: boolean | null;
  open_to_collaboration: boolean | null;
  website_url: string | null;
  primary_language: string | null;
  denomination_affiliation: string | null;
  congregation_size_range: CongregationSize | null;
  show_contact_on_profile: boolean | null;
}

export interface UpdateChurchSuccessBody {
  success: true;
  church_id: string;
  message: string;
}

// ─── Field-length caps (mirror register-church) ───
const MAX_NAME = 200;
const MAX_COUNTRY = 100;
const MAX_CITY = 120;
const MAX_ADDRESS = 250;
const MAX_EMAIL = 320;
const MAX_PHONE = 32;
const MAX_URL = 500;
const MAX_FREETEXT = 500;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// UUID v4 / nil shape — admin client returns UUIDs in this exact form;
// the FE Page 1 reads churches.id directly, so any value reaching this
// function should already match. Defense-in-depth against a malformed
// or forged payload.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isNonEmptyString(v: unknown, max: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}
function isOptionalNonEmptyString(v: unknown, max: number): v is string | undefined | null {
  if (v === undefined || v === null) return true;
  // Optional EDITED strings: when present, must be non-empty after trim
  // (a leader who wants to "clear" a column should not be able to do so
  // by submitting "   " — that's almost certainly an accident).
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}
function isOptionalString(v: unknown, max: number): v is string | undefined | null {
  if (v === undefined || v === null) return true;
  return typeof v === "string" && v.length <= max;
}
function isOptionalFiniteNumber(v: unknown): v is number | undefined | null {
  if (v === undefined || v === null) return true;
  return typeof v === "number" && Number.isFinite(v);
}
function isOptionalBoolean(v: unknown): v is boolean | undefined | null {
  return v === undefined || v === null || typeof v === "boolean";
}

export type ParseResult =
  | { ok: true; church_id: string; row: UpdateChurchRow }
  | { ok: false; error: string };

/**
 * Validate + normalise the JSON body for an UPDATE.
 *
 * Required: church_id (UUID).
 * Everything else optional. Anything absent OR null in the payload is
 * left as null on the row; index.ts strips nulls before sending to
 * the DB so we only UPDATE the columns the leader actually edited.
 *
 * Underground type-coercion: when `type === 'underground'` is part of
 * this edit, `city`, `lat`, `lng` are force-set to null on the row.
 * This is the same c.10167 invariant the register flow honors — and
 * critically, an edit FROM another type TO underground must strip the
 * existing location data.
 */
export function parseUpdatePayload(body: unknown): ParseResult {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const p = body as Record<string, unknown>;

  // ── Required: church_id ──
  if (typeof p.church_id !== "string" || !UUID_RE.test(p.church_id)) {
    return { ok: false, error: "church_id is required and must be a UUID" };
  }
  const church_id = p.church_id;

  // ── Optional strings (non-empty-when-present) ──
  if (!isOptionalNonEmptyString(p.name, MAX_NAME)) {
    return { ok: false, error: "name must be a non-empty string when provided" };
  }
  if (!isOptionalNonEmptyString(p.country, MAX_COUNTRY)) {
    return { ok: false, error: "country must be a non-empty string when provided" };
  }
  if (!isOptionalNonEmptyString(p.contact_name, MAX_NAME)) {
    return { ok: false, error: "contact_name must be a non-empty string when provided" };
  }

  // contact_email + contact_phone are optional individually. The
  // at-least-one rule from register doesn't apply here — an edit
  // touching contact details might pass only one of the two. If both
  // are absent from the payload, no contact change is happening.
  if (!isOptionalString(p.contact_email, MAX_EMAIL)) {
    return { ok: false, error: "contact_email must be a string when provided" };
  }
  if (
    typeof p.contact_email === "string" &&
    p.contact_email.trim().length > 0 &&
    !EMAIL_RE.test(p.contact_email.trim())
  ) {
    return { ok: false, error: "contact_email is not a valid email address" };
  }
  if (!isOptionalString(p.contact_phone, MAX_PHONE)) {
    return { ok: false, error: "contact_phone must be a string when provided" };
  }
  if (!isOptionalString(p.city, MAX_CITY)) {
    return { ok: false, error: "city must be a string when provided" };
  }
  if (!isOptionalString(p.address, MAX_ADDRESS)) {
    return { ok: false, error: "address must be a string when provided" };
  }

  // ── Optional enums ──
  if (
    p.type !== undefined &&
    p.type !== null &&
    !(CHURCH_TYPES as readonly string[]).includes(p.type as string)
  ) {
    return { ok: false, error: `type must be one of: ${CHURCH_TYPES.join(", ")}` };
  }
  if (
    p.rag_status !== undefined &&
    p.rag_status !== null &&
    !(RAG_STATUSES as readonly string[]).includes(p.rag_status as string)
  ) {
    return { ok: false, error: `rag_status must be one of: ${RAG_STATUSES.join(", ")}` };
  }

  // ── Optional coords ──
  if (!isOptionalFiniteNumber(p.lat)) {
    return { ok: false, error: "lat must be a finite number when provided" };
  }
  if (!isOptionalFiniteNumber(p.lng)) {
    return { ok: false, error: "lng must be a finite number when provided" };
  }

  // ── Emergency preparedness booleans ──
  if (!isOptionalBoolean(p.has_emergency_plan)) {
    return { ok: false, error: "has_emergency_plan must be a boolean when provided" };
  }
  if (!isOptionalBoolean(p.open_to_collaboration)) {
    return { ok: false, error: "open_to_collaboration must be a boolean when provided" };
  }

  // ── KAN-208 enrichment fields ──
  if (!isOptionalString(p.website_url, MAX_URL)) {
    return { ok: false, error: "website_url must be a string when provided" };
  }
  if (
    typeof p.website_url === "string" &&
    p.website_url.trim().length > 0 &&
    !/^https?:\/\//i.test(p.website_url.trim())
  ) {
    return { ok: false, error: "website_url must start with http:// or https://" };
  }
  if (!isOptionalString(p.primary_language, MAX_FREETEXT)) {
    return { ok: false, error: "primary_language must be a string when provided" };
  }
  if (!isOptionalString(p.denomination_affiliation, MAX_FREETEXT)) {
    return { ok: false, error: "denomination_affiliation must be a string when provided" };
  }
  if (
    p.congregation_size_range !== undefined &&
    p.congregation_size_range !== null &&
    !(CONGREGATION_SIZES as readonly string[]).includes(p.congregation_size_range as string)
  ) {
    return {
      ok: false,
      error: `congregation_size_range must be one of: ${CONGREGATION_SIZES.join(", ")}`,
    };
  }
  if (!isOptionalBoolean(p.show_contact_on_profile)) {
    return { ok: false, error: "show_contact_on_profile must be a boolean when provided" };
  }

  // ── needs[] / resources[] — same shape + cleanup as register ──
  let needs: string[] | null = null;
  if (p.needs !== undefined && p.needs !== null) {
    if (!Array.isArray(p.needs)) {
      return { ok: false, error: "needs must be an array of strings when provided" };
    }
    for (const n of p.needs) {
      if (typeof n !== "string") {
        return { ok: false, error: "needs must be an array of strings when provided" };
      }
    }
    const cleaned = (p.needs as string[]).map((s) => s.trim()).filter((s) => s.length > 0);
    needs = cleaned.length > 0 ? cleaned : null;
  }

  let resources: string[] | null = null;
  if (p.resources !== undefined && p.resources !== null) {
    if (!Array.isArray(p.resources)) {
      return { ok: false, error: "resources must be an array of strings when provided" };
    }
    for (const r of p.resources) {
      if (typeof r !== "string") {
        return { ok: false, error: "resources must be an array of strings when provided" };
      }
    }
    const cleaned = (p.resources as string[]).map((s) => s.trim()).filter((s) => s.length > 0);
    resources = cleaned.length > 0 ? cleaned : null;
  }

  // Optional → trimmed-or-null helper. Same posture as register.
  const optStr = (v: unknown): string | null => {
    if (v === undefined || v === null) return null;
    const trimmed = (v as string).trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  const type = (p.type as ChurchType | undefined) ?? null;
  const isUnderground = type === "underground";

  const row: UpdateChurchRow = {
    name: optStr(p.name),
    type,
    country: optStr(p.country),
    // UG strip: identical to register-church c.10167 invariant.
    // Critical for edits — a leader flipping from any other type TO
    // underground must NOT leave city/lat/lng on the row.
    city: isUnderground ? null : optStr(p.city),
    address: optStr(p.address),
    contact_name: optStr(p.contact_name),
    contact_email: optStr(p.contact_email),
    contact_phone: optStr(p.contact_phone),
    rag_status: (p.rag_status as RagStatus | undefined) ?? null,
    lat: isUnderground ? null : ((p.lat as number | undefined) ?? null),
    lng: isUnderground ? null : ((p.lng as number | undefined) ?? null),
    needs,
    resources,
    has_emergency_plan:
      typeof p.has_emergency_plan === "boolean" ? p.has_emergency_plan : null,
    open_to_collaboration:
      typeof p.open_to_collaboration === "boolean" ? p.open_to_collaboration : null,
    website_url: optStr(p.website_url),
    primary_language: optStr(p.primary_language),
    denomination_affiliation: optStr(p.denomination_affiliation),
    congregation_size_range:
      (p.congregation_size_range as CongregationSize | undefined) ?? null,
    show_contact_on_profile:
      typeof p.show_contact_on_profile === "boolean" ? p.show_contact_on_profile : null,
  };

  return { ok: true, church_id, row };
}

export function buildSuccessBody(churchId: string): UpdateChurchSuccessBody {
  return {
    success: true,
    church_id: churchId,
    message: "Church updated",
  };
}
