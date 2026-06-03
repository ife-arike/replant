// KAN-22 — viewer's own church (name + type) for the Post-a-Request modal.
//
// Separate from useChurchesGlobal (which fetches own church_id + country
// for the globe). This hook gives the modal what it needs to render the
// non-editable attribution line:
//
//   standard    → "This request will be posted on behalf of {name}."
//   underground → "This request will be posted anonymously on behalf of
//                  your church."
//
// Verification is read from useAuth().branch (no fetch needed); this
// hook is strictly the church-identity bit.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ViewerChurch {
  name: string | null;
  type: string | null;
  isUnderground: boolean;
}

export interface UseViewerChurchResult {
  church: ViewerChurch | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

async function fetchViewerChurch(): Promise<ViewerChurch | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authId = sessionData?.session?.user?.id;
  if (!authId) return null;

  // FK hint required: churches.profile_completion_done_by (KAN-213) creates
  // a second FK between users and churches, so PostgREST needs explicit
  // disambiguation via the constraint name.
  const { data, error } = await supabase
    .from('users')
    .select('churches!users_church_id_fkey ( name, type )')
    .eq('auth_id', authId)
    .single();

  if (error || !data) return null;

  // supabase-js types the joined relationship one-or-many; treat defensively.
  const row = data as unknown as {
    churches: { name: string | null; type: string | null } | { name: string | null; type: string | null }[] | null;
  };
  const c = Array.isArray(row.churches) ? (row.churches[0] ?? null) : row.churches;
  if (!c) return null;
  return {
    name: c.name ?? null,
    type: c.type ?? null,
    isUnderground: c.type === 'underground',
  };
}

export function useViewerChurch(): UseViewerChurchResult {
  const [church, setChurch] = useState<ViewerChurch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await fetchViewerChurch();
      setChurch(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { church, loading, error, refetch: load };
}
