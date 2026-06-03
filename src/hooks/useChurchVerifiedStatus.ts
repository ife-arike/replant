// useChurchVerifiedStatus — distinguishes two "pending" leader scenarios:
//
//   churchVerified = true  → second leader joining an already-verified
//                            church (rag_status green/amber/red). The
//                            church is in the network; only the leader's
//                            personal account needs confirmation.
//   churchVerified = false → original leader whose church is still pending
//                            verification by the Replant team.
//   churchVerified = null  → check in flight (caller should default to
//                            the church-pending variant while loading).
//
// Only runs when branch === 'pending'. Active leaders don't need this.
// Follows the same single-round-trip join pattern as useViewerChurch.

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '../lib/supabase';

const VERIFIED_RAG = ['green', 'amber', 'red'];

async function checkChurchVerified(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authId = sessionData?.session?.user?.id;
  if (!authId) return false;

  // FK hint required: see useChurchesGlobal comment — same disambiguation needed.
  const { data, error } = await supabase
    .from('users')
    .select('churches!users_church_id_fkey ( rag_status )')
    .eq('auth_id', authId)
    .single();

  if (error || !data) return false;

  const row = data as unknown as {
    churches: { rag_status: string | null } | { rag_status: string | null }[] | null;
  };
  const c = Array.isArray(row.churches) ? (row.churches[0] ?? null) : row.churches;
  return VERIFIED_RAG.includes(c?.rag_status ?? '');
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
