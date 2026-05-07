// Canonical types for the submit-heartcry contract — KAN-66.
//
// Both the FE (KAN-64 form) and the Edge Function (supabase/functions/submit-heartcry)
// derive from this. The Edge Function duplicates these types locally in
// supabase/functions/submit-heartcry/logic.ts so the runtime bundle has no out-of-tree
// imports — the duplicate must stay in lockstep with this file.
//
// Spec: KAN-66 AC; D-26 (triage routing), D-30 (severity values), v2.2 §08
// Screen 15 + Heartcry Delivery — Admin Side; SEC G-22/G-23/G-24 closed.

export type HeartcrySeverity =
  | "active_persecution"
  | "urgent"
  | "serious"
  | "ongoing"
  | "informational";

export type HeartcryRequestType =
  | "prayer"
  | "practical_support"
  | "guidance"
  | "just_to_be_heard";

export interface SubmitHeartcryRequestBody {
  content: string;
  severity: HeartcrySeverity;
  request_type: HeartcryRequestType[] | null;
}

export interface SubmitHeartcrySuccessResponse {
  success: true;
}

export interface SubmitHeartcryValidationErrorResponse {
  error: "validation_failed";
  detail: string;
}

export type SubmitHeartcryErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN_NOT_VERIFIED"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export interface SubmitHeartcryGenericErrorResponse {
  error: string;
  code: SubmitHeartcryErrorCode;
}
