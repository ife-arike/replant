// wipeLocalAccountState — KAN-205 (SEC design §4.3, ratified 2026-07-03).
//
// Ordinary sign-out (signOutAndClear + the SecureStore session adapter)
// wipes the encrypted session blob — BOTH halves: AsyncStorage ciphertext
// and the SecureStore AES key (src/lib/secure-storage.ts removeItem). It
// deliberately does NOT touch per-device app state, because a leader who
// signs out and back in should keep their acknowledged covenant and
// tutorial progress.
//
// Account DELETION is different: the leader is leaving. Local residue
// tied to their tenure on this device goes with them. This util is called
// ONLY on the deletion paths —
//   1. DeleteAccountFlow, after the delete-account edge function succeeds
//   2. RestoreScreen's "Continue with deletion"
// — never on ordinary sign-out.
//
// Wipe list (enumerated from every SecureStore call site in src/, SEC
// §4.3):
//   covenant_ack             ConnectScreen — Connect covenant acknowledged.
//                            Re-showing the covenant on a future restore
//                            or re-signup is correct behavior.
//   notif_message_badge      connect-prefs — Connect badge preference.
//   tutorial_church_tab_seen ChurchTutorialOverlay — Church tab tutorial.
//
// NOT wiped:
//   pending_signout_revocation — the deferred-revocation retry flag is
//   part of the sign-out machinery itself (KAN-41/42); signOutAndClear
//   owns its lifecycle.
//   replant.session.k.* — the session-blob AES keys are wiped by the
//   Supabase storage adapter's removeItem during signOut; enumerating
//   them here would duplicate (and race) that path.
//
// Every delete is best-effort: a SecureStore failure must never block
// the deletion ceremony. Failures are silently swallowed — the keys are
// preferences/acks, not security material, and the encrypted-session
// wipe (the security-relevant half) has its own guaranteed path.

import * as SecureStore from 'expo-secure-store';

const ACCOUNT_STATE_KEYS = [
  'covenant_ack',
  'notif_message_badge',
  'tutorial_church_tab_seen',
] as const;

export async function wipeLocalAccountState(): Promise<void> {
  await Promise.all(
    ACCOUNT_STATE_KEYS.map((key) =>
      SecureStore.deleteItemAsync(key).catch(() => {}),
    ),
  );
}
