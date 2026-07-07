// KAN-304 — leader-facing report intake (client wrapper).
//
// Calls the `submit-report` edge function (which hosts the fail-open-alarmed
// rate limiter + the FLAG_TAXONOMY free-text scan, then commits through the
// SECURITY DEFINER RPC submit_content_report).
//
// ── Reporter-protection invariants enforced on the FE side ──
//   • NO reporter-side artifact (SEC §1.3; register §C invariant 3 — the
//     seized-device test): this module persists NOTHING about what was
//     reported. No local report log, no cache, no analytics event. The report
//     reason and free text are sent once and never stored on device.
//   • NO detail/reason/target logging: even on a network throw, callers surface
//     a generic failure — this module never echoes the payload into a log.
//   • UNIFORM outcome (anti-oracle): the server returns {ok:true} for
//     new/duplicate/invalid/not-visible alike. The client therefore learns only
//     "received", "rate_limited", or "error" — never whether the target existed,
//     whether others reported it, or whether it was a duplicate. "Already
//     reported" is a purely client-side, in-SESSION hint (see ReportSheet), never
//     derived from a server signal and never persisted.

import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../lib/supabase';

const SUBMIT_REPORT_URL = `${SUPABASE_URL}/functions/v1/submit-report`;

// The six reportable surfaces (server target_type values).
export type ReportSurface =
  | 'dm_message'
  | 'branch_message'
  | 'prayer_request'
  | 'testimony'
  | 'comment'
  | 'church_profile';

// The eight leader-facing reasons (server reason_code values). Copy for each
// lives in ReportSheet (CONTENT lane, verbatim). 'something_else' requires detail.
export type ReportReason =
  | 'locate_identify'
  | 'threats'
  | 'asking_for_money'
  | 'impersonation'
  | 'false_teaching'
  | 'spam'
  | 'wellbeing_concern'
  | 'something_else';

export type SubmitReportResult =
  // Uniform success — the ONLY thing the client is told about the outcome.
  | { ok: true }
  // The reporter's OWN rate limit tripped (the one honest target-independent
  // deviation). Copy references only the reporter's own rate, never the target.
  | { ok: false; reason: 'rate_limited' }
  // A genuine send failure (network or a downstream write failure). The sheet's
  // error state preserves the free-text draft and offers retry.
  | { ok: false; reason: 'error' };

export interface SubmitReportArgs {
  surface: ReportSurface;
  targetId: string;
  reason: ReportReason;
  detail?: string | null;
}

/**
 * Submit a content report. Fire-and-forget by design: the resolved value is only
 * used to pick the confirmation / rate-limited / error view — nothing about the
 * report is retained after this call returns.
 */
export async function submitReport(args: SubmitReportArgs): Promise<SubmitReportResult> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) {
    // Not signed in (should not happen from an authed surface) — generic error.
    return { ok: false, reason: 'error' };
  }

  let res: Response;
  try {
    res = await fetch(SUBMIT_REPORT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_type: args.surface,
        target_id: args.targetId,
        reason_code: args.reason,
        // Only send detail when present; the server caps/scrubs it.
        detail: args.detail && args.detail.trim().length > 0 ? args.detail.trim() : null,
      }),
    });
  } catch {
    // Network throw — never echo the payload; generic error (draft preserved).
    return { ok: false, reason: 'error' };
  }

  if (res.ok) {
    // 200 {ok:true} for every accepted/duplicate/silently-discarded case.
    return { ok: true };
  }

  if (res.status === 429) {
    return { ok: false, reason: 'rate_limited' };
  }

  // 401 (auth), 503 (write_failed), 5xx, or any other non-200 → generic error.
  return { ok: false, reason: 'error' };
}
