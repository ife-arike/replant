// KAN-12 create-account — handler factory (createHandler pattern).
//
// Mirrors check-email-available / register-church. Deps are injected so
// the orchestration is unit-testable without the Supabase Auth Admin API,
// without a real DB connection, and without Upstash / Resend.
//
// Response contract (SEC-mapped):
//   200 { userId: string }                            — happy path
//   400 { error: 'validation_error', message }        — payload reject
//   400 { error: 'user_already_exists' }              — Layer 3 finds duplicate
//   400 { error: 'LEADER_CAP_EXCEEDED' }              — capacity guard rejects
//   429 { error: ..., retry_after_seconds }           — rate-limit (per IP+email)
//   500 { error: 'internal_error' }                   — server-side fault (no raw
//                                                       Postgres / Auth Admin
//                                                       details leaked)
//
// Three-layer idempotency: this handler implements LAYER 3 per SPEC
// c.10175. Layer 1 (pre-check) and Layer 2 (post-error retry guard) are
// FE responsibilities on AccountSetupPage2Screen.

import {
  computeVerificationDeadline,
  ERROR_CODES,
  exceedsCapacity,
  parsePayload,
  rateLimitKey,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  type Role,
} from "./logic.ts";

export interface AuthUserRef {
  id: string;
  email: string;
}

export interface InsertPublicUserRow {
  auth_id: string;
  full_name: string;
  email: string;
  role: Role;
  church_id: string;
  anonymous: boolean;
  declaration_affirmed: true;
  declaration_date: string;
  verification_status: "pending";
  verification_deadline: string;
}

export interface Deps {
  // ─── Layer 3 duplicate detection ───
  /**
   * Look up an existing auth.users row by canonical lowercase email.
   * Returns null if none exists. The lookup is the gatekeeper for the
   * "auth user exists, public user does not" resume path.
   */
  findAuthUserByEmail(emailLower: string): Promise<AuthUserRef | null>;
  /**
   * Look up an existing public.users row by auth_id. Returns null if
   * none exists — the resume path.
   */
  findPublicUserByAuthId(authId: string): Promise<{ id: string } | null>;

  // ─── Step 1 — Auth create + compensating delete ───
  /**
   * Create the auth.users row via `supabase.auth.admin.createUser`.
   * MUST set `email_confirm: true` — onboarding doesn't run the email
   * confirmation flow at MVP; leaders are considered confirmed at
   * account creation.
   */
  createAuthUser(opts: { email: string; password: string }): Promise<AuthUserRef>;
  /**
   * Compensating delete for the auth.users row created earlier in this
   * request, when the subsequent INSERT fails. Best-effort: a failure
   * here is logged but does NOT change the response (the request already
   * failed; we just leak an orphan auth row that Layer 3 will resolve on
   * the next retry).
   */
  deleteAuthUser(authId: string): Promise<void>;

  // ─── Capacity guard ───
  countActiveUsersInChurch(churchId: string): Promise<number>;

  // ─── Step 2-5 — public.users INSERT (single statement, atomic by Postgres) ───
  insertPublicUser(row: InsertPublicUserRow): Promise<{ id: string }>;

  // ─── Step 6-7 — fire-and-forget Resend ───
  /**
   * Welcome email to the new leader. Failure logged warn, NOT awaited
   * (request returns success regardless). KAN-31 owns the template.
   */
  sendWelcomeEmail(opts: { email: string; firstName: string }): Promise<void>;
  /**
   * "New church registered" email to the Replant team, fired ONLY when
   * `isNewChurch === true` (the leader registered a fresh church in this
   * onboarding flow via KAN-13 loopback). Failure logged warn, NOT
   * awaited. KAN-31 owns the destination + template.
   */
  sendNewChurchEmail(opts: { churchId: string; leaderEmail: string; leaderFullName: string }): Promise<void>;

  // ─── Plumbing ───
  rateLimit(ip: string, emailLower: string): Promise<
    | { allowed: true; count: number }
    | { allowed: false; retryAfterSeconds: number }
  >;
  getIp(req: Request): string;
  now(): Date;
  log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>): void;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const errorRes = (status: number, code: string, message?: string) =>
  json(status, message ? { error: code, message } : { error: code });

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") {
        return errorRes(405, "method_not_allowed");
      }

      // Rate-limit consumes the bucket BEFORE body parse, BUT we need
      // the email to scope the key. Pull body first, then key.
      // A malformed body still ticks the rate-limit by IP-only (no
      // email available) — see fallback below.
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        // No email yet — use the IP-only bucket so spammers can't bypass
        // by sending malformed payloads to bypass the email-scoped key.
        const ip = deps.getIp(req);
        const ipOnlyRl = await deps.rateLimit(ip, "_invalid_body_");
        if (!ipOnlyRl.allowed) {
          return json(429, {
            error: "rate_limited",
            retry_after_seconds: ipOnlyRl.retryAfterSeconds,
          });
        }
        return errorRes(400, ERROR_CODES.VALIDATION_ERROR, "Request body must be valid JSON");
      }

      const parsed = parsePayload(body);
      if (!parsed.ok) {
        // Tick the rate-limit on validation failure too — same anti-probe
        // posture as the JSON-parse branch above. Scope by IP+best-email
        // we can recover from the payload (or `_invalid_payload_` if not).
        const probableEmail = extractProbableEmail(body) ?? "_invalid_payload_";
        const ip = deps.getIp(req);
        await deps.rateLimit(ip, probableEmail);
        return errorRes(400, ERROR_CODES.VALIDATION_ERROR, parsed.error);
      }
      const input = parsed.input;

      const ip = deps.getIp(req);
      const rl = await deps.rateLimit(ip, input.email);
      if (!rl.allowed) {
        deps.log("warn", "create_account_rate_limited", {
          ip_hash: hashIp(ip),
          email_hash: hashEmail(input.email),
          retry_after_seconds: rl.retryAfterSeconds,
        });
        return json(429, {
          error: "rate_limited",
          retry_after_seconds: rl.retryAfterSeconds,
        });
      }

      // ─── Layer 3 — duplicate detection ───
      //
      // Three possible states:
      //   (A) both rows exist  → user_already_exists, reject
      //   (B) only auth exists → resume mid-transaction (reuse authId,
      //       skip Step 1, proceed to capacity + INSERT)
      //   (C) neither exists   → fresh flow (Step 1 then 2-5)
      let existingAuth: AuthUserRef | null;
      try {
        existingAuth = await deps.findAuthUserByEmail(input.email);
      } catch (e) {
        deps.log("error", "create_account_auth_lookup_failed", {
          email_hash: hashEmail(input.email),
          message: (e as Error).message,
        });
        return errorRes(500, ERROR_CODES.INTERNAL_ERROR);
      }

      let existingPublic: { id: string } | null = null;
      if (existingAuth) {
        try {
          existingPublic = await deps.findPublicUserByAuthId(existingAuth.id);
        } catch (e) {
          deps.log("error", "create_account_public_lookup_failed", {
            email_hash: hashEmail(input.email),
            message: (e as Error).message,
          });
          return errorRes(500, ERROR_CODES.INTERNAL_ERROR);
        }
      }

      if (existingAuth && existingPublic) {
        // State (A) — both rows exist → reject.
        deps.log("info", "create_account_duplicate", {
          email_hash: hashEmail(input.email),
        });
        return errorRes(400, ERROR_CODES.USER_ALREADY_EXISTS);
      }

      // ─── Capacity guard ───
      //
      // Race window with concurrent submits is acknowledged in the
      // dispatch out-of-scope (DBA-side trigger is a follow-up). For
      // MVP, the count-then-INSERT race is bounded by the 3-req/hr
      // rate-limit per IP+email.
      let activeCount: number;
      try {
        activeCount = await deps.countActiveUsersInChurch(input.churchId);
      } catch (e) {
        deps.log("error", "create_account_capacity_check_failed", {
          email_hash: hashEmail(input.email),
          church_id: input.churchId,
          message: (e as Error).message,
        });
        return errorRes(500, ERROR_CODES.INTERNAL_ERROR);
      }
      if (exceedsCapacity(activeCount)) {
        deps.log("info", "create_account_capacity_exceeded", {
          email_hash: hashEmail(input.email),
          church_id: input.churchId,
          active_count: activeCount,
        });
        return errorRes(400, ERROR_CODES.LEADER_CAP_EXCEEDED);
      }

      // ─── Step 1 — Auth createUser (or resume) ───
      let authUserId: string;
      let authUserCreatedThisRun = false;
      if (existingAuth && !existingPublic) {
        // State (B) — resume path. Don't create a second auth row.
        authUserId = existingAuth.id;
        deps.log("info", "create_account_resume_from_auth", {
          email_hash: hashEmail(input.email),
        });
      } else {
        // State (C) — fresh flow.
        try {
          const created = await deps.createAuthUser({
            email: input.email,
            password: input.password,
          });
          authUserId = created.id;
          authUserCreatedThisRun = true;
        } catch (e) {
          deps.log("error", "create_account_auth_create_failed", {
            email_hash: hashEmail(input.email),
            message: (e as Error).message,
          });
          return errorRes(500, ERROR_CODES.INTERNAL_ERROR);
        }
      }

      // ─── Steps 2-5 — public.users INSERT ───
      const nowTs = deps.now();
      const row: InsertPublicUserRow = {
        auth_id: authUserId,
        full_name: input.fullName,
        email: input.email,
        role: input.role,
        church_id: input.churchId,
        anonymous: input.anonymous,
        declaration_affirmed: true,
        declaration_date: nowTs.toISOString(),
        verification_status: "pending",
        verification_deadline: computeVerificationDeadline(nowTs),
      };

      let inserted: { id: string };
      try {
        inserted = await deps.insertPublicUser(row);
      } catch (e) {
        // Compensating DELETE — only when we created the auth row in THIS
        // request. If we resumed an existing auth row (State B), leaving
        // it alone is correct: the next retry of Layer 3 will resolve.
        if (authUserCreatedThisRun) {
          try {
            await deps.deleteAuthUser(authUserId);
          } catch (delErr) {
            // Best-effort. Surface as a separate log line so OPS can
            // reconcile any rare orphan auth rows.
            deps.log("error", "create_account_compensating_delete_failed", {
              auth_id: authUserId,
              email_hash: hashEmail(input.email),
              message: (delErr as Error).message,
            });
          }
        }
        deps.log("error", "create_account_insert_failed", {
          email_hash: hashEmail(input.email),
          church_id: input.churchId,
          message: (e as Error).message,
        });
        return errorRes(500, ERROR_CODES.INTERNAL_ERROR);
      }

      // ─── Steps 6-7 — fire-and-forget Resend (NOT awaited) ───
      //
      // Failure here does not roll back account creation (COO c.10131).
      // OPS monitors Resend delivery failures via the warn logs.
      void deps.sendWelcomeEmail({ email: input.email, firstName: input.firstName })
        .catch((err) => {
          deps.log("warn", "create_account_welcome_email_failed", {
            email_hash: hashEmail(input.email),
            message: (err as Error).message,
          });
        });

      if (input.isNewChurch) {
        void deps.sendNewChurchEmail({
          churchId: input.churchId,
          leaderEmail: input.email,
          leaderFullName: input.fullName,
        })
          .catch((err) => {
            deps.log("warn", "create_account_new_church_email_failed", {
              email_hash: hashEmail(input.email),
              church_id: input.churchId,
              message: (err as Error).message,
            });
          });
      }

      deps.log("info", "create_account_success", {
        user_id: inserted.id,
        email_hash: hashEmail(input.email),
        church_id: input.churchId,
        resumed: !authUserCreatedThisRun && existingAuth !== null,
        is_new_church: input.isNewChurch,
        rate_count: rl.count,
      });

      return json(200, { userId: inserted.id });
    } catch (e) {
      deps.log("error", "create_account_unexpected", {
        message: (e as Error).message,
      });
      return errorRes(500, ERROR_CODES.INTERNAL_ERROR);
    }
  };
}

// ─── Best-effort email extraction from a malformed-but-object body, ───
// solely for rate-limit-key scoping. Returns null when no plausible
// email field is present — caller falls back to a sentinel.
function extractProbableEmail(body: unknown): string | null {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const e = (body as Record<string, unknown>).email;
    if (typeof e === "string" && e.length > 0 && e.length < 500) {
      return e.trim().toLowerCase();
    }
  }
  return null;
}

// Non-cryptographic hashes for logs — never log raw IPs or raw emails.
// djb2-8 chars; correlation possible across repeated attempts from the
// same source without leaking the source value itself.
function hashIp(ip: string): string {
  return djb2(ip);
}
function hashEmail(emailLower: string): string {
  return djb2(emailLower);
}
function djb2(s: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// Re-export for index.ts single-import.
export { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS, rateLimitKey };
