// ─────────────────────────────────────────────
// Screen 02 — Declaration of Faith (KAN-10)
//
// Visual layout matches docs/replant-wireframes.html "Acknowledgement —
// Declaration" screen (lines 908-932) — centered ack-cross + title +
// subtitle, then a sky-top-bordered body card with the testament + hdivider
// + attribution, then the affirm button, then the footer. CSS color tokens
// (--sky/--surface/--off-white/--muted/--faint at lines 12-22) map onto the
// existing Colors palette in src/constants/theme.ts (no new tokens added).
//
// Functional behaviour (unchanged from initial KAN-10 build per SM ruling
// 11047 — visual polish only, no logic delta):
//   - Affirm-only path. NO "I Do Not Agree" button at MVP.
//   - Scroll-gate: AC formula `contentOffset.y + layoutHeight >=
//     contentHeight - 20`, sticky once true. Bound to the ScrollView INSIDE
//     the body card (was on the outer screen pre-polish).
//   - "I Affirm This" replaces this screen with AccountSetup1Placeholder.
//     navigation.replace (not push) — agreement must stand.
//   - declaration_affirmed DB write is NOT performed here; KAN-12 owns it.
//   - No back gesture (gestureEnabled: false on the route in RootNavigator).
//   - Portrait orientation + Android predictive-back locked at app.json level
//     globally.
//
// If the body fits in its allotted card height without overflow, the
// scroll-gate fires immediately on layout — acceptable per AC interpretation
// (the threshold formula is satisfied at distance-from-bottom = 0).

import React, { useEffect, useState } from "react";
import {
  type LayoutChangeEvent,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Typography } from "../../constants/theme";
import type { RootStackParamList } from "../../navigation/types";

const SCROLL_BOTTOM_OFFSET_PX = 20;

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DeclarationOfFaithScreen() {
  const navigation = useNavigation<Nav>();
  const [affirmEnabled, setAffirmEnabled] = useState(false);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    // AC: contentOffset.y + layoutHeight >= contentHeight - 20px
    if (
      contentOffset.y + layoutMeasurement.height >=
      contentSize.height - SCROLL_BOTTOM_OFFSET_PX
    ) {
      // Sticky — scrolling back up does not re-disable the button.
      setAffirmEnabled(true);
    }
  };

  // Layout-based fallback: if the body content fits inside the ScrollView's
  // visible area (with the AC's 20px tolerance), the user can never scroll
  // and `onScroll` may never fire on some RN versions / platforms. Flip the
  // gate as soon as both measurements are known and the content fits.
  // SM spec: "If body fits without scrolling on a given device, button
  // enables immediately — acceptable per AC interpretation."
  useEffect(() => {
    if (
      scrollViewHeight > 0 &&
      contentHeight > 0 &&
      contentHeight <= scrollViewHeight + SCROLL_BOTTOM_OFFSET_PX
    ) {
      setAffirmEnabled(true);
    }
  }, [scrollViewHeight, contentHeight]);

  const handleScrollViewLayout = (e: LayoutChangeEvent) => {
    setScrollViewHeight(e.nativeEvent.layout.height);
  };

  const handleContentSizeChange = (_w: number, h: number) => {
    setContentHeight(h);
  };

  const handleAffirm = () => {
    if (!affirmEnabled) return;
    navigation.replace("AccountSetup1Placeholder");
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.content}>
        {/* Top section — centered cross + title + subtitle */}
        <View style={styles.topSection}>
          <View style={styles.ackCross}>
            <View style={styles.ackCrossVertical} />
            <View style={styles.ackCrossHorizontal} />
          </View>
          <Text style={styles.title}>A Declaration of Faith</Text>
          <Text style={styles.subtitle}>
            Before you enter, we ask that you affirm{"\n"}what we stand on.
          </Text>
        </View>

        {/* Body card — sky top border, scrollable interior */}
        <View style={styles.bodyCard}>
          <ScrollView
            contentContainerStyle={styles.bodyCardContent}
            onLayout={handleScrollViewLayout}
            onContentSizeChange={handleContentSizeChange}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
          >
            <Text style={[styles.bodyParagraph, styles.bodyParagraphSpaced]}>
              I believe that Jesus Christ is the Word of God made flesh — the
              Lamb of God slain for our sins. He came down from heaven, was
              born of a virgin, was crucified, buried, and ascended to the
              right hand of God, then gave to us the gift of the Holy Spirit.
            </Text>
            <Text style={[styles.bodyParagraph, styles.bodyParagraphSpaced]}>
              He is the image of the invisible God. He is our only Lord and
              Saviour.
            </Text>
            <Text style={styles.bodyParagraph}>
              The Holy Bible is our only source of truth.
            </Text>

            <View style={styles.hdivider} />

            <Text style={styles.attribution}>
              By continuing, I personally affirm this testament as my own.
            </Text>
          </ScrollView>
        </View>

        {/* Affirm button — sky bg, black text, 2pt above per wireframe margin-top:2 */}
        <TouchableOpacity
          style={[styles.affirmButton, !affirmEnabled && styles.affirmButtonDisabled]}
          onPress={handleAffirm}
          disabled={!affirmEnabled}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: !affirmEnabled }}
          accessibilityLabel="I Affirm This"
          accessibilityHint={
            affirmEnabled
              ? "Affirms the Declaration of Faith and continues to account setup."
              : "Disabled. Scroll to read the full declaration before affirming."
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

        {/* Footer — two lines, muted, centered */}
        <Text style={styles.footer}>
          This is not a legal agreement. This is a test of the spirits.
          {"\n"}1 John 4:1
        </Text>
      </View>
    </SafeAreaView>
  );
}

// Wireframe rem → RN pt mapping (per SM spec):
//   0.95rem (title)        ≈ 22
//   0.68rem (body italic)  ≈ 14
//   0.52rem (subtitle / attribution) ≈ 12
//   0.48rem (footer)       ≈ 10
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: "column",
    gap: 10,
  },

  // ── Top section ────────────────────────────────
  topSection: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },

  // .ack-cross — 28×28, two 1.5px sky bars, centered above title
  ackCross: {
    width: 28,
    height: 28,
    position: "relative",
    marginBottom: 12,
  },
  // ::before — vertical bar, 1.5px wide, full height, centered horizontally
  ackCrossVertical: {
    position: "absolute",
    left: 13.25, // (28 - 1.5) / 2
    top: 0,
    width: 1.5,
    height: 28,
    backgroundColor: Colors.accent,
  },
  // ::after — horizontal bar, 1.5px tall, full width, top: 35%
  ackCrossHorizontal: {
    position: "absolute",
    left: 0,
    top: 9.8, // 28 * 0.35
    width: 28,
    height: 1.5,
    backgroundColor: Colors.accent,
  },

  title: {
    fontFamily: Typography.display,
    fontSize: 22,
    fontWeight: "400",
    letterSpacing: 0.05 * 22, // 0.05em → 1.1pt
    color: Colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 12 * 1.5,
    textAlign: "center",
    marginTop: 3,
  },

  // ── Body card ──────────────────────────────────
  bodyCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderTopWidth: 1.5,
    borderTopColor: Colors.accent, // distinctive sky top border
    borderRadius: 6,
    overflow: "hidden",
  },
  bodyCardContent: {
    padding: 12,
  },
  bodyParagraph: {
    fontFamily: Typography.displayItalic,
    fontSize: 14,
    fontWeight: "300",
    color: Colors.text, // --off-white
    lineHeight: 14 * 1.75,
  },
  bodyParagraphSpaced: {
    marginBottom: 14, // approximates the wireframe's <br><br> paragraph break
  },

  // .hdivider — 0.5px faint line, margin 10px vertical (overrides default 4px)
  hdivider: {
    height: 0.5,
    backgroundColor: Colors.border, // --faint
    marginVertical: 10,
  },

  attribution: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 12 * 1.6,
  },

  // ── Affirm button ──────────────────────────────
  // .btn-primary { background: var(--sky); color: var(--black); }
  affirmButton: {
    width: "100%",
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2, // wireframe margin-top:2
    minHeight: 44,
  },
  affirmButtonDisabled: {
    backgroundColor: "rgba(107, 181, 232, 0.2)",
  },
  affirmButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.background, // --black
    letterSpacing: 0.3,
  },
  affirmButtonTextDisabled: {
    color: "rgba(107, 181, 232, 0.45)",
  },

  // ── Footer ─────────────────────────────────────
  footer: {
    fontFamily: Typography.body,
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 10 * 1.5,
  },
});
