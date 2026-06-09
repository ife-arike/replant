// useConnectionRequest — typed wrappers for the 5 connection_requests RPCs.
//
// All writes go through SECURITY DEFINER RPCs (no direct table writes from
// the FE — matches the RLS posture where only the RPCs may write).
// The caller's identity is resolved server-side via auth.uid() inside each
// RPC — we never pass a sender_id parameter.
//
// Error codes match the RPC RAISE exception strings from
// 20260609000003_connect_request_flow_v1.sql. Each is mapped to a
// user-friendly message string for display in toasts / inline notices.
//
// SAFE-LOG: message content NEVER appears in any log statement — mirror
// the send-message edge-fn posture. We log request_id, status, and
// user-safe error labels only.

import { supabase } from '../lib/supabase';

// ── error mapping ─────────────────────────────────────────────────────
// SEC condition F2: we do NOT distinguish recipient_not_found,
// recipient_not_verified, pending_request_exists, conversation_exists,
// cooldown_active — they all surface as the same opaque "can't send"
// message to prevent social-graph enumeration. The raw code is
// preserved for future server-side SAFE-LOG use only.
const SEND_ERROR_DISPLAY_MESSAGES: Record<string, string> = {
  // Opaque bucket — all map to the same user-facing copy (F2).
  recipient_not_found: "This request couldn't be sent right now.",
  recipient_not_verified: "This request couldn't be sent right now.",
  request_already_pending: "This request couldn't be sent right now.",
  pending_request_exists: "This request couldn't be sent right now.",
  conversation_exists: "This request couldn't be sent right now.",
  cooldown_active: "This request couldn't be sent right now.",
  // Addressable errors the FE can communicate clearly.
  not_verified_sender: 'Your account needs to be verified before you can send requests.',
  invalid_recipient: 'The leader you selected is no longer available.',
  invalid_message: 'Your message is too short or too long.',
  not_authorized: "You don't have permission to do that.",
  invalid_action: 'Invalid action.',
  request_not_found: 'This request no longer exists.',
  not_recipient: "You can't respond to a request you didn't receive.",
  request_not_pending: 'This request has already been resolved.',
  not_sender: "You can't modify a request you didn't send.",
  request_not_removable: 'This request can only be removed once declined or expired.',
  // ── get_or_create_conversation_if_permitted (20260609000006) ──
  // requires_connection_request is NOT an error — it's a routing signal.
  // It is intentionally NOT in the opaque enumeration-defence bucket: the
  // FE MUST be able to distinguish it to fall back to the request flow.
  // We still surface it through ConnectionRequestError (the catch site
  // branches on `.code === 'requires_connection_request'`), so it carries
  // a neutral non-alarming message in case it ever reaches a toast.
  requires_connection_request: 'A connection request is needed to reach this leader.',
};

function extractErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'unknown';
  // Supabase PostgrestError shape — message often encodes the RAISE code.
  const e = error as Record<string, unknown>;
  // RAISE EXCEPTION codes come through in e.message, e.code, or e.details.
  // The pattern from 20260609000003 is: RAISE EXCEPTION 'code' USING ERRCODE = '...'.
  // PostgREST surfaces the message in the `message` field.
  const msg = String(e.message ?? '');
  const hint = String(e.hint ?? '');
  const detail = String(e.details ?? '');
  const raw = `${msg} ${hint} ${detail}`.toLowerCase();
  for (const code of Object.keys(SEND_ERROR_DISPLAY_MESSAGES)) {
    if (raw.includes(code)) return code;
  }
  return 'unknown';
}

export class ConnectionRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ConnectionRequestError';
  }
}

function toDisplayError(rawError: unknown): ConnectionRequestError {
  const code = extractErrorCode(rawError);
  const message =
    SEND_ERROR_DISPLAY_MESSAGES[code] ??
    "Something went wrong. Please try again.";
  return new ConnectionRequestError(code, message);
}

// ── sendConnectionRequest ─────────────────────────────────────────────
// Creates a connection request from the caller to recipientId.
// Returns the new request_id (uuid).
// Throws ConnectionRequestError on failure.
export async function sendConnectionRequest(
  recipientId: string,
  message: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('send_connection_request', {
    p_recipient_id: recipientId,
    p_message: message,
  });
  if (error) throw toDisplayError(error);
  if (!data) throw new ConnectionRequestError('unknown', 'Something went wrong. Please try again.');
  return data as string;
}

// ── respondToRequest ──────────────────────────────────────────────────
// Accepts or declines an incoming request.
// action: 'accept' | 'decline'
// Returns the conversation_id on accept, null on decline.
// Throws ConnectionRequestError on failure.
export async function respondToRequest(
  requestId: string,
  action: 'accept' | 'decline',
): Promise<string | null> {
  const { data, error } = await supabase.rpc('respond_to_connection_request', {
    p_request_id: requestId,
    p_action: action,
  });
  if (error) throw toDisplayError(error);
  return (data as string | null) ?? null;
}

// ── getOrCreateConversationIfPermitted ────────────────────────────────
// Same-network bypass (20260609000006). When the caller and recipient are
// already in-network (same church OR a shared active branch) the
// connection-request consent layer is unnecessary — this RPC find-or-
// creates the conversation directly and returns its conversation_id.
//
// When the pair is NOT in-network the RPC raises `requires_connection_request`.
// We throw a ConnectionRequestError carrying that code so the navigation
// layer can branch: code === 'requires_connection_request' → open the
// thread in request mode; otherwise → open the existing conversation.
//
// Returns the conversation_id (uuid) on success.
// Throws ConnectionRequestError on every failure (including the
// requires_connection_request routing signal).
export async function getOrCreateConversationIfPermitted(
  recipientId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    'get_or_create_conversation_if_permitted',
    { p_recipient_id: recipientId },
  );
  if (error) throw toDisplayError(error);
  if (!data) {
    throw new ConnectionRequestError('unknown', 'Something went wrong. Please try again.');
  }
  return data as string;
}

// ── withdrawRequest ───────────────────────────────────────────────────
// Withdraws an outgoing pending request (caller must be sender).
// The 3-day affordance check is FE-only — the RPC has no age gate.
// Throws ConnectionRequestError on failure.
export async function withdrawRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_connection_request', {
    p_request_id: requestId,
  });
  if (error) throw toDisplayError(error);
}

// ── removeRequest ─────────────────────────────────────────────────────
// Hard-deletes a declined/expired/withdrawn request row (caller must be
// sender). Removes the row from the Leaders list.
// Throws ConnectionRequestError on failure.
export async function removeRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_connection_request', {
    p_request_id: requestId,
  });
  if (error) throw toDisplayError(error);
}
