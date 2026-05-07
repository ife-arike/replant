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
    // Pending without a church-attached deadline is a data-integrity anomaly:
    // schema makes churches.verification_deadline NOT NULL and onboarding always
    // attaches a church before the user can authenticate. Surface as 5xx via the
    // caller's catch-all rather than fabricate a deadline.
    throw new Error("Pending user has no church verification_deadline");
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
