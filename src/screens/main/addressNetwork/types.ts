// ─────────────────────────────────────────────
// Address the Network — shared types + small pure helpers.
//
// The leader-facing status vocabulary (in_review / edits_proposed / live /
// declined) is mapped from public.content_submissions.status at the api
// boundary (addressNetworkApi.ts). The client never touches the table
// directly — RLS is deny-all; everything goes through SECURITY DEFINER
// RPCs (KAN-337 intake contract).
// ─────────────────────────────────────────────

// Only two live types this build. 'family' (A Word from your Family) is a
// coming-soon row that opens ComingSoonModal — it is never a composable
// value (KAN-337: family_word stays as a discriminator on the table so it
// slots in later, but there is no client compose path for it yet).
export type ATNType = 'word' | 'testimony';

export type Attribution = 'show_name' | 'role_region';

export type SubmissionStatus = 'in_review' | 'edits_proposed' | 'live' | 'declined';

export interface Submission {
  id: string;
  type: ATNType;
  title: string | null;
  body: string;
  status: SubmissionStatus;
  attribution: Attribution;
  // Present only while status === 'edits_proposed' — the team's proposed
  // version, read alongside the leader's original in the review screen.
  proposedTitle: string | null;
  proposedBody: string | null;
  // Present only while status === 'declined' — the team's warm, actionable
  // reason (always shown, never hidden behind a tap).
  declineReason: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  liveSince: string | null; // ISO — set when status === 'live'
}

export interface SubmitInput {
  type: ATNType;
  title: string | null;
  body: string;
  attribution: Attribution;
}

// Concurrency cap — per leader, two OPEN at once (Ruling 6). Not a rate.
export const OPEN_CAP = 2;

export const TYPE_LABEL: Record<ATNType, string> = {
  word: 'A Word for Today',
  testimony: 'Testimony',
};

export const TYPE_DESTINATION: Record<ATNType, string> = {
  word: 'A short encouragement, published to the Home feed.',
  testimony: 'Something God has done, published to the Home feed.',
};

// Body field label per type (Testimony delta, §D).
export const BODY_LABEL: Record<ATNType, string> = {
  word: 'Your word',
  testimony: 'Your testimony',
};

// Default kicker when a Word for Today carries no title (Ruling 1).
export const DEFAULT_WORD_KICKER = 'A word for today';

export function isOpenStatus(status: SubmissionStatus): boolean {
  return status === 'in_review' || status === 'edits_proposed';
}

export function openCountOf(subs: readonly Submission[]): number {
  return subs.reduce((n, s) => (isOpenStatus(s.status) ? n + 1 : n), 0);
}

export function hasEditsProposed(subs: readonly Submission[]): boolean {
  return subs.some((s) => s.status === 'edits_proposed');
}
