// KAN-346 — the Settings self-row read has exactly two honest outcomes.
// 'error' covers both a failed query and a missing row: in either case
// the form must NOT mount on invented defaults (anonymous=false could
// render an anonymous leader as non-anonymous and let them save it).
export type SettingsReadOutcome = 'error' | 'ready';

export function classifySettingsRead(error: unknown, data: unknown): SettingsReadOutcome {
  return error || !data ? 'error' : 'ready';
}
