// KAN-80 Batch 2 — resend-webhook edge function.
//
// Receives Resend (Svix-signed) delivery-lifecycle events and promotes
// email_log outcomes: sent → delivered / soft_bounced / hard_bounced /
// complained. Closes the bounce-blindness gap (comms matrix G13).
//
// AUTH POSTURE (verify_jwt=false is LOAD-BEARING — see config.toml):
// Resend cannot mint Supabase JWTs; the Svix signature IS the auth.
// Signature verification runs on EVERY request before any DB access.
// Replay protection is durable via webhook_events_processed (M5c).
//
// Response discipline (OPS): return 200 even on rows we can't match —
// a 5xx makes Resend retry with backoff for up to 24h and re-deliveries
// would pile into the replay table. Unmatched events are logged for the
// orphan-reconciler (Batch 6).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifySvixSignature } from "../_shared/email/webhook-verify.ts";
import { processEvent, recordReplayClaim, type ResendEvent } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Signing secret cached per isolate with TTL (OPS Finding 5 — guards
// against post-rotation stale reads).
const SECRET_CACHE_TTL_MS = 15 * 60 * 1000;
let cachedSecret: { value: string; fetchedAt: number } | null = null;

async function getSigningSecret(): Promise<string | null> {
  const now = Date.now();
  if (cachedSecret && now - cachedSecret.fetchedAt < SECRET_CACHE_TTL_MS) {
    return cachedSecret.value;
  }
  const { data, error } = await adminClient.rpc("get_secret_by_name", {
    secret_name: "resend_webhook_signing_secret",
  });
  if (error || typeof data !== "string" || data.length === 0) {
    console.error(JSON.stringify({
      level: "error",
      event: "resend-webhook.signing-secret-unavailable",
      error_class: error?.message ?? "empty",
      ts: new Date().toISOString(),
    }));
    return null;
  }
  cachedSecret = { value: data, fetchedAt: now };
  return data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const secret = await getSigningSecret();
  if (secret === null) {
    // Fail CLOSED but let Resend retry — secret may be mid-rotation.
    return new Response("secret unavailable", { status: 500 });
  }

  const verdict = await verifySvixSignature(req.headers, rawBody, secret);
  if (!verdict.ok) {
    // missing_headers → probe; no audit (SEC Finding 3). Present-but-wrong
    // → active-attack signal; audit it.
    if (verdict.reason === "bad_signature") {
      await adminClient.from("audit_log").insert({
        action: "webhook_signature_invalid",
        accessed_by: null,
        triggered_by: "system",
        meta: { provider: "resend", surface: "resend-webhook" },
      });
    }
    return new Response("unauthorized", { status: 401 });
  }

  // Durable replay protection — claimed=false means we already processed
  // this svix-id; 200 no-op so Resend stops retrying.
  let claimed: boolean;
  try {
    claimed = await recordReplayClaim(adminClient, verdict.svixId);
  } catch (e) {
    console.error(JSON.stringify({
      level: "error",
      event: "resend-webhook.replay-claim-failed",
      error_class: (e as Error).message,
      ts: new Date().toISOString(),
    }));
    return new Response("retry", { status: 500 });
  }
  if (!claimed) return new Response("ok (replay)", { status: 200 });

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return new Response("ok (unparseable)", { status: 200 });
  }

  try {
    const result = await processEvent(adminClient, event);
    if (!result.handled) {
      console.warn(JSON.stringify({
        level: "warn",
        event: "resend-webhook.unhandled",
        reason: result.reason,
        event_type: event.type,
        ts: new Date().toISOString(),
      }));
    }
  } catch (e) {
    console.error(JSON.stringify({
      level: "error",
      event: "resend-webhook.process-failed",
      error_class: (e as Error).message,
      ts: new Date().toISOString(),
    }));
    // Deliberate 200: the replay claim already holds this svix-id, so a
    // Resend retry would no-op. Orphan-reconciler (Batch 6) sweeps gaps.
  }

  return new Response("ok", { status: 200 });
});
