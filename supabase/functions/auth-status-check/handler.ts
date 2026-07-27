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

// KAN-205 (SEC panel 2026-07-03, ratified 2026-07-03) — the wire shape for
// a leader inside their own 30-day deletion window. Top-level status is
// deliberately 'pending', NOT 'deactivated':
//   - The FE's deactivated handling (modal + forced signOut) fires on
//     verification_status BEFORE branch_substate mapping — returning
//     'deactivated' here would hijack the RestoreScreen ceremony.
//   - Old app builds that don't know 'self_deleted' fall through to
//     verification_status; 'pending' is the safest degraded surface
//     (no false-active writes-silently-fail shell, no wrong modal).
// New builds branch on branch_substate === 'self_deleted' and mount
// RestoreScreen; deleted-on / permanent-on dates are read by the FE from
// its own users row (users_select_own covers the soft-delete columns).
const SELF_DELETED_BODY: AuthStatusResponse = {
  verification_status: "pending",
  verification_deadline: null,
  days_remaining: null,
  branch_substate: "self_deleted",
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
        // KAN-205 — a super_admin who self-deleted gets the same restore
        // ceremony as any leader (self-deletion sets is_active=false, so
        // without this check they'd land on the deactivated/support modal
        // with no path back inside their own 30-day window).
        if (resolveBranchSubstate(row) === "self_deleted") {
          return json(200, SELF_DELETED_BODY);
        }
        if (row.is_active === false) return json(200, DEACTIVATED_BODY_SUPPORT);
        return json(200, ACTIVE_BODY);
      }

      const row = await deps.fetchUserStatus(validated.authUid);
      if (!row) return error500();

      const nowISO = deps.now().toISOString();

      // KAN-205 (SEC §2.2 — the ratified blocker fix) — USER-level
      // self-deletion short-circuits the whole resolver. Without this:
      //   - a self-deleted second leader on a live church resolved
      //     'active' and saw a working-looking app where every write
      //     failed on RLS, with no restore surface;
      //   - a self-deleted pending leader whose church deadline later
      //     lapsed hit the deactivateAtomically write below, clobbering
      //     the self-deletion with verification_status='deactivated'.
      // Checked BEFORE resolveStatus so neither path can fire. The
      // underground reveal decoration is also skipped by construction —
      // a leader inside their deletion window gets no reveal prompt.
      const selfDeletedSubstate = resolveBranchSubstate(row);
      if (selfDeletedSubstate === "self_deleted") {
        return json(200, SELF_DELETED_BODY);
      }

      const resolved = resolveStatus(row, nowISO);

      if (
        resolved.kind === "pending_past_deadline_needs_write" &&
        // KAN-205 belt — never let the login-check deadline write clobber
        // ANY soft-deleted row (admin-initiated reasons included). The
        // self_deleted short-circuit above already covers leader_initiated;
        // this guard covers every other soft_delete_reason.
        row.soft_deleted_at === null
      ) {
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
