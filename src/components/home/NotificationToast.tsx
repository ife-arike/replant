// NotificationToast.tsx — transient top-of-screen moments.
// Trimmed set (rev 2): approved · not-approved · heartcry. The routine,
// home-visible moments (DM, announcement, daily scripture) and the security
// alert are deferred to real device push (post-MVP).
//
// Behaviour: slides down + fades in, lingers ~4s, then auto-dismisses;
// swipe up to dismiss early. Only one shows at a time (a new arrival replaces
// the old). The home dims slightly beneath via the host overlay.

import React, { useEffect, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { useViewerChurch } from '../../hooks/useViewerChurch';
import { viewerOrgCopy } from '../../utils/displayHelpers';
import { CheckIcon, InfoIcon, HeartIcon, Chevron } from './banner-icons';

export type ToastType = 'approved' | 'rejected' | 'heartcry';

type ToastConfig = {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  sacred?: boolean;   // serif italic, warm surface
  chevron?: boolean;  // tappable → onPress
};

// Build the toast config map per-render so the "approved" title can swap
// "church" → "organization" for para-ministry viewers via viewerOrgCopy.
function buildToasts(viewer: ReturnType<typeof viewerOrgCopy>): Record<ToastType, ToastConfig> {
  return {
    approved: { icon: <CheckIcon />, title: `${viewer.yourChurchOrOrgCap} has been verified.`, sub: 'Welcome to the network.' },
    rejected: { icon: <InfoIcon color={Colors.textMuted} />, title: "Your verification wasn't approved", sub: 'See the reason and next steps in your profile.', chevron: true },
    heartcry: { icon: <HeartIcon />, title: 'Someone has responded to your heartcry.', sacred: true, chevron: true },
  };
}

const LINGER_MS = 4000;

export function NotificationToast({ type, onPress, onDismiss }: { type: ToastType; onPress?: () => void; onDismiss: () => void }) {
  const { church } = useViewerChurch();
  const viewer = viewerOrgCopy(church?.type);
  const cfg = buildToasts(viewer)[type];
  const ty = useRef(new Animated.Value(-10)).current;
  const op = useRef(new Animated.Value(0)).current;

  const close = (dir: 'up' | 'auto') => {
    Animated.parallel([
      Animated.timing(ty, { toValue: dir === 'up' ? -60 : -14, duration: 220, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(ty, { toValue: 0, useNativeDriver: true, friction: 9, tension: 80 }),
      Animated.timing(op, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => close('auto'), LINGER_MS);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -6,
      onPanResponderRelease: (_, g) => { if (g.dy < -24) close('up'); },
    }),
  ).current;

  return (
    <Animated.View style={[styles.layer, { transform: [{ translateY: ty }], opacity: op }]} {...pan.panHandlers}>
      <Pressable onPress={onPress} disabled={!cfg.chevron} style={[styles.toast, cfg.sacred && styles.sacred]}>
        <View style={styles.grab} />
        <View style={styles.iconWell}>{cfg.icon}</View>
        <View style={styles.main}>
          <Text style={[styles.title, cfg.sacred && styles.titleSacred]}>{cfg.title}</Text>
          {cfg.sub ? <Text style={styles.sub}>{cfg.sub}</Text> : null}
        </View>
        {cfg.chevron ? <View style={styles.chev}><Chevron /></View> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 12, right: 12, top: 8, zIndex: 50 }, // top: below safe-area inset
  toast: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: Colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: 16, paddingHorizontal: 14, paddingTop: 15, paddingBottom: 13,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 12,
  },
  sacred: { backgroundColor: Colors.cardWarm },
  grab: { position: 'absolute', top: 7, alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(240,237,230,0.16)' },
  iconWell: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,237,230,0.04)', marginTop: 3 },
  main: { flex: 1, paddingTop: 4 },
  title: { fontFamily: Typography.bodyMedium, fontSize: 14, lineHeight: 18, color: Colors.text },
  titleSacred: { fontFamily: Typography.scriptureItalic, fontSize: 16.5, lineHeight: 21 },
  sub: { fontFamily: Typography.body, fontSize: 12, lineHeight: 16, color: Colors.textMuted, marginTop: 2 },
  chev: { alignSelf: 'center' },
});
