// connect-prefs — local preference store for Connect tab settings that
// the BE schema doesn't yet have a column for.
//
// At present the only preference is `notif_message_badge` (HANDOFF
// §15.2). The dispatch's intent is a `PATCH /users/me` that writes
// `users.notif_message_badge: boolean`, but that column doesn't
// exist in live yet (verified 2026-05-29). Per the dispatch, we
// hold the write and keep the toggle functional on-device via
// SecureStore. When DBA lands the column + an RPC, the swap is a
// single helper here — readers (`useNotifBadgeEnabled` consumers,
// the tab badge hook) and writers (the Settings row) do not change.
//
// Why SecureStore: consistent with the `covenant_ack` pattern already
// in ConnectScreen. AsyncStorage is plaintext on Android and below
// SEC's threat-model bar for any per-user state in this app
// (cross-ref src/lib/supabase.ts header).
//
// Default: true (badge shown unless the leader has explicitly turned
// it off). Matches HANDOFF §15.2.

import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'notif_message_badge';
const DEFAULT_ENABLED = true;

// Module-level state + tiny listener registry. The Settings toggle
// and the tab-icon badge live in different parts of the tree and
// must stay in lockstep without a context provider above both.
type Listener = (enabled: boolean) => void;
let cached: boolean = DEFAULT_ENABLED;
let hydrated = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l(cached));
}

async function hydrate(): Promise<void> {
  try {
    const v = await SecureStore.getItemAsync(STORAGE_KEY);
    if (v === 'false') cached = false;
    else if (v === 'true') cached = true;
    else cached = DEFAULT_ENABLED;
  } catch {
    cached = DEFAULT_ENABLED;
  }
  hydrated = true;
  notify();
}

// Kicks off the SecureStore read once per process. Safe to call
// multiple times — subsequent calls are no-ops.
let hydratePromise: Promise<void> | null = null;
function ensureHydrated(): Promise<void> {
  if (!hydratePromise) hydratePromise = hydrate();
  return hydratePromise;
}

export function getNotifBadgeEnabled(): boolean {
  return cached;
}

export async function setNotifBadgeEnabled(enabled: boolean): Promise<void> {
  cached = enabled;
  notify();
  // Best-effort persistence. A SecureStore failure here leaves the
  // toggle accurate for this session; the next launch will read the
  // previous value (or default true if never written). We deliberately
  // don't surface a write error to the leader — they see the toggle
  // flip immediately, which matches the dispatch's optimistic posture.
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // swallowed by design
  }
  // BE-gap surface: when users.notif_message_badge column lands +
  // a write RPC exists, fire the PATCH here. Until then, this
  // preference is per-device only — flagged in the build summary.
}

// React hook — subscribes to the module-level store, hydrates lazily.
export function useNotifBadgeEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cached);
  useEffect(() => {
    let active = true;
    void ensureHydrated().then(() => {
      if (active) setEnabled(cached);
    });
    const listener: Listener = (v) => {
      if (active) setEnabled(v);
    };
    listeners.add(listener);
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);
  return enabled;
}

// Test / debug helper — flushes the in-memory cache so tests can
// re-read SecureStore. Not used in production code paths.
export function __resetConnectPrefsForTest(): void {
  cached = DEFAULT_ENABLED;
  hydrated = false;
  hydratePromise = null;
  notify();
}

export { hydrated as __hydrated };
