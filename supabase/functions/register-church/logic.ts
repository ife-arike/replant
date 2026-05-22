// KAN-13 register-church — pure logic (validation + types + canonical enums).
//
// Pulled out of the handler so it's unit-testable without the Deno runtime
// or a Supabase client. The handler stays thin: validate via parsePayload,
// insert via deps.insertChurch, return the canonical success response.
//
// Contract source: KAN-13 c.10167 (BE comment). Live DB schema verified
// 2026-05-19; churches.address column added by migration
// 20260519140000_kan13_churches_add_address.sql.

// ─── Canonical enums (mirror live `public.churches.type` + `rag_status_enum`) ───
//
// `church_type` enum in the DB also contains `para_ministry`, added after
// KAN-13 was groomed. Per ticket scope, register-church accepts the 6 types
// listed in c.10167 only — `para_ministry` is out of scope here and would
// need a separate FE option + sign-off before being whitelisted.
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

// ─── Payload + insert row types ───

export interface RegisterChurchPayload {
  name: string;
  type: ChurchType;
  country: string;
  city?: string | null;
  address?: string | null;
  // KAN-13 v2 — contact_name is required; admin-only; never surfaced to
  // non-admin leaders (column-level guard mirrors contact_email).
  contact_name: string;
  // KAN-13 v2 — contact_email is now optional at the field level. The
  // at-least-one rule below enforces that *one of* email or phone is
  // present. When provided, contact_email must still pass EMAIL_RE.
  contact_email?: string | null;
  contact_phone?: string | null;
  rag_status: RagStatus;
  state_declaration: string;
  lat?: number | null;
  lng?: number | null;
  // KAN-14: optional list of needs/offerings free-text strings. FE submits
  // already-trimmed + empty-filtered. BE re-normalises defensively. Maps to
  // `public.churches.needs text[] NULL`.
  needs?: string[] | null;
  // Finalization fix 7 — emergency preparedness self-report. Both
  // nullable: leaders are not required to answer at registration. Maps
  // to public.churches.has_emergency_plan / open_to_collaboration
  // (migration 20260522000002_kan_churches_emergency_plan_v1).
  has_emergency_plan?: boolean | null;
  open_to_collaboration?: boolean | null;
}

// Shape passed to deps.insertChurch — has all the columns the BE writes.
// verification_status, verification_deadline, is_active, verified, created_at,
// church_code are server-side defaults / explicit values; not on this row.
export interface InsertChurchRow {
  name: string;
  type: ChurchType;
  country: string;
  city: string | null;
  address: string | null;
  contact_name: string;
  // KAN-13 v2 — both nullable on the row now (one of the two must be
  // non-null per parsePayload's at-least-one validation upstream).
  contact_email: string | null;
  contact_phone: string | null;
  rag_status: RagStatus;
  state_declaration: string;
  lat: number | null;
  lng: number | null;
  needs: string[] | null;
  // Finalization fix 7 — null when leader skipped the question.
  has_emergency_plan: boolean | null;
  open_to_collaboration: boolean | null;
}

export interface RegisterChurchSuccessBody {
  success: true;
  church_id: string;
  verification_status: "pending";
  verification_deadline: string;
  message: string;
}

// ─── Field-length caps (defense-in-depth; mirrors text-column ceilings) ───
//
// Postgres `text` is unbounded, but unbounded BE accepts of arbitrary
// length open the door to DOS via a 10 MB payload. Caps match the FE
// pickers (country list + RAG radio) and a generous human-input ceiling
// for free-text fields.
const MAX_NAME = 200;
const MAX_COUNTRY = 100;
const MAX_CITY = 120;
const MAX_ADDRESS = 250;
const MAX_EMAIL = 320; // RFC 5321 practical max
const MAX_PHONE = 32;
const MAX_DECLARATION = 4000;

// Basic email shape — single @, non-empty local part, non-empty domain with
// at least one dot. Per c.10167: "basic regex, not exhaustive."
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

export type ParseResult =
  | { ok: true; row: InsertChurchRow }
  | { ok: false; error: string };

/**
 * Validate + normalise the JSON body. Returns a ready-to-insert row or
 * a single `error` string suitable for a 400 body.
 *
 * Underground type-coercion: when `type === 'underground'`, `city`, `lat`,
 * and `lng` are force-set to null on the insert row regardless of what the
 * payload contained. This is the c.10167 invariant: "absent for underground
 * — not sent, not written." `address` is NOT stripped (c.10167 doesn't list
 * it as UG-restricted); the FE simply doesn't collect it on the UG path, so
 * in practice the value is undefined for UG submissions anyway.
 */
export function parsePayload(body: unknown): ParseResult {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const p = body as Record<string, unknown>;

  // Required strings
  if (!isNonEmptyString(p.name, MAX_NAME)) {
    return { ok: false, error: "name is required" };
  }
  if (!isNonEmptyString(p.country, MAX_COUNTRY)) {
    return { ok: false, error: "country is required" };
  }
  // KAN-13 v2 — contact_name required (admin-only PII; column-level
  // guard inherited from contact_email/contact_phone).
  if (!isNonEmptyString(p.contact_name, MAX_NAME)) {
    return { ok: false, error: "contact_name is required" };
  }
  // KAN-13 v2 — at-least-one rule. At least one of contact_email or
  // contact_phone must be non-empty. Serves leaders who have a phone
  // but not an email, and vice versa. When email IS provided, its
  // format must still pass EMAIL_RE.
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

  // Required enums
  if (typeof p.type !== "string" || !(CHURCH_TYPES as readonly string[]).includes(p.type)) {
    return {
      ok: false,
      error: `type must be one of: ${CHURCH_TYPES.join(", ")}`,
    };
  }
  if (typeof p.rag_status !== "string" || !(RAG_STATUSES as readonly string[]).includes(p.rag_status)) {
    return {
      ok: false,
      error: `rag_status must be one of: ${RAG_STATUSES.join(", ")}`,
    };
  }

  // Optional strings
  if (!isOptionalString(p.city, MAX_CITY)) {
    return { ok: false, error: "city must be a string when provided" };
  }
  if (!isOptionalString(p.address, MAX_ADDRESS)) {
    return { ok: false, error: "address must be a string when provided" };
  }
  // contact_email is now optional at the field level (the at-least-one
  // rule above is the gating check). Still type-validate when provided.
  if (!isOptionalString(p.contact_email, MAX_EMAIL)) {
    return { ok: false, error: "contact_email must be a string when provided" };
  }
  if (!isOptionalString(p.contact_phone, MAX_PHONE)) {
    return { ok: false, error: "contact_phone must be a string when provided" };
  }

  // Optional coords
  if (!isOptionalFiniteNumber(p.lat)) {
    return { ok: false, error: "lat must be a finite number when provided" };
  }
  if (!isOptionalFiniteNumber(p.lng)) {
    return { ok: false, error: "lng must be a finite number when provided" };
  }

  // Finalization fix 7 — emergency preparedness booleans. Both optional;
  // accepted values are true / false / null / undefined (absent). Anything
  // else is a type error.
  if (!isOptionalBoolean(p.has_emergency_plan)) {
    return { ok: false, error: "has_emergency_plan must be a boolean when provided" };
  }
  if (!isOptionalBoolean(p.open_to_collaboration)) {
    return { ok: false, error: "open_to_collaboration must be a boolean when provided" };
  }

  // Optional needs[] — KAN-14. Absent / null → null. Present → must be an
  // array of strings; each entry is trimmed + empty-string-filtered as
  // defense-in-depth (the FE already does this, but if a bad client posts
  // ['', '  ', 'manpower'] we want a clean ['manpower'] in the row).
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

  const type = p.type as ChurchType;
  const isUnderground = type === "underground";

  // Helper that empty-strings on optional-text fields become null in the row.
  // A blank "city: ''" sent by the FE shouldn't write '' to the column.
  const optStr = (v: unknown): string | null => {
    if (v === undefined || v === null) return null;
    const trimmed = (v as string).trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  const row: InsertChurchRow = {
    name: (p.name as string).trim(),
    type,
    country: (p.country as string).trim(),
    // UG strip: c.10167 "absent for underground — not sent, not written"
    city: isUnderground ? null : optStr(p.city),
    address: optStr(p.address),
    // KAN-13 v2 — contact_name is admin-only PII; NOT stripped on UG
    // (the verification team needs to reach the underground leader).
    contact_name: (p.contact_name as string).trim(),
    contact_email: optStr(p.contact_email),
    contact_phone: optStr(p.contact_phone),
    rag_status: p.rag_status as RagStatus,
    state_declaration: (p.state_declaration as string).trim(),
    lat: isUnderground ? null : ((p.lat as number | undefined) ?? null),
    lng: isUnderground ? null : ((p.lng as number | undefined) ?? null),
    needs,
    has_emergency_plan: typeof p.has_emergency_plan === "boolean" ? p.has_emergency_plan : null,
    open_to_collaboration: typeof p.open_to_collaboration === "boolean" ? p.open_to_collaboration : null,
  };

  return { ok: true, row };
}

/**
 * Convention used by the live UAT seed + matches existing churches in the
 * project: verification_deadline = now() + 90 days. The column is NOT NULL
 * with no DB default, so the BE must set it explicitly.
 */
export function computeVerificationDeadline(now: Date): string {
  const deadline = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  return deadline.toISOString();
}

export function buildSuccessBody(
  churchId: string,
  verificationDeadline: string,
): RegisterChurchSuccessBody {
  return {
    success: true,
    church_id: churchId,
    verification_status: "pending",
    verification_deadline: verificationDeadline,
    message: "Church registered — pending verification",
  };
}
