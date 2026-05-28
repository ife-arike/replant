// KAN-22 — Prayer Wall panel data hook.
//
// Drives the CAL pull-up panel: paginated fetch from get_prayer_wall
// (server-side filter + ORDER BY pr.urgent DESC, pr.created_at DESC —
// AC #8 satisfied at the data boundary), 20 per page (PAGE_SIZE), with
// pull-to-refresh, infinite scroll, and category + urgency filters.
//
// Filter UX is "client-side" from the leader's perspective (chips
// update immediately) — the implementation refetches via the RPC's
// filter_categories[] + filter_urgent params, same as PrayerWallScreen
// (KAN-23). That keeps category counts honest across pagination, which
// a pure in-memory filter on 20 rows would not.
//
// `open()` is the panel's "fetch on open" trigger — first fetch runs
// only after the leader expands the panel above the collapsed snap, not
// on tab load.

import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_URGENCY,
  PAGE_SIZE,
  buildRpcFilters,
  type PrayerCategory,
  type PrayerRow,
  type SelectedCategories,
  type UrgencyFilter,
} from '../components/prayer/PrayerWallLogic';

type LoadState = 'idle' | 'initial' | 'refreshing' | 'paging' | 'error';

export interface UsePrayerWallResult {
  rows: PrayerRow[];
  loadState: LoadState;
  hasFetchedOnce: boolean;
  hasMore: boolean;
  selectedCategories: SelectedCategories;
  urgency: UrgencyFilter;
  toggleCategory: (cat: PrayerCategory) => void;
  setUrgency: (u: UrgencyFilter) => void;
  clearFilters: () => void;
  open: () => void;        // triggers first fetch (no-op if already fetched)
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

async function fetchPage(
  offset: number,
  filterUrgent: boolean | null,
  filterCategories: string[] | null,
): Promise<{ rows: PrayerRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_prayer_wall', {
    page_offset: offset,
    filter_urgent: filterUrgent,
    filter_categories: filterCategories,
  });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as PrayerRow[], error: null };
}

export function usePrayerWall(): UsePrayerWallResult {
  const [rows, setRows] = useState<PrayerRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [hasMore, setHasMore] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<SelectedCategories>(
    () => new Set<PrayerCategory>(),
  );
  const [urgency, setUrgencyState] = useState<UrgencyFilter>(DEFAULT_URGENCY);
  const hasFetchedOnce = useRef(false);

  const loadInitial = useCallback(
    async (cats: SelectedCategories, urg: UrgencyFilter) => {
      setLoadState('initial');
      const { filter_urgent, filter_categories } = buildRpcFilters(cats, urg);
      const { rows: page, error } = await fetchPage(0, filter_urgent, filter_categories);
      hasFetchedOnce.current = true;
      if (error) { setLoadState('error'); return; }
      setRows(page);
      setHasMore(page.length === PAGE_SIZE);
      setLoadState('idle');
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoadState('refreshing');
    const { filter_urgent, filter_categories } = buildRpcFilters(selectedCategories, urgency);
    const { rows: page, error } = await fetchPage(0, filter_urgent, filter_categories);
    hasFetchedOnce.current = true;
    if (error) { setLoadState('error'); return; }
    setRows(page);
    setHasMore(page.length === PAGE_SIZE);
    setLoadState('idle');
  }, [selectedCategories, urgency]);

  const loadMore = useCallback(async () => {
    if (loadState !== 'idle' || !hasMore || rows.length === 0) return;
    setLoadState('paging');
    const { filter_urgent, filter_categories } = buildRpcFilters(selectedCategories, urgency);
    const { rows: page, error } = await fetchPage(rows.length, filter_urgent, filter_categories);
    if (error) { setLoadState('idle'); return; }
    if (page.length === 0) setHasMore(false);
    else {
      setRows((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    }
    setLoadState('idle');
  }, [selectedCategories, urgency, hasMore, loadState, rows.length]);

  const toggleCategory = useCallback((cat: PrayerCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      // Refire fetch from offset 0 with the new filter set. Inline here
      // (rather than a useEffect on selectedCategories) so the network
      // call kicks before React commits the next render.
      void loadInitial(next, urgency);
      return next;
    });
  }, [loadInitial, urgency]);

  const setUrgency = useCallback((u: UrgencyFilter) => {
    setUrgencyState(u);
    void loadInitial(selectedCategories, u);
  }, [loadInitial, selectedCategories]);

  const clearFilters = useCallback(() => {
    const cleared: SelectedCategories = new Set<PrayerCategory>();
    setSelectedCategories(cleared);
    setUrgencyState(DEFAULT_URGENCY);
    void loadInitial(cleared, DEFAULT_URGENCY);
  }, [loadInitial]);

  const open = useCallback(() => {
    if (hasFetchedOnce.current) return;
    void loadInitial(selectedCategories, urgency);
  }, [loadInitial, selectedCategories, urgency]);

  return {
    rows,
    loadState,
    hasFetchedOnce: hasFetchedOnce.current,
    hasMore,
    selectedCategories,
    urgency,
    toggleCategory,
    setUrgency,
    clearFilters,
    open,
    refresh,
    loadMore,
  };
}
