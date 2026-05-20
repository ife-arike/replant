// SettingsScreenContainer — KAN-138 wiring (on-brand v2.1 pass).
//
// Thin data-loader wrapper around SettingsScreen. Pulls the authenticated
// leader's auth_id from useAuth() and one-shot-reads:
//   - users.display_name_preference (NOT NULL, DEFAULT 'first_name_only')
//   - users.anonymous (NOT NULL, DEFAULT false)
//   - users.church_id → churches { id, name, church_code, rag_status }
//
// Email comes from session.user.email (already in scope via useAuth) —
// auth.users is the source of truth for email, NOT public.users.email
// (which mirrors but may drift mid-flight).
//
// Read RLS:
//   - users_select_own — leader sees own row
//   - churches_select_active — leader sees own active church regardless of type
// Write RLS (handled inside SettingsScreen):
//   - users_update_own (display_name_preference, anonymous)
//   - churches RLS for rag_status — assumed to permit own-church update via
//     the existing leader-update policy; if writes 403 in UAT, flag for DBA.
//
// Underground note: the embedded resource via the users_church_id_fkey FK
// does NOT route through `churches_public` (which filters out type =
// 'underground'). So underground leaders see their own church row here.

import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../../contexts/AuthProvider";
import { Colors } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import SettingsScreen from "./SettingsScreen";

type DisplayNamePreference = "first_name_only" | "full_name";
type RagStatus = "green" | "amber" | "red";

interface UsersRowShape {
  display_name_preference: DisplayNamePreference | null;
  anonymous: boolean | null;
  full_name?: string | null;
  role?: string | null;
  church?: {
    id: string | null;
    name: string | null;
    church_code: string | null;
    rag_status: RagStatus | null;
  } | null;
}

export default function SettingsScreenContainer() {
  const { session } = useAuth();
  const authId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;

  // Loaded state — null while the read is in flight; once non-null, the
  // screen renders. Read failures fall through to safe defaults.
  const [initialPref, setInitialPref] = useState<DisplayNamePreference | null>(
    null,
  );
  const [anonymousMode, setAnonymousMode] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [churchName, setChurchName] = useState<string | null>(null);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [churchCode, setChurchCode] = useState<string | null>(null);
  const [ragStatus, setRagStatus] = useState<RagStatus | null>(null);

  useEffect(() => {
    if (!authId) return;
    let cancelled = false;
    (async () => {
      // Single round-trip — embedded resource via users_church_id_fkey
      // pulls church { id, name, church_code, rag_status } in one shot.
      const { data, error } = await supabase
        .from("users")
        .select(`
          display_name_preference,
          anonymous,
          full_name,
          role,
          church:church_id(
            id,
            name,
            church_code,
            rag_status
          )
        `)
        .eq("auth_id", authId)
        .maybeSingle();
      if (cancelled) return;

      if (error || !data) {
        // Read failed (network) — fall through to safe defaults; the
        // first write either confirms the default (no-op) or overwrites.
        setInitialPref("first_name_only");
        setAnonymousMode(false);
        return;
      }

      // PostgREST infers embedded one-to-one as an array in some Supabase
      // client builds — cast through unknown and accept either shape.
      const row = data as unknown as UsersRowShape;
      setInitialPref(row.display_name_preference ?? "first_name_only");
      setAnonymousMode(row.anonymous ?? false);
      setFullName(row.full_name ?? null);
      setUserRole(row.role ?? null);

      // Defensive: church may come back as object | array | null.
      const churchField = (row as unknown as { church?: unknown }).church;
      const c = Array.isArray(churchField)
        ? (churchField[0] ?? null)
        : (churchField ?? null);
      const cTyped = c as UsersRowShape["church"];
      setChurchId(cTyped?.id ?? null);
      setChurchName(cTyped?.name ?? null);
      setChurchCode(cTyped?.church_code ?? null);
      setRagStatus(cTyped?.rag_status ?? null);
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
      email={email}
      initialDisplayNamePreference={initialPref}
      anonymousMode={anonymousMode}
      fullName={fullName}
      userRole={userRole}
      churchCode={churchCode}
      churchName={churchName}
      churchId={churchId}
      ragStatus={ragStatus}
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
