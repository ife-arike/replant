// register-church v6 — handler factory (validation-only mode).
//
// Per SME-reviewed orphan-prevention architecture (2026-06-14):
//   1. Validate the church payload via shared parseChurchPayload.
//   2. Check for similar churches in the same country (same-room race
//      soft warning — Founder-approved option (a)).
//   3. Return { valid: true } OR { valid: false, similar: [...] } OR
//      { valid: false, error: '...' }. NO DB WRITE.
//
// The leader proceeds to ASP2 bypass card (FE persists the church
// payload to OnboardingContext), then taps Enter Replant — at which
// point create-account v4 calls the atomic RPC that writes the church
// + the leader in a single transaction.
//
// Per-IP rate limit (no per-email key — this endpoint has no auth
// context): defends against church-name and contact-email enumeration
// probing the validation oracle. SEC-required.

import { parseChurchPayload } from "./logic.ts";

export interface SimilarChurch {
  id: string;
  name: string;
  city: string | null;
  verification_status: string;
  match_reason: string;
}

export interface Deps {
  // v7 (Founder ruling 2026-06-18) — match by name+city, contact_email,
  // or contact_phone within the same country. Branches always excluded.
  findSimilarChurches(args: {
    name: string;
    country: string;
    city: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    limit?: number;
  }): Promise<SimilarChurch[]>;
  rateLimit(ip: string): Promise<
    | { allowed: true; count: number }
    | { allowed: false; retryAfterSeconds: number }
    // Strict fail-closed (pre-UAT audit 2026-07-01): Upstash backend unreachable -> reject with 503.
    | { allowed: false; backendError: true }
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

function djb2(s: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

      const ip = deps.getIp(req);
      const rl = await deps.rateLimit(ip);
      if (!rl.allowed) {
        // Strict fail-closed (pre-UAT audit 2026-07-01): when the rate-limit backend (Upstash) is
        // unreachable we reject rather than proceed — abuse-surface protection on an anon write RPC.
        if ("backendError" in rl) {
          deps.log("error", "register_church_rate_limit_unavailable", { ip_hash: djb2(ip) });
          return json(503, { error: "rate_limit_unavailable", message: "Service temporarily unavailable — please try again in a moment." });
        }
        deps.log("warn", "register_church_rate_limited", {
          ip_hash: djb2(ip),
          retry_after_seconds: rl.retryAfterSeconds,
        });
        return json(429, { error: "rate_limited", retry_after_seconds: rl.retryAfterSeconds });
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json(400, { valid: false, error: "validation_error", message: "Request body must be valid JSON" });
      }

      // v7 (Founder ruling 2026-06-18) — `force: true` is the
      // "Continue anyway" path from the FE similar-church modal. When
      // the leader has reviewed the candidates and confirmed it's a
      // different church, the FE re-submits with force:true and the
      // similarity check is skipped entirely.
      const force =
        body !== null && typeof body === "object" && (body as Record<string, unknown>).force === true;

      const parsed = parseChurchPayload(body);
      if (!parsed.ok) {
        return json(400, { valid: false, error: "validation_error", message: parsed.error });
      }

      // v7 (Founder ruling 2026-06-18) — branches are derivative
      // entities under a parent church. Skip the duplicate check
      // entirely when the incoming registration is a branch; multiple
      // branches under one parent legitimately share name + city.
      // (Defense-in-depth: find_similar_churches also filters out
      // existing branches from candidates.)
      const isBranchRegistration = parsed.payload.type === "branch";

      // Pre-flight similar-church check (Founder-approved soft warning).
      // Non-blocking: if the helper RPC errors out, treat as "no matches"
      // so a transient infra hiccup doesn't block a legitimate
      // registration.
      let similar: SimilarChurch[] = [];
      if (!force && !isBranchRegistration) {
        try {
          similar = await deps.findSimilarChurches({
            name: parsed.payload.name,
            country: parsed.payload.country,
            city: parsed.payload.city,
            contactEmail: parsed.payload.contact_email,
            contactPhone: parsed.payload.contact_phone,
            limit: 3,
          });
        } catch (e) {
          deps.log("warn", "register_church_similar_check_failed", {
            message: (e as Error).message,
          });
        }
      }

      if (similar.length > 0) {
        deps.log("info", "register_church_similar_found", {
          type: parsed.payload.type,
          country_hash: djb2(parsed.payload.country),
          name_length: parsed.payload.name.length,
          count: similar.length,
          top_match_reason: similar[0]?.match_reason,
        });
        return json(200, { valid: false, similar });
      }

      deps.log("info", "register_church_validated", {
        type: parsed.payload.type,
        country_hash: djb2(parsed.payload.country),
        name_length: parsed.payload.name.length,
        forced: force,
        is_branch: isBranchRegistration,
      });
      return json(200, { valid: true });
    } catch (e) {
      deps.log("error", "register_church_unexpected", { message: (e as Error).message });
      return json(500, { error: "internal_error" });
    }
  };
}
