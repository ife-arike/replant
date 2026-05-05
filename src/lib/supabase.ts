// Supabase client for the Replant app — KAN-87 foundation (AC-2).
//
// Configuration is locked per SM ruling 10977:
//   - detectSessionInUrl: false  (RN has no URL-fragment session hand-off)
//   - persistSession: true       (session survives app restart via AsyncStorage)
//   - autoRefreshToken: true     (KAN-41's 168hr refresh works end-to-end)
//   - storage: AsyncStorage      (Expo-platform standard for RN)
//
// react-native-url-polyfill/auto is imported here because Hermes lacks the URL
// global; without it, supabase-js URL parsing throws on first auth attempt.
//
// Env loading uses EXPO_PUBLIC_* prefix so Expo runtime exposes the values to
// the client. The anon key is meant to be client-visible; Row-Level Security is
// what protects data. SERVICE_ROLE_KEY MUST NEVER appear in client code (hard
// SEC line per KAN-44 SEC 10302 / 10920 / 10955).

import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

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

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
