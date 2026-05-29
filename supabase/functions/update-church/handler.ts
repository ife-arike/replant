// KAN-207 update-church — handler factory (createHandler pattern).
//
// Mirrors register-church/handler.ts: deps are injected so the handler
// is unit-testable without the Supabase client or Deno runtime.
//
// Flow:
//   1. Reject non-POST → 405.
//   2. Extract Authorization: Bearer <token>; absent → 401.
//   3. deps.getAuthUser(token) → null → 401.
//   4. Parse body via parseUpdatePayload → 400 on bad shape.
//   5. deps.checkOwnership(user.id, parsed.church_id) → false → 403.
//      Ownership = caller's public.users row links to the target
//      church_id with is_active = true. Ownership runs BEFORE any
//      DB write — never relaxed.
//   6. deps.updateChurch(parsed.church_id, parsed.row) — index.ts
//      strips null/undefined fields so only the columns the leader
//      actually edited are UPDATEd. Throw → 500.
//   7. Log update_church_success with church_id + type. No PII.
//   8. Return 200 + buildSuccessBody.

import {
  buildSuccessBody,
  parseUpdatePayload,
  type UpdateChurchRow,
} from "./logic.ts";

export interface Deps {
  // Verify the caller's JWT. Real impl: adminClient.auth.getUser(token).
  // Returns { id } on success, null on any failure path (invalid token,
  // missing user, etc.). Errors are swallowed by the dep — handler
  // converts null → 401.
  getAuthUser(token: string): Promise<{ id: string } | null>;

  // Ownership check. Real impl: SELECT id FROM public.users
  //   WHERE auth_id = $authUserId AND church_id = $churchId AND is_active = true
  // Returns true iff exactly one row matches.
  checkOwnership(authUserId: string, churchId: string): Promise<boolean>;

  // Partial UPDATE. Real impl strips null/undefined fields from the
  // row before sending to adminClient.from('churches').update(...).
  updateChurch(churchId: string, row: Partial<UpdateChurchRow>): Promise<void>;

  log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>): void;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error400 = (msg: string) => json(400, { error: msg });
const error401 = () => json(401, { error: "Unauthorized" });
const error403 = () => json(403, { error: "Forbidden" });
const error405 = () => json(405, { error: "Method not allowed" });
const error500 = () => json(500, { error: "Church update failed" });

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") return error405();

      // ── Auth ──
      const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
      const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
      if (!token) return error401();

      const user = await deps.getAuthUser(token);
      if (!user) return error401();

      // ── Body parse ──
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return error400("Request body must be valid JSON");
      }

      const parsed = parseUpdatePayload(body);
      if (!parsed.ok) return error400(parsed.error);

      // ── Ownership ──
      // BE-side ACL. RLS on churches.update is not relied on — this
      // function runs as service role, which bypasses RLS. Ownership
      // MUST be enforced here, before any UPDATE fires.
      const owns = await deps.checkOwnership(user.id, parsed.church_id);
      if (!owns) {
        deps.log("warn", "update_church_forbidden", {
          auth_user_id: user.id,
          church_id: parsed.church_id,
        });
        return error403();
      }

      // ── Update ──
      try {
        await deps.updateChurch(parsed.church_id, parsed.row);
      } catch (e) {
        deps.log("error", "update_church_failed", {
          church_id: parsed.church_id,
          type: parsed.row.type,
          message: (e as Error).message,
        });
        return error500();
      }

      deps.log("info", "update_church_success", {
        church_id: parsed.church_id,
        type: parsed.row.type,
      });

      return json(200, buildSuccessBody(parsed.church_id));
    } catch (e) {
      deps.log("error", "update_church_unexpected", {
        message: (e as Error).message,
      });
      return error500();
    }
  };
}
