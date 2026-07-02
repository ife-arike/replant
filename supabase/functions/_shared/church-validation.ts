// _shared/church-validation.ts
//
// Canonical church payload validation. Single source of truth for:
//   - register-church v6 (pre-flight validation only, no DB write)
//   - create-account v4 (validates the optional `newChurch` payload before
//     passing it to the create_account_atomic RPC for atomic write)
//
// SME panel (SEC + DBA + BA + BE) 2026-06-14 ruled: drift between the
// pre-flight validator and the atomic-write validator re-opens the orphan
// window we just closed. Single source of truth is non-negotiable.
//
// Architecture: orphan-prevention atomic create-account
// (see .claude/plans/orphan-prevention-architecture.md)
//
// Note on underground stripping: this module enforces "underground = no
// city/lat/lng" at validation time. The PL/pgSQL `create_account_atomic`
// function relies on this guarantee — it does NOT re-strip. If you ever
// add a non-FE path that calls create-account directly without passing
// through this validator, ADD a defense in the function.

export const CHURCH_TYPES = [
  "main_campus",
  "branch",
  "house_church",
  "ministry",
  "without_walls",
  "underground",
  "para_ministry",
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

export interface ChurchPayload {
  name: string;
  type: ChurchType;
  country: string;
  city: string | null;
  address: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  rag_status: RagStatus;
  state_declaration: string;
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

const MAX_NAME = 200;
const MAX_COUNTRY = 100;
const MAX_CITY = 120;
const MAX_ADDRESS = 250;
const MAX_EMAIL = 320;
const MAX_PHONE = 32;
const MAX_DECLARATION = 4000;
const MAX_URL = 500;
const MAX_FREETEXT = 500;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmptyString(v: unknown, max: number): v is string {
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

export type ChurchParseResult =
  | { ok: true; payload: ChurchPayload }
  | { ok: false; error: string };

export function parseChurchPayload(body: unknown): ChurchParseResult {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Church payload must be a JSON object" };
  }
  const p = body as Record<string, unknown>;
  if (!isNonEmptyString(p.name, MAX_NAME)) return { ok: false, error: "name is required" };
  if (!isNonEmptyString(p.country, MAX_COUNTRY)) return { ok: false, error: "country is required" };
  if (!isNonEmptyString(p.contact_name, MAX_NAME)) return { ok: false, error: "contact_name is required" };
  const hasEmail = isNonEmptyString(p.contact_email, MAX_EMAIL);
  const hasPhone = isNonEmptyString(p.contact_phone, MAX_PHONE);
  if (!hasEmail && !hasPhone) {
    return { ok: false, error: "at least one of contact_email or contact_phone is required" };
  }
  if (hasEmail && !EMAIL_RE.test((p.contact_email as string).trim())) {
    return { ok: false, error: "contact_email is not a valid email address" };
  }
  if (!isNonEmptyString(p.state_declaration, MAX_DECLARATION)) {
    return { ok: false, error: "state_declaration is required" };
  }
  if (typeof p.type !== "string" || !(CHURCH_TYPES as readonly string[]).includes(p.type)) {
    return { ok: false, error: `type must be one of: ${CHURCH_TYPES.join(", ")}` };
  }
  if (typeof p.rag_status !== "string" || !(RAG_STATUSES as readonly string[]).includes(p.rag_status)) {
    return { ok: false, error: `rag_status must be one of: ${RAG_STATUSES.join(", ")}` };
  }
  if (!isOptionalString(p.city, MAX_CITY)) return { ok: false, error: "city must be a string when provided" };
  if (!isOptionalString(p.address, MAX_ADDRESS)) return { ok: false, error: "address must be a string when provided" };
  if (!isOptionalString(p.contact_email, MAX_EMAIL)) return { ok: false, error: "contact_email must be a string when provided" };
  if (!isOptionalString(p.contact_phone, MAX_PHONE)) return { ok: false, error: "contact_phone must be a string when provided" };
  if (!isOptionalFiniteNumber(p.lat)) return { ok: false, error: "lat must be a finite number when provided" };
  if (!isOptionalFiniteNumber(p.lng)) return { ok: false, error: "lng must be a finite number when provided" };
  if (!isOptionalBoolean(p.has_emergency_plan)) return { ok: false, error: "has_emergency_plan must be a boolean when provided" };
  if (!isOptionalBoolean(p.open_to_collaboration)) return { ok: false, error: "open_to_collaboration must be a boolean when provided" };
  if (!isOptionalString(p.website_url, MAX_URL)) return { ok: false, error: "website_url must be a string when provided" };
  if (typeof p.website_url === "string" && p.website_url.trim().length > 0 && !/^https?:\/\//i.test(p.website_url.trim())) {
    return { ok: false, error: "website_url must start with http:// or https://" };
  }
  if (!isOptionalString(p.primary_language, MAX_FREETEXT)) return { ok: false, error: "primary_language must be a string when provided" };
  if (!isOptionalString(p.denomination_affiliation, MAX_FREETEXT)) return { ok: false, error: "denomination_affiliation must be a string when provided" };
  if (
    p.congregation_size_range !== undefined &&
    p.congregation_size_range !== null &&
    !(CONGREGATION_SIZES as readonly string[]).includes(p.congregation_size_range as string)
  ) {
    return { ok: false, error: `congregation_size_range must be one of: ${CONGREGATION_SIZES.join(", ")}` };
  }
  if (!isOptionalBoolean(p.show_contact_on_profile)) return { ok: false, error: "show_contact_on_profile must be a boolean when provided" };

  let needs: string[] | null = null;
  if (p.needs !== undefined && p.needs !== null) {
    if (!Array.isArray(p.needs)) return { ok: false, error: "needs must be an array of strings when provided" };
    for (const n of p.needs) if (typeof n !== "string") return { ok: false, error: "needs must be an array of strings when provided" };
    const cleaned = (p.needs as string[]).map((s) => s.trim()).filter((s) => s.length > 0);
    needs = cleaned.length > 0 ? cleaned : null;
  }
  let resources: string[] | null = null;
  if (p.resources !== undefined && p.resources !== null) {
    if (!Array.isArray(p.resources)) return { ok: false, error: "resources must be an array of strings when provided" };
    for (const r of p.resources) if (typeof r !== "string") return { ok: false, error: "resources must be an array of strings when provided" };
    const cleaned = (p.resources as string[]).map((s) => s.trim()).filter((s) => s.length > 0);
    resources = cleaned.length > 0 ? cleaned : null;
  }

  const type = p.type as ChurchType;
  const isUnderground = type === "underground";
  const optStr = (v: unknown): string | null => {
    if (v === undefined || v === null) return null;
    const trimmed = (v as string).trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  const payload: ChurchPayload = {
    name: (p.name as string).trim(),
    type,
    country: (p.country as string).trim(),
    city: isUnderground ? null : optStr(p.city),
    address: optStr(p.address),
    contact_name: (p.contact_name as string).trim(),
    contact_email: optStr(p.contact_email),
    contact_phone: optStr(p.contact_phone),
    rag_status: p.rag_status as RagStatus,
    state_declaration: (p.state_declaration as string).trim(),
    lat: isUnderground ? null : ((p.lat as number | undefined) ?? null),
    lng: isUnderground ? null : ((p.lng as number | undefined) ?? null),
    needs,
    resources,
    has_emergency_plan: typeof p.has_emergency_plan === "boolean" ? p.has_emergency_plan : null,
    open_to_collaboration: typeof p.open_to_collaboration === "boolean" ? p.open_to_collaboration : null,
    website_url: optStr(p.website_url),
    primary_language: optStr(p.primary_language),
    denomination_affiliation: optStr(p.denomination_affiliation),
    congregation_size_range: (p.congregation_size_range as CongregationSize | undefined) ?? null,
    show_contact_on_profile: typeof p.show_contact_on_profile === "boolean" ? p.show_contact_on_profile : null,
  };
  return { ok: true, payload };
}
