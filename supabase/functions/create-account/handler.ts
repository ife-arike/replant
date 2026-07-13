// create-account v4 — handler factory.
//
// Per SME-reviewed orphan-prevention architecture (2026-06-14): this
// function owns the atomic signup write. Church creation moves out of
// register-church (now validation-only at v6) and into this function's
// single RPC call to public.create_account_atomic.
//
// Flow:
//   1. Rate-limit per-IP (SEC) + per-IP-per-email
//   2. Parse + validate payload (leader + optional newChurch / churchId)
//   3. Find existing auth.users by email; if found, find public.users by auth_id
//      - both exist → USER_ALREADY_EXISTS
//      - auth exists, public missing → resume path (use existing authId,
//        DO NOT comp-delete on RPC failure since we didn't create it)
//      - neither → createAuthUser, set created=true
//   4. Call createAccountAtomic(authId, leader, newChurch, churchId)
//   5. Map RPC errors back to API error codes via PG ERRCODE
//      - on failure AND created=true → comp-delete auth user
//   6. Fire welcome email + new-church email (fire-and-forget)
//   7. Return 200 { userId, churchId }

import {
  ERROR_CODES,
  idempotencyCacheKey,
  IDEMPOTENCY_CACHE_TTL_SECONDS,
  isValidIdempotencyKey,
  parsePayload,
  rateLimitKey,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  type Role,
} from "./logic.ts";

export interface AuthUserRef { id: string; email: string; }

// PostgrestError-shaped — what supabase-js surfaces on rpc() failure.
export interface RpcError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}

export interface CreateAccountAtomicResult {
  userId: string;
  churchId: string | null;
}

export interface Deps {
  findAuthUserByEmail(e: string): Promise<AuthUserRef | null>;
  findPublicUserByAuthId(id: string): Promise<{ id: string } | null>;
  createAuthUser(o: { email: string; password: string }): Promise<AuthUserRef>;
  deleteAuthUser(id: string): Promise<void>;
  // The single atomic write — invokes public.create_account_atomic.
  // p_new_church / p_existing_church_id are mutually exclusive at the
  // call site; the function raises P0007 if both are passed (programming
  // guard; FE never reaches that state).
  createAccountAtomic(
    authId: string,
    leader: Record<string, unknown>,
    newChurch: Record<string, unknown> | null,
    existingChurchId: string | null,
    // Branch-flow extensions (2026-06-18). Defaults preserve v3 behavior.
    branchOfChurchId?: string | null,
    pendingParentClaim?: Record<string, unknown> | null,
    isHeadquarters?: boolean,
  ): Promise<CreateAccountAtomicResult>;
  // Branched welcome-email copy. `kind` drives which copy variant fires;
  // `daysRemaining` is the count to surface in the pending-church variant
  // (7 for skip; null for verified-church). `churchType` drives the
  // "church" → "organization" conditional swap for para-ministry (CONTENT F6,
  // 2026-06-18). Null when no church attached (skip path).
  sendWelcomeEmail(o: {
    email: string;
    firstName: string;
    // KAN-80 G14 — public.users.id anchoring the email_log row.
    userId: string;
    // v8 — added "underground_pending" kind (Founder ruling #5,
    // CONTENT B2). Generic body, no church/role/region/country
    // reference. Used for underground founders AND underground join-by-code
    // second leaders. Identical generic message — email channel must not
    // reveal underground membership.
    kind: "skip" | "pending_church" | "verified_church" | "underground_pending";
    daysRemaining: number | null;
    churchType: string | null;
  }): Promise<void>;
  // Replaces getChurchContactEmail: same contact_email lookup plus the
  // fields needed to drive the welcome-email kind + dynamic days. Returns
  // null on lookup failure so the handler can degrade gracefully.
  getChurchInfo(id: string): Promise<{
    contact_email: string | null;
    verification_status: string;
    verification_deadline: string | null;
  } | null>;
  sendNewChurchEmail(o: {
    churchId: string;
    leaderEmail: string;
    leaderFullName: string;
    // KAN-80 G14 — acting leader's public.users.id (triggered_by forensics;
    // the admin-notify row itself anchors on idempotency_key notify_t36:<churchId>).
    triggeredByUserId: string;
  }): Promise<void>;
  rateLimit(ip: string, email: string): Promise<
    | { allowed: true; count: number }
    | { allowed: false; retryAfterSeconds: number }
    | { allowed: false; backendError: true }
  >;
  // Per-IP-only rate limit (SEC-required) — defeats email-rotation
  // enumeration. Looser budget than per-IP-per-email.
  perIpRateLimit(ip: string): Promise<
    | { allowed: true; count: number }
    | { allowed: false; retryAfterSeconds: number }
    | { allowed: false; backendError: true }
  >;
  // v8 idempotency cache (Founder ruling #28). cacheGet returns the
  // cached JSON-encoded response body on replay (status always 200 since
  // we only cache successful 200s); null on miss or backend failure.
  // cacheSet stores the response body string (caller serializes) with
  // TTL. On Upstash backend failure, cacheSet swallows so the live
  // response still reaches the client.
  idempotencyCacheGet(key: string): Promise<string | null>;
  idempotencyCacheSet(key: string, value: string, ttlSeconds: number): Promise<void>;
  getIp(req: Request): string;
  now(): Date;
  log(l: "info" | "warn" | "error", e: string, f: Record<string, unknown>): void;
}

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const err = (s: number, c: string, m?: string) =>
  json(s, m ? { error: c, message: m } : { error: c });

function djb2(s: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

function probEmail(b: unknown): string | null {
  if (b && typeof b === "object" && !Array.isArray(b)) {
    const e = (b as Record<string, unknown>).email;
    if (typeof e === "string" && e.length > 0 && e.length < 500) return e.trim().toLowerCase();
  }
  return null;
}

// ── ERRCODE → API error mapping ─────────────────────────────────────
//
// Returns the API-facing { status, errorCode, message? } for a given
// PostgrestError-shaped error from create_account_atomic. Order matters
// — check unique-violation constraints first (more specific) before
// generic SQLSTATEs.
interface MappedError {
  status: number;
  errorCode: string;
  message?: string;
}

function mapRpcError(e: RpcError): MappedError {
  const code = e.code ?? "";
  const details = e.details ?? "";
  const message = e.message ?? "";
  const haystack = `${message} ${details}`;

  // Unique violations — inspect constraint name
  if (code === "23505") {
    if (haystack.includes("churches_contact_email_unique_excl_campus")) {
      return {
        status: 409,
        errorCode: ERROR_CODES.CONTACT_EMAIL_TAKEN,
        message:
          "This email is already registered to another church. If this is your parent campus, change your church type to Main Campus or Branch. Otherwise use a different contact email.",
      };
    }
    if (haystack.includes("users_email")) {
      // Shouldn't fire — pre-check covers this case. If it does, it's a
      // race: a competing signup landed between the pre-check and the
      // atomic write.
      return { status: 400, errorCode: ERROR_CODES.USER_ALREADY_EXISTS };
    }
    return { status: 400, errorCode: ERROR_CODES.VALIDATION_ERROR, message: "Duplicate value." };
  }

  // PL/pgSQL RAISE EXCEPTION ... USING ERRCODE = '...'
  switch (code) {
    case "P0001":
      return { status: 400, errorCode: ERROR_CODES.LEADER_CAP_EXCEEDED };
    case "P0002":
      return {
        status: 400,
        errorCode: ERROR_CODES.CHURCH_NOT_FOUND,
        message: "Selected church no longer available.",
      };
    case "P0004":
    case "P0005":
    case "P0006":
    case "P0007":
    case "P0008":
      return { status: 400, errorCode: ERROR_CODES.VALIDATION_ERROR, message };
  }

  // CHECK constraint violation
  if (code === "23514") {
    return {
      status: 400,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      message: "Submission failed validation.",
    };
  }

  // NOT NULL violation — shouldn't fire (validation + function guards
  // cover the required columns) but surface as internal_error so we
  // notice in logs.
  return { status: 500, errorCode: ERROR_CODES.INTERNAL_ERROR };
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") return err(405, "method_not_allowed");

      const ip = deps.getIp(req);

      // SEC — per-IP-only rate limit FIRST (defeats email rotation
      // enumeration; the per-IP-per-email rate-limit below would be
      // bypassed by an attacker cycling through emails).
      const perIp = await deps.perIpRateLimit(ip);
      if (!perIp.allowed) {
        // Strict fail-closed (pre-UAT audit 2026-07-01): Upstash unreachable -> reject, don't proceed.
        if ("backendError" in perIp) {
          deps.log("error", "create_account_rate_limit_unavailable", { ip_hash: djb2(ip) });
          return json(503, { error: "rate_limit_unavailable", message: "Service temporarily unavailable — please try again in a moment." });
        }
        deps.log("warn", "rate_limited_per_ip", {
          ip_hash: djb2(ip),
          retry_after_seconds: perIp.retryAfterSeconds,
        });
        return json(429, { error: "rate_limited", retry_after_seconds: perIp.retryAfterSeconds });
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        const rl = await deps.rateLimit(ip, "_invalid_body_");
        if (!rl.allowed) {
          if ("backendError" in rl) {
            return json(503, { error: "rate_limit_unavailable", message: "Service temporarily unavailable — please try again in a moment." });
          }
          return json(429, { error: "rate_limited", retry_after_seconds: rl.retryAfterSeconds });
        }
        return err(400, ERROR_CODES.VALIDATION_ERROR, "Request body must be valid JSON");
      }

      // v8 — idempotency key REQUIRED (Founder ruling #28). Resolve from
      // Idempotency-Key header first, falling back to body.idempotencyKey.
      // Missing or malformed → 400 idempotency_key_required (don't burn
      // a rate-limit budget on a bad client).
      const headerKey = req.headers.get("Idempotency-Key");
      const bodyKey = body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).idempotencyKey
        : undefined;
      const rawIdempKey = (typeof headerKey === "string" && headerKey.length > 0)
        ? headerKey.trim()
        : (typeof bodyKey === "string" ? bodyKey.trim() : "");
      if (!isValidIdempotencyKey(rawIdempKey)) {
        return err(400, ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
      }

      // Cache hit → return cached 200 body verbatim. (We only cache
      // successful 200s, so a hit means the prior call succeeded and the
      // FE is retrying after a timeout/network blip.)
      const idempKey = idempotencyCacheKey(rawIdempKey);
      try {
        const cached = await deps.idempotencyCacheGet(idempKey);
        if (cached) {
          deps.log("info", "idempotency_replay", { ip_hash: djb2(ip) });
          return new Response(cached, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        // Cache backend failure — do NOT short-circuit. Log + fall
        // through to a fresh call. (Worst case is duplicate-email 400
        // on the second submit, which the existing layer-3 detection
        // already handles.)
        deps.log("warn", "idempotency_cache_get_failed", { message: (e as Error).message });
      }

      const parsed = parsePayload(body, deps.now(), rawIdempKey);
      if (!parsed.ok) {
        await deps.rateLimit(ip, probEmail(body) ?? "|invalid|");
        return err(400, ERROR_CODES.VALIDATION_ERROR, parsed.error);
      }
      const input = parsed.input;

      const rl = await deps.rateLimit(ip, input.email);
      if (!rl.allowed) {
        if ("backendError" in rl) {
          deps.log("error", "create_account_rate_limit_unavailable", { ip_hash: djb2(ip) });
          return json(503, { error: "rate_limit_unavailable", message: "Service temporarily unavailable — please try again in a moment." });
        }
        deps.log("warn", "rate_limited", {
          ip_hash: djb2(ip),
          email_hash: djb2(input.email),
          retry_after_seconds: rl.retryAfterSeconds,
        });
        return json(429, { error: "rate_limited", retry_after_seconds: rl.retryAfterSeconds });
      }

      // ── Pre-check: existing auth.users + public.users ───────────
      let existingAuth: AuthUserRef | null;
      try {
        existingAuth = await deps.findAuthUserByEmail(input.email);
      } catch (e) {
        deps.log("error", "auth_lookup_failed", {
          email_hash: djb2(input.email),
          message: (e as Error).message,
        });
        return err(500, ERROR_CODES.INTERNAL_ERROR);
      }

      let existingPublic: { id: string } | null = null;
      if (existingAuth) {
        try {
          existingPublic = await deps.findPublicUserByAuthId(existingAuth.id);
        } catch (e) {
          deps.log("error", "public_lookup_failed", {
            email_hash: djb2(input.email),
            message: (e as Error).message,
          });
          return err(500, ERROR_CODES.INTERNAL_ERROR);
        }
      }

      if (existingAuth && existingPublic) {
        deps.log("info", "duplicate", { email_hash: djb2(input.email) });
        return err(400, ERROR_CODES.USER_ALREADY_EXISTS);
      }

      // ── Resolve auth user ────────────────────────────────────────
      // Resume path: existingAuth && !existingPublic. The auth user was
      // created by a prior failed attempt; we re-attach a public-side
      // record. `created = false` here is LOAD-BEARING — do NOT
      // comp-delete the auth user on RPC failure since we didn't
      // create it (would clobber a real user's auth record).
      let authId: string;
      let created = false;
      if (existingAuth && !existingPublic) {
        authId = existingAuth.id;
        deps.log("info", "resume", { email_hash: djb2(input.email) });
      } else {
        try {
          const a = await deps.createAuthUser({ email: input.email, password: input.password });
          authId = a.id;
          created = true;
        } catch (e) {
          deps.log("error", "auth_create_failed", { message: (e as Error).message });
          return err(500, ERROR_CODES.INTERNAL_ERROR);
        }
      }

      // ── Atomic RPC call ─────────────────────────────────────────
      // Leader payload — serialized for the PL/pgSQL function.
      const leaderForRpc: Record<string, unknown> = {
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        role: input.role,
        anonymous: input.anonymous,
        includeMiddleName: input.includeMiddleName,
        // null when attached to a church; ISO ts (7 days out) when skip.
        verificationDeadline: input.userVerificationDeadline,
      };

      // newChurch payload — pass the canonical ChurchPayload directly.
      const newChurchForRpc: Record<string, unknown> | null = input.newChurch
        ? (input.newChurch as unknown as Record<string, unknown>)
        : null;

      let result: CreateAccountAtomicResult;
      try {
        result = await deps.createAccountAtomic(
          authId,
          leaderForRpc,
          newChurchForRpc,
          input.churchId,
          input.branchOfChurchId,
          input.pendingParentClaim as Record<string, unknown> | null,
          input.isHeadquarters,
        );
      } catch (e) {
        const rpcErr = e as RpcError;
        const mapped = mapRpcError(rpcErr);
        // Compensating delete only when we ourselves created the auth
        // user. The resume path leaves the existing auth user alone.
        if (created) {
          try {
            await deps.deleteAuthUser(authId);
          } catch (de) {
            deps.log("error", "comp_delete_failed", {
              auth_id_hash: djb2(authId),
              message: (de as Error).message,
            });
          }
        }
        deps.log("error", "atomic_failed", {
          code: rpcErr.code ?? "",
          mapped: mapped.errorCode,
          email_hash: djb2(input.email),
          had_new_church: newChurchForRpc !== null,
          had_existing_church_id: input.churchId !== null,
          message: rpcErr.message,
        });
        return err(mapped.status, mapped.errorCode, mapped.message);
      }

      // ── Side effects — email (fire-and-forget) ───────────────────
      // Welcome email goes to the leader. When the leader is attached
      // to an existing church, swap the recipient to that church's
      // contact_email so the message reaches the registered Replant
      // contact instead of the personal address. For the new-church
      // path the leader IS the contact, so no swap.
      //
      // Three copy variants (KAN-TBD 2026-06-18):
      //   skip            — no church attached. 7-day countdown.
      //   pending_church  — attached to a pending church (new OR
      //                     existing-pending). Dynamic daysRemaining
      //                     derived from church.verification_deadline.
      //   verified_church — joined an already-verified church. No
      //                     countdown; team confirms account.
      let welcomeEmailTarget = input.email;
      let welcomeKind: "skip" | "pending_church" | "verified_church" | "underground_pending";
      let welcomeDays: number | null;

      const isSkipPath = input.churchId === null && newChurchForRpc === null;
      // v8 (Founder ruling #5) — underground founder gets generic
      // pending email. NO church name, role, region, country, or
      // "underground" mention. Skip all the dynamic body computation
      // below for this path.
      const isUndergroundFounder = input.newChurch !== null && input.newChurch.type === "underground";

      if (isUndergroundFounder) {
        welcomeKind = "underground_pending";
        welcomeDays = null;
        // Recipient stays as input.email — the personal email the leader
        // typed at signup. No church contact swap (the underground
        // founder IS the contact and we never expose it elsewhere).
      } else if (isSkipPath) {
        welcomeKind = "skip";
        welcomeDays = 7;
      } else {
        // Default to pending_church + 30-day fallback in case the church
        // lookup fails — better to send something close than to log "no
        // info" silently.
        welcomeKind = "pending_church";
        welcomeDays = 30;

        const churchIdForLookup = input.churchId ?? result.churchId;
        if (churchIdForLookup !== null) {
          try {
            const info = await deps.getChurchInfo(churchIdForLookup);
            if (info) {
              // Existing-church flow only: swap to the church's
              // registered contact_email. New-church flow keeps the
              // leader as the recipient (they typed the contact email
              // moments ago).
              if (input.churchId !== null && info.contact_email) {
                welcomeEmailTarget = info.contact_email;
              }
              if (info.verification_status === "verified") {
                welcomeKind = "verified_church";
                welcomeDays = null;
              } else if (info.verification_deadline) {
                const deadlineMs = Date.parse(info.verification_deadline);
                const nowMs = deps.now().getTime();
                if (!Number.isNaN(deadlineMs) && deadlineMs > nowMs) {
                  // Ceil to whole days, floor of 1 so we never email
                  // "0 days" (which would lie about the surface in a
                  // demoralizing way for a brand-new leader).
                  welcomeDays = Math.max(1, Math.ceil((deadlineMs - nowMs) / 86_400_000));
                }
              }
            }
          } catch (e) {
            deps.log("warn", "church_info_lookup_failed", { message: (e as Error).message });
          }
        }
      }

      // CONTENT F6 (2026-06-18): pass church type so the body can swap
      // "church" → "organization" for para_ministry.
      const welcomeChurchType: string | null = input.newChurch
        ? (input.newChurch.type as string)
        : null;

      void deps.sendWelcomeEmail({
        email: welcomeEmailTarget,
        firstName: input.firstName,
        userId: result.userId,
        kind: welcomeKind,
        daysRemaining: welcomeDays,
        churchType: welcomeChurchType,
      }).catch(e => deps.log("warn", "welcome_email_failed", { message: (e as Error).message }));

      // New-church admin email fires only when the atomic write created
      // a church row this call.
      //
      // v8 (Founder rulings #5 + #22, 2026-06-19): underground founder
      // signups DO NOT trigger the connect@ admin email. The email
      // channel must not leak underground membership (subpoena/breach
      // surface). Underground-pending churches surface via the
      // dedicated admin-side underground queue + `audit_log_underground`,
      // NOT via team@/connect@ inbox. The `account_created` log line
      // below carries church_id only (no name, no leader name) — admin
      // queue picks it up from the DB row.
      if (
        newChurchForRpc !== null &&
        result.churchId !== null &&
        !isUndergroundFounder
      ) {
        void deps.sendNewChurchEmail({
          churchId: result.churchId,
          leaderEmail: input.email,
          leaderFullName: input.fullName,
          triggeredByUserId: result.userId,
        }).catch(e => deps.log("warn", "new_church_email_failed", { message: (e as Error).message }));
      }

      deps.log("info", "account_created", {
        user_id: result.userId,
        // v8 — for underground founders, suppress church_id from the
        // routine log line (don't bind user_id ↔ underground church_id
        // in telemetry). The audit_log_underground row carries the link
        // under stricter RLS.
        church_id: isUndergroundFounder ? null : result.churchId,
        email_hash: djb2(input.email),
        church_created: newChurchForRpc !== null,
        was_skip: input.churchId === null && newChurchForRpc === null,
        was_underground_founder: isUndergroundFounder,
        resumed: !created && existingAuth !== null,
        rate_count: rl.count,
        per_ip_count: perIp.count,
      });

      // v8 — cache the success body for idempotency replays. 1h TTL
      // (Founder ruling #28). Cache backend failure is non-fatal: log
      // and continue — the FE still gets the success response from this
      // call; a future replay would just rerun the path and hit the
      // layer-3 duplicate guard (or succeed if no row was actually
      // written, which is harmless).
      const successBody = JSON.stringify({ userId: result.userId, churchId: result.churchId });
      try {
        await deps.idempotencyCacheSet(idempKey, successBody, IDEMPOTENCY_CACHE_TTL_SECONDS);
      } catch (e) {
        deps.log("warn", "idempotency_cache_set_failed", { message: (e as Error).message });
      }

      return new Response(successBody, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      deps.log("error", "unexpected", { message: (e as Error).message });
      return err(500, ERROR_CODES.INTERNAL_ERROR);
    }
  };
}

export { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS };
export type { Role };
