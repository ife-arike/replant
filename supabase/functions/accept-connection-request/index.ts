// accept-connection-request Edge Function — KAN-69 consent-layer accept path.
//
// Why this function exists (SEC ruling, 20260609000007):
//   respond_to_connection_request deliberately does NOT seed the original
//   request message into public.messages — the request message MUST transit
//   FLAG_TAXONOMY scanning first, attributed to the ORIGINAL requester (not
//   the accepting recipient). The old FE path called send-message with the
//   recipient's token, which mis-attributed the seeded message to the
//   accepter. This function fixes that: it scans the request message here,
//   flips the request to 'accepted', then seeds the already-scanned message
//   via seed_accepted_request_message (which attributes it to the requester).
//
// SEC-locked invariants (mirror send-message):
//   - verify_jwt=true at the platform is load-bearing. A forged JWT is
//     rejected before this handler runs. The handler ALSO re-validates the
//     JWT via auth.getUser() (defence in depth) and rejects role==='anon'.
//   - Message content (request.message) NEVER appears in any log statement.
//     Zero exceptions (AC-12 pattern secrecy posture).
//   - DELIVER-ALWAYS (D-45 clause 3): the keyword scan writes flagged/
//     flag_reason ONLY — it never gates the accept or the 200. Any
//     moderation_state write failure is logged + swallowed; it never gates
//     the 200. The conversation exists once respond_to_connection_request
//     returns; the leaders can talk regardless of seed / moderation outcome.
//   - The seed message is attributed to the original requester by the RPC,
//     not to the accepting caller.

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.105.1";
import {
  classifyLoadFailure,
  loadTaxonomy,
  type Taxonomy,
} from "../send-message/taxonomy.ts";
import { collectMatches, composeFlagReason } from "../send-message/matcher.ts";
import { classifyMatches } from "../send-message/post-flag-effects.ts";

// ── boot constants (mirror send-message) ──────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment configuration");
}

const adminClient: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

const userClientFor = (authHeader: string): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  });

// ── FLAG_TAXONOMY cold-start load (mirror send-message) ───────────────
const taxonomyRaw = Deno.env.get("FLAG_TAXONOMY");
const taxonomy: Taxonomy | null = loadTaxonomy(taxonomyRaw);
if (!taxonomy) {
  console.warn(JSON.stringify({
    level: "warn",
    event: "accept-connection-request.taxonomy-unavailable",
    reason: classifyLoadFailure(taxonomyRaw),
    ts: new Date().toISOString(),
  }));
} else {
  console.log(JSON.stringify({
    level: "info",
    event: "accept-connection-request.taxonomy-loaded",
    taxonomy_version: taxonomy.taxonomy_version,
    code_count: taxonomy.codes.length,
    ts: new Date().toISOString(),
  }));
}

// ── error envelope (mirror send-message handler shapes) ───────────────
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown>,
): void {
  // NO message content + NO recipient identifiers beyond request_id /
  // conversation_id handles. Mirror send-message SAFE-LOG discipline.
  const line = JSON.stringify({
    level,
    event,
    ...fields,
    ts: new Date().toISOString(),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

Deno.serve(async (req: Request): Promise<Response> => {
  let requestIdForLog: string | null = null;
  let conversationIdForLog: string | null = null;
  try {
    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    // ── 1. JWT validation (defence in depth; platform verify_jwt=true) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return json(401, { error: "Invalid or expired session" });
    }
    const userClient = userClientFor(authHeader);
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json(401, { error: "Invalid or expired session" });
    }
    if ((user.role ?? "anon") === "anon") {
      return json(401, { error: "Invalid or expired session" });
    }

    // ── 2. Parse body ──────────────────────────────────────────────────
    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return json(400, { error: "Request body must be valid JSON." });
    }
    const body = bodyJson as Record<string, unknown> | null;
    const requestId = body?.request_id;
    if (typeof requestId !== "string" || !UUID_RE.test(requestId)) {
      return json(400, { error: "request_id is required and must be a UUID." });
    }
    requestIdForLog = requestId;

    // ── 3. Resolve caller's public.users.id from auth_id (adminClient) ──
    const { data: callerRow, error: callerErr } = await adminClient
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (callerErr || !callerRow) {
      return json(403, { error: "Forbidden" });
    }
    const callerId = callerRow.id as string;

    // ── 4. Read the connection request (adminClient / service role) ─────
    const { data: reqRow, error: reqErr } = await adminClient
      .from("connection_requests")
      .select("id, sender_id, recipient_id, message, status")
      .eq("id", requestId)
      .maybeSingle();
    if (reqErr) {
      log("error", "accept-connection-request.request-read-failed", {
        request_id: requestId,
        error_class: reqErr.message ?? "error",
      });
      return json(500, { error: "Accept failed" });
    }
    if (!reqRow) {
      return json(404, { error: "This request no longer exists." });
    }

    // ── 4b. Authorization: caller must be the recipient; status pending ─
    if (reqRow.recipient_id !== callerId) {
      return json(403, { error: "Forbidden" });
    }
    if (reqRow.status !== "pending") {
      return json(400, { error: "This request has already been resolved." });
    }

    // ── 5. FLAG_TAXONOMY scan on the request message ────────────────────
    // DELIVER-ALWAYS: the scan only produces flagged + flag_reason codes;
    // it never gates the accept. Content NEVER logged.
    const message = (reqRow.message as string | null) ?? "";
    const matchResult = collectMatches(message, taxonomy);
    const { flag_reason } = composeFlagReason(matchResult.matches);
    const flagged = matchResult.matches.length > 0;
    // flag_reason is a comma-joined `auto:<code>` string; the seed RPC
    // expects text[] and collapses it internally. Pass the matched code
    // names as the array (already public via taxonomy-codes.ts).
    const flagCodes: string[] = matchResult.matches.map(
      (c) => `auto:${c.code}`,
    );

    // ── 6. Flip request to 'accepted' + get conversation_id (user RPC) ──
    const { data: convData, error: respondErr } = await userClient.rpc(
      "respond_to_connection_request",
      { p_request_id: requestId, p_action: "accept" },
    );
    if (respondErr) {
      log("error", "accept-connection-request.respond-failed", {
        request_id: requestId,
        error_class: respondErr.message ?? "error",
      });
      return json(500, { error: "Accept failed" });
    }
    const conversationId = (convData as string | null) ?? null;
    if (!conversationId) {
      // respond_to_connection_request returns NULL only on decline; an
      // accept that returns no conversation is an invariant break.
      log("error", "accept-connection-request.no-conversation", {
        request_id: requestId,
      });
      return json(500, { error: "Accept failed" });
    }
    conversationIdForLog = conversationId;

    // ── 7. Seed the already-scanned request message (user RPC) ──────────
    // DELIVER-ALWAYS: if the seed fails, the conversation already exists —
    // return 200 with the conversation_id. Log + swallow. The leaders can
    // still talk; the requester can re-send if the seed was lost.
    let messageId: string | null = null;
    try {
      const { data: seedData, error: seedErr } = await userClient.rpc(
        "seed_accepted_request_message",
        {
          p_request_id: requestId,
          p_flagged: flagged,
          p_flag_reason: flagCodes,
        },
      );
      if (seedErr) {
        log("warn", "accept-connection-request.seed-failed", {
          request_id: requestId,
          conversation_id: conversationId,
          error_class: seedErr.message ?? "error",
        });
      } else {
        // RPC RETURNS TABLE → supabase-js surfaces an array of rows.
        const row = Array.isArray(seedData) ? seedData[0] : seedData;
        messageId = (row?.message_id as string | undefined) ?? null;
      }
    } catch (e) {
      log("warn", "accept-connection-request.seed-threw", {
        request_id: requestId,
        conversation_id: conversationId,
        error_class: (e as Error)?.name ?? "Error",
      });
    }

    // ── 8. Post-commit flag effects: moderation_state per routing axis ──
    // DELIVER-ALWAYS: any moderation_state failure is logged + swallowed,
    // never gates the 200. Mirrors send-message postCommitFlagEffects.
    if (flagged && messageId) {
      const plan = classifyMatches(matchResult.matches);
      for (const axisPayload of plan.axes) {
        try {
          const { error: msErr } = await adminClient
            .from("moderation_state")
            .insert({
              message_id: messageId,
              axis: axisPayload.axis,
              status: "pending",
              actor: null,
              meta: {
                routing: axisPayload.axis,
                tier: axisPayload.tier,
                matched_codes: axisPayload.matched_codes,
              },
            });
          // 23505 = (message_id, axis) PK collision on a retry — graceful.
          if (msErr && (msErr as { code?: string }).code !== "23505") {
            log("warn", "accept-connection-request.moderation-state-failed", {
              request_id: requestId,
              conversation_id: conversationId,
              axis: axisPayload.axis,
              error_class: msErr.message ?? "error",
            });
          }
        } catch (e) {
          log("warn", "accept-connection-request.moderation-state-threw", {
            request_id: requestId,
            conversation_id: conversationId,
            axis: axisPayload.axis,
            error_class: (e as Error)?.name ?? "Error",
          });
        }
      }
    }

    // SAFE-LOG: request_id + conversation_id + flagged. No content.
    log("info", "accept-connection-request.ok", {
      request_id: requestId,
      conversation_id: conversationId,
      flagged,
    });

    return json(200, {
      conversation_id: conversationId,
      message_id: messageId,
    });
  } catch (e) {
    log("error", "accept-connection-request.error", {
      request_id: requestIdForLog,
      conversation_id: conversationIdForLog,
      error_class: (e as Error)?.name ?? "Error",
    });
    return json(500, { error: "Accept failed" });
  }
});
