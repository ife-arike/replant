// KAN-80 Batch 2 — sendEmail contract, Deno thin client.
//
// Two-phase shape (panel-locked, BE Finding 1):
//   claim()    — INSERT the email_log row (outcome='queued') as the atomic
//                idempotency claim. Callable INSIDE a caller's transactional
//                scope where one exists; the UNIQUE indexes serialize races.
//   dispatch() — POST to Resend AFTER the claim is committed; UPDATE the row
//                to sent/failed. One in-process retry after 5s ('standard').
//   send()     — claim + dispatch for non-transactional callers (most).
//
// Fire-and-forget contract (SEC, KAN-31 c.10013): callers never roll back
// their own work on email failure. Failures land in email_log for the
// dead-letter sweep; the webhook promotes sent → delivered/bounced.
//
// PII discipline: no recipient address, subject, body, or variable values
// in console logs — template + outcome + error class only.

import {
  type ClaimResult,
  EmailContractError,
  type SendArgs,
  type SendResult,
  type ServiceClient,
} from "./types.ts";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Replant <connect@projectreplant.org>";
const RETRY_DELAY_MS = 5000;

function validateArgs(args: SendArgs): void {
  if (!args.logUserId && !args.idempotencyKey) {
    throw new EmailContractError(
      `template=${args.template}: logUserId or idempotencyKey required (email_log anchor)`,
    );
  }
  if (args.idempotencyKey && !args.idempotencyKey.startsWith(args.template)) {
    throw new EmailContractError(
      `template=${args.template}: idempotencyKey must be namespaced by template name`,
    );
  }
}

async function isSuppressed(
  client: ServiceClient,
  args: SendArgs,
): Promise<boolean> {
  // Only notification-class sends to a known leader are suppressible.
  // Transactional/security-class NEVER suppresses (Founder ruling 2026-07-13).
  if (!args.notificationClass || !args.logUserId) return false;
  const { data, error } = await client
    .from("users")
    .select("email_notifications_enabled")
    .eq("id", args.logUserId)
    .maybeSingle();
  if (error || !data) return false; // fail OPEN on lookup error — email is the backup channel
  return data.email_notifications_enabled === false;
}

export async function claim(
  client: ServiceClient,
  args: SendArgs,
): Promise<ClaimResult> {
  validateArgs(args);

  if (await isSuppressed(client, args)) {
    // Record the suppression so the estate stays observable (no silent path).
    await client.from("email_log").insert({
      user_id: args.logUserId,
      template: args.template,
      outcome: "suppressed_pre_send",
      idempotency_key: args.idempotencyKey ?? null,
      triggered_by: args.triggeredBy ?? null,
    });
    return { status: "suppressed", reason: "notifications_disabled" };
  }

  const { data, error } = await client
    .from("email_log")
    .insert({
      user_id: args.logUserId ?? null,
      template: args.template,
      outcome: "queued",
      idempotency_key: args.idempotencyKey ?? null,
      triggered_by: args.triggeredBy ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique violation → another worker (or an earlier attempt)
    // holds the claim. Surface the existing row so callers can short-circuit.
    if (error.code === "23505") {
      let lookup = client.from("email_log").select("id, resend_id");
      if (args.idempotencyKey) {
        lookup = lookup.eq("idempotency_key", args.idempotencyKey);
      } else {
        lookup = lookup
          .eq("user_id", args.logUserId)
          .eq("template", args.template)
          .eq("sent_date", new Date().toISOString().slice(0, 10));
      }
      const { data: existing } = await lookup.maybeSingle();
      return {
        status: "duplicate",
        logId: existing?.id ?? "unknown",
        resendId: existing?.resend_id ?? null,
      };
    }
    throw new Error(`email_log claim failed: ${error.message}`);
  }
  return { status: "claimed", logId: data.id };
}

async function postToResend(
  apiKey: string,
  args: SendArgs,
): Promise<{ ok: boolean; resendId: string | null; errorClass: string }> {
  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: args.from ?? DEFAULT_FROM,
        to: [args.to],
        subject: args.subject,
        ...(args.html !== undefined ? { html: args.html } : {}),
        text: args.text,
      }),
    });
    if (!res.ok) {
      // Retry only server-side/transient failures; a 4xx is a payload bug.
      return { ok: false, resendId: null, errorClass: `http_${res.status}` };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return {
      ok: true,
      resendId: typeof body.id === "string" ? body.id : null,
      errorClass: "",
    };
  } catch (e) {
    return { ok: false, resendId: null, errorClass: (e as Error).name };
  }
}

export async function dispatch(
  client: ServiceClient,
  apiKey: string,
  logId: string,
  args: SendArgs,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<SendResult> {
  let attempt = await postToResend(apiKey, args);
  let attempts = 1;

  // Standard profile: one retry after 5s on 5xx / network error only.
  const retriable = !attempt.ok &&
    (attempt.errorClass.startsWith("http_5") || !attempt.errorClass.startsWith("http_"));
  if (retriable) {
    await sleep(RETRY_DELAY_MS);
    attempt = await postToResend(apiKey, args);
    attempts = 2;
  }

  const outcome = attempt.ok ? "sent" : "failed";
  const { error: updErr } = await client
    .from("email_log")
    .update({
      outcome,
      resend_id: attempt.resendId,
      attempt_count: attempts,
    })
    .eq("id", logId)
    .eq("outcome", "queued");
  if (updErr) {
    console.error(JSON.stringify({
      level: "error",
      event: "sendEmail.outcome-update-failed",
      template: args.template,
      error_class: updErr.message,
      ts: new Date().toISOString(),
    }));
  }

  if (!attempt.ok) {
    console.error(JSON.stringify({
      level: "error",
      event: "sendEmail.dispatch-failed",
      template: args.template,
      error_class: attempt.errorClass,
      attempts,
      ts: new Date().toISOString(),
    }));
    return { success: false, outcome: "failed", reason: attempt.errorClass };
  }
  return { success: true, resendId: attempt.resendId, outcome: "sent" };
}

/** Convenience for non-transactional callers: claim + dispatch. */
export async function send(
  client: ServiceClient,
  apiKey: string,
  args: SendArgs,
): Promise<SendResult> {
  const claimed = await claim(client, args);
  if (claimed.status === "suppressed") {
    return { success: false, outcome: "suppressed", reason: claimed.reason };
  }
  if (claimed.status === "duplicate") {
    return { success: true, resendId: claimed.resendId, outcome: "duplicate" };
  }
  return dispatch(client, apiKey, claimed.logId, args);
}
