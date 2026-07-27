// KAN-192 register-church-delete — handler factory (createHandler pattern).
//
// Same shape as register-church and search-churches: deps interface for
// the moving parts (DB calls, rate limit, IP, logger), thin handler
// that orchestrates them. Keeps the index.ts thin and the tests trivial.

import {
  classifyDeleteFailure,
  type DeleteChurchPayload,
  type DeleteOutcome,
  parsePayload,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
} from "./logic.ts";

export interface Deps {
  /**
   * Attempt the DELETE with the locked-in guards (id + contact_email +
   * created_at within session window + no linked users). Returns
   * `{ kind: 'deleted' }` on success; on miss runs the diagnostic SELECT
   * + linked-user check and returns the classified outcome.
   *
   * The handler does NOT do the disambiguation itself — that's the dep's
   * responsibility because the dep has the DB connection.
   */
  attemptDelete(payload: DeleteChurchPayload): Promise<DeleteOutcome>;

  rateLimit(ip: string): Promise<
    | { allowed: true; count: number }
    | { allowed: false; retryAfterSeconds: number }
    | { allowed: false; backendError: true }
  >;

  getIp(req: Request): string;

  log(
    level: "info" | "warn" | "error",
    event: string,
    fields: Record<string, unknown>,
  ): void;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error400 = (msg: string) => json(400, { error: msg });
const error403 = () =>
  json(403, { error: "Ownership of this church could not be verified." });
const error404 = () => json(404, { error: "Church not found." });
const error405 = () => json(405, { error: "Method not allowed" });
const error409 = () =>
  json(409, {
    error:
      "This church is already linked to a leader account. Continue to Replant instead.",
  });
const error410 = () =>
  json(410, {
    error:
      "The window to delete this church has passed. Contact accounts@projectreplant.org if you need help.",
  });
const error429 = (retryAfterSeconds: number) =>
  json(429, {
    error: "Too many requests. Please try again later.",
    retry_after_seconds: retryAfterSeconds,
  });
// Strict fail-closed (pre-UAT audit 2026-07-01): rate-limit backend (Upstash) unreachable -> reject.
const error503 = () => json(503, { error: "Service temporarily unavailable — please try again in a moment." });
const error500 = () => json(500, { error: "Church delete failed" });

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") return error405();

      // Rate-limit BEFORE body parsing — a malformed-payload spammer is
      // still subject to the cap. Mirrors search-churches.
      const ip = deps.getIp(req);
      const rl = await deps.rateLimit(ip);
      if (!rl.allowed) {
        if ("backendError" in rl) {
          deps.log("error", "register_church_delete_rate_limit_unavailable", { ip_hash: hashIp(ip) });
          return error503();
        }
        deps.log("warn", "register_church_delete_rate_limited", {
          ip_hash: hashIp(ip),
          retry_after_seconds: rl.retryAfterSeconds,
        });
        return error429(rl.retryAfterSeconds);
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return error400("Request body must be valid JSON");
      }

      const parsed = parsePayload(body);
      if (!parsed.ok) return error400(parsed.error);

      let outcome: DeleteOutcome;
      try {
        outcome = await deps.attemptDelete(parsed.payload);
      } catch (e) {
        deps.log("error", "register_church_delete_db_failed", {
          ip_hash: hashIp(ip),
          message: (e as Error).message,
        });
        return error500();
      }

      switch (outcome.kind) {
        case "deleted":
          deps.log("info", "register_church_delete_success", {
            ip_hash: hashIp(ip),
            rate_count: rl.count,
          });
          return json(200, { deleted: true });
        case "not_found":
          deps.log("info", "register_church_delete_not_found", {
            ip_hash: hashIp(ip),
          });
          return error404();
        case "ownership_mismatch":
          deps.log("warn", "register_church_delete_ownership_mismatch", {
            ip_hash: hashIp(ip),
          });
          return error403();
        case "session_expired":
          deps.log("info", "register_church_delete_session_expired", {
            ip_hash: hashIp(ip),
          });
          return error410();
        case "leader_linked":
          deps.log("info", "register_church_delete_leader_linked", {
            ip_hash: hashIp(ip),
          });
          return error409();
        case "unknown_failure":
          deps.log("error", "register_church_delete_unknown_failure", {
            ip_hash: hashIp(ip),
          });
          return error500();
      }
    } catch (e) {
      deps.log("error", "register_church_delete_unexpected", {
        message: (e as Error).message,
      });
      return error500();
    }
  };
}

// djb2 hash — non-cryptographic. Same pattern as register-church /
// search-churches. Keeps raw IPs out of structured logs while letting
// us correlate repeated failures from the same source.
function hashIp(ip: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < ip.length; i++) {
    h = (((h << 5) + h) ^ ip.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// Re-export so index.ts has a single import surface.
export {
  classifyDeleteFailure,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
};
