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

export interface AuthStatusResponse {
  verification_status: VerificationStatus;
  verification_deadline: string | null;
  days_remaining: number | null;
  // Present iff verification_status === "deactivated". Omitted on
  // "active" and "pending" bodies — the FE only branches copy when the
  // user has landed on the deactivated surface.
  recovery_path?: RecoveryPath;
}

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
  church: { verification_deadline: string | null } | null;
}

export type ResolvedStatus =
  | { kind: "active" }
  | { kind: "pending"; verification_deadline: string; days_remaining: number }
  | { kind: "deactivated"; recovery_path: RecoveryPath }
  | { kind: "pending_past_deadline_needs_write"; verification_deadline: string };

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
    return { kind: "deactivated", recovery_path: "support_contact" };
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
    if (deactDeadline !== null) {
      const dl = Date.parse(deactDeadline);
      const now = Date.parse(nowISO);
      if (Number.isNaN(dl) || Number.isNaN(now)) throw new Error("Invalid timestamp");
      if (dl <= now) return { kind: "deactivated", recovery_path: "verification_renewal" };
    }
    return { kind: "deactivated", recovery_path: "support_contact" };
  }

  const deadline = row.church?.verification_deadline ?? null;
  if (deadline === null) {
    // KAN-36 (Founder Option Y, SEC c.14194, locked 2026-05-21) —
    // NULL deadline is fail-closed. Two real ways this lands here:
    //   (1) `users.church_id IS NULL` — skip-flow leader, no church
    //       attached. The embedded `church:churches(...)` join returns
    //       null, so `row.church?.verification_deadline` is null.
    //   (2) `users.church_id` is set but the church row's
    //       verification_deadline is NULL — data-integrity anomaly or
    //       a legacy / test row that bypassed onboarding's deadline
    //       computation.
    // Both surfaces are fail-closed per Founder lock. Return the
    // deactivated branch WITHOUT calling deactivateAtomically:
    //   - For (1) the user has no church_id to write deactivation
    //     against in a meaningful way for the audit-log forensic
    //     surface (the audit row's church_id would be null, and the
    //     meta would have no missed deadline to record).
    //   - For (2) the anomaly is the missing deadline itself, not a
    //     deadline that was missed. The atomic UPDATE + audit-log path
    //     is reserved for the deadline-passed case where the audit row
    //     tagged trigger: "login_check" has forensic value about
    //     which deadline was crossed. NULL-deadline anomalies belong
    //     to a different forensic surface (data-integrity audit).
    // Net: branch flips to "deactivated"; RootNavigator routes the
    // user to the deactivated screen; login flow stops. Persistence
    // of the deactivated state for these users falls to (a) a
    // subsequent write that backfills the deadline + flips status,
    // or (b) admin operator action. SEC 11015 #3a preserved — no
    // throw, no 5xx, session not retained false-positively.
    //
    // KAN-36 v2 (SEC c.14235 #6, locked 2026-05-24) — NULL-deadline
    // fail-closed MUST map to recovery_path: "support_contact", not
    // verification_renewal. Founder Option Y lock (2026-05-21) is
    // about the fail-closed *routing*; SEC c.14235 #6 is the explicit
    // ruling that the recovery_path on this branch is the support
    // bucket. A leader with no deadline cannot meaningfully "renew"
    // a window that was never set; the only forward path is a
    // human conversation.
    return { kind: "deactivated", recovery_path: "support_contact" };
  }
  const now = Date.parse(nowISO);
  const dl = Date.parse(deadline);
  if (Number.isNaN(now) || Number.isNaN(dl)) throw new Error("Invalid timestamp");
  if (dl <= now) {
    return { kind: "pending_past_deadline_needs_write", verification_deadline: deadline };
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
    case "deactivated":
      return {
        verification_status: "deactivated",
        verification_deadline: null,
        days_remaining: null,
        recovery_path: resolved.recovery_path,
      };
    case "pending_past_deadline_needs_write":
      // KAN-36 v2 (SEC c.14235 #2) — login-check just-flipped a pending
      // user past their deadline. Same trigger as cron, so the response
      // collapses with the cron-deactivated past-deadline case to
      // recovery_path: "verification_renewal". The two paths remain
      // byte-identical inside the renewal bucket; only the renewal/
      // support distinction is intentionally exposed.
      return {
        verification_status: "deactivated",
        verification_deadline: null,
        days_remaining: null,
        recovery_path: "verification_renewal",
      };
  }
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
