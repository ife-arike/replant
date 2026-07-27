// KAN-80 Batch 2 — shared email contract types (Deno side).
//
// The module owns: claim (idempotent email_log row), dispatch (Resend POST
// + outcome update), suppression (leader notification toggle), retry
// (standard profile). It does NOT own template rendering — callers pass
// subject/html/text; the per-family template registry + opaque-tag layer
// arrive with the family migration batches.
//
// The 'pastoral' retry profile (out-of-process via email_retry_queue) ships
// with Batch 6 alongside the retry-worker cron — until then every caller is
// 'standard' (one in-process retry after 5s).

/** Thrown for caller bugs (malformed idempotency key, missing anchor) —
 * distinct from Resend/network failures which return SendResult. */
export class EmailContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailContractError";
  }
}

export interface SendArgs {
  /** email_log.template literal. DB CHECK (M7) will harden the set later. */
  template: string;
  to: string;
  subject: string;
  /** Optional — omit for deliberately text-only sends (e.g. the UG
   * registration confirmation, kept byte-identical per Founder ruling). */
  html?: string;
  text: string;
  /** Defaults to leader-facing sender. Admin-class callers pass
   * "Replant Operations <accounts@projectreplant.org>". */
  from?: string;
  /** email_log.user_id — the leader the email is ABOUT. NULL for
   * admin-notify sends (idempotencyKey then required — anchor CHECK M4). */
  logUserId?: string | null;
  /** Caller-namespaced business-event key, MUST start with the template
   * name (e.g. "heartcry_triage_notification:<heartcry_id>"). Mandatory
   * for cron + admin-notify sends; omit for user-triggered welcome-class
   * (per-UTC-day dedup applies instead). */
  idempotencyKey?: string;
  /** Acting user for admin-class forensics (SEC). Caller-vouched — set to
   * the actor who passed the upstream auth gate; never auto-filled. */
  triggeredBy?: string | null;
  /** true → honor users.email_notifications_enabled (notification-class).
   * false/omitted → transactional/security-class, NEVER suppressed
   * (password reset, verification outcomes, deactivation…). */
  notificationClass?: boolean;
}

export type ClaimResult =
  | { status: "claimed"; logId: string }
  | { status: "duplicate"; logId: string; resendId: string | null }
  | { status: "suppressed"; reason: "notifications_disabled" };

export type SendResult =
  | { success: true; resendId: string | null; outcome: "sent" | "duplicate" }
  | { success: false; outcome: "suppressed" | "failed"; reason: string };

/** Minimal structural type for the injected service-role client. */
export type ServiceClient = {
  from: (table: string) => any;
};
