// useChurchVerifiedStatus — distinguishes the "pending" leader scenarios:
//
//   'verified'     → second leader joining an already-verified church
//                    (verification_status='verified'). The church is in the
//                    network; only the leader's personal account needs
//                    confirmation.
//   'not_verified' → original leader whose church is still pending
//                    verification by the Replant team (or any non-verified
//                    status), per a SUCCESSFUL read.
//   'error'        → the read FAILED (KAN-346) — we do not know either way.
//                    Consumers render the conservative church-pending
//                    variant for this state by explicit choice; it must
//                    never be conflated with a real 'not_verified' verdict.
//   null           → check in flight (caller should default to the
//                    church-pending variant while loading).
//
// Bug fix 2026-06-14 (Founder report): hook previously read rag_status
// (safety/risk indicator: green/amber/red for persecuted-zone risk) and
// treated any of those as "verified" — wrong column entirely. New-church
// signups land with a default rag_status but verification_status='pending'
// → banner picked the leader variant and falsely said "Your church is
// verified." Read verification_status directly.
//
// Only runs when branch === 'pending'. Active leaders don't need this.
// Follows the same single-round-trip join pattern as useViewerChurch.

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '../lib/supabase';
import {
  resolveChurchVerifiedStatus,
  type ChurchVerifiedStatus,
} from './churchVerifiedStatus';

export type { ChurchVerifiedStatus } from './churchVerifiedStatus';

async function checkChurchVerified(): Promise<Exclude<ChurchVerifiedStatus, null>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authId = sessionData?.session?.user?.id;
  // No hydrated session on a pending-branch surface is an anomaly, not a
  // verification verdict — classify as a failed read.
  if (!authId) return 'error';

  // FK hint required: see useChurchesGlobal comment — same disambiguation needed.
  const { data, error } = await supabase
    .from('users')
    .select('churches!users_church_id_fkey ( verification_status )')
    .eq('auth_id', authId)
    .single();

  const row = data as unknown as {
    churches: { verification_status: string | null } | { verification_status: string | null }[] | null;
  } | null;
  const c = row
    ? Array.isArray(row.churches)
      ? (row.churches[0] ?? null)
      : row.churches
    : null;
  return resolveChurchVerifiedStatus(error ?? (!row ? { missing: true } : null), c?.verification_status);
}

export function useChurchVerifiedStatus(): ChurchVerifiedStatus {
  const { branch } = useAuth();
  const [churchVerified, setChurchVerified] = useState<ChurchVerifiedStatus>(null);

  useEffect(() => {
    if (branch !== 'pending') {
      setChurchVerified(null);
      return;
    }

    let cancelled = false;

    checkChurchVerified()
      .then((v) => { if (!cancelled) setChurchVerified(v); })
      .catch(() => { if (!cancelled) setChurchVerified('error'); });

    return () => { cancelled = true; };
  }, [branch]);

  return churchVerified;
}
