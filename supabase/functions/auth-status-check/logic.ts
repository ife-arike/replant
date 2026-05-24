// Type definitions duplicated locally rather than imported from /types/auth.ts so the
// edge runtime bundle has no out-of-tree imports to resolve. Must stay in lockstep
// with /types/auth.ts (the canonical FE source). Both derive from the locked contract
// in KAN-44 comment 10292.
export type VerificationStatus = "active" | "pending" | "deactivated";

export interface AuthStatusResponse {
  verification_status: VerificationStatus;
  verification_deadline: string | null;
  days_remaining: number | null;
}

export type DbVerificationStatus = "pending" | "verified" | "deactivated";

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
  | { kind: "deactivated" }
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
  if (row.verification_status === "deactivated") return { kind: "deactivated" };

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
    return { kind: "deactivated" };
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
    case "pending_past_deadline_needs_write":
      return { verification_status: "deactivated", verification_deadline: null, days_remaining: null };
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
