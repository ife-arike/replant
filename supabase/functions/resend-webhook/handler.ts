// KAN-80 Batch 2 — Resend webhook event processor (testable in isolation).
//
// Receives Resend delivery-lifecycle events, updates the matching
// email_log row's outcome. Replay-protected via webhook_events_processed
// (M5c). Terminal-state enforcement lives HERE (BE-side per DBA ruling —
// email_log is intentionally mutable for webhook updates, no DB trigger).
//
// Lifecycle (panel-locked M1):
//   queued → sent → delivered            (happy path)
//   queued → sent → soft_bounced → delivered
//   queued → sent → soft_bounced → hard_bounced
//   queued → sent → hard_bounced | complained
//   queued → failed
// Terminal: delivered, hard_bounced, complained, failed, suppressed_*.

type SupabaseishClient = {
  from: (table: string) => any;
};

// Terminality is encoded here: no VALID_FROM set contains hard_bounced,
// complained, failed, or any suppressed_* state — nothing transitions out
// of them. delivered→complained IS valid (spam reports arrive post-
// delivery); delivered may follow soft_bounced (transient recovered).
const VALID_FROM: Record<string, Set<string>> = {
  sent:         new Set(["queued"]),
  delivered:    new Set(["queued", "sent", "soft_bounced"]),
  soft_bounced: new Set(["queued", "sent"]),
  hard_bounced: new Set(["queued", "sent", "soft_bounced"]),
  complained:   new Set(["queued", "sent", "delivered", "soft_bounced"]),
};

export interface ResendEvent {
  type: string;
  data?: {
    email_id?: string;
    bounce?: { type?: string };
  };
}

export type ProcessResult =
  | { handled: true; transition: string }
  | { handled: false; reason: "replay" | "unknown_type" | "no_email_id" | "row_not_found" | "invalid_transition" };

export async function recordReplayClaim(
  client: SupabaseishClient,
  svixId: string,
): Promise<boolean> {
  // INSERT ... ON CONFLICT DO NOTHING via upsert(ignoreDuplicates). A
  // returned row means WE claimed it; empty data means replay.
  const { data, error } = await client
    .from("webhook_events_processed")
    .upsert(
      { provider: "resend", event_id: svixId },
      { onConflict: "provider,event_id", ignoreDuplicates: true },
    )
    .select("event_id");
  if (error) throw new Error(`replay-claim failed: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

export function eventToOutcome(event: ResendEvent): string | null {
  switch (event.type) {
    case "email.sent":      return "sent";
    case "email.delivered": return "delivered";
    case "email.complained": return "complained";
    case "email.bounced": {
      const bounceType = event.data?.bounce?.type?.toLowerCase() ?? "";
      // Resend/SES: "Permanent" = hard; "Transient"/"Undetermined" = soft.
      return bounceType === "permanent" ? "hard_bounced" : "soft_bounced";
    }
    default: return null;
  }
}

export async function processEvent(
  client: SupabaseishClient,
  event: ResendEvent,
): Promise<ProcessResult> {
  const targetOutcome = eventToOutcome(event);
  if (targetOutcome === null) return { handled: false, reason: "unknown_type" };

  const emailId = event.data?.email_id;
  if (!emailId) return { handled: false, reason: "no_email_id" };

  // Point-lookup via email_log_resend_id_uniq (M3). Backoff absorbs the
  // INSERT-not-yet-visible race on 0-second-old sends (DBA Finding 6).
  const delays = [0, 500, 2000, 10000];
  let row: { id: string; outcome: string } | null = null;
  for (const delay of delays) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const { data, error } = await client
      .from("email_log")
      .select("id, outcome")
      .eq("resend_id", emailId)
      .maybeSingle();
    if (error) throw new Error(`email_log lookup failed: ${error.message}`);
    if (data) { row = data; break; }
  }
  if (!row) return { handled: false, reason: "row_not_found" };

  if (!VALID_FROM[targetOutcome]?.has(row.outcome)) {
    return { handled: false, reason: "invalid_transition" };
  }

  // Guarded UPDATE — re-checks the from-state in the WHERE so a concurrent
  // webhook can't double-apply (second UPDATE matches 0 rows).
  const { error: updErr } = await client
    .from("email_log")
    .update({ outcome: targetOutcome })
    .eq("id", row.id)
    .eq("outcome", row.outcome);
  if (updErr) throw new Error(`email_log update failed: ${updErr.message}`);

  return { handled: true, transition: `${row.outcome}→${targetOutcome}` };
}
