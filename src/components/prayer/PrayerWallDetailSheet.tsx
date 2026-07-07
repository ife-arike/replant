// ─────────────────────────────────────────────
// PrayerWallDetailSheet — KAN-23 v2 (Ticket B)
//
// Bottom sheet that rises over the feed when a leader taps a prayer
// card. Renders the full prayer body (no clamp), category + urgent
// chips, passive heart count, and two CTAs:
//
//   1. Stand in the gap — optimistic flip of local iStanding +
//      standCount, then calls supabase.rpc('stand_in_the_gap',
//      { p_prayer_request_id }); rolls back on error. The RPC is
//      SECURITY DEFINER, verified-only, self-prayer blocked, race-safe
//      on the (prayer_request_id, leader_id) PK.
//
//   2. Connect to this church — for named, non-underground posts only.
//      Anonymous / underground posts render the CTA disabled with the
//      label "Anonymous · direct message unavailable". Still a STUB
//      pattern with explicit TODO comment.
//
// Dismiss paths (all restore feed scroll position because the feed
// FlatList behind us was never unmounted):
//   - ✕ tap top-right of sheet
//   - Tap-outside on the dimmed backdrop
//   - Swipe-down on the sheet (PanResponder threshold)
//
// Animation: 320 ms cubic-bezier ease-out slide-up + backdrop opacity
// fade-in 0 → 0.55. Reduced motion drops to instant render.
//
// Note on backdrop blur: design spec asks for "8 pt backdrop blur";
// expo-blur is not installed at MVP (see DeactivationModal for the
// same deferral pattern). The dim alone reads acceptably.
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../utils/useReducedMotion';
import { supabase } from '../../lib/supabase';
import {
  formatRelativeTime,
  getLocationLine,
  hasPrayedStateChanged,
  type PrayerRow,
} from './PrayerWallLogic';
import { formatLeaderLine, viewerOrgCopy } from '../../utils/displayHelpers';
import { HeartIcon, XIcon } from './PrayerIcons';
import { PRAYER_DETAIL_STYLE } from './PrayerWallCard';
import ReportSheet from '../common/ReportSheet';

interface Props {
  row: PrayerRow | null;
  onDismiss: () => void;
  /**
   * KAN-23 corrections r1 — fires on every dismiss path (✕, backdrop,
   * swipe-down) when the leader's stand-in-the-gap state has changed
   * during this sheet session. Parent uses it to mirror the new
   * i_prayed / prayed_count back to the matching row in its feed
   * cache, so the card heart count doesn't go stale when the sheet
   * closes. Suppressed when state matches the row's initial values
   * (silent dismiss, no fire) — see hasPrayedStateChanged.
   */
  onPrayedChange?: (requestId: string, iPrayed: boolean, prayedCount: number) => void;
  /**
   * The viewer's own church_id. When the post's church_id matches this,
   * "Connect to this church" is disabled (you can't connect to your own
   * church) and the label reads "This is your church".
   */
  viewerChurchId?: string;
  /**
   * The viewer's own church type. Drives the para-ministry copy swap on
   * the "This is your church" CTA label (BA-para #1 — director sees
   * "This is your organization" instead). Optional; defaults to the
   * "your church" wording when absent.
   */
  viewerChurchType?: string | null;
  now?: Date;
}

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_MAX_RATIO = 0.88;
const SHEET_HEIGHT = SCREEN_H * SHEET_MAX_RATIO;
const ANIM_MS = 320;
const SWIPE_DISMISS_THRESHOLD = 80;

export default function PrayerWallDetailSheet({ row, onDismiss, onPrayedChange, viewerChurchId, viewerChurchType, now }: Props) {
  const viewer = viewerOrgCopy(viewerChurchType);
  const reduced = useReducedMotion();
  const slideY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  // Local optimistic state — write stubs. The real RPC wiring is
  // pending SEC checkpoint and will land in a follow-up ticket.
  const [iStanding, setIStanding] = useState(row?.i_prayed ?? false);
  const [standCount, setStandCount] = useState(row?.prayed_count ?? 0);
  // KAN-304 — report sheet + in-session already-reported set (never persisted).
  const [reportOpen, setReportOpen] = useState(false);
  const reportedKeys = useRef<Set<string>>(new Set()).current;

  // Sync local optimistic state whenever the row changes (i.e., the
  // user opens a different card without an intervening unmount).
  useEffect(() => {
    if (row !== null) {
      setIStanding(row.i_prayed);
      setStandCount(row.prayed_count);
    }
  }, [row]);

  useEffect(() => {
    if (row !== null) {
      setMounted(true);
      if (reduced) {
        slideY.setValue(0);
        backdropOpacity.setValue(0.55);
      } else {
        Animated.parallel([
          Animated.timing(slideY, {
            toValue: 0,
            duration: ANIM_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 0.55,
            duration: ANIM_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else if (mounted) {
      // Animate out, then unmount once the slide completes.
      const done = () => setMounted(false);
      if (reduced) {
        slideY.setValue(SHEET_HEIGHT);
        backdropOpacity.setValue(0);
        done();
      } else {
        Animated.parallel([
          Animated.timing(slideY, {
            toValue: SHEET_HEIGHT,
            duration: ANIM_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 0,
            duration: ANIM_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(done);
      }
    }
    // mounted intentionally excluded — we react to row presence, not mount churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, reduced]);

  // Single dismiss path — fires onPrayedChange (if provided) when the
  // leader's stand-in-the-gap toggled during this sheet session, then
  // delegates to onDismiss. Used by ✕ tap, backdrop tap, and swipe-
  // down. Initial values for the change-detection are taken from the
  // row prop itself; iStanding / standCount are reset to row.* every
  // time row changes (sync effect above).
  const handleDismiss = () => {
    if (
      row !== null &&
      onPrayedChange &&
      hasPrayedStateChanged(
        { i_prayed: row.i_prayed, prayed_count: row.prayed_count },
        { i_prayed: iStanding, prayed_count: standCount },
      )
    ) {
      onPrayedChange(row.id, iStanding, standCount);
    }
    onDismiss();
  };

  // Stash latest handleDismiss in a ref so the panResponder closure
  // (built once via useRef at first render) always sees the freshest
  // values. Without this, the panResponder would call onDismiss
  // directly with a stale prop and miss the onPrayedChange fan-out.
  const handleDismissRef = useRef(handleDismiss);
  useEffect(() => {
    handleDismissRef.current = handleDismiss;
  });

  // Swipe-down dismiss — only react to downward drag, ignore upward.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) slideY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > SWIPE_DISMISS_THRESHOLD) {
          handleDismissRef.current();
        } else {
          Animated.timing(slideY, {
            toValue: 0,
            duration: 150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const handleStandInTheGap = async () => {
    if (row === null) return;
    // Optimistic flip first — server call follows; on failure we roll
    // back to the captured pre-flip values.
    const prevStanding = iStanding;
    const prevCount = standCount;
    const nextStanding = !prevStanding;
    const nextCount = prevCount + (nextStanding ? 1 : -1);
    setIStanding(nextStanding);
    setStandCount(nextCount);

    const { error } = await supabase.rpc('stand_in_the_gap', {
      p_prayer_request_id: row.id,
    });
    if (error) {
      setIStanding(prevStanding);
      setStandCount(prevCount);
    }
  };

  const handleConnect = () => {
    // TODO: wire Connect flow — pending SEC checkpoint.
    // Today this is a UI-only stub. The CTA renders for named, non-
    // underground posts; tapping does nothing persistent. A follow-up
    // ticket lands the actual leader-to-leader connection surface.
  };

  if (!mounted || row === null) return null;

  // KAN-23 corrections r1 — church type removed from sheet header per
  // dispatch. Matches the same change in PrayerWallCard. Identity is
  // church name + country only.
  const locationLine = getLocationLine(row.church_name, row.country);
  // v8 Fix E — attribution now flows through the shared
  // formatLeaderLine helper so the sheet matches the card's
  // "{RoleLabel} {Name}" format. isAnonymous derived from null
  // leader_display_name (server-side mask returns null for both
  // anonymous + underground posts).
  const isUnderground = row.church_type === 'underground';
  const isAnonymous = row.leader_display_name === null;
  const leaderLine = formatLeaderLine(row.leader_role, row.leader_display_name, isAnonymous);
  const timestamp = formatRelativeTime(row.created_at, now);
  // You can't connect to your own church — disable + relabel when the
  // post's church_id matches the viewer's own church.
  const isOwnChurch = viewerChurchId != null && row.church_id === viewerChurchId;
  const connectDisabled = isUnderground || isAnonymous || isOwnChurch;
  const connectLabel = isOwnChurch
    ? `This is ${viewer.yourChurchOrOrg}`
    : connectDisabled
      ? 'Direct message unavailable'
      : 'Connect to this church';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop — dim + tap-to-dismiss. */}
      <Pressable onPress={handleDismiss} style={StyleSheet.absoluteFill} accessibilityLabel="Dismiss prayer detail">
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#000', opacity: backdropOpacity },
          ]}
        />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideY }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.grabHandle} />

        {/* Header — location string + ✕ */}
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.headerLocation,
              { color: row.urgency ? Colors.red : Colors.accent },
            ]}
            numberOfLines={2}
          >
            {locationLine.toUpperCase()}
          </Text>
          <Pressable onPress={handleDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <XIcon size={16} color={Colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.leaderLine}>{leaderLine}</Text>

        {/* Body — full prayer text, no clamp, plain/readable Cormorant
            Medium (NOT italic — detail sheets stay legible at length) */}
        <Text style={[styles.body, PRAYER_DETAIL_STYLE]}>{row.prayer_text}</Text>

        {/* Meta chips + passive heart count */}
        <View style={styles.metaRow}>
          {row.category ? (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{row.category}</Text>
            </View>
          ) : null}
          {row.urgency ? (
            <View style={styles.urgentChip}>
              <Text style={styles.urgentChipText}>Urgent</Text>
            </View>
          ) : null}
          <View style={styles.heartDisplay} accessible accessibilityLabel={`${standCount} prayed`}>
            <HeartIcon size={12} color={iStanding ? Colors.red : Colors.textMuted} filled={iStanding} />
            <Text style={styles.heartCount}>{standCount}</Text>
          </View>
          {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
        </View>

        {/* CTA row */}
        <View style={styles.ctaColumn}>
          <Pressable
            onPress={handleStandInTheGap}
            accessibilityRole="button"
            accessibilityLabel={iStanding ? "You're standing in the gap" : 'Stand in the gap'}
            style={({ pressed }) => [
              styles.ctaPrimary,
              iStanding ? styles.ctaPrimaryGhost : styles.ctaPrimarySolid,
              pressed && styles.ctaPressed,
            ]}
          >
            <HeartIcon
              size={14}
              color={iStanding ? Colors.red : Colors.background}
              filled={iStanding}
            />
            <Text
              style={[
                styles.ctaPrimaryText,
                iStanding ? styles.ctaPrimaryTextGhost : styles.ctaPrimaryTextSolid,
              ]}
            >
              {iStanding ? "You're standing in the gap" : 'Stand in the gap'}
            </Text>
          </Pressable>

          <Pressable
            onPress={connectDisabled ? undefined : handleConnect}
            accessibilityRole="button"
            accessibilityLabel={connectLabel}
            accessibilityState={{ disabled: connectDisabled }}
            disabled={connectDisabled}
            style={({ pressed }) => [
              styles.ctaSecondary,
              connectDisabled && styles.ctaSecondaryDisabled,
              pressed && !connectDisabled && styles.ctaPressed,
            ]}
          >
            <Text
              style={[
                styles.ctaSecondaryText,
                connectDisabled && styles.ctaSecondaryTextDisabled,
              ]}
            >
              {connectLabel}
            </Text>
          </Pressable>

          {/* KAN-304 — quiet report affordance (a door, not an alarm: muted, last). */}
          <Pressable
            onPress={() => setReportOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Report this prayer"
            accessibilityHint="Opens a form to report this to the Replant team"
            style={styles.reportRow}
          >
            <Text style={styles.reportRowText}>Report this prayer</Text>
          </Pressable>
        </View>
      </Animated.View>

      {row ? (
        <ReportSheet
          open={reportOpen}
          surface="prayer_request"
          targetId={row.id}
          alreadyReportedKeys={reportedKeys}
          onReported={(k) => reportedKeys.add(k)}
          onDismiss={() => setReportOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SHEET_HEIGHT,
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 26,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: 'rgba(240, 237, 230, 0.18)',
    marginTop: 8,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLocation: {
    flex: 1,
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    lineHeight: 16,
  },
  leaderLine: {
    // v8 Fix E — attribution 15 pt DM Sans 400, lh 1.3, rgba(text, 0.45),
    // 4 pt below the Church · Country header, 14 pt above the body
    // (the body's marginTop:16 minus this marginBottom:2 would be off
    // — but the body owns marginTop, so this marginBottom is only the
    // local spacing inside the sheet content stack; the body's
    // marginTop covers the 14 pt gap directly).
    marginTop: 4,
    fontFamily: Typography.body,
    fontSize: 15,
    lineHeight: 20, // 15 × 1.3 ≈ 19.5
    color: 'rgba(240, 237, 230, 0.45)',
  },
  body: {
    // Type values (fontFamily / fontSize / lineHeight / color) are
    // sourced from the PRAYER_DETAIL_STYLE constant (imported from
    // PrayerWallCard) — plain Cormorant Medium, kept readable. This
    // style block owns only the sheet-specific positioning.
    // v8 Fix E — 14 pt gap above body (between leader attribution
    // and prayer body) per dispatch.
    marginTop: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  categoryChip: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(107, 181, 232, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 181, 232, 0.30)',
  },
  categoryChipText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.0,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  urgentChip: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(224, 85, 85, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(224, 85, 85, 0.30)',
  },
  urgentChipText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.0,
    color: Colors.red,
    textTransform: 'uppercase',
  },
  heartDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  heartCount: {
    // v7 Item 08 — DM Sans 400 (was DM Mono).
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  timestamp: {
    // v7 Item 08 — DM Sans 400, sentence case, no tracking.
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
  ctaColumn: {
    marginTop: 22,
    gap: 10,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaPrimary: {
    // v6 fix F — Stand-in-the-gap primary CTA min height 48 → 52,
    // label 14 → 16 pt DM Sans 500.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ctaPrimarySolid: {
    backgroundColor: Colors.red,
  },
  ctaPrimaryGhost: {
    backgroundColor: Colors.transparent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.red,
  },
  ctaPrimaryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
  },
  ctaPrimaryTextSolid: {
    color: Colors.background,
  },
  ctaPrimaryTextGhost: {
    color: Colors.red,
  },
  ctaSecondary: {
    // v6 fix F — Connect-to-this-church secondary CTA min height
    // 44 → 48, label 13 → 16 pt DM Sans 500.
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
    backgroundColor: Colors.transparent,
  },
  ctaSecondaryDisabled: {
    borderColor: Colors.border,
    backgroundColor: 'rgba(240, 237, 230, 0.04)',
  },
  ctaSecondaryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.accent,
  },
  ctaSecondaryTextDisabled: {
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },
  // KAN-304 — quiet report affordance (muted, centered, last in the column).
  reportRow: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  reportRowText: {
    color: Colors.textMuted,
    fontFamily: Typography.body,
    fontSize: 13,
  },
});
