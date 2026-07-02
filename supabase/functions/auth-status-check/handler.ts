import {
  type AuthStatusResponse,
  buildResponse,
  decodeJwtPayload,
  isSuperAdmin,
  isUndergroundJoinCodePendingReveal,
  resolveBranchSubstate,
  resolveStatus,
} from "./logic.ts";

export interface Deps {
  validateJwt(authHeader: string): Promise<{ authUid: string; role: string } | null>;
  fetchUserStatus(authUid: string): Promise<import("./logic.ts").UserStatusRow | null>;
  // Atomic UPDATE + audit_log INSERT in a single PostgreSQL transaction.
  // Returns { wrote: true } when the UPDATE matched (audit row was also written
  // within the same tx). Returns { wrote: false } when the UPDATE matched 0 rows
  // (idempotency: a concurrent caller already deactivated). Throws on any failure
  // — the transaction will have rolled back, so DB stays in pre-deactivation state.
  deactivateAtomically(
    userId: string,
    churchId: string | null,
    nowISO: string,
  ): Promise<{ wrote: boolean }>;
  // Underground reveal-eligibility extension (Founder ratification
  // 2026-06-20). Returns the data needed by
  // isUndergroundJoinCodePendingReveal:
  //   - churchType / churchVerificationStatus / undergroundJoinCodeRevealedAt
  //     come from the church row (already fetched in fetchUserStatus
  //     for the verification join, but we re-read the underground
  //     fields explicitly so we don't widen the existing SELECT).
  //   - foundingLeaderId comes from a separate "oldest active leader"
  //     lookup scoped to the church.
  // Returns null when the caller is not attached to a church OR the
  // church type is not 'underground' (cheap short-circuit).
  fetchUndergroundRevealContext(
    userId: string,
    churchId: string,
  ): Promise<{
    churchType: string | null;
    churchVerificationStatus: string | null;
    undergroundJoinCodeRevealedAt: string | null;
    foundingLeaderId: string | null;
  } | null>;
  now(): Date;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error401 = () =>
  json(401, { error: "Invalid or expired session", code: "UNAUTHORIZED" });

const error500 = () =>
  json(500, { error: "Status check failed", code: "INTERNAL_ERROR" });

const ACTIVE_BODY: AuthStatusResponse = {
  verification_status: "active",
  verification_deadline: null,
  days_remaining: null,
};

// KAN-36 v2 (SEC c.14235, Founder c.14236, locked 2026-05-24) — super_admin
// downgrade is admin-initiated by construction (the super_admin path doesn't
// touch church.verification_deadline), so recovery_path is always
// "support_contact" here. Non-super_admin deactivations go through
// resolveStatus/buildResponse where recovery_path is computed from row data.
const DEACTIVATED_BODY_SUPPORT: AuthStatusResponse = {
  verification_status: "deactivated",
  verification_deadline: null,
  days_remaining: null,
  recovery_path: "support_contact",
};

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return error401();
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return error401();

      const validated = await deps.validateJwt(authHeader);
      if (!validated) return error401();
      if (validated.role === "anon") return error401();

      let claims: Record<string, unknown>;
      try {
        claims = decodeJwtPayload(token);
      } catch {
        return error401();
      }

      // super_admin path: must read users.is_active and downgrade if false.
      // Pre-deactivation JWTs remain valid until natural expiry (KAN-41 sets
      // refresh at 168h + access TTL on top), so trusting the claim alone would
      // miss the lag window — which is exactly what this endpoint exists to catch.
      // (DBA 10924.) verification_deadline is church-level and doesn't apply to
      // super_admins, so we don't go through resolveStatus on this path.
      if (isSuperAdmin(claims)) {
        const row = await deps.fetchUserStatus(validated.authUid);
        if (!row) return error500();
        if (row.is_active === false) return json(200, DEACTIVATED_BODY_SUPPORT);
        return json(200, ACTIVE_BODY);
      }

      const row = await deps.fetchUserStatus(validated.authUid);
      if (!row) return error500();

      const nowISO = deps.now().toISOString();
      const resolved = resolveStatus(row, nowISO);

      if (resolved.kind === "pending_past_deadline_needs_write") {
        // Atomic UPDATE + audit_log INSERT (SEC 10920). On any failure inside the
        // transaction (UPDATE error, audit INSERT error, etc.) the impl throws —
        // the catch-all returns 500 and the DB stays in pre-deactivation state, so
        // the next call retries cleanly with audit trail intact.
        await deps.deactivateAtomically(row.id, row.church_id, nowISO);
      }

      const responseBody: AuthStatusResponse = buildResponse(resolved);

      // Underground reveal-eligibility decoration (Founder ratification
      // 2026-06-20). Only meaningful for attached, active leaders whose
      // church is verified underground. We DO NOT add the flag for
      // deactivated/rejected paths (those leaders should not see the
      // reveal surface). We DO compute it on the active+pending paths;
      // for "active" status with a verified church, this is the
      // primary moment the flag fires.
      //
      // We omit the flag entirely (rather than emitting `false`) when
      // not eligible — minimizes wire surface and avoids advertising
      // the feature's existence to non-underground viewers.
      // Underground Verification Queue branch_substate decoration
      // (2026-06-22 — Q1/Q2/Q3 mini-panel synthesis).
      //
      // Surfaced for any non-super_admin path that has a church row,
      // regardless of resolved.kind — the leader needs to see the
      // rejection/request_info modal whether their formal status is
      // pending, active, or deactivated. Generic-chrome invariant
      // (mobile FE branches on this field; field is OMITTED when
      // neither substate applies). Pure function over row; no DB call.
      const substate = resolveBranchSubstate(row);
      if (substate !== undefined) {
        responseBody.branch_substate = substate;
      }

      if (
        row.church_id !== null &&
        (resolved.kind === "active" || resolved.kind === "pending")
      ) {
        try {
          const ctx = await deps.fetchUndergroundRevealContext(row.id, row.church_id);
          if (ctx !== null) {
            const pending = isUndergroundJoinCodePendingReveal({
              callerUserId: row.id,
              churchType: ctx.churchType,
              churchVerificationStatus: ctx.churchVerificationStatus,
              undergroundJoinCodeRevealedAt: ctx.undergroundJoinCodeRevealedAt,
              foundingLeaderId: ctx.foundingLeaderId,
            });
            if (pending) {
              responseBody.underground_join_code_pending_reveal = true;
            }
          }
        } catch {
          // Decoration failure is non-fatal — the core status response
          // is more important than the reveal-prompt hint. The FE will
          // see no flag and won't surface the prompt this cycle; next
          // refresh will catch it. Do NOT 500 the whole call here.
        }
      }

      return json(200, responseBody);
    } catch {
      return error500();
    }
  };
}
