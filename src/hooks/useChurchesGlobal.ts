// KAN-21 — global churches data hook.
//
// Single source of data for the CAL globe (KAN-21 GlobeView):
//   - dots: every active, non-underground, coord-bearing church
//           ({ id, lat, lng, rag_status }) via get_churches_global.
//   - undergroundCount: count of active underground churches via
//           get_underground_count. Drives the "+N hidden" honor chip.
//   - ownChurchId / viewerCountry: the viewer's registered church id +
//           country (NOT live GPS — used to identify the sky-blue own-
//           church dot and to centre the globe's initial camera).
//
// Both RPCs are SECURITY DEFINER, authenticated-only (KAN-21 c.14803),
// and the view-level underground exclusion lives inside
// get_churches_global — so this hook does not (and must not) re-filter.
//
// Fetches all three in parallel via Promise.all on mount. No polling —
// the globe is a snapshot view; explicit `refetch` is exposed for pull-
// to-refresh / future "live" controls.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ChurchDot {
  id: string;
  lat: number;
  lng: number;
  rag_status: string; // 'green' | 'amber' | 'red' (text from the RPC)
}

interface ViewerContext {
  ownChurchId: string | null;
  viewerCountry: string | null;
}

export interface UseChurchesGlobalResult {
  dots: ChurchDot[];
  undergroundCount: number;
  ownChurchId: string | null;
  viewerCountry: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

async function fetchDots(): Promise<{ rows: ChurchDot[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_churches_global');
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as ChurchDot[], error: null };
}

async function fetchUndergroundCount(): Promise<{ count: number; error: string | null }> {
  const { data, error } = await supabase.rpc('get_underground_count');
  if (error) return { count: 0, error: error.message };
  // Function returns scalar int; supabase-js wraps it as the data field.
  const n = typeof data === 'number' ? data : Number(data ?? 0);
  return { count: Number.isFinite(n) ? n : 0, error: null };
}

async function fetchViewerContext(): Promise<ViewerContext> {
  // Resolve the viewer via the session, then their users row → church.
  // RLS on public.users permits reading own row for authenticated callers.
  const { data: sessionData } = await supabase.auth.getSession();
  const authId = sessionData?.session?.user?.id;
  if (!authId) return { ownChurchId: null, viewerCountry: null };

  // Single round-trip: own users row + joined church.country.
  const { data, error } = await supabase
    .from('users')
    .select('church_id, churches:church_id (country)')
    .eq('auth_id', authId)
    .single();

  if (error || !data) return { ownChurchId: null, viewerCountry: null };
  // supabase-js types the joined relationship as one-or-many; treat as
  // unknown first so the cast doesn't trip "insufficient overlap".
  const row = data as unknown as {
    church_id: string | null;
    churches: { country: string | null } | { country: string | null }[] | null;
  };
  const churchObj = Array.isArray(row.churches)
    ? (row.churches[0] ?? null)
    : row.churches;
  return {
    ownChurchId: row.church_id ?? null,
    viewerCountry: churchObj?.country ?? null,
  };
}

export function useChurchesGlobal(): UseChurchesGlobalResult {
  const [dots, setDots] = useState<ChurchDot[]>([]);
  const [undergroundCount, setUndergroundCount] = useState(0);
  const [ctx, setCtx] = useState<ViewerContext>({ ownChurchId: null, viewerCountry: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [dotsRes, ugRes, ctxRes] = await Promise.all([
      fetchDots(),
      fetchUndergroundCount(),
      fetchViewerContext(),
    ]);
    // Either RPC failing is a globe-load error; viewer context failing
    // degrades gracefully (no own-dot highlight, world-default camera).
    if (dotsRes.error || ugRes.error) {
      setError(dotsRes.error ?? ugRes.error);
      setLoading(false);
      return;
    }
    setDots(dotsRes.rows);
    setUndergroundCount(ugRes.count);
    setCtx(ctxRes);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    dots,
    undergroundCount,
    ownChurchId: ctx.ownChurchId,
    viewerCountry: ctx.viewerCountry,
    loading,
    error,
    refetch: load,
  };
}
