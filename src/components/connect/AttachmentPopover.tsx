// AttachmentPopover — HANDOFF §15.3.
//
// Anticipatory popover anchored above the composer paperclip, used in
// BOTH the DM composer (Screen 18) and the branch composer (Screen 19).
// Replaces the earlier alert-toast treatment.
//
// Behaviour:
//   - Tap paperclip → popover opens (fade + 6pt rise, 180ms,
//     cubic-bezier(.32,.72,0,1)).
//   - Dismiss on: tap outside (transparent backdrop catcher),
//     tap paperclip again (parent toggles `visible`), or user starts
//     typing (parent flips `visible` on first non-empty draft).
//
// Layout values are per §15.3 — width 246, padding 13/15/14,
// `--surface2` bg, 0.5px `--sky-mid` border, radius 13, shadow 0 14 40
// rgba(0,0,0,0.55). The caret/tail is an 11×11 rotated square pinned
// at left:20 of the popover's bottom edge, with right + bottom border
// to match the popover's edge stroke.
//
// Positioning: the popover renders ABSOLUTELY positioned above the
// paperclip (`bottom: 50, left: -8`). The parent renders this as a
// sibling of the paperclip Pressable inside the composer container.

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';

interface Props {
  visible: boolean;
  onRequestClose: () => void;
}

const RISE_PT = 6;
const ENTER_MS = 180;

export default function AttachmentPopover({ visible, onRequestClose }: Props) {
  // Render-controlled mounting: keep mounted briefly during the
  // close animation so the fade-out reads. For this surface the
  // dispatch only specifies an ENTER animation; the dismiss can be
  // immediate. We do a quick fade on close anyway to avoid pop.
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(visible ? 0 : RISE_PT)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1, duration: ENTER_MS,
          easing: Easing.bezier(0.32, 0.72, 0, 1),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0, duration: ENTER_MS,
          easing: Easing.bezier(0.32, 0.72, 0, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0, duration: 120,
          easing: Easing.bezier(0.32, 0.72, 0, 1),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: RISE_PT, duration: 120,
          easing: Easing.bezier(0.32, 0.72, 0, 1),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <>
      {/* Transparent full-screen backdrop catcher — dismisses on any
          tap outside the popover. pointerEvents: 'box-only' lets the
          paperclip tap (sibling) pass through if the user re-taps
          the icon. The parent owns the toggle. */}
      <Pressable
        style={styles.backdrop}
        onPress={onRequestClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss attachment notice"
      />
      <Animated.View
        style={[
          styles.popover,
          { opacity, transform: [{ translateY }] },
        ]}
        accessibilityRole="alert"
      >
        <Text style={styles.title}>Attachments — coming soon</Text>
        <Text style={styles.sub}>
          Sharing files and photos is on the way — with consent, of course.
        </Text>
        {/* Caret/tail: an 11×11 rotated square pinned at left:20 of
            the popover's bottom edge with right + bottom border to
            match the popover's edge stroke (the top + left of the
            rotated square become the "down-pointing" edges). */}
        <View style={styles.caret} pointerEvents="none" />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: -2000, left: -2000, right: -2000, bottom: -2000,
    backgroundColor: 'transparent',
    // zIndex sits BELOW the popover but ABOVE the composer chrome.
    zIndex: 10,
  },
  popover: {
    position: 'absolute',
    // §15.3: bottom: 50px; left: -8px relative to the paperclip wrap.
    bottom: 50,
    left: -8,
    width: 246,
    paddingTop: 13,
    paddingRight: 15,
    paddingBottom: 14,
    paddingLeft: 15,
    backgroundColor: '#181818', // --surface2
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107,181,232,0.35)', // --sky-mid
    borderRadius: 13,
    // Shadow per §15.3: 0 14 40 rgba(0,0,0,0.55). iOS uses shadow*;
    // Android uses elevation — both keep the popover visibly lifted
    // above the composer hairline.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 18,
    zIndex: 20,
  },
  title: {
    fontFamily: Typography.displayMedium,
    fontSize: 17,
    lineHeight: 22,
    color: Colors.text,
    marginBottom: 6,
  },
  sub: {
    fontFamily: Typography.body,
    fontSize: 11.5,
    lineHeight: 11.5 * 1.5,
    color: Colors.textMuted,
  },
  caret: {
    position: 'absolute',
    // 11×11 rotated square — top edge becomes the pointing tip.
    width: 11,
    height: 11,
    left: 20,
    bottom: -6, // half the diagonal so the square's tip lands on the popover's outer edge
    backgroundColor: '#181818',
    transform: [{ rotate: '45deg' }],
    // Border on the bottom + right of the un-rotated square becomes
    // the bottom-left + bottom-right edges after the 45° rotate,
    // which are the edges that face away from the popover body.
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(107,181,232,0.35)',
    borderBottomColor: 'rgba(107,181,232,0.35)',
  },
});
