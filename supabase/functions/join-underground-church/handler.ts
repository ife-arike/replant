// join-underground-church — handler factory.
//
// Flow (locked Founder rulings 2026-06-19/20):
//   1. POST + idempotency key required (header > body).
//   2. Idempotency cache hit → replay 200.
//   3. Per-IP rate limit 5/hr (#27), fail-CLOSED via in-memory token
//      bucket per worker on Upstash backend failure.
//   4. Parse + validate payload.
//   5. Create auth.users row (admin client). Email collision → comp-safe;
//      we DO NOT support a resume path here (single attempt) — surface
//      as the same generic invalid_or_consumed_code to avoid revealing
//      that the email is already registered with Replant somewhere
//      (enumeration defense).
//   6. signInWithPassword → user JWT.
//   7. INSERT public.users (church_id NULL, is_active=true) via admin
//      client — needed so the redeem RPC's `auth.uid()` lookup finds an
//      active user.
//   8. Build user-scoped client (carries the JWT). Call
//      redeem_underground_join_code(p_code) AS the new user. Returns
//      church_id; the RPC locks the row + nulls the hash atomically.
//      ANY failure here → comp-delete the public.users row AND the
//      auth.users row → return invalid_or_consumed_code.
//   9. Count active leaders on church. If >= 2 (we'd be the 3rd) →
//      comp-delete + generic invalid_or_consumed_code. (We re-check
//      AFTER redeem because redeem already nulled the hash; if cap is
//      exceeded the join attempt fails for this leader and the founder
//      must admin-rotate to add another.)
//      NOTE: per Founder ruling #29 + cap=2, the redeem semantics are
//      one-shot. Cap reached means rotation required. The pure cap
//      check here lives outside the locked RPC.
//  10. UPDATE public.users SET church_id = redeemed_church_id.
//  11. Fire welcome email (underground_pending generic body).
//  12. Cache success body for idempotency.
//  13. Return 200 { userId, churchId }.

import {
  ERROR_CODES,
  idempotencyCacheKey,
  IDEMPOTENCY_CACHE_TTL_SECONDS,
  isValidIdempotencyKey,
  parsePayload,
  PER_IP_RATE_LIMIT_MAX,
  PER_IP_RATE_LIMIT_WINDOW_SECONDS,
  perIpRateLimitKey,
} from "./logic.ts";

export interface Deps {
  // Create auth.users row. Returns { id }. Caller is responsible for
  // comp-delete on subsequent failure.
  createAuthUser(o: { email: string; password: string }): Promise<{ id: string }>;
  deleteAuthUser(id: string): Promise<void>;

  // Returns the access token for the just-created user so we can act
  // AS them in the redeem RPC (where auth.uid() is consulted).
  signInWithPassword(o: { email: string; password: string }): Promise<{ accessToken: string }>;

  // INSERT public.users with church_id NULL. Returns { id }.
  insertPublicUserNoChurch(o: {
    authId: string;
    email: string;
    fullName: string;
    firstName: string;
    middleName: string;
    lastName: string;
    phone: string;
    includeMiddleName: boolean;
    role: string;
    anonymous: boolean;
  }): Promise<{ id: string }>;
  deletePublicUserById(id: string): Promise<void>;

  // Call public.redeem_underground_join_code(p_code) AS the new user
  // (i.e., using the user-scoped JWT). Returns church_id on success;
  // throws on any failure (caller maps to generic invalid_or_consumed_code).
  redeemJoinCodeAsUser(o: { accessToken: string; code: string }): Promise<{ churchId: string }>;

  // Count active leaders on a church (admin client). For the cap check.
  countActiveLeaders(churchId: string): Promise<number>;

  // UPDATE public.users SET church_id = ?. Admin client.
  attachUserToChurch(o: { userId: string; churchId: string }): Promise<void>;

  // Generic underground_pending email. NO church name, no role, no
  // region, no country, no "underground" word (#5 + CONTENT B2).
  sendUndergroundPendingEmail(o: { email: string }): Promise<void>;

  // Idempotency cache (Upstash). Failure-mode parity with create-account:
  // get returns null on miss/error; set swallows on error.
  idempotencyCacheGet(key: string): Promise<string | null>;
  idempotencyCacheSet(key: string, value: string, ttlSeconds: number): Promise<void>;

  // Per-IP rate limit. Returns { allowed: boolean, retryAfterSeconds? }.
  // Locked invariant: FAIL-CLOSED on Upstash error via in-memory token
  // bucket per worker. The Deps impl OWNS the fallback — handler just
  // trusts allowed=false.
  perIpRateLimit(ip: string): Promise<
    | { allowed: true; count: number }
    | { allowed: false; retryAfterSeconds: number }
  >;

  getIp(req: Request): string;
  log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>): void;
}

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const err = (s: number, code: string) =>
  json(s, { error: code });

function djb2(s: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

// CAP: Founder ruling #12 + #29 — underground cap stays at 2; redeem
// consumes the hash on first successful second-leader join. Cap-of-2
// reached → admin must rotate before another leader can join.
const UNDERGROUND_LEADER_CAP = 2;

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") return err(405, ERROR_CODES.METHOD_NOT_ALLOWED);

      const ip = deps.getIp(req);

      // SEC — per-IP rate limit FIRST. Fail-CLOSED on Upstash error
      // via the Deps impl's in-memory token bucket fallback.
      const perIp = await deps.perIpRateLimit(ip);
      if (!perIp.allowed) {
        deps.log("warn", "rate_limited_per_ip", {
          ip_hash: djb2(ip),
          retry_after_seconds: perIp.retryAfterSeconds,
        });
        return json(429, {
          error: ERROR_CODES.RATE_LIMITED,
          retry_after_seconds: perIp.retryAfterSeconds,
        });
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return err(400, ERROR_CODES.VALIDATION_ERROR);
      }

      // Idempotency key — header > body.idempotencyKey.
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

      // Cache hit → replay verbatim.
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
        deps.log("warn", "idempotency_cache_get_failed", { message: (e as Error).message });
      }

      const parsed = parsePayload(body, rawIdempKey);
      if (!parsed.ok) {
        return err(400, ERROR_CODES.VALIDATION_ERROR);
      }
      const input = parsed.input;

      // ── Step 5: create auth.users ────────────────────────────────
      // Founder ruling 2026-06-20 — override of #4 for email-collision:
      // distinguish "email already registered" from generic code failure
      // so a leader reusing an email across Replant accounts gets a
      // clear UX. Other createUser failures still fold into the generic
      // bucket (defense-in-depth against fingerprinting).
      let authId: string;
      try {
        const created = await deps.createAuthUser({ email: input.email, password: input.password });
        authId = created.id;
      } catch (e) {
        const msg = (e as Error).message ?? "";
        const isEmailCollision =
          /already.*registered|already.*exists|duplicate.*email|email.*exists/i.test(msg);
        deps.log("warn", "auth_create_failed", {
          ip_hash: djb2(ip),
          email_hash: djb2(input.email),
          email_collision: isEmailCollision,
          message: msg,
        });
        if (isEmailCollision) {
          return err(409, ERROR_CODES.EMAIL_ALREADY_REGISTERED);
        }
        return err(400, ERROR_CODES.INVALID_OR_CONSUMED_CODE);
      }

      // ── Step 6: sign in to get a user-scoped JWT ─────────────────
      let accessToken: string;
      try {
        const session = await deps.signInWithPassword({ email: input.email, password: input.password });
        accessToken = session.accessToken;
      } catch (e) {
        // Sign-in failure is unexpected (we just created the user with
        // this password). Comp-delete and bail.
        deps.log("error", "signin_after_create_failed", {
          auth_id_hash: djb2(authId),
          message: (e as Error).message,
        });
        try { await deps.deleteAuthUser(authId); } catch (de) {
          deps.log("error", "comp_delete_auth_failed", { message: (de as Error).message });
        }
        return err(500, ERROR_CODES.INTERNAL_ERROR);
      }

      // ── Step 7: INSERT public.users with church_id NULL ──────────
      let publicUserId: string;
      try {
        const inserted = await deps.insertPublicUserNoChurch({
          authId,
          email: input.email,
          fullName: input.fullName,
          firstName: input.firstName,
          middleName: input.middleName,
          lastName: input.lastName,
          phone: input.phone,
          includeMiddleName: input.includeMiddleName,
          role: input.role,
          anonymous: input.anonymous,
        });
        publicUserId = inserted.id;
      } catch (e) {
        deps.log("error", "public_user_insert_failed", { message: (e as Error).message });
        try { await deps.deleteAuthUser(authId); } catch (de) {
          deps.log("error", "comp_delete_auth_failed", { message: (de as Error).message });
        }
        return err(500, ERROR_CODES.INTERNAL_ERROR);
      }

      // ── Step 8: call redeem AS the new user ──────────────────────
      // ANY failure here = single generic invalid_or_consumed_code.
      // Do NOT branch on the RPC's internal subcodes (invalid_code,
      // not_authorized, etc.) — that's the enumeration defense per
      // Founder ruling #4.
      let churchId: string;
      try {
        const redeemed = await deps.redeemJoinCodeAsUser({
          accessToken,
          code: input.joinCode,
        });
        churchId = redeemed.churchId;
      } catch (e) {
        // Comp-delete BOTH rows. The auth user creation invariant
        // (must be comp-deletable on any subsequent failure) holds.
        deps.log("warn", "redeem_failed", {
          ip_hash: djb2(ip),
          // Log the RPC error code for our own ops triage; the FE
          // never sees it (we return generic invalid_or_consumed_code).
          rpc_error: (e as Error).message,
        });
        try { await deps.deletePublicUserById(publicUserId); } catch (de) {
          deps.log("error", "comp_delete_public_failed", { message: (de as Error).message });
        }
        try { await deps.deleteAuthUser(authId); } catch (de) {
          deps.log("error", "comp_delete_auth_failed", { message: (de as Error).message });
        }
        return err(400, ERROR_CODES.INVALID_OR_CONSUMED_CODE);
      }

      // ── Step 9: cap check ────────────────────────────────────────
      // The redeem RPC already consumed the hash. We now check whether
      // this church already has the cap of leaders BEFORE we attach.
      // If yes, single generic invalid_or_consumed_code (don't reveal
      // cap-exceeded as a distinct case — enumeration defense).
      //
      // NOTE: there is a race window where two simultaneous redeems
      // could both claim slots; but the redeem RPC is one-shot (nulls
      // hash) so only ONE concurrent caller can pass the redeem step.
      // The cap check here is for the post-launch scenario where the
      // founder is alone and one second leader joins → cap=2 reached
      // (correct outcome). If somehow active leader count is already
      // >= cap, we treat as invalid and roll back.
      let activeCount: number;
      try {
        activeCount = await deps.countActiveLeaders(churchId);
      } catch (e) {
        deps.log("error", "active_count_failed", { message: (e as Error).message });
        // Don't strand the join — roll back and surface generic error.
        try { await deps.deletePublicUserById(publicUserId); } catch (_) { /* logged elsewhere */ }
        try { await deps.deleteAuthUser(authId); } catch (_) { /* logged elsewhere */ }
        return err(500, ERROR_CODES.INTERNAL_ERROR);
      }
      // We haven't attached yet — activeCount reflects current state.
      // The joining leader would be activeCount + 1. The cap is the
      // POST-attach total.
      if (activeCount + 1 > UNDERGROUND_LEADER_CAP) {
        deps.log("warn", "cap_exceeded_after_redeem", {
          ip_hash: djb2(ip),
          // church_id intentionally omitted from this log line.
          active_count: activeCount,
        });
        try { await deps.deletePublicUserById(publicUserId); } catch (_) { /* logged elsewhere */ }
        try { await deps.deleteAuthUser(authId); } catch (_) { /* logged elsewhere */ }
        return err(400, ERROR_CODES.INVALID_OR_CONSUMED_CODE);
      }

      // ── Step 10: attach the leader to the church ─────────────────
      try {
        await deps.attachUserToChurch({ userId: publicUserId, churchId });
      } catch (e) {
        deps.log("error", "attach_failed", { message: (e as Error).message });
        try { await deps.deletePublicUserById(publicUserId); } catch (_) { /* logged elsewhere */ }
        try { await deps.deleteAuthUser(authId); } catch (_) { /* logged elsewhere */ }
        return err(500, ERROR_CODES.INTERNAL_ERROR);
      }

      // ── Step 11: welcome email (fire-and-forget) ─────────────────
      void deps.sendUndergroundPendingEmail({ email: input.email })
        .catch(e => deps.log("warn", "welcome_email_failed", { message: (e as Error).message }));

      // ── Step 12: cache success ───────────────────────────────────
      const successBody = JSON.stringify({ userId: publicUserId, churchId });
      try {
        await deps.idempotencyCacheSet(idempKey, successBody, IDEMPOTENCY_CACHE_TTL_SECONDS);
      } catch (e) {
        deps.log("warn", "idempotency_cache_set_failed", { message: (e as Error).message });
      }

      deps.log("info", "joined_underground", {
        user_id: publicUserId,
        // church_id INTENTIONALLY omitted from this routine log line.
        // The audit_log_underground row written by redeem carries the
        // link under stricter RLS.
        email_hash: djb2(input.email),
        ip_hash: djb2(ip),
        per_ip_count: perIp.count,
      });

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

// Re-exports for the index module.
export {
  PER_IP_RATE_LIMIT_MAX,
  PER_IP_RATE_LIMIT_WINDOW_SECONDS,
  perIpRateLimitKey,
};
