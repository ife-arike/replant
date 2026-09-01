// KAN-347 — one shared answer to "what did the fetch actually tell us?"
// for the persecuted reader surfaces. A FAILURE must never wear content's
// face: 'error' wins over anything else, and 'empty' (a successful call
// that found nothing) is a different truth from 'ready'. PersecutedScreen
// established this posture (error state vs designed empty state); the
// readers route through here so the three outcomes cannot be re-merged.
export type ReaderFetchOutcome = 'error' | 'empty' | 'ready';

export function classifyFetch(
  error: unknown,
  rows: readonly unknown[] | null | undefined,
): ReaderFetchOutcome {
  if (error) return 'error';
  return rows && rows.length > 0 ? 'ready' : 'empty';
}
