// delete-account edge function — KAN-205 (Founder-ratified 2026-07-03).
//
// The thin server-side leg of the deletion ceremony. The FE runs the full
// ceremony (explain → password re-auth via signInWithPassword → type-DELETE)
// and then calls this function, which:
//   1. Validates the JWT (verify_jwt=true at the platform is the outer
//      gate — NO config.toml in this function's directory, so deploy
//      WITHOUT --no-verify-jwt; the anon-role rejection below is
//      defense-in-depth, mirroring auth-status-check).
//   2. Executes public.fn_soft_delete_my_account('leader_initiated') AS
//      THE CALLER (user-scoped client). The RPC's own auth.uid() gate is
//      the authoritative authorization check; this function adds nothing
//      to it and can subtract nothing from it.
//   3. Revokes ALL refresh tokens (scope=global) — ratified expert call
//      #2: self-deletion is the owner's own act, other-device sessions
//      die. Non-fatal on failure: the FE also runs a global signOut, and
//      Day-30 auth-row deletion is the backstop.
//   4. Fires the deletion-started email — Founder override of CONTENT
//      B-1 (2026-07-03): "leaders MUST be informed." Standard variant is
//      clear (deletion started, 30-day restore guidance, accounts@); the
//      UG variant follows the locked information-free welcome-email
//      pattern (same sender family, neutral subject, no "underground",
//      no church, no deletion specifics — content discipline is the
//      protection). FIRE-AND-FORGET: deletion succeeds even if the send
//      fails (DELIVER-ALWAYS spirit); outcome lands in email_log.
//
// SAFE-LOG hygiene: no email addresses, no names, no user ids in log
// lines — event names + error classes only (send-message precedent).
//
// Error contract (message strings from the RPC are load-bearing):
//   'deletion limit reached'   → 429 DELETION_LIMIT (ratified 3-per-30d
//                                 cycle shape lives INSIDE the RPC)
//   'no active user found'     → 409 NOT_ACTIVE
//   anything else              → 500 INTERNAL_ERROR (no detail leak)

export interface CallerRow {
  id: string;
  email: string | null;
  first_name: string | null;
  church_id: string | null;
  is_underground: boolean;
  soft_deleted_at: string | null;
  soft_delete_reason: string | null;
}

export interface Deps {
  validateJwt(
    authHeader: string,
  ): Promise<{ authUid: string; role: string } | null>;
  fetchCaller(authUid: string): Promise<CallerRow | null>;
  // Runs public.fn_soft_delete_my_account('leader_initiated') as the
  // caller. Resolves { ok:false, message } on RPC error so the handler
  // can map the contract messages above without re-throwing.
  softDeleteAsCaller(
    authHeader: string,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
  // Revokes every refresh token for the presented session's user
  // (auth admin signOut, scope=global). Throws on failure.
  revokeAllSessions(accessToken: string): Promise<void>;
  // Sends the deletion-started email. Throws on failure.
  sendDeletionStartedEmail(args: {
    email: string;
    firstName: string | null;
    kind: "standard" | "underground";
  }): Promise<void>;
  // Best-effort email_log write. Throws on failure (handler swallows +
  // warns — the log row is observability, never a gate).
  logEmailOutcome(args: {
    userId: string;
    outcome: "sent" | "failed_resend_emit";
  }): Promise<void>;
  log(
    level: "info" | "warn" | "error",
    event: string,
    fields?: Record<string, unknown>,
  ): void;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error401 = () =>
  json(401, { error: "Invalid or expired session", code: "UNAUTHORIZED" });

const error500 = () =>
  json(500, { error: "Account deletion failed", code: "INTERNAL_ERROR" });

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") {
        return json(405, { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
      }

      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return error401();
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return error401();

      const validated = await deps.validateJwt(authHeader);
      if (!validated) return error401();
      if (validated.role === "anon") return error401();

      const caller = await deps.fetchCaller(validated.authUid);
      if (!caller) return error500();

      // Idempotency: a retry after a crash-between-steps (or a double
      // tap racing the sign-out) must not error. If the account is
      // already inside its own leader-initiated window, complete the
      // teardown (revoke) and return success WITHOUT re-sending email.
      if (
        caller.soft_deleted_at !== null &&
        caller.soft_delete_reason === "leader_initiated"
      ) {
        try {
          await deps.revokeAllSessions(token);
        } catch (e) {
          deps.log("warn", "delete-account.revoke-failed-idempotent", {
            error_class: (e as Error)?.name ?? "Error",
          });
        }
        return json(200, { ok: true, already_deleted: true });
      }

      const result = await deps.softDeleteAsCaller(authHeader);
      if (!result.ok) {
        if (result.message.includes("deletion limit reached")) {
          // Ratified cycle shape (3 per 30 days) fired inside the RPC.
          return json(429, { error: "Deletion limit reached", code: "DELETION_LIMIT" });
        }
        if (result.message.includes("no active user found")) {
          return json(409, { error: "Account is not active", code: "NOT_ACTIVE" });
        }
        deps.log("error", "delete-account.rpc-failed", {
          // Message class only — RPC messages are our own contract
          // strings, but keep the no-detail-leak posture uniform.
          error_class: "RpcError",
        });
        return error500();
      }
      deps.log("info", "delete-account.soft-delete-ok");

      // Global refresh-token revoke (expert call #2). Non-fatal: the FE
      // follows with its own global signOut, and the Day-30 sweep is the
      // backstop. The deletion itself has already committed.
      try {
        await deps.revokeAllSessions(token);
      } catch (e) {
        deps.log("warn", "delete-account.revoke-failed", {
          error_class: (e as Error)?.name ?? "Error",
        });
      }

      // Deletion-started email (Founder override of B-1). Fire-and-forget:
      // failures are logged, never surfaced, never fail the request.
      if (caller.email) {
        const kind: "standard" | "underground" = caller.is_underground
          ? "underground"
          : "standard";
        let outcome: "sent" | "failed_resend_emit" = "sent";
        try {
          await deps.sendDeletionStartedEmail({
            email: caller.email,
            firstName: caller.first_name,
            kind,
          });
        } catch (e) {
          outcome = "failed_resend_emit";
          deps.log("error", "delete-account.email-failed", {
            error_class: (e as Error)?.name ?? "Error",
          });
        }
        try {
          // One template string for BOTH variants — the variant must not
          // fingerprint UG accounts inside the broader email_log table.
          await deps.logEmailOutcome({ userId: caller.id, outcome });
        } catch (e) {
          deps.log("warn", "delete-account.email-log-failed", {
            error_class: (e as Error)?.name ?? "Error",
          });
        }
      }

      return json(200, { ok: true });
    } catch (e) {
      deps.log("error", "delete-account.unhandled", {
        error_class: (e as Error)?.name ?? "Error",
      });
      return error500();
    }
  };
}
