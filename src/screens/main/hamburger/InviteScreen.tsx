// InviteScreen — hamburger sprint (CD v5 final, Founder-locked 2026-06-09).
// Presented as a full-screen modal (presentation: 'modal') — slides up from
// the bottom. Custom header (no nav bar).
//
// Invite link format: Option A — web URL (Founder-confirmed; no selector UI).
//   projectreplant.org/join?ref=${referralCode}
//
// Referral code (MVP fallback — no DB column yet): deterministic 8-char code
// derived from public.users.id — first 8 chars of the UUID, uppercased,
// prefixed "RPL-" (e.g. RPL-DED45949). Fetched via auth_id = auth.uid()
// (NEVER id = auth.uid() — load-bearing Replant invariant). When the
// users.referral_code column ships, swap to reading that field directly.
//
// All italic copy uses Typography.scriptureItalic; colours via Colors tokens.

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthProvider';
import { supabase } from '../../../lib/supabase';
import type { RootStackParamList } from '../../../navigation/types';
import RpLogo from '../../../components/home/RpLogo';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const LINK_HOST = 'projectreplant.org/join?ref=';

// MVP fallback — derive a deterministic referral code from the user's
// public.users.id UUID. Swap to users.referral_code once that column ships.
function deriveReferralCode(userId: string | null): string {
  if (!userId) return 'RPL-XXXXXXXX';
  const head = userId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `RPL-${head}`;
}

export default function InviteScreen() {
  const navigation = useNavigation<NavProp>();
  const { session } = useAuth();
  const authId = session?.user?.id ?? null;

  const [referralCode, setReferralCode] = useState<string>('RPL-XXXXXXXX');
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Fetch public.users.id via auth_id (NOT id = auth.uid()).
  useEffect(() => {
    if (!authId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authId)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as unknown as { id: string | null };
      setReferralCode(deriveReferralCode(row.id ?? null));
    })();
    return () => {
      cancelled = true;
    };
  }, [authId]);

  const fullUrl = `${LINK_HOST}${referralCode}`;

  const showToast = () => {
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(fullUrl);
    showToast();
  };

  const handleShare = () => {
    void Share.share({
      url: fullUrl,
      message: `Join me on Replant — a secure network for Christian leaders. ${fullUrl}`,
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Custom header */}
      <View style={styles.header}>
        <View style={styles.headerMark}>
          <RpLogo size={34} />
          <Text style={styles.headerWordmark}>Replant</Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={styles.closeButton}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M18 6L6 18M6 6l12 12"
              stroke={Colors.textMuted}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
      >
        {/* Eyebrow with hairlines either side */}
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowHairline} />
          <Text style={styles.eyebrow}>Kingdom invitation</Text>
          <View style={styles.eyebrowHairline} />
        </View>

        {/* Headline */}
        <Text style={styles.headline}>
          Bring a leader{'\n'}
          <Text style={styles.headlineItalic}>into the network.</Text>
        </Text>

        {/* Sub-copy */}
        <Text style={styles.sub}>
          Your invite link is unique to you. When a leader joins through it, you're
          connected in the network.
        </Text>

        {/* Active link block */}
        <View style={styles.linkBlock}>
          <View style={styles.linkText}>
            <Text style={styles.linkLabel}>Your link</Text>
            <Text style={styles.linkUrl} numberOfLines={1}>{fullUrl}</Text>
          </View>
          <Pressable
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel="Copy invite link"
            hitSlop={6}
            style={styles.copyButton}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 9h10v10H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
                stroke={Colors.accent}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </View>

        {/* Primary CTA — share */}
        <Pressable
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share invite link"
          style={styles.cta}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 16V4M12 4L8 8M12 4l4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
              stroke="#080808"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.ctaLabel}>Share invite link</Text>
        </Pressable>

        {/* Scripture anchor */}
        <View style={styles.scripture}>
          <Text style={styles.scriptureText}>
            For as the body is one, and hath many members, and all the members of that
            one body, being many, are one body: so also is Christ.
          </Text>
          <Text style={styles.scriptureRef}>1 Corinthians 12:12 · KJV</Text>
        </View>
      </ScrollView>

      {/* Copy confirmation toast */}
      {toastVisible && (
        <Animated.View
          style={[styles.toast, { opacity: toastOpacity }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>Link copied</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  headerMark: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerWordmark: {
    fontFamily: Typography.displayMedium,
    fontSize: 22,
    letterSpacing: 0.5,
    color: Colors.text,
    marginLeft: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Body
  body: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    flexGrow: 1,
  },

  // Eyebrow
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  eyebrowHairline: {
    width: 18,
    height: 0.5,
    backgroundColor: Colors.borderAccent,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 11.5,
    letterSpacing: 3.22, // 0.28em × 11.5
    textTransform: 'uppercase',
    color: Colors.accent,
    textAlign: 'center',
  },

  // Headline
  headline: {
    fontFamily: Typography.displayRegular,
    fontSize: 38,
    lineHeight: 40, // 1.05 × 38
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },
  headlineItalic: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 38,
    color: Colors.accent,
  },

  // Sub-copy
  sub: {
    fontFamily: Typography.sansLight,
    fontSize: 15.5,
    lineHeight: 26, // ~1.65 × 15.5
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 290,
    alignSelf: 'center',
    marginBottom: 30,
  },

  // Active link block
  linkBlock: {
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.borderAccent,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  linkText: {
    flex: 1,
    minWidth: 0,
  },
  linkLabel: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    letterSpacing: 2.31, // 0.22em × 10.5
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  linkUrl: {
    fontFamily: Typography.mono,
    fontSize: 15,
    color: Colors.accent,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(107, 181, 232, 0.08)',
    borderWidth: 0.5,
    borderColor: Colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CTA
  cta: {
    height: 52,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 22,
  },
  ctaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 17,
    color: '#080808',
  },

  // Scripture anchor
  scripture: {
    marginTop: 'auto',
    paddingTop: 24,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  scriptureText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 27, // ~1.7 × 16
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 290,
    marginBottom: 8,
  },
  scriptureRef: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.64, // 0.24em × 11
    textTransform: 'uppercase',
    color: Colors.textSubtle,
  },

  // Copy toast
  toast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: Colors.borderAccent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  toastText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.text,
  },
});
