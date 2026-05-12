// SettingsScreenContainer — KAN-72 wiring (fix/KAN-72-settings-navigator-wiring).
//
// Thin data-loader wrapper around SettingsScreen. Pulls the authenticated
// user's auth_id from useAuth() and one-shot-reads the current
// display_name_preference from public.users (NOT NULL, DEFAULT
// 'first_name_only' per live DB CHECK constraint kan72_users_display_name_pref).
//
// Why a wrapper:
//   - SettingsScreen was signed off by UI/UX + FE at commit 576c3f5 with
//     props { userId, initialDisplayNamePreference }. Keeping the wrapper
//     separate preserves that contract; this file owns the data fetch +
//     loading/error states only.
//   - On read failure, fall through to the screen with the DB default
//     ('first_name_only'). The first write either confirms the default
//     (no-op early-return inside the screen's handler) or overwrites it.
//
// Read RLS: users_select_own — authenticated user can SELECT own row only.
// Write RLS: users_update_own — same. Both writes happen inside the screen.

import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../../contexts/AuthProvider";
import { Colors } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import SettingsScreen from "./SettingsScreen";

type DisplayNamePreference = "first_name_only" | "full_name";

export default function SettingsScreenContainer() {
  const { session } = useAuth();
  const authId = session?.user?.id ?? null;

  const [initialPref, setInitialPref] = useState<DisplayNamePreference | null>(
    null,
  );

  useEffect(() => {
    if (!authId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("display_name_preference")
        .eq("auth_id", authId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data?.display_name_preference) {
        // Fall through to DB default — column is NOT NULL, DEFAULT
        // 'first_name_only', so every authenticated row already has a value.
        // A read-time failure here means the network was down; the screen
        // still renders with the safe default and the user can still write.
        setInitialPref("first_name_only");
        return;
      }
      setInitialPref(data.display_name_preference as DisplayNamePreference);
    })();
    return () => {
      cancelled = true;
    };
  }, [authId]);

  if (!authId || initialPref === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
    );
  }

  return (
    <SettingsScreen
      userId={authId}
      initialDisplayNamePreference={initialPref}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
