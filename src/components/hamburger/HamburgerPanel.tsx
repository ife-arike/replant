// HamburgerPanel — KAN-76
//
// Slide-in overlay panel triggered from the top-bar hamburger on every
// main screen (Home + future tabs). Mounted ONCE at the app root
// (App.tsx) alongside NavigationContainer; controlled by
// `useHamburger().isOpen`. The underlying screen state is preserved
// because the panel is a Modal overlay, not a navigation stack push.
//
// Dispatch / dismiss patterns:
//   - Tap on backdrop → close
//   - Swipe left (dx < -50) on panel → close
//   - Android hardware back → close (return true to swallow)
//   - Animated slide 250ms open / 200ms close; Modal unmounts only
//     after close animation completes (local modalVisible boolean)
//
// Menu items (per KAN-76 live AC, with KAN-28b not yet built so
// Vision / Outreach / FAQ fall back to "Coming soon" Alerts — matches
// the Language defensive-routing pattern explicitly called out in the
// live ticket's risks/gaps):
//   1. The Vision         → Alert "Coming soon"
//   2. Outreach & Missions→ Alert "Coming soon"
//   3. Language           → close panel + navigate to Settings root
//   4. Settings           → close panel + navigate to Settings
//   5. FAQ                → Alert "Coming soon"
// Panel closes BEFORE navigation push / Alert (250ms after close start
// to match the slide-out animation).
//
// Identity card (bottom):
//   - Avatar circle (36 px, surfaceElevated bg, accent initials)
//   - "First name · Church name" (primary)
//   - "City, Country" (secondary) — EXCLUDED when church.type === 'underground'
//     per global rule on underground geographic data (KAN-76 AC + COO ratify)
//   - Self-only display: NEVER governed by display_name_preference or
//     anonymous flag — leader always sees their own real name / church
//     on their own surface. Cross-ref KAN-72 + KAN-75.
//   - Not tappable (no onPress) — visual surface only at MVP.
//
// Logout row (below identity card, separated by hairline border-top):
//   - Muted color (rgba(240,237,230,0.3)) to read intentionally subdued
//   - Tapping does NOT close panel — Alert mounts on top of Modal
//     (natural React Native Modal + Alert stacking). On confirm,
//     useAuth().signOut() fires; the branch flip to "unauthenticated"
//     drives RootNavigator back to Login and the panel unmounts as
//     part of that transition.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import { useHamburger } from '../../contexts/HamburgerContext';
import { supabase } from '../../lib/supabase';
import { navigationRef } from '../../navigation/navigationRef';
import RpLogo from '../home/RpLogo';

// Responsive panel width — 75% mobile / 50% tablet / 360 fixed desktop.
const { width: WIN_W } = Dimensions.get('window');
const PANEL_W = WIN_W >= 1280 ? 360 : WIN_W >= 768 ? WIN_W * 0.5 : WIN_W * 0.75;

const LOGOUT_COLOR = 'rgba(240, 237, 230, 0.3)';
const ICON_SIZE = 22;
const ICON_STROKE = 1.5;
const CLOSE_DURATION_MS = 200;
const OPEN_DURATION_MS = 250;

interface CardData {
  fullName: string | null;
  firstName: string | null;
  churchName: string | null;
  city: string | null;
  country: string | null;
  churchType: string | null;
}

function getInitials(fullName: string | null): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

type IconKey = 'vision' | 'outreach' | 'language' | 'settings' | 'faq';

function MenuIcon({ icon }: { icon: IconKey }) {
  const stroke = Colors.accent;
  switch (icon) {
    case 'vision':
      return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10} stroke={stroke} strokeWidth={ICON_STROKE} />
          <Line x1={12} y1={8} x2={12} y2={12} stroke={stroke} strokeWidth={ICON_STROKE} strokeLinecap="round" />
          <Line x1={12} y1={16} x2={12.01} y2={16} stroke={stroke} strokeWidth={ICON_STROKE} strokeLinecap="round" />
        </Svg>
      );
    case 'outreach':
      return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10} stroke={stroke} strokeWidth={ICON_STROKE} />
          <Line x1={2} y1={12} x2={22} y2={12} stroke={stroke} strokeWidth={ICON_STROKE} />
          <Path
            d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
            stroke={stroke}
            strokeWidth={ICON_STROKE}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'language':
      return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
          <Path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke={stroke}
            strokeWidth={ICON_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'settings':
      return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={3} stroke={stroke} strokeWidth={ICON_STROKE} />
          <Path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            stroke={stroke}
            strokeWidth={ICON_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'faq':
      return (
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10} stroke={stroke} strokeWidth={ICON_STROKE} />
          <Path
            d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
            stroke={stroke}
            strokeWidth={ICON_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Line x1={12} y1={17} x2={12.01} y2={17} stroke={stroke} strokeWidth={ICON_STROKE} strokeLinecap="round" />
        </Svg>
      );
  }
}

interface MenuItemProps {
  icon: IconKey;
  label: string;
  onPress: () => void;
  last?: boolean;
}

function MenuItem({ icon, label, onPress, last }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuRow, last ? styles.menuRowLast : null]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MenuIcon icon={icon} />
      <Text style={styles.menuLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HamburgerPanel() {
  const { isOpen, close } = useHamburger();
  const { session, signOut } = useAuth();

  // Animated.Value tracks the panel's X translation. Starts off-screen
  // right (PANEL_W). On open → 0; on close → PANEL_W (then unmount).
  const translateX = useRef(new Animated.Value(PANEL_W)).current;

  // Local Modal-visibility boolean (separate from context isOpen) so
  // the close animation can finish before Modal unmounts.
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setModalVisible(true);
      Animated.timing(translateX, {
        toValue: 0,
        duration: OPEN_DURATION_MS,
        useNativeDriver: true,
      }).start();
    } else if (modalVisible) {
      Animated.timing(translateX, {
        toValue: PANEL_W,
        duration: CLOSE_DURATION_MS,
        useNativeDriver: true,
      }).start(() => {
        setModalVisible(false);
      });
    }
    // translateX + modalVisible are intentionally not in deps — the
    // effect drives them, including them would re-fire on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Android hardware back button — swallow when panel is visible so we
  // don't pop the underlying nav stack along with the panel.
  useEffect(() => {
    if (!modalVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [modalVisible, close]);

  // KAN-76 v2 — auto-dismiss on signOut. When session transitions to
  // null (KAN-42 signOut() flips the auth branch to "unauthenticated"),
  // the Modal must be gone before RootNavigator unmounts the active
  // tree — otherwise the panel briefly hovers over Login as the
  // underlying screen is already animating away. Instant snap (no
  // Animated.timing) so the dismiss completes within the same frame as
  // the branch flip.
  useEffect(() => {
    if (session === null && modalVisible) {
      translateX.setValue(PANEL_W);
      setModalVisible(false);
      close();
    }
    // translateX intentionally not in deps — it's a stable Animated.Value
    // ref; including it would not change anything but adds noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, modalVisible, close]);

  // Swipe-left gesture to dismiss. Threshold dx < -50; horizontal-
  // dominant guard so vertical scroll inside the panel doesn't get
  // captured.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx < -10 && Math.abs(g.dy) < Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) close();
      },
    }),
  ).current;

  // Identity-card data fetch. Pulled once per session.user.id change —
  // not on every panel open. `users.full_name` + the embedded
  // churches row gives the panel everything it needs in one round trip.
  // author_id-equivalent: we filter by auth_id to land the right row
  // even on the legacy founder path that pre-existed as a leader.
  const [card, setCard] = useState<CardData | null>(null);
  const authId = session?.user?.id ?? null;

  useEffect(() => {
    if (!authId) {
      setCard(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('full_name, church:church_id(name, city, country, type)')
        .eq('auth_id', authId)
        .maybeSingle();
      if (cancelled || !data) return;
      // Supabase types embedded relationships as either an object or
      // an array depending on FK cardinality. Defensive shape here:
      // accept either, normalize to a single object or null.
      const row = data as unknown as { full_name: string | null; church?: unknown };
      const cf = row.church;
      const c = Array.isArray(cf) ? (cf[0] ?? null) : (cf ?? null);
      const typed = c as
        | { name?: string | null; city?: string | null; country?: string | null; type?: string | null }
        | null;
      const fullName = row.full_name ?? null;
      setCard({
        fullName,
        firstName: fullName ? fullName.trim().split(/\s+/)[0] : null,
        churchName: typed?.name ?? null,
        city: typed?.city ?? null,
        country: typed?.country ?? null,
        churchType: typed?.type ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [authId]);

  // Navigation handlers — close panel first (animated), then push after
  // the slide-out completes so the underlying screen surfaces clean.
  const handleSettings = useCallback(() => {
    close();
    setTimeout(() => {
      if (navigationRef.isReady()) navigationRef.navigate('Settings');
    }, CLOSE_DURATION_MS + 50);
  }, [close]);

  const handleLanguage = useCallback(() => {
    // Language section not yet built (KAN-27 deferred per risks/gaps).
    // Route to Settings root per ticket's defensive-routing technical note.
    close();
    setTimeout(() => {
      if (navigationRef.isReady()) navigationRef.navigate('Settings');
    }, CLOSE_DURATION_MS + 50);
  }, [close]);

  const handleComingSoon = useCallback(
    (label: string) => {
      // Vision / Outreach & Missions / FAQ — KAN-28b not yet built.
      // Mirror the Language defensive-routing pattern: close panel
      // first, then surface the placeholder. Swap to navigationRef
      // when KAN-28b ships.
      close();
      setTimeout(() => {
        Alert.alert(label, 'This section is coming in a future update.');
      }, CLOSE_DURATION_MS + 50);
    },
    [close],
  );

  const handleLogout = useCallback(() => {
    // KAN-76 AC — panel STAYS OPEN when Logout is tapped. Alert mounts
    // on top of the Modal (natural RN stacking). On confirm, the auth
    // branch flips to "unauthenticated" via signOut() and RootNavigator
    // unmounts the active tree (panel goes with it). On cancel, only
    // the Alert dismisses — panel remains visible + interactive.
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void signOut();
          },
        },
      ],
      { cancelable: true },
    );
  }, [signOut]);

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      />

      <Animated.View
        style={[styles.panel, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.header}>
          <RpLogo size={40} />
          <Text style={styles.headerWordmark}>Replant</Text>
        </View>

        <View style={styles.menuList}>
          <MenuItem icon="vision" label="The Vision" onPress={() => handleComingSoon('The Vision')} />
          <MenuItem
            icon="outreach"
            label="Outreach & Missions"
            onPress={() => handleComingSoon('Outreach & Missions')}
          />
          <MenuItem icon="language" label="Language" onPress={handleLanguage} />
          <MenuItem icon="settings" label="Settings" onPress={handleSettings} />
          <MenuItem icon="faq" label="FAQ" onPress={() => handleComingSoon('FAQ')} last />
        </View>

        <View style={styles.footer}>
          <View style={styles.identityCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(card?.fullName ?? null)}</Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.identityName} numberOfLines={1}>
                {card?.firstName ?? '…'}
                {card?.churchName ? ` · ${card.churchName}` : ''}
              </Text>
              {card?.churchType !== 'underground' && (card?.city || card?.country) && (
                <Text style={styles.identityLocation} numberOfLines={1}>
                  {[card.city, card.country].filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
          </View>

          <Pressable
            style={styles.logoutRow}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                stroke={LOGOUT_COLOR}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M16 17l5-5-5-5"
                stroke={LOGOUT_COLOR}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Line x1={21} y1={12} x2={9} y2={12} stroke={LOGOUT_COLOR} strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
            <Text style={styles.logoutLabel}>Log out</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 8, 8, 0.6)',
    // expo-blur not installed at MVP — wireframe specs 2px backdrop blur
    // alongside the rgba overlay; deferred until the package lands.
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: PANEL_W,
    backgroundColor: Colors.surface,
    borderLeftWidth: 0.5,
    borderLeftColor: Colors.borderAccent,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 24,
    marginBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerWordmark: {
    fontFamily: Typography.displayRegular,
    fontSize: 30,
    letterSpacing: 2.4,
    color: Colors.text,
  },
  menuList: {
    flex: 1,
    flexDirection: 'column',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuLabel: {
    fontFamily: Typography.displayRegular,
    fontSize: 24,
    color: Colors.text,
  },
  footer: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingTop: 20,
    gap: 10,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 18,
    color: Colors.accent,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  identityName: {
    fontFamily: Typography.body,
    fontSize: 17,
    fontWeight: '500',
    color: Colors.text,
  },
  identityLocation: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  logoutLabel: {
    fontFamily: Typography.body,
    fontSize: 17,
    color: LOGOUT_COLOR,
  },
});
