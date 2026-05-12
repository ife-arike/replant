// Account Setup Page 1 placeholder — KAN-10 forward target (per SM ruling 11047).
// Reached when the user affirms the Declaration of Faith. KAN-11 replaces this
// stub with the real Account Setup Page 1.

import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Spacing, Typography } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

export default function AccountSetup1PlaceholderScreen() {
  // __DEV__-only sign-in form — temp tool so KAN-72 / KAN-87 work can be
  // exercised on the simulator until KAN-38 ships the real Login surface.
  // The {__DEV__ && (...)} wrap below tree-shakes this entire block out of
  // production builds (Metro inlines __DEV__ to false on bundle).
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDevSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInErr) {
        setError(signInErr.message);
      }
      // Success path: AuthProvider's onAuthStateChange listener flips the
      // branch and RootNavigator unmounts this screen automatically.
    } catch (e) {
      setError((e as Error)?.message ?? "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Account Setup</Text>
      <Text style={styles.body}>(KAN-11 takes over here once Done)</Text>

      {__DEV__ && (
        <View style={styles.devBlock}>
          <Text style={styles.devLabel}>DEV ONLY — sign in</Text>
          <TextInput
            style={styles.devInput}
            value={email}
            onChangeText={setEmail}
            placeholder="email"
            placeholderTextColor="rgba(240, 237, 230, 0.35)"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            editable={!submitting}
          />
          <TextInput
            style={styles.devInput}
            value={password}
            onChangeText={setPassword}
            placeholder="password"
            placeholderTextColor="rgba(240, 237, 230, 0.35)"
            secureTextEntry
            autoCapitalize="none"
            editable={!submitting}
          />
          <TouchableOpacity
            style={[styles.devButton, submitting && styles.devButtonDisabled]}
            onPress={handleDevSignIn}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Dev sign in"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.textMuted} />
            ) : (
              <Text style={styles.devButtonText}>Dev sign in</Text>
            )}
          </TouchableOpacity>
          {error && <Text style={styles.devError}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  heading: { fontFamily: Typography.display, fontSize: 28, color: Colors.text },
  body: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted },

  // ─── __DEV__-only styling — deliberately not brandkit ─────────
  devBlock: {
    marginTop: Spacing.xl,
    width: "100%",
    maxWidth: 320,
    padding: Spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(240, 237, 230, 0.25)",
    borderRadius: 6,
    gap: Spacing.sm,
  },
  devLabel: {
    fontFamily: Typography.body,
    fontSize: 10,
    letterSpacing: 1.5,
    color: "rgba(240, 237, 230, 0.45)",
    textTransform: "uppercase",
    textAlign: "center",
  },
  devInput: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.text,
    backgroundColor: "rgba(240, 237, 230, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(240, 237, 230, 0.15)",
    borderRadius: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  devButton: {
    paddingVertical: 10,
    backgroundColor: "rgba(240, 237, 230, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(240, 237, 230, 0.25)",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
  },
  devButtonDisabled: {
    opacity: 0.5,
  },
  devButtonText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.text,
  },
  devError: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: "rgba(224, 85, 85, 0.85)",
    lineHeight: 16,
  },
});
