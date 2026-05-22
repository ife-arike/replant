// signOutAndClear — KAN-42
//
// Shared sign-out utility called by:
//   - SettingsScreen sign-out row (KAN-138 / KAN-42)
//   - Hamburger panel logout row (KAN-76)
//   - Deactivation popup (KAN-36)
//
// Security contract (SEC ruling KAN-41, 3 May 2026):
//   1. Write `pending_signout_revocation` flag to SecureStore BEFORE
//      calling signOut(), so a crash after local clear doesn't leave
//      the flag unset.
//   2. Call supabase.auth.signOut(). Supabase SDK is local-first: it
//      clears the local session regardless of network outcome.
//   3. On success: delete the flag (revocation completed server-side).
//   4. On network failure: flag persists. AuthProvider.initialize()
//      checks for the flag on every app foreground and retries the
//      server-side revocation call until it succeeds.
//
// Navigation to Login is NOT done here. The calling component routes
// after this resolves (or AuthProvider's onAuthStateChange fires the
// branch flip to "unauthenticated" which RootNavigator catches).

import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';

export const PENDING_SIGNOUT_KEY = 'pending_signout_revocation';

export async function signOutAndClear(): Promise<void> {
  // Write flag before network call so a crash mid-sequence doesn't
  // silently skip the deferred revocation retry.
  await SecureStore.setItemAsync(PENDING_SIGNOUT_KEY, '1').catch(() => {});

  try {
    await supabase.auth.signOut();
    // Server-side revocation succeeded — clear the flag.
    await SecureStore.deleteItemAsync(PENDING_SIGNOUT_KEY).catch(() => {});
  } catch {
    // Network failure — flag stays for deferred retry on next foreground.
    // Local session is already cleared by the Supabase SDK (local-first).
  }
}
