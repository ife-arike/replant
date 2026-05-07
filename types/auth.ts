export type VerificationStatus = "active" | "pending" | "deactivated";

export interface AuthStatusResponse {
  verification_status: VerificationStatus;
  verification_deadline: string | null;
  days_remaining: number | null;
}

export type AuthStatusErrorCode = "UNAUTHORIZED" | "INTERNAL_ERROR";

export interface AuthStatusErrorResponse {
  error: string;
  code: AuthStatusErrorCode;
}
