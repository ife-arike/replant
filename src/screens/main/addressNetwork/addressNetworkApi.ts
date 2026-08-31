// ─────────────────────────────────────────────
// Address the Network — client api layer.
//
// The client talks ONLY to SECURITY DEFINER RPCs (KAN-337). The intake
// table public.content_submissions is RLS deny-all; direct reads/writes
// are impossible by design, so every call here is an RPC.
//
// All five RPCs are DEPLOYED (verified live 2026-08-10). KAN-345: the
// pre-deployment in-memory stub fallback is gone — it fired on ANY RPC
// error (not just function-absent) and fabricated success, so a failed
// publish showed the leader "live" while nothing reached the server.
// Every function now THROWS on RPC error; callers own the error UI.
//
// Server contract this layer assumes (per the CD pack §Data/backend):
//   - submit: author + church_id resolved from JWT; UNDERGROUND authors
//     have attribution FORCED to role_region server-side regardless of the
//     value sent (defense in depth). Byline/region are resolved by the
//     feed's own helpers, never sent from the client.
//   - open cap of 2 is enforced server-side (per leader).
// ─────────────────────────────────────────────

import { supabase } from '../../../lib/supabase';
import type {
  ATNType,
  Attribution,
  Submission,
  SubmissionStatus,
  SubmitInput,
} from './types';

// RPC names — MUST match the parallel-lane migrations. Change here only.
export const RPC = {
  submit: 'content_submission_create',
  list: 'content_submissions_list_mine',
  publish: 'content_submission_publish',
  requestChanges: 'content_submission_request_changes',
  withdraw: 'content_submission_withdraw',
} as const;

// content_submissions.type ⇄ client ATNType.
const DB_TYPE: Record<ATNType, string> = {
  word: 'word_for_today',
  testimony: 'testimony',
};

function toClientType(dbType: unknown): ATNType {
  return dbType === 'testimony' ? 'testimony' : 'word';
}

// content_submissions.status ⇄ leader-facing SubmissionStatus.
//   pending              → in_review
//   edits_pending_leader → edits_proposed
//   approved / approved_with_edits (published) → live
//   declined             → declined
function toClientStatus(dbStatus: unknown): SubmissionStatus {
  switch (dbStatus) {
    case 'edits_pending_leader':
      return 'edits_proposed';
    case 'declined':
      return 'declined';
    case 'approved':
    case 'approved_with_edits':
    case 'live':
      return 'live';
    case 'pending':
    default:
      return 'in_review';
  }
}

// Defensive shape of a row the list RPC returns. Everything optional so a
// partial/renamed field degrades to a sane default rather than crashing.
interface RpcRow {
  id?: string;
  type?: string;
  title?: string | null;
  body?: string | null;
  status?: string;
  attribution?: string | null;
  proposed_title?: string | null;
  proposed_body?: string | null;
  decline_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  live_since?: string | null;
  published_at?: string | null;
}

function toSubmission(row: RpcRow): Submission {
  const status = toClientStatus(row.status);
  return {
    id: String(row.id ?? cryptoId()),
    type: toClientType(row.type),
    title: row.title ?? null,
    body: row.body ?? '',
    status,
    attribution: row.attribution === 'show_name' ? 'show_name' : 'role_region',
    proposedTitle: row.proposed_title ?? null,
    proposedBody: row.proposed_body ?? null,
    declineReason: row.decline_reason ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    liveSince: status === 'live' ? (row.live_since ?? row.published_at ?? null) : null,
  };
}

// Defensive id for a malformed row that arrives without one — display-only.
function cryptoId(): string {
  return 'atn-' + Math.random().toString(36).slice(2, 10);
}

// ── public api ────────────────────────────────────────────────────────

export async function fetchSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase.rpc(RPC.list);
  if (error) throw error;
  const rows = Array.isArray(data) ? (data as RpcRow[]) : [];
  return rows.map(toSubmission);
}

export async function submitAddressNetwork(input: SubmitInput): Promise<Submission> {
  const { data, error } = await supabase.rpc(RPC.submit, {
    p_type: DB_TYPE[input.type],
    p_title: input.title,
    p_body: input.body,
    p_attribution: input.attribution,
  });
  if (error) throw error;
  // Real RPC may return the created row, or just an id — normalise.
  const row = (Array.isArray(data) ? data[0] : data) as RpcRow | null;
  if (row && (row.id || row.status)) return toSubmission(row);
  // Minimal echo — construct from what we sent so the UI can proceed.
  return toSubmission({
    id: typeof data === 'string' ? data : undefined,
    type: DB_TYPE[input.type],
    title: input.title,
    body: input.body,
    status: 'pending',
    attribution: input.attribution,
    created_at: new Date().toISOString(),
  });
}

export async function publishSubmission(id: string): Promise<void> {
  const { error } = await supabase.rpc(RPC.publish, { p_submission_id: id });
  if (error) throw error;
}

export async function requestChanges(id: string, note: string): Promise<void> {
  const { error } = await supabase.rpc(RPC.requestChanges, {
    p_submission_id: id,
    p_note: note,
  });
  if (error) throw error;
}

export async function withdrawSubmission(id: string): Promise<void> {
  const { error } = await supabase.rpc(RPC.withdraw, { p_submission_id: id });
  if (error) throw error;
}
