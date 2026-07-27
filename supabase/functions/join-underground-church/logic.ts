// join-underground-church — pure logic (validation, types, constants).
//
// Per Founder rulings 2026-06-19/20: this function is the ONLY path for
// a second leader to attach to an existing underground church at
// signup. They must possess the join code, distributed face-to-face by
// the founding leader. The discoverability vector (standard RPL ID +
// search-by-RPL-only on underground rows) lets people REACH but not
// JOIN — that gap is what this function enforces.

export const ERROR_CODES = {
  IDEMPOTENCY_KEY_REQUIRED: "idempotency_key_required",
  VALIDATION_ERROR: "validation_error",
  RATE_LIMITED: "rate_limited",
  // SINGLE generic error for ALL redemption-failure paths (Founder
  // ruling #4). Invalid code, consumed code, expired code, cap exceeded,
  // RPC internal error — all map to this string. The FE renders one
  // user-visible message: "That code did not match. Please check with
  // the leader who gave it to you."
  INVALID_OR_CONSUMED_CODE: "invalid_or_consumed_code",
  // 2026-06-20 Founder override of #4 for email-collision specifically:
  // a leader who reuses an email across Replant accounts gets a clear UX
  // instead of the cryptic "code didn't match." Trade: minor enumeration
  // leak (an attacker can probe whether an email is registered) for
  // dramatically better UX for a legitimate leader. Founder accepts.
  EMAIL_ALREADY_REGISTERED: "email_already_registered",
  INTERNAL_ERROR: "internal_error",
  METHOD_NOT_ALLOWED: "method_not_allowed",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ROLES = [
  "pastor", "apostle", "prophet", "evangelist", "teacher",
  "elder", "bishop", "reverend", "intercessor", "psalmist",
  "ministry_leader", "other",
] as const;
export type Role = (typeof ROLES)[number];

export const MAX_NAME_PART = 100;
export const MAX_EMAIL = 320;
export const MAX_PHONE = 40;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 64;
// Code shape illustrative `RPL-XXXX-NNNNN` (4 random A-Z + 5 digits;
// Founder ruling #2). Format check is permissive on alphanumerics +
// hyphens — actual validity is decided by the bcrypt compare in the
// RPC. We just keep payload bounded.
export const MIN_JOIN_CODE = 8;
export const MAX_JOIN_CODE = 64;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Idempotency key: 16-128 char printable ASCII (matches create-account v8).
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_\-:.+/=]{16,128}$/;

export function isValidIdempotencyKey(v: unknown): v is string {
  return typeof v === "string" && IDEMPOTENCY_KEY_RE.test(v);
}

export function idempotencyCacheKey(rawKey: string): string {
  return `join-underground:idemp:${rawKey}`;
}

export const IDEMPOTENCY_CACHE_TTL_SECONDS = 3600;

// Per-IP rate limit — Founder ruling #27: 5/hr per IP.
export const PER_IP_RATE_LIMIT_MAX = 5;
export const PER_IP_RATE_LIMIT_WINDOW_SECONDS = 3600;

export function perIpRateLimitKey(ip: string): string {
  return `join-underground:ratelimit-ip:${ip}`;
}

export interface JoinLeaderInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
  anonymous?: boolean;
}

export interface JoinPayload {
  idempotencyKey?: string;
  joinCode: string;
  leader: JoinLeaderInput;
}

export interface ValidatedJoinInput {
  idempotencyKey: string;
  joinCode: string;
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
}

export type ParseResult =
  | { ok: true; input: ValidatedJoinInput }
  | { ok: false; error: string };

function isNonEmptyString(v: unknown, max: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

function parseOptionalString(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  if (v.length > max) return "";
  return v.trim();
}

export function parsePayload(body: unknown, idempotencyKey: string = ""): ParseResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const p = body as Record<string, unknown>;

  // joinCode — bound length; trim whitespace and uppercase for
  // consistency. (The bcrypt compare in the RPC is exact on the raw
  // string we pass — so the founding leader and the joining leader
  // must agree on canonical form. Uppercase + trim is the conservative
  // canonical form.)
  if (typeof p.joinCode !== "string") {
    return { ok: false, error: "joinCode is required" };
  }
  const rawCode = p.joinCode.trim();
  if (rawCode.length < MIN_JOIN_CODE || rawCode.length > MAX_JOIN_CODE) {
    return { ok: false, error: "joinCode is required" };
  }
  const joinCode = rawCode.toUpperCase();

  if (p.leader === undefined || p.leader === null || typeof p.leader !== "object" || Array.isArray(p.leader)) {
    return { ok: false, error: "leader is required" };
  }
  const l = p.leader as Record<string, unknown>;

  if (!isNonEmptyString(l.firstName, MAX_NAME_PART)) return { ok: false, error: "leader.firstName is required" };
  if (!isNonEmptyString(l.lastName, MAX_NAME_PART)) return { ok: false, error: "leader.lastName is required" };
  if (!isNonEmptyString(l.email, MAX_EMAIL)) return { ok: false, error: "leader.email is required" };
  const trimmedEmail = (l.email as string).trim();
  if (!EMAIL_RE.test(trimmedEmail)) return { ok: false, error: "leader.email is not a valid email address" };
  if (typeof l.password !== "string") return { ok: false, error: "leader.password is required" };
  if (l.password.length < MIN_PASSWORD) return { ok: false, error: `leader.password must be at least ${MIN_PASSWORD} characters` };
  if (l.password.length > MAX_PASSWORD) return { ok: false, error: `leader.password must be at most ${MAX_PASSWORD} characters` };
  if (typeof l.role !== "string" || !(ROLES as readonly string[]).includes(l.role)) {
    return { ok: false, error: `leader.role must be one of: ${ROLES.join(", ")}` };
  }

  const firstName = (l.firstName as string).trim();
  const lastName = (l.lastName as string).trim();
  const middleName = parseOptionalString(l.middleName, MAX_NAME_PART);
  const phone = parseOptionalString(l.phone, MAX_PHONE);
  const anonymous = typeof l.anonymous === "boolean" ? l.anonymous : false;

  const fullName = [firstName, middleName, lastName].filter(s => s.length > 0).join(" ");
  const includeMiddleName = middleName.length > 0;

  return {
    ok: true,
    input: {
      idempotencyKey,
      joinCode,
      email: trimmedEmail.toLowerCase(),
      password: l.password,
      fullName,
      firstName,
      middleName,
      lastName,
      phone,
      includeMiddleName,
      role: l.role as Role,
      anonymous,
    },
  };
}
