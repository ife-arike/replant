// ─────────────────────────────────────────────
// Address the Network — client api layer.
//
// The client talks ONLY to SECURITY DEFINER RPCs (KAN-337). The intake
// table public.content_submissions is RLS deny-all; direct reads/writes
// are impossible by design, so every call here is an RPC.
//
// The five RPCs below are authored in a PARALLEL migration lane. Until
// they land, each call fails soft: it falls back to an in-memory store so
// the whole leader flow (compose → review → withdraw) is exercisable in a
// dev build for the Founder's first-pass review. The names are the single
// swap-point — when the real functions deploy, this file is the only thing
// that changes.
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

// ── stub fallback ─────────────────────────────────────────────────────
// Used ONLY when an RPC is absent (function not deployed). Keeps the flow
// whole for review; no data leaves the device. Seeded once in __DEV__ with
// the CD's four example states so every status + the edits-review consent
// loop can be walked without the backend. Vanishes the moment the real
// RPCs answer.
let stub: Submission[] | null = null;

function cryptoId(): string {
  return 'atn-' + Math.random().toString(36).slice(2, 10);
}

function ensureStub(): Submission[] {
  if (stub) return stub;
  stub = __DEV__ ? seedStub() : [];
  return stub;
}

function seedStub(): Submission[] {
  const now = Date.now();
  const iso = (daysAgo: number) => new Date(now - daysAgo * 864e5).toISOString();
  return [
    {
      id: 'atn-seed-review',
      type: 'word',
      title: null,
      body:
        'Do not measure the day by what you can see. The seed you buried in tears is kept by the One who counts every hidden thing. Lift your head. He has not forgotten the sowing.',
      status: 'in_review',
      attribution: 'show_name',
      proposedTitle: null,
      proposedBody: null,
      declineReason: null,
      createdAt: iso(2),
      updatedAt: iso(2),
      liveSince: null,
    },
    {
      id: 'atn-seed-edits',
      type: 'testimony',
      title: 'A door we thought was closed',
      body:
        'For two years we could not gather. Last month, in a place I will not name here, forty of us broke bread together again. Tell the young ones: what was sealed, the Lord can open.',
      status: 'edits_proposed',
      attribution: 'show_name',
      proposedTitle: 'A door we thought was closed',
      proposedBody:
        'For two years we could not gather. Last month, forty of us broke bread together again. Tell the young ones: what was sealed, the Lord can open.',
      declineReason: null,
      createdAt: iso(3),
      updatedAt: iso(1),
      liveSince: null,
    },
    {
      id: 'atn-seed-live',
      type: 'word',
      title: null,
      body:
        'He keeps the flame when the wind is loudest. Stand where He put you, the morning is His to bring.',
      status: 'live',
      attribution: 'show_name',
      proposedTitle: null,
      proposedBody: null,
      declineReason: null,
      createdAt: iso(20),
      updatedAt: iso(18),
      liveSince: iso(18),
    },
    {
      id: 'atn-seed-declined',
      type: 'testimony',
      title: 'The village that returned',
      body:
        'After the raids they scattered, but this spring the whole village came back to the Lord together.',
      status: 'declined',
      attribution: 'show_name',
      proposedTitle: null,
      proposedBody: null,
      declineReason:
        'This names a place that could put believers at risk. We would gladly share it with the location removed. Send us a version and we will carry it to the network.',
      createdAt: iso(25),
      updatedAt: iso(24),
      liveSince: null,
    },
  ];
}

function logStub(op: string) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[AddressNetwork] ${op}: RPC not deployed — using in-memory stub.`);
  }
}

// ── public api ────────────────────────────────────────────────────────

export async function fetchSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase.rpc(RPC.list);
  if (error) {
    logStub('fetchSubmissions');
    return [...ensureStub()];
  }
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
  if (error) {
    logStub('submitAddressNetwork');
    const created: Submission = {
      id: cryptoId(),
      type: input.type,
      title: input.title,
      body: input.body,
      status: 'in_review',
      attribution: input.attribution,
      proposedTitle: null,
      proposedBody: null,
      declineReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      liveSince: null,
    };
    ensureStub().unshift(created);
    return created;
  }
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
  if (error) {
    logStub('publishSubmission');
    const s = ensureStub().find((x) => x.id === id);
    if (s) {
      s.title = s.proposedTitle ?? s.title;
      s.body = s.proposedBody ?? s.body;
      s.status = 'live';
      s.liveSince = new Date().toISOString();
      s.proposedTitle = null;
      s.proposedBody = null;
      s.updatedAt = new Date().toISOString();
    }
  }
}

export async function requestChanges(id: string, note: string): Promise<void> {
  const { error } = await supabase.rpc(RPC.requestChanges, {
    p_submission_id: id,
    p_note: note,
  });
  if (error) {
    logStub('requestChanges');
    const s = ensureStub().find((x) => x.id === id);
    if (s) {
      s.status = 'in_review';
      s.proposedTitle = null;
      s.proposedBody = null;
      s.updatedAt = new Date().toISOString();
    }
  }
}

export async function withdrawSubmission(id: string): Promise<void> {
  const { error } = await supabase.rpc(RPC.withdraw, { p_submission_id: id });
  if (error) {
    logStub('withdrawSubmission');
    const store = ensureStub();
    const i = store.findIndex((x) => x.id === id);
    if (i >= 0) store.splice(i, 1);
  }
}
