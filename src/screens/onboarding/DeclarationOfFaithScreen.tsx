// ─────────────────────────────────────────────
// Screen 02 — Declaration of Faith (KAN-10)
//
// Per SM ruling 11047 (built against KAN-10 AC + wireframes Section 03 / Screen 02):
//   - Affirm-only path. NO "I Do Not Agree" button at MVP (KAN-25 captures the
//     post-MVP decline-path question).
//   - Scroll-gate: button stays disabled until the user has scrolled the body
//     to the bottom (AC formula: `contentOffset.y + layoutHeight >= contentHeight - 20`).
//   - Once enabled, "I Affirm This" replaces this screen with the next route.
//     `navigation.replace` (not push) so the user cannot back into DoF after
//     affirming — agreement must stand.
//   - `declaration_affirmed = true` is NOT written here — KAN-12 owns that DB
//     write at account creation. State on this screen is local-only.
//   - No back gesture / no header / no programmatic exit. Portrait orientation
//     and Android predictive-back are already locked at app.json level.
//
// Mounted under the unauthenticated branch of KAN-87's RootNavigator (Path B
// per SM ruling 11047). Replaces LoginPlaceholderScreen as the cold-launch
// landing until KAN-9 (Splash) and KAN-38 (Login) build out their surfaces.

import React, { useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Colors, Radius, Spacing, Typography } from "../../constants/theme";
import type { RootStackParamList } from "../../navigation/types";

const SCROLL_BOTTOM_OFFSET_PX = 20;

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DeclarationOfFaithScreen() {
  const navigation = useNavigation<Nav>();
  const [affirmEnabled, setAffirmEnabled] = useState(false);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    // AC: contentOffset.y + layoutHeight >= contentHeight - 20px
    if (
      contentOffset.y + layoutMeasurement.height >=
      contentSize.height - SCROLL_BOTTOM_OFFSET_PX
    ) {
      // Sticky once true — scrolling back up does not re-disable the button.
      setAffirmEnabled(true);
    }
  };

  const handleAffirm = () => {
    if (!affirmEnabled) return;
    // replace, not push — affirmation must stand; user cannot back into DoF.
    navigation.replace("AccountSetup1Placeholder");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <Text style={styles.headerLabel}>REPLANT</Text>
        <Text style={styles.headerTitle}>A Declaration of Faith</Text>
        <Text style={styles.headerSubtitle}>
          Before you enter, we ask that you affirm what we stand on.
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.declarationBlock}>
          <View style={styles.declarationAccent} />
          <View style={styles.declarationBody}>
            <Text style={styles.declarationParagraph}>
              I believe that Jesus Christ is the Word of God made flesh — the
              Lamb of God slain for our sins. He came down from heaven, was
              born of a virgin, was crucified, buried, and ascended to the
              right hand of God, then gave to us the gift of the Holy Spirit.
            </Text>
            <Text style={styles.declarationParagraph}>
              He is the image of the invisible God. He is our only Lord and
              Saviour.
            </Text>
            <Text style={styles.declarationParagraph}>
              The Holy Bible is our only source of truth.
            </Text>
          </View>
        </View>

        <Text style={styles.attribution}>
          By continuing, I personally affirm this testament as my own.
        </Text>

        {/* Scroll anchor — guarantees the gate fires only at true bottom. */}
        <View style={styles.scrollAnchor} />
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.affirmButton, !affirmEnabled && styles.affirmButtonDisabled]}
          onPress={handleAffirm}
          disabled={!affirmEnabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ disabled: !affirmEnabled }}
          accessibilityLabel="I Affirm This"
          accessibilityHint={
            affirmEnabled
              ? "Affirms the Declaration of Faith and continues to account setup."
              : "Disabled. Scroll to read the full declaration."
          }
        >
          <Text
            style={[
              styles.affirmButtonText,
              !affirmEnabled && styles.affirmButtonTextDisabled,
            ]}
          >
            I Affirm This
          </Text>
        </TouchableOpacity>

        {!affirmEnabled && (
          <Text style={styles.scrollHint}>Scroll to read the full declaration</Text>
        )}

        <Text style={styles.footer}>
          This is not a legal agreement. This is a test of the spirits.
          {"\n"}1 John 4:1
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  header: {
    paddingTop: 72,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLabel: {
    fontFamily: Typography.body,
    fontSize: 11,
    letterSpacing: 6,
    color: Colors.accent,
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },

  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },

  declarationBlock: {
    flexDirection: "row",
    marginBottom: Spacing.xl,
  },
  declarationAccent: {
    width: 2,
    backgroundColor: Colors.accent,
    marginRight: Spacing.md,
    borderRadius: 1,
  },
  declarationBody: {
    flex: 1,
    gap: Spacing.lg,
  },
  declarationParagraph: {
    fontFamily: Typography.displayItalic,
    fontSize: 19,
    color: Colors.text,
    lineHeight: 32,
    letterSpacing: 0.2,
  },

  attribution: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
    fontStyle: "italic",
  },

  scrollAnchor: {
    height: Spacing.xxxl,
  },

  actions: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  affirmButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 48,
  },
  affirmButtonDisabled: {
    backgroundColor: "rgba(107, 181, 232, 0.2)",
  },
  affirmButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.background,
    letterSpacing: 0.3,
  },
  affirmButtonTextDisabled: {
    color: "rgba(107, 181, 232, 0.45)",
  },
  scrollHint: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    textAlign: "center",
    letterSpacing: 0.4,
  },
  footer: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    letterSpacing: 0.3,
  },
});
