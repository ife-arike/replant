// Type definitions duplicated locally rather than imported from /types/heartcry.ts
// so the edge runtime bundle has no out-of-tree imports to resolve. Must stay in
// lockstep with /types/heartcry.ts (the canonical FE source). Both derive from
// the locked KAN-66 contract.

export type HeartcrySeverity =
  | "active_persecution"
  | "urgent"
  | "serious"
  | "ongoing"
  | "informational";

export type HeartcryRequestType =
  | "prayer"
  | "practical_support"
  | "guidance"
  | "just_to_be_heard";

// Severity enum values pulled from live DB recon (severity_level enum, KAN-66
// HALT comment 11096). Order is the live enumsortorder.
export const ALLOWED_SEVERITIES: ReadonlySet<HeartcrySeverity> = new Set([
  "active_persecution",
  "urgent",
  "serious",
  "ongoing",
  "informational",
]);

export const ALLOWED_REQUEST_TYPES: ReadonlySet<HeartcryRequestType> = new Set([
  "prayer",
  "practical_support",
  "guidance",
  "just_to_be_heard",
]);

// DB-level enum values (verification_status_enum). The API-layer translation
// (verified → "active") is auth-status-check's lane; this function only checks
// the DB value directly.
export type DbVerificationStatus = "pending" | "verified" | "deactivated";

export interface HeartcrySubmitterRow {
  id: string;
  church_id: string;
  verification_status: DbVerificationStatus;
}

export interface ValidatedBody {
  content: string; // trimmed, non-empty
  severity: HeartcrySeverity;
  request_type: HeartcryRequestType[] | null;
}

export type ValidationResult =
  | { ok: true; body: ValidatedBody }
  | { ok: false; detail: string };

// Reasonable upper bound — discourages accidental dump of huge plaintext that
// would blow through pgp_sym_encrypt limits and produce inconvenient ciphertext.
// FE form's char counter (KAN-64) is the soft cap; this is the hard cap.
export const MAX_CONTENT_LENGTH = 10_000;

export function validateBody(input: unknown): ValidationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, detail: "Request body must be a JSON object." };
  }
  const obj = input as Record<string, unknown>;

  if (typeof obj.content !== "string") {
    return { ok: false, detail: "content is required and must be a string." };
  }
  const content = obj.content.trim();
  if (content.length === 0) {
    return { ok: false, detail: "content must not be empty after trim." };
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return {
      ok: false,
      detail: `content exceeds the maximum length of ${MAX_CONTENT_LENGTH} characters.`,
    };
  }

  if (
    typeof obj.severity !== "string" ||
    !ALLOWED_SEVERITIES.has(obj.severity as HeartcrySeverity)
  ) {
    return {
      ok: false,
      detail:
        "severity must be one of: active_persecution, urgent, serious, ongoing, informational.",
    };
  }
  const severity = obj.severity as HeartcrySeverity;

  let request_type: HeartcryRequestType[] | null;
  if (obj.request_type === null || obj.request_type === undefined) {
    request_type = null;
  } else if (Array.isArray(obj.request_type)) {
    if (obj.request_type.length === 0) {
      // Empty array is treated equivalently to null per AC ("empty array or null
      // both valid") — normalize to null at the storage boundary so downstream
      // queries don't have to distinguish.
      request_type = null;
    } else {
      const seen = new Set<string>();
      for (const v of obj.request_type) {
        if (typeof v !== "string" || !ALLOWED_REQUEST_TYPES.has(v as HeartcryRequestType)) {
          return {
            ok: false,
            detail:
              "request_type entries must be one of: prayer, practical_support, guidance, just_to_be_heard.",
          };
        }
        if (seen.has(v)) {
          return { ok: false, detail: "request_type entries must be unique." };
        }
        seen.add(v);
      }
      request_type = obj.request_type as HeartcryRequestType[];
    }
  } else {
    return {
      ok: false,
      detail: "request_type must be an array of allowed values, null, or omitted.",
    };
  }

  return { ok: true, body: { content, severity, request_type } };
}

export function isUserVerified(row: HeartcrySubmitterRow): boolean {
  return row.verification_status === "verified";
}
