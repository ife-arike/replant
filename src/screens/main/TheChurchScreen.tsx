// ─────────────────────────────────────────────
// TheChurchScreen — CAL host (KAN-21 + KAN-22 + CAL chrome patch)
//
// Structure per CD (church-tab/app.jsx + styles.css, Founder-locked
// 2026-05-28):
//
//   tc-header
//     ├── tc-title-row (title + subtitle, CAML/CAL variants)
//     └── tc-pager (At My Location · horizon line · At Large)
//
//   tc-pages
//     ├── page 0: CAML placeholder (separate ticket — switcher works)
//     └── page 1: CAL
//           ├── GlobeView (Mapbox globe, dot rendering, rotation)
//           ├── Count stats chip   (top-left of globe area)
//           ├── Regions button     (top-right of globe area — STUB)
//           ├── RegionalPanel      (slide-in, shell only — DBA-blocked body)
//           ├── ChurchProfileBottomSheet (KAN-20, dot-tap)
//           └── PrayerWallPullUp   (KAN-22, 3-state)
//
// useChurchesGlobal is hoisted here so both the subtitle (verified +
// hidden counts) and the count chip read from one source. GlobeView
// receives the data as props — its KAN-21 corner pills were stripped
// per CD chrome rule (KAN-21 c.14810, Founder ack 2026-05-28).
//
// CAML page is a placeholder for now per dispatch; horizon-line
// switcher animates regardless so the leader can preview the swap.
// ─────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import { useReducedMotion } from '../../utils/useReducedMotion';
import { useChurchesGlobal } from '../../hooks/useChurchesGlobal';
import GlobeView from '../../components/church/GlobeView';
import ChurchProfileBottomSheet from '../../components/church/ChurchProfileBottomSheet';
import PrayerWallPullUp from '../../components/church/PrayerWallPullUp';
import RegionalPanel, { type ChurchRegion } from '../../components/church/RegionalPanel';

type Page = 0 | 1; // 0 = CAML (placeholder), 1 = CAL (globe)

// Horizon-line math from CD styles.css: --horizon-w grows from 22% to
// 78% as page goes 0→1; --horizon-x slides from 0% to 22% so the bar
// stays inside the track. Same easing as the CD: cubic-bezier(.22, .61,
// .36, 1) over 550ms.
const HORIZON_MS = 550;

export default function TheChurchScreen() {
  const { branch } = useAuth();
  const viewerVerified = branch === 'active';
  const reduced = useReducedMotion();

  // Hoisted globe data — subtitle + count chip + GlobeView all read from
  // the same source (one network call, no duplicate fetches).
  const {
    dots, undergroundCount, ownChurchId, viewerCountry, loading, error, refetch,
  } = useChurchesGlobal();

  const [page, setPage] = useState<Page>(1); // CAL is the live build today
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const [regionalOpen, setRegionalOpen] = useState(false);
  const [regional, setRegional] = useState<ChurchRegion | null>(null);
  // Fix A (2026-05-28): host-side track of overlay state so we can pause
  // the globe rotation + red-dot pulse whenever any overlay is visible.
  const [prayerWallSnap, setPrayerWallSnap] = useState<'collapsed' | 'half' | 'full'>('collapsed');
  const anyOverlayOpen =
    selectedChurchId !== null || regionalOpen || prayerWallSnap !== 'collapsed';

  // Counts for the chrome.
  const verifiedCount = dots.length;
  const urgentCount = useMemo(
    () => dots.reduce((n, d) => (d.rag_status === 'red' ? n + 1 : n), 0),
    [dots],
  );

  // Horizon animated value 0→1.
  const horizonProgress = React.useRef(new Animated.Value(page)).current;
  React.useEffect(() => {
    if (reduced) {
      horizonProgress.setValue(page);
    } else {
      Animated.timing(horizonProgress, {
        toValue: page,
        duration: HORIZON_MS,
        easing: Easing.bezier(0.22, 0.61, 0.36, 1),
        useNativeDriver: false, // animating width/left, not transform
      }).start();
    }
  }, [page, reduced, horizonProgress]);

  const horizonWidth = horizonProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['22%', '78%'],
  });
  const horizonLeft = horizonProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '22%'],
  });

  // Regions button (STUB per Step 0 halt — get_churches_global lacks
  // country/name/leaders fields). Opens the RegionalPanel shell with a
  // placeholder region so the chrome is testable; real region selection
  // lands when DBA delivers (KAN-21 c.14810).
  const handleRegionsPress = () => {
    setRegional({ name: 'Coming soon', churches: [] });
    setRegionalOpen(true);
  };

  const handleHorizonPress = () => setPage((p) => (p === 0 ? 1 : 0));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* tc-header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {page === 0 ? (
              <>The Church at <Text style={styles.titleEm}>Loganville</Text></>
            ) : (
              <>The Church <Text style={styles.titleEm}>at Large</Text></>
            )}
          </Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {page === 0
            ? 'YOUR HOME · 6 LEADERS WITHIN 10 MILES'
            : `GLOBAL · ${verifiedCount} VERIFIED · +${undergroundCount} HIDDEN`}
        </Text>
        {/* tc-pager — horizon switcher */}
        <View style={styles.pager}>
          <Text style={[styles.pagerLabel, page === 0 && styles.pagerLabelActive]}>AT MY LOCATION</Text>
          <Pressable onPress={handleHorizonPress} style={styles.horizonTrack} accessibilityRole="button" accessibilityLabel={page === 0 ? 'Switch to At Large' : 'Switch to At My Location'}>
            <View style={styles.horizonBase} />
            <Animated.View style={[styles.horizonBar, { width: horizonWidth, left: horizonLeft }]} />
          </Pressable>
          <Text style={[styles.pagerLabel, page === 1 && styles.pagerLabelActive]}>AT LARGE</Text>
        </View>
      </View>

      {/* tc-pages */}
      <View style={styles.pages}>
        {page === 0 ? (
          // CAML placeholder — separate ticket per dispatch.
          <View style={styles.camlPlaceholder}>
            <Text style={styles.placeholderEyebrow}>AT MY LOCATION</Text>
            <Text style={styles.placeholderText}>
              The local-map view lands in a separate ticket. Use the horizon switcher above to return to At Large.
            </Text>
          </View>
        ) : (
          <View style={styles.calStack}>
            <GlobeView
              dots={dots}
              ownChurchId={ownChurchId}
              viewerCountry={viewerCountry}
              loading={loading}
              error={error}
              onRetry={refetch}
              onChurchSelect={setSelectedChurchId}
              forcePaused={anyOverlayOpen}
            />

            {/* Count stats chip — top-left of globe area (CD app.jsx) */}
            <View style={styles.countChip} pointerEvents="none">
              <Text style={styles.countChipText}>
                <Text style={styles.countSky}>{verifiedCount}</Text>
                <Text style={styles.countMuted}> VERIFIED · </Text>
                <Text style={styles.countRed}>{urgentCount}</Text>
                <Text style={styles.countMuted}> URGENT · </Text>
                <Text style={styles.countOffWhite}>+{undergroundCount}</Text>
                <Text style={styles.countMuted}> HIDDEN</Text>
              </Text>
            </View>

            {/* Regions button — top-right of globe area. STUB per Step 0
                halt (KAN-21 c.14810) — opens the RegionalPanel shell. */}
            <Pressable
              onPress={handleRegionsPress}
              style={styles.regionsBtn}
              accessibilityRole="button"
              accessibilityLabel="Regions"
            >
              <View style={styles.regionsDot} />
              <Text style={styles.regionsText}>REGIONS</Text>
            </Pressable>

            {/* RegionalPanel — shell only; body pending DBA. */}
            <RegionalPanel
              open={regionalOpen}
              region={regional}
              onClose={() => setRegionalOpen(false)}
            />

            {/* KAN-22 — Prayer Wall pull-up. onSnapChange feeds the
                anyOverlayOpen gate so the globe pauses while the panel
                is half or full (Fix A). */}
            <PrayerWallPullUp onSnapChange={setPrayerWallSnap} />
          </View>
        )}
      </View>

      {/* Dot-tap profile sheet — outside the page swap so dismiss state
          survives a page change (defensive; not strictly needed today). */}
      <ChurchProfileBottomSheet
        churchId={selectedChurchId}
        viewerVerified={viewerVerified}
        onDismiss={() => setSelectedChurchId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // tc-header — CD styles.css .tc-header
  // Fix 1 (2026-05-28): increased bottom padding so the switcher row
  // has breathing room before the globe area starts.
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    // CD has a gradient fade to background. RN doesn't do CSS gradients
    // out-of-the-box; sticking to a solid near-black for now.
    backgroundColor: 'rgba(8, 8, 8, 0.92)',
    zIndex: 6,
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: {
    fontFamily: Typography.displayRegular, // CD: Cormorant 400, weight per spec
    fontSize: 22,
    letterSpacing: 0.44, // 0.02em × 22
    color: Colors.text,
    lineHeight: 26,
  },
  titleEm: {
    fontFamily: Typography.displayItalic, // sky italic per CD .tc-title em
    color: Colors.accent,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 2.1, // ~0.22em × 9.5
    color: Colors.textMuted,
  },

  // tc-pager
  pager: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  pagerLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.textMuted,
  },
  pagerLabelActive: { color: Colors.accent },
  horizonTrack: {
    flex: 1, height: 12,
    justifyContent: 'center',
  },
  horizonBase: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  horizonBar: {
    position: 'absolute',
    height: 2,
    backgroundColor: Colors.accent,
    borderRadius: 1,
    shadowColor: Colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },

  // tc-pages
  pages: { flex: 1 },

  // CAML placeholder
  camlPlaceholder: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 10,
  },
  placeholderEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 2.2,
    color: Colors.accent,
  },
  placeholderText: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },

  // CAL stack
  calStack: { flex: 1 },

  // Count chip — top-left of globe area (CD: top:16, left:16)
  // Fix 1 (2026-05-28): bumped fontSize 8.5 → 10 and padding 7/11 → 9/13
  // so the chip is legible on-device. CD CSS reads 8.5px for web; RN
  // renders the same numeric size noticeably smaller, so a clean bump
  // restores legibility without breaking the visual rhythm.
  countChip: {
    position: 'absolute',
    top: 16, left: 16,
    paddingVertical: 9, paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 8, 8, 0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    zIndex: 8,
  },
  countChipText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.6, // ~0.16em × 10
    lineHeight: 14,
  },
  countSky:      { color: Colors.accent },
  countRed:      { color: Colors.red },
  countOffWhite: { color: Colors.text },
  countMuted:    { color: Colors.textMuted },

  // Regions button — top-right of globe area (CD: top:16, right:16)
  regionsBtn: {
    position: 'absolute',
    top: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 9, paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 8, 8, 0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    zIndex: 8,
  },
  regionsDot: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.textMuted,
  },
  regionsText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.textMuted,
  },
});
