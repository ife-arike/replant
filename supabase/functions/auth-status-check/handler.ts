import {
  type AuthStatusResponse,
  buildResponse,
  decodeJwtPayload,
  isSuperAdmin,
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

const DEACTIVATED_BODY: AuthStatusResponse = {
  verification_status: "deactivated",
  verification_deadline: null,
  days_remaining: null,
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
        if (row.is_active === false) return json(200, DEACTIVATED_BODY);
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

      return json(200, buildResponse(resolved));
    } catch {
      return error500();
    }
  };
}
