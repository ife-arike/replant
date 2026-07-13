// Type definitions duplicated locally rather than imported from /types/auth.ts so the
// edge runtime bundle has no out-of-tree imports to resolve. Must stay in lockstep
// with the FE mirror in src/contexts/AuthProvider.tsx. Both derive from the locked
// contract in KAN-44 comment 10292, amended by KAN-36 v2 per SEC c.14235 + Founder
// ratification c.14236 to add the binary recovery_path lifecycle field.
export type VerificationStatus = "active" | "pending" | "deactivated";

// KAN-36 v2 (SEC c.14235 #1) — single binary field, exactly two values.
// No third value, no enum expansion. Maps to FE copy variant per the
// design v3 modal.
export type RecoveryPath = "verification_renewal" | "support_contact";

// Flow-gaps F4/G10 (SME Panel A, 2026-07-13; Founder-ratified rejection
// copy 2026-07-13) — closed enum ONLY. The admin's free-text rejection
// reason lives in audit_log.meta and must NEVER cross to the client;
// this token selects which ratified lockout copy variant the FE renders.
// recovery_path stays binary (the c.14235 lock is untouched) — this is
// the KAN-205 additive-optional-field precedent, omitted when absent so
// old clients degrade to the generic deactivated copy.
export type LockoutReason = "church_rejected" | "leader_rejected";

export interface AuthStatusResponse {
  verification_status: VerificationStatus;
  verification_deadline: string | null;
  days_remaining: number | null;
  // Present iff verification_status === "deactivated". Omitted on
  // "active" and "pending" bodies — the FE only branches copy when the
  // user has landed on the deactivated surface.
  recovery_path?: RecoveryPath;
  // Underground extension (Founder ratification 2026-06-20).
  //
  // True when ALL of:
  //   - viewer's church.type = 'underground'
  //   - viewer is the founding leader (oldest active leader by created_at)
  //   - church.verification_status = 'verified'
  //   - church.underground_join_code_revealed_at IS NULL
  //
  // The FE shows the "code ready to view" prompt when this flag is true.
  // We do NOT auto-call reveal here — that's a separate edge function
  // (reveal-join-code) that fires after a 2-step gate on the FE side.
  // The flag is OMITTED from the response body when false (don't
  // advertise to non-underground viewers that an underground branch
  // exists at all).
  underground_join_code_pending_reveal?: boolean;
  // Underground Verification Queue extension (Founder ratification
  // 2026-06-22 — Q1/Q2/Q3 mini-panel synthesis).
  //
  // Surfaces the leader's substate WITHIN the existing top-level
  // `verification_status` so the mobile FE can branch into:
  //   'request_info'  → admin sent a question; suppress verified-gate
  //                     timeline phrase + fire RequestInfoModal on Home
  //   'soft_deleted'  → admin two-eyes confirmed a reject; show
  //                     VerificationOutcomeModal + persistent banner,
  //                     gate Connect/PrayerWall to read-only
  //   'self_deleted'  → KAN-205 (SEC panel 2026-07-03, ratified): the
  //                     LEADER's own account is in the 30-day
  //                     leader-initiated soft-delete window. RootNavigator
  //                     mounts the dedicated RestoreScreen ceremony —
  //                     NOT the tabs, NOT the rejection read-only shell.
  //                     Surfaces only post-auth (sign-in works all 30
  //                     days; nothing pre-auth discloses the account).
  //
  // OMITTED from the response when neither applies — same posture as
  // underground_join_code_pending_reveal (don't advertise the state
  // machine to viewers it doesn't apply to).
  branch_substate?: BranchSubstate;
  // Flow-gaps F4/G10 (2026-07-13) — present iff verification_status ===
  // "deactivated" AND the cause is a rejection (church-level via
  // reject-church, or leader-level via reject-leader). Selects the
  // Founder-ratified "We were unable to verify your church/account"
  // lockout copy. OMITTED for every non-rejection deactivation.
  lockout_reason?: LockoutReason;
}

export type BranchSubstate = "request_info" | "soft_deleted" | "self_deleted";

// KAN-65 tidy-up (2026-05-26) — added 'rejected'. The live
// verification_status_enum has had this value since KAN-110; the local type
// was stale. resolveStatus below now branches explicitly on 'rejected' so
// the new union member doesn't fall through to the pending branch (which
// would have read the deadline and routed incorrectly).
export type DbVerificationStatus = "pending" | "verified" | "rejected" | "deactivated";

export interface UserStatusRow {
  id: string;
  verification_status: DbVerificationStatus;
  deactivated_at: string | null;
  is_active: boolean;
  church_id: string | null;
  // KAN-205 (2026-07-07) — USER-level soft-delete columns. Before this,
  // the resolver derived 'soft_deleted' from the CHURCH's soft_deleted_at
  // only, so a self-deleted leader who was not the last leader on their
  // church signed into a normal-looking app where every write failed on
  // RLS, with no restore surface (the ratified KAN-205 blocker). These
  // three columns let resolveBranchSubstate check the USER first.
  soft_deleted_at: string | null;
  soft_delete_reason: string | null;
  hard_delete_scheduled_at: string | null;
  // KAN-TBD 2026-06-18 (Founder ratification, overriding KAN-36 Option Y
  // for the skip-flow null-church case). users.verification_deadline is
  // load-bearing for the skip-leader pending branch; the church-side
  // deadline doesn't exist for skip leaders by design.
  user_verification_deadline: string | null;
  // KAN-TBD 2026-06-18 root fix (Founder ruling: stop spot-fixing).
  // We must read church.verification_status BEFORE church.verification_deadline,
  // because stale deadlines persist on verified-church rows (the 30-day
  // window elapses long before admin verification often happens). Reading
  // the deadline without first checking status auto-deactivated every new
  // leader joining a verified-with-stale-deadline church.
  //
  // Underground Verification Queue extension (2026-06-22): two additional
  // columns on the church row drive `branch_substate` derivation —
  //   - soft_deleted_at: timestamptz, set by fn_soft_delete_my_account or
  //     by admin two-eyes confirm-reject. Non-NULL → branch_substate='soft_deleted'.
  //   - last_outcome_modal_kind: text, set by fn_request_info_underground to
  //     'request_info'. Drives branch_substate='request_info' when present.
  church: {
    verification_status: string | null;
    verification_deadline: string | null;
    soft_deleted_at: string | null;
    last_outcome_modal_kind: string | null;
  } | null;
}

export type ResolvedStatus =
  | { kind: "active" }
  // KAN-TBD 2026-06-18 — verification_deadline + days_remaining nullable
  // so the skip-flow leader can be legitimately pending without leaking a
  // countdown into the API response. The FE banner uses days===null to
  // fire the locked "register" copy variant; surfacing a number would
  // route it to amber/urgent with wrong "your church" wording.
  | { kind: "pending"; verification_deadline: string | null; days_remaining: number | null }
  | { kind: "deactivated"; recovery_path: RecoveryPath; lockout_reason?: LockoutReason }
  // KAN-TBD 2026-06-18 — isSkipFlow distinguishes skip leader past
  // 7-day deadline (route to support_contact — there's no church to
  // renew) from attached leader past 30-day church deadline (route to
  // verification_renewal).
  | { kind: "pending_past_deadline_needs_write"; verification_deadline: string; isSkipFlow: boolean };

export interface AuditLogRow {
  accessed_by: null;
  triggered_by: "system";
  action: "deactivate_user";
  church_id: string | null;
  accessed_at: string;
  meta: { trigger: "login_check"; user_id: string };
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

export function isSuperAdmin(claims: Record<string, unknown>): boolean {
  return claims.super_admin === true;
}

export function daysRemaining(verificationDeadline: string, nowISO: string): number {
  const deadline = Date.parse(verificationDeadline);
  const now = Date.parse(nowISO);
  if (Number.isNaN(deadline) || Number.isNaN(now)) {
    throw new Error("Invalid timestamp");
  }
  const ms = deadline - now;
  if (ms <= 0) return 0;
  return Math.floor(ms / 86_400_000);
}

// Caller is responsible for handling super_admin separately (handler reads users.is_active
// and downgrades when false, per DBA 10924) — this resolver only handles non-super-admin
// users. The Option-B church-deadline path doesn't apply to super_admins.
export function resolveStatus(
  row: UserStatusRow,
  nowISO: string,
): ResolvedStatus {
  if (row.verification_status === "verified") return { kind: "active" };

  // KAN-65 tidy-up (2026-05-26) — explicit 'rejected' branch. A rejected
  // leader cannot meaningfully renew a verification window (admin-controlled
  // state); the only forward path is a human conversation, so route to the
  // support_contact recovery surface — same destination as a NULL-deadline
  // fail-closed pending row. Without this branch the row would fall through
  // to the "pending" path below and be evaluated against a deadline, which
  // is incorrect for rejected leaders.
  if (row.verification_status === "rejected") {
    // Flow-gaps F4 (2026-07-13): leader-level rejection (reject-leader.js
    // sets exactly this row state) carries the personal-variant ratified
    // copy. recovery_path stays support_contact — the recourse IS the
    // human conversation at accounts@. Precedence note (SEC Panel A):
    // a user both individually rejected AND on a rejected church lands
    // here — the more specific state wins.
    return {
      kind: "deactivated",
      recovery_path: "support_contact",
      lockout_reason: "leader_rejected",
    };
  }

  if (row.verification_status === "deactivated") {
    // KAN-36 v2 (SEC c.14235 #2/#4, Founder c.14236, locked 2026-05-24) —
    // recovery_path inferred from row data only (constant-time, no extra
    // query). A deactivation is treated as deadline-driven (renewal path)
    // when the row carries a past, non-NULL church.verification_deadline —
    // matching both cron-flipped users and any user the login-check path
    // wrote on a prior call. Every other shape (future deadline, NULL
    // deadline, no church attached) falls into the support bucket. NULL-
    // deadline anomalies on DB-deactivated rows resolve to support_contact
    // by the same rule that c.14235 #6 locks for the pending+NULL branch
    // below — the FE never sees verification_renewal on a NULL-deadline
    // row.
    const deactDeadline = row.church?.verification_deadline ?? null;
    // Flow-gaps Panel B DBA stamp (2026-07-13): the renewal copy applies
    // ONLY to deadline-driven deactivations — a church still PENDING
    // verification whose 30-day window lapsed. A VERIFIED church routinely
    // carries a stale past creation-timer deadline (the 2026-06-18 root
    // fix documented this), so a user-deactivated row on a verified /
    // rejected / deactivated church must resolve to support_contact —
    // never "your church verification window expired." Mirrors the
    // pending branch's own church-status switch below (one mental model).
    const deactChurchStatus = row.church?.verification_status ?? null;
    if (deactChurchStatus === "pending" && deactDeadline !== null) {
      const dl = Date.parse(deactDeadline);
      const now = Date.parse(nowISO);
      if (Number.isNaN(dl) || Number.isNaN(now)) throw new Error("Invalid timestamp");
      if (dl <= now) return { kind: "deactivated", recovery_path: "verification_renewal" };
    }
    return { kind: "deactivated", recovery_path: "support_contact" };
  }

  // ── KAN-TBD 2026-06-18 root fix — comprehensive pending-branch resolution ──
  //
  // Founder ruling "stop spot-fixing, find the root, fix the whole
  // bug." The earlier override of KAN-36 Option Y closed the skip-flow
  // null-church case but missed the verified-church + stale-deadline
  // case. Comprehensive matrix:
  //
  //   user pending + church_id NULL (skip)           → user-side deadline path
  //   user pending + church verified                 → pending, no countdown
  //                                                    (admin owns leader
  //                                                    confirmation)
  //   user pending + church rejected | deactivated   → deactivated/support
  //                                                    (church not in good
  //                                                    standing)
  //   user pending + church pending                  → church deadline path
  //   user pending + church NULL deadline anomaly    → deactivated/support
  //
  // For verified-church + pending-leader specifically: the church's
  // verification_deadline often stays set to the original 30-day
  // creation timer that elapsed well before admin verification. Reading
  // that stale timestamp instantly auto-deactivated every new leader
  // joining a verified church. Root cause was reading
  // verification_deadline without first branching on verification_status.

  // Skip-flow leader (no church attached) — use user-side deadline.
  if (row.church_id === null) {
    const userDeadline = row.user_verification_deadline;
    if (userDeadline === null) {
      // Anomaly — create-account always sets this for skip leaders.
      return { kind: "deactivated", recovery_path: "support_contact" };
    }
    const now = Date.parse(nowISO);
    const dl = Date.parse(userDeadline);
    if (Number.isNaN(now) || Number.isNaN(dl)) throw new Error("Invalid timestamp");
    if (dl <= now) {
      return {
        kind: "pending_past_deadline_needs_write",
        verification_deadline: userDeadline,
        isSkipFlow: true,
      };
    }
    // Mask deadline + days so the FE banner stays on the locked
    // "register" variant copy via `days === null`.
    return {
      kind: "pending",
      verification_deadline: null,
      days_remaining: null,
    };
  }

  // Attached to a church — branch on the CHURCH's verification_status
  // BEFORE reading its deadline.
  const churchStatus = row.church?.verification_status ?? null;

  if (churchStatus === "verified") {
    // Verified church + pending leader = admin confirming the leader's
    // personal identity. There is no time-based countdown for the
    // leader half of this pair — admin owns the transition. The FE's
    // useChurchVerifiedStatus picks the "leader" banner variant
    // ("Your church is verified. Your leader access opens once the
    // Replant team confirms your account.") from this same signal.
    return {
      kind: "pending",
      verification_deadline: null,
      days_remaining: null,
    };
  }

  if (churchStatus === "rejected") {
    // Flow-gaps F4 (2026-07-13): the church was rejected (reject-church.js
    // sets only the church row; this leader's own row stays pending) —
    // carry the church-variant ratified lockout copy. Route stays
    // support_contact.
    return {
      kind: "deactivated",
      recovery_path: "support_contact",
      lockout_reason: "church_rejected",
    };
  }

  if (churchStatus === "deactivated") {
    // Leader is attached to a church that is no longer in good standing.
    // They cannot proceed via this church. Route to support — admin
    // will work out the leader's path (rejoin a different church,
    // appeal, etc.). Deliberately NO lockout_reason — church deactivation
    // keeps today's generic copy (SEC Panel A required change 4.3).
    return { kind: "deactivated", recovery_path: "support_contact" };
  }

  // churchStatus === "pending" (or null — anomaly on missing church row).
  // Church-side 30-day deadline drives the outcome.
  const deadline = row.church?.verification_deadline ?? null;
  if (deadline === null) {
    // Anomaly — pending church missing its deadline. Fail-closed per
    // the original Option Y intent (this branch was always correct).
    return { kind: "deactivated", recovery_path: "support_contact" };
  }

  const now = Date.parse(nowISO);
  const dl = Date.parse(deadline);
  if (Number.isNaN(now) || Number.isNaN(dl)) throw new Error("Invalid timestamp");

  if (dl <= now) {
    return {
      kind: "pending_past_deadline_needs_write",
      verification_deadline: deadline,
      isSkipFlow: false,
    };
  }

  return {
    kind: "pending",
    verification_deadline: deadline,
    days_remaining: daysRemaining(deadline, nowISO),
  };
}

export function buildResponse(resolved: ResolvedStatus): AuthStatusResponse {
  switch (resolved.kind) {
    case "active":
      return { verification_status: "active", verification_deadline: null, days_remaining: null };
    case "pending":
      return {
        verification_status: "pending",
        verification_deadline: resolved.verification_deadline,
        days_remaining: resolved.days_remaining,
      };
    case "deactivated": {
      const body: AuthStatusResponse = {
        verification_status: "deactivated",
        verification_deadline: null,
        days_remaining: null,
        recovery_path: resolved.recovery_path,
      };
      // Omit-when-absent (never null/default) — same posture as
      // branch_substate. Old clients ignore the unknown key and render
      // the generic deactivated copy.
      if (resolved.lockout_reason !== undefined) {
        body.lockout_reason = resolved.lockout_reason;
      }
      return body;
    }
    case "pending_past_deadline_needs_write":
      // KAN-36 v2 (SEC c.14235 #2) — login-check just-flipped a pending
      // user past their deadline. Same trigger as cron.
      //
      // KAN-TBD 2026-06-18 — when isSkipFlow, route to support_contact
      // instead of verification_renewal: the skip leader has no church
      // to renew, so the "renewal" copy variant doesn't apply. They
      // need a human conversation to be reinstated.
      return {
        verification_status: "deactivated",
        verification_deadline: null,
        days_remaining: null,
        recovery_path: resolved.isSkipFlow ? "support_contact" : "verification_renewal",
      };
  }
}

// Underground reveal eligibility — pure function over already-fetched
// rows. The handler does the DB lookups; this function decides whether
// the flag should be set TRUE on the outgoing response.
//
// Inputs:
//   - callerUserId: viewer's public.users.id
//   - church: { id, type, verification_status, underground_join_code_revealed_at }
//   - foundingLeaderId: oldest active leader (created_at ASC LIMIT 1) on that church
//
// All four conditions must hold for true.
export function isUndergroundJoinCodePendingReveal(args: {
  callerUserId: string;
  churchType: string | null;
  churchVerificationStatus: string | null;
  undergroundJoinCodeRevealedAt: string | null;
  foundingLeaderId: string | null;
}): boolean {
  if (args.churchType !== "underground") return false;
  if (args.churchVerificationStatus !== "verified") return false;
  if (args.undergroundJoinCodeRevealedAt !== null) return false;
  if (args.foundingLeaderId === null) return false;
  if (args.foundingLeaderId !== args.callerUserId) return false;
  return true;
}

// Underground Verification Queue substate resolver (2026-06-22),
// extended for KAN-205 self-deletion (SEC panel 2026-07-03, ratified).
//
// Pure function over the already-fetched row. The handler decorates
// the response when this returns non-undefined. Priority:
//   1. USER soft_deleted_at IS NOT NULL with reason 'leader_initiated'
//      → 'self_deleted' (KAN-205 — the leader's own act trumps every
//      church-derived state; checked FIRST per the SEC design §2.2).
//      Applies to skip-flow leaders too (they can self-delete; before
//      KAN-205 they were excluded from substates entirely).
//   2. church soft_deleted_at IS NOT NULL → 'soft_deleted' (admin
//      rejection ceremony — unchanged. A user soft-deleted with an
//      ADMIN reason always has the church mirror set by the same
//      two-eyes confirm, so it lands here, not in 'self_deleted').
//   3. last_outcome_modal_kind === 'request_info' → 'request_info'
//   4. else undefined (no decoration)
//
// Generic chrome invariant: this field is OMITTED entirely when not
// applicable. Don't advertise the state machine to viewers it doesn't
// apply to.
export function resolveBranchSubstate(row: UserStatusRow): BranchSubstate | undefined {
  // KAN-205 — USER-level check FIRST. Only the leader-initiated reason
  // maps to the self-restore ceremony; admin-initiated soft-deletes keep
  // routing through the church-derived 'soft_deleted' rejection surface.
  if (row.soft_deleted_at !== null && row.soft_delete_reason === "leader_initiated") {
    return "self_deleted";
  }
  if (row.church_id === null) return undefined;
  if (row.church === null) return undefined;
  if (row.church.soft_deleted_at !== null) return "soft_deleted";
  if (row.church.last_outcome_modal_kind === "request_info") return "request_info";
  return undefined;
}

export function buildAuditRow(
  userId: string,
  churchId: string | null,
  nowISO: string,
): AuditLogRow {
  return {
    accessed_by: null,
    triggered_by: "system",
    action: "deactivate_user",
    church_id: churchId,
    accessed_at: nowISO,
    meta: { trigger: "login_check", user_id: userId },
  };
}
