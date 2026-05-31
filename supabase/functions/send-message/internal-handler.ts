// KAN-217 — /internal route handler for send-message.
//
// SEC c.15285 Item 3 sub-items, all load-bearing:
//   (3a) X-Internal-Token request header vs welcome_dm_internal_token
//        (Vault) — constant-time. device-pass-fixes-1 (2026-05-31):
//        token carried on X-Internal-Token, NOT Authorization Bearer,
//        because the platform verify_jwt=true gate rejects any Bearer
//        that isn't a valid Supabase JWT and our token is a 64-char hex
//        string. Authorization stays for gateway-pass with any valid
//        JWT (anon or SR-key); /internal route auth is the custom
//        header below. Scoped to this route only — blast radius <
//        master SR key. Decoupled from Supabase key rotation cycles.
//        SEC re-stamp (AC-3 amendment).
//   (3b) X-Replant-Internal: true sentinel header required alongside the
//        token; both checks always run, same 401 surfaced for either failure.
//   (3c) sender_id resolved from Vault (replant_system_user_id) at startup.
//        Never accepted as a request body parameter. Body sender_id → reject.
//   (3d) Internal token never logged. No console.log, no error handler
//        exposure, no debug trace.
//   (3e) Keyword scanner fires identically — no matcher bypass, no source-
//        prefix carve-out, no is_system_message exemption. flagged may be
//        true; delivery is NEVER gated on it. DELIVER-ALWAYS (D-45 clause 3).
//   (3f) Internal token remains in server-side env / Vault only — never in
//        response payload, never in any client-reachable surface.
//
// External (peer-to-peer) callers are routed to ./handler.ts unchanged.
// This file owns the /internal route ONLY.
//
// Error envelope mirrors handler.ts for shape consistency:
//   200 → { id, conversation_id, created_at, flagged }
//   400 → { error: "validation_failed", detail: string }
//   401 → { error, code: "UNAUTHORIZED" }    — auth header(s) bad
//   403 → { error, code: "FORBIDDEN" }       — conversation lookup failures
//   405 → { error, code: "METHOD_NOT_ALLOWED" }
//   500 → { error, code: "INTERNAL_ERROR" }

import {
  resolveInternalReceiverId,
  validateInternalBody,
} from "./logic.ts";
import { requireInternalAuthHeaders } from "./internal-auth.ts";
import { collectMatches, composeFlagReason } from "./matcher.ts";
import { classifyMatches } from "./post-flag-effects.ts";
import type {
  ConversationParticipants,
  SendMessageResult,
} from "./handler.ts";
import type { Taxonomy } from "./taxonomy.ts";
import type { FlagEffectsPlan } from "./post-flag-effects.ts";

export interface InternalDeps {
  // SEC AC-3(a)/(f): dedicated /internal auth token — Vault-resident
  // (`welcome_dm_internal_token`), read once at cold-start in index.ts.
  // Scoped to this route only (not the master SR key). Decoupled from
  // Supabase key-format changes. Never logged, never in any response.
  // device-pass-fixes-1: replaces serviceRoleKey (Option 2 — Founder
  // authorized 2026-05-30) after Supabase key rotation desynced the
  // Netlify env SR key from the edge function Deno.env, causing
  // production 401s on every welcome DM send.
  internalToken: string;
  // SEC AC-3(c): system sender id resolved from Vault
  // (replant_system_user_id) at startup. Frozen string for the lifetime
  // of this isolate.
  systemSenderId: string;
  fetchConversation(
    conversationId: string,
  ): Promise<ConversationParticipants | null>;
  sendInTransaction(input: {
    senderId: string;
    conversationId: string | null;
    participantA: string | null;
    participantB: string | null;
    content: string;
    receiverId: string;
    flagged: boolean;
    flag_reason: string | null;
  }): Promise<SendMessageResult>;
  getTaxonomy(): Taxonomy | null;
  postCommitFlagEffects(input: {
    messageId: string;
    senderId: string;
    plan: FlagEffectsPlan;
  }): Promise<void>;
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

const error400 = (detail: string) =>
  json(400, { error: "validation_failed", detail });
const error401 = () =>
  json(401, { error: "Invalid or missing internal credentials", code: "UNAUTHORIZED" });
const error403 = () => json(403, { error: "Forbidden", code: "FORBIDDEN" });
const error405 = () =>
  json(405, { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
const error500 = () =>
  json(500, { error: "Send failed", code: "INTERNAL_ERROR" });

export function createInternalHandler(deps: InternalDeps) {
  return async (req: Request): Promise<Response> => {
    let conversationIdForLog: string | null = null;
    try {
      if (req.method !== "POST") return error405();

      // ───────────────────── AC-3(a)+(b): auth gate ─────────────────────
      // Token rides on X-Internal-Token (NOT Authorization Bearer) so the
      // platform verify_jwt=true gate accepts the request. The Authorization
      // header is consumed only by the gateway — it carries any valid
      // Supabase JWT (anon or SR-key both work). The actual /internal route
      // auth is the X-Internal-Token compare below.
      //
      // Both checks always run (timing-equalized inside the helper); same
      // 401 surfaced for either failure — no oracle distinction between
      // "sentinel missing" and "token wrong".
      const authOk = requireInternalAuthHeaders(
        req.headers.get("X-Internal-Token"),
        req.headers.get("X-Replant-Internal"),
        deps.internalToken,
      );
      if (!authOk) {
        // SAFE-LOG (AC-3d): NO headers, NO body, NO token — just the event.
        deps.log("warn", "send-message.internal.auth-failed", {});
        return error401();
      }

      // ───────────────────── Body parsing + validation ─────────────────────
      let bodyJson: unknown;
      try {
        bodyJson = await req.json();
      } catch {
        return error400("Request body must be valid JSON.");
      }
      // AC-3(c): validateInternalBody rejects any body containing
      // sender_id. Also enforces conversation_id-only contract.
      const validation = validateInternalBody(bodyJson);
      if (!validation.ok) {
        deps.log("warn", "send-message.internal.validation", {
          detail_class: validation.detail.split(" ")[0],
        });
        return error400(validation.detail);
      }
      const { conversation_id, content } = validation.body;
      conversationIdForLog = conversation_id;

      // ───────────────────── Conversation lookup ─────────────────────
      // Defensive: confirm the system user is one of the participants.
      // Admin BE (AC-4) is responsible for find-or-create with system +
      // leader as participants — if that contract is violated we surface
      // a 403 rather than insert into the wrong thread.
      const conv = await deps.fetchConversation(conversation_id);
      if (!conv) return error403();
      const receiverId = resolveInternalReceiverId(
        conv,
        deps.systemSenderId,
      );
      if (!receiverId) {
        deps.log("warn", "send-message.internal.system-not-participant", {
          conversation_id: conv.id,
        });
        return error403();
      }

      // ───────────────────── AC-3(e): keyword scan — DELIVER-ALWAYS ─────────────────────
      // Identical path to the external handler. No bypass, no source-
      // prefix carve-out, no is_system_message exemption. flagged may be
      // true; the INSERT still happens and the 200 still returns.
      const matchResult = collectMatches(content, deps.getTaxonomy());
      const { flag_reason, dropped_codes } = composeFlagReason(
        matchResult.matches,
      );
      const flagged = matchResult.matches.length > 0;

      if (dropped_codes.length > 0) {
        deps.log("warn", "send-message.internal.flag-reason-overflow", {
          sender_id: deps.systemSenderId,
          conversation_id: conv.id,
          dropped_codes: dropped_codes.join(","),
        });
      }
      if (matchResult.observability.cross_axis) {
        deps.log("warn", "send-message.internal.cross-axis-match", {
          sender_id: deps.systemSenderId,
          conversation_id: conv.id,
        });
      }

      // ───────────────────── Insert message ─────────────────────
      // senderId is the Vault-loaded systemSenderId. Never the body.
      const result = await deps.sendInTransaction({
        senderId: deps.systemSenderId,
        conversationId: conv.id,
        participantA: null,
        participantB: null,
        content,
        receiverId,
        flagged,
        flag_reason,
      });

      // ───────────────────── Post-commit flag effects ─────────────────────
      // Same as external path. DELIVER-ALWAYS: any failure is swallowed
      // internally; the 200 response is guaranteed.
      if (flagged) {
        const plan = classifyMatches(matchResult.matches);
        try {
          await deps.postCommitFlagEffects({
            messageId: result.id,
            senderId: deps.systemSenderId,
            plan,
          });
        } catch (err) {
          deps.log("error", "send-message.internal.post-commit-effects-failed", {
            sender_id: deps.systemSenderId,
            conversation_id: result.conversation_id,
            error_class: (err as Error)?.name ?? "Error",
          });
        }
      }

      // SAFE-LOG (AC-3d): no auth header, no body content, no SR key.
      // Sender is the public system uuid — already public-knowledge.
      deps.log("info", "send-message.internal.ok", {
        sender_id: deps.systemSenderId,
        conversation_id: result.conversation_id,
        flagged: result.flagged,
      });

      return json(200, result);
    } catch (e) {
      const err = e as Error & { httpStatus?: number };
      if (err?.httpStatus === 403) {
        deps.log("warn", "send-message.internal.forbidden", {
          sender_id: deps.systemSenderId,
          conversation_id: conversationIdForLog,
          error_class: err.name ?? "Error",
        });
        return error403();
      }
      if (err?.httpStatus === 400) {
        deps.log("warn", "send-message.internal.validation-throw", {
          sender_id: deps.systemSenderId,
          conversation_id: conversationIdForLog,
          error_class: err.name ?? "Error",
        });
        return error400(err.message);
      }
      // SAFE-LOG on 500 (AC-3d): NO SR key, NO body, NO stack details.
      deps.log("error", "send-message.internal.error", {
        sender_id: deps.systemSenderId,
        conversation_id: conversationIdForLog,
        error_class: err?.name ?? "Error",
      });
      return error500();
    }
  };
}
