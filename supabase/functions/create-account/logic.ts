// create-account v4 — pure logic (validation, types, error codes).
//
// Per SME-reviewed orphan-prevention architecture (2026-06-14):
// create-account now owns the atomic write boundary for signup. The
// payload accepts (leader fields) + optional newChurch (when the leader
// just registered a church via the new validation-only register-church
// v6) or existing churchId (when the leader joined an existing church
// via ASP2 search). Mutually exclusive.
//
// IMPORTANT: the church validator block below (parseChurchPayload +
// types + constants) MIRRORS _shared/church-validation.ts in the repo
// and the equivalent block in register-church/logic.ts. The MCP deploy
// model doesn't honor cross-function _shared imports, so the validator
// is duplicated. If you change the rules, change all three copies and
// re-deploy both functions. SME panel 2026-06-14: drift here re-opens
// the orphan window.

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
  // Underground only — founder's brave/safe choice at signup. Default
  // false (safe). Immutable post-creation (admin-only change). Ignored
  // when type !== 'underground'.
  show_church_name: boolean | null;
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
  if (!isOptionalBoolean(p.show_church_name)) return { ok: false, error: "show_church_name must be a boolean when provided" };

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

  // Underground hardening (v8, Founder rulings 2026-06-19/20):
  //   - Force rag_status='red' server-side (don't trust FE).
  //   - Strip city/lat/lng/address (defense-in-depth on top of the
  //     underground_no_location CHECK).
  //   - show_church_name comes from FE; defaults FALSE (safe). Only
  //     valid for underground rows. Non-underground payloads ignore.
  const ragStatus: RagStatus = isUnderground ? "red" : (p.rag_status as RagStatus);

  const payload: ChurchPayload = {
    name: (p.name as string).trim(),
    type,
    country: (p.country as string).trim(),
    city: isUnderground ? null : optStr(p.city),
    address: isUnderground ? null : optStr(p.address),
    contact_name: (p.contact_name as string).trim(),
    contact_email: optStr(p.contact_email),
    contact_phone: optStr(p.contact_phone),
    rag_status: ragStatus,
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
    show_church_name: isUnderground
      ? (typeof p.show_church_name === "boolean" ? p.show_church_name : false)
      : null,
  };
  return { ok: true, payload };
}


// ──────────────────────────────────────────────────────────────────
// Leader validation + canonical create-account types
// ──────────────────────────────────────────────────────────────────

export const ROLES = [
  "pastor", "apostle", "prophet", "evangelist", "teacher",
  "elder", "bishop", "reverend", "intercessor", "psalmist",
  "ministry_leader", "other",
] as const;
export type Role = (typeof ROLES)[number];

export const ERROR_CODES = {
  USER_ALREADY_EXISTS: "user_already_exists",
  LEADER_CAP_EXCEEDED: "LEADER_CAP_EXCEEDED",
  VALIDATION_ERROR: "validation_error",
  INTERNAL_ERROR: "internal_error",
  CONTACT_EMAIL_TAKEN: "contact_email_taken",
  CHURCH_NOT_FOUND: "church_not_found",
  // v8 (Founder ruling #28, 2026-06-19) — idempotency key is REQUIRED on
  // every signup. Missing key returns 400 with this code.
  IDEMPOTENCY_KEY_REQUIRED: "idempotency_key_required",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const MAX_NAME_PART = 100;
export const MAX_EMAIL_LEADER = 320;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 64;
export const MAX_ROLE_LENGTH = 32;
// KAN-231 — personal phone is an optional fallback contact. Loose cap;
// admin tooling owns display normalization.
export const MAX_PHONE_LEADER = 40;

const EMAIL_RE_LEADER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 7-day window for skip-for-now leaders (Founder ruling — leaders must
// attach to a church within 7 days or be deactivated).
const SKIP_VERIFICATION_WINDOW_DAYS = 7;

export interface PendingParentClaim {
  name: string;
  city: string | null;
  country: string | null;
}

export interface CreateAccountPayload {
  // v8 — required for all signups (Founder ruling #28).
  idempotencyKey?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
  anonymous?: boolean;
  // Mutually exclusive — pass exactly one (or neither, for skip-for-now):
  churchId?: string | null;
  newChurch?: Record<string, unknown> | null;
  // Branch-flow extensions (2026-06-18). Only valid when newChurch.type === 'branch':
  //   - branchOfChurchId XOR pendingParentClaim (exactly one when type=branch).
  //   - branchOfChurchId resolves to a parentable church (main_campus / house_church /
  //     ministry / without_walls). The DB trigger backstops eligibility.
  // is_headquarters only valid when type is parentable (not branch/para/underground).
  branchOfChurchId?: string | null;
  pendingParentClaim?: PendingParentClaim | null;
  isHeadquarters?: boolean;
}

// v8 idempotency key format: 16-128 char printable ASCII. Permissive
// enough for UUIDs, ULIDs, FE-generated nonces; rejects empty + binary.
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_\-:.+/=]{16,128}$/;

export function isValidIdempotencyKey(v: unknown): v is string {
  return typeof v === "string" && IDEMPOTENCY_KEY_RE.test(v);
}

export function idempotencyCacheKey(rawKey: string): string {
  return `create-account:idemp:${rawKey}`;
}

export const IDEMPOTENCY_CACHE_TTL_SECONDS = 3600;

export interface ValidatedAccountInput {
  idempotencyKey: string;
  email: string;
  password: string;
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  includeMiddleName: boolean;
  role: Role;
  anonymous: boolean;
  churchId: string | null;
  newChurch: ChurchPayload | null;
  // Branch-flow extensions (2026-06-18)
  branchOfChurchId: string | null;
  pendingParentClaim: PendingParentClaim | null;
  isHeadquarters: boolean;
  // App-supplied users.verification_deadline (null when attached to a
  // church, ISO timestamp 7 days out when skip-for-now).
  userVerificationDeadline: string | null;
}

export type ParseResult =
  | { ok: true; input: ValidatedAccountInput }
  | { ok: false; error: string };

function isNonEmptyStringLeader(v: unknown, max: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

function parseOptionalStringLeader(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  if (v.length > max) return "";
  return v.trim();
}

function computeSkipVerificationDeadline(now: Date): string {
  const ms = SKIP_VERIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + ms).toISOString();
}

export function parsePayload(
  body: unknown,
  now: Date = new Date(),
  // v8 — idempotency key is resolved by the handler (Header > body) and
  // injected here. Required; handler returns IDEMPOTENCY_KEY_REQUIRED 400
  // before calling parsePayload when the key is missing.
  idempotencyKey: string = "",
): ParseResult {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const p = body as Record<string, unknown>;
  if (!isNonEmptyStringLeader(p.firstName, MAX_NAME_PART)) return { ok: false, error: "firstName is required" };
  if (!isNonEmptyStringLeader(p.lastName, MAX_NAME_PART)) return { ok: false, error: "lastName is required" };
  if (!isNonEmptyStringLeader(p.email, MAX_EMAIL_LEADER)) return { ok: false, error: "email is required" };
  const trimmedEmail = (p.email as string).trim();
  if (!EMAIL_RE_LEADER.test(trimmedEmail)) return { ok: false, error: "email is not a valid email address" };
  if (typeof p.password !== "string") return { ok: false, error: "password is required" };
  if (p.password.length < MIN_PASSWORD) return { ok: false, error: `password must be at least ${MIN_PASSWORD} characters` };
  if (p.password.length > MAX_PASSWORD) return { ok: false, error: `password must be at most ${MAX_PASSWORD} characters` };
  if (typeof p.role !== "string" || p.role.length > MAX_ROLE_LENGTH || !(ROLES as readonly string[]).includes(p.role)) {
    return { ok: false, error: `role must be one of: ${ROLES.join(", ")}` };
  }

  const churchId: string | null =
    typeof p.churchId === "string" && UUID_RE.test(p.churchId) ? p.churchId : null;
  const anonymous = typeof p.anonymous === "boolean" ? p.anonymous : false;

  // Validate the optional newChurch payload via the (inlined-mirrored)
  // canonical validator. Drift here re-opens the orphan window.
  let newChurch: ChurchPayload | null = null;
  if (p.newChurch !== undefined && p.newChurch !== null) {
    const churchParse = parseChurchPayload(p.newChurch);
    if (!churchParse.ok) {
      return { ok: false, error: `newChurch: ${churchParse.error}` };
    }
    newChurch = churchParse.payload;
  }

  // Mutual-exclusion guard — flat payload contract per BE SME ruling.
  if (newChurch !== null && churchId !== null) {
    return { ok: false, error: "supply either newChurch or churchId, not both" };
  }

  // ── Branch-flow extensions (2026-06-18) ──
  // Parse + validate optional branchOfChurchId / pendingParentClaim / isHeadquarters.
  // These fields are only valid alongside a newChurch with type='branch' (the FK +
  // claim path) or type IN parentable-set (HQ flag); the DB trigger backstops.
  let branchOfChurchId: string | null = null;
  if (typeof p.branchOfChurchId === "string" && UUID_RE.test(p.branchOfChurchId)) {
    branchOfChurchId = p.branchOfChurchId;
  }

  let pendingParentClaim: PendingParentClaim | null = null;
  if (p.pendingParentClaim !== undefined && p.pendingParentClaim !== null) {
    const claim = p.pendingParentClaim as Record<string, unknown>;
    if (typeof claim.name !== "string" || claim.name.trim().length === 0) {
      return { ok: false, error: "pendingParentClaim.name is required" };
    }
    if (claim.name.length > MAX_NAME) {
      return { ok: false, error: `pendingParentClaim.name must be <= ${MAX_NAME} chars` };
    }
    pendingParentClaim = {
      name: claim.name.trim(),
      city: typeof claim.city === "string" && claim.city.trim().length > 0 ? claim.city.trim() : null,
      country: typeof claim.country === "string" && claim.country.trim().length > 0 ? claim.country.trim() : null,
    };
  }

  const isHeadquarters = typeof p.isHeadquarters === "boolean" ? p.isHeadquarters : false;

  // Mutual-exclusion: cannot supply both branchOfChurchId and pendingParentClaim
  if (branchOfChurchId !== null && pendingParentClaim !== null) {
    return { ok: false, error: "supply either branchOfChurchId or pendingParentClaim, not both" };
  }

  // Branch fields only valid when registering a new church (not existing-church join or skip)
  if (newChurch === null && (branchOfChurchId !== null || pendingParentClaim !== null)) {
    return { ok: false, error: "branchOfChurchId/pendingParentClaim require newChurch" };
  }

  if (newChurch !== null) {
    if (newChurch.type === "branch") {
      if (branchOfChurchId === null && pendingParentClaim === null) {
        return { ok: false, error: "branch requires either branchOfChurchId or pendingParentClaim" };
      }
    } else if (branchOfChurchId !== null || pendingParentClaim !== null) {
      return { ok: false, error: "branchOfChurchId/pendingParentClaim only valid when newChurch.type=branch" };
    }
    // HQ-type-fence: branch, para_ministry, underground cannot be HQ
    if (isHeadquarters && (newChurch.type === "branch" || newChurch.type === "para_ministry" || newChurch.type === "underground")) {
      return { ok: false, error: `is_headquarters not allowed for type=${newChurch.type}` };
    }
  } else if (isHeadquarters) {
    return { ok: false, error: "isHeadquarters requires newChurch" };
  }

  const firstName = (p.firstName as string).trim();
  const lastName = (p.lastName as string).trim();
  const middleName = parseOptionalStringLeader(p.middleName, MAX_NAME_PART);
  const phone = parseOptionalStringLeader(p.phone, MAX_PHONE_LEADER);

  // KAN-229 — full_name single-space filtered join (Founder ruling
  // 2026-06-14 — no double space when middle empty).
  const fullName = [firstName, middleName, lastName]
    .filter(s => s.length > 0)
    .join(" ");

  // KAN-229 — include_middle_name defaults to false in schema. If the
  // leader typed a middle name, honor it across the network.
  const includeMiddleName = middleName.length > 0;

  // users.verification_deadline is the 7-day skip-for-now countdown.
  // Null when attached to a church (church_id is set) — attached
  // leaders wait on the church's verification, not a personal countdown.
  const userVerificationDeadline =
    churchId === null && newChurch === null
      ? computeSkipVerificationDeadline(now)
      : null;

  return {
    ok: true,
    input: {
      idempotencyKey,
      email: trimmedEmail.toLowerCase(),
      password: p.password,
      fullName,
      firstName,
      middleName,
      lastName,
      phone,
      includeMiddleName,
      role: p.role as Role,
      anonymous,
      churchId,
      newChurch,
      branchOfChurchId,
      pendingParentClaim,
      isHeadquarters,
      userVerificationDeadline,
    },
  };
}

export const RATE_LIMIT_MAX_REQUESTS = 3;
export const RATE_LIMIT_WINDOW_SECONDS = 3600;
// Per-IP-only rate limit (SEC-required) — defeats email-rotation
// enumeration. Looser budget than per-IP-per-email since one IP can
// legitimately host multiple leader signups (shared network at a
// training session).
export const PER_IP_RATE_LIMIT_MAX = 30;

export function rateLimitKey(ip: string, emailLower: string): string {
  return `create-account:ratelimit:${ip}:${emailLower}`;
}
export function perIpRateLimitKey(ip: string): string {
  return `create-account:ratelimit-ip:${ip}`;
}

export const CHURCH_LEADER_CAP = 2;
export function exceedsCapacity(n: number): boolean {
  return n >= CHURCH_LEADER_CAP;
}
