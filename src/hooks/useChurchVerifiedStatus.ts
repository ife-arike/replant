// useChurchVerifiedStatus — distinguishes two "pending" leader scenarios:
//
//   churchVerified = true  → second leader joining an already-verified
//                            church (verification_status='verified'). The
//                            church is in the network; only the leader's
//                            personal account needs confirmation.
//   churchVerified = false → original leader whose church is still pending
//                            verification by the Replant team (or any
//                            non-verified status).
//   churchVerified = null  → check in flight (caller should default to
//                            the church-pending variant while loading).
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

async function checkChurchVerified(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authId = sessionData?.session?.user?.id;
  if (!authId) return false;

  // FK hint required: see useChurchesGlobal comment — same disambiguation needed.
  const { data, error } = await supabase
    .from('users')
    .select('churches!users_church_id_fkey ( verification_status )')
    .eq('auth_id', authId)
    .single();

  if (error || !data) return false;

  const row = data as unknown as {
    churches: { verification_status: string | null } | { verification_status: string | null }[] | null;
  };
  const c = Array.isArray(row.churches) ? (row.churches[0] ?? null) : row.churches;
  return c?.verification_status === 'verified';
}

export function useChurchVerifiedStatus(): boolean | null {
  const { branch } = useAuth();
  const [churchVerified, setChurchVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (branch !== 'pending') {
      setChurchVerified(null);
      return;
    }

    let cancelled = false;

    checkChurchVerified()
      .then((v) => { if (!cancelled) setChurchVerified(v); })
      .catch(() => { if (!cancelled) setChurchVerified(false); });

    return () => { cancelled = true; };
  }, [branch]);

  return churchVerified;
}
