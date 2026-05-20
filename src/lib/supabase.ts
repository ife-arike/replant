// Supabase client for the Replant app — KAN-87 foundation (AC-2)
// + SEC rework per ruling 11015 (items #2 + #4).
//
// Configuration locks (per SM ruling 10977):
//   - detectSessionInUrl: false  (RN has no URL-fragment session hand-off)
//   - persistSession: true       (session survives app restart)
//   - autoRefreshToken: true     (KAN-41's 168hr refresh works end-to-end)
//
// Session storage (item #2): switched from AsyncStorage to the encryption-
// key-wrap adapter (src/lib/secure-storage.ts). AsyncStorage is plaintext on
// Android (SharedPreferences) and below SEC's bar for the persecuted-leader
// threat model. The wrap adapter keeps AES-256 keys in Expo SecureStore
// (Keychain / EncryptedSharedPreferences) and AES-GCM ciphertext in
// AsyncStorage. removeItem nukes both halves.
//
// Cross-endpoint 401 (item #4): the global.fetch override below intercepts
// every Supabase project request and emits a 401 event for AuthProvider's
// listener when a stale JWT is rejected anywhere in the API surface — not
// only auth-status-check. Cross-ref KAN-44 ruling 10955.
//
// react-native-url-polyfill/auto is imported here because Hermes lacks the
// URL global; without it, supabase-js URL parsing throws on first auth.
//
// Env loading uses EXPO_PUBLIC_* prefix so Expo runtime exposes the values
// to the client. The anon key is meant to be client-visible; RLS is the
// data gate. SERVICE_ROLE_KEY MUST NEVER appear in client code (hard SEC
// line per KAN-44 SEC 10302 / 10920 / 10955).

import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { emit401 } from "./auth-events";
import { secureStorageAdapter } from "./secure-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in env. " +
      "Set them in .env.local before launching the app.",
  );
}

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

// Cross-endpoint 401 interceptor (SEC 10955 cross-ref + 11015 #4).
// Wraps the global fetch used by supabase-js for every request — REST,
// Storage, Realtime, Functions. On 401 from a project URL, emits a single
// auth event so AuthProvider can run the ordered clear-and-route. The
// interceptor never logs request/response bodies (no token material).
const interceptingFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input as RequestInfo, init);
  if (response.status === 401) {
    const requestUrl = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;
    if (requestUrl && requestUrl.startsWith(url)) {
      emit401();
    }
  }
  return response;
};

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: secureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // KAN-38 — PKCE flow for React Native. With PKCE, resetPasswordForEmail
    // stashes a code verifier in SecureStore and the reset email delivers
    // a one-time `?code=` in the query string. App.tsx's Linking handler
    // hands the code to exchangeCodeForSession, which fires PASSWORD_RECOVERY
    // in onAuthStateChange — AuthProvider then flips branch to
    // password_recovery and RootNavigator mounts SetNewPasswordScreen.
    flowType: 'pkce',
  },
  global: {
    fetch: interceptingFetch,
  },
});
