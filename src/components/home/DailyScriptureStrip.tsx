// ─────────────────────────────────────────────
// Daily Scripture Strip — KAN-16
//
// Renders at the top of Home (below KAN-35 verification banner when
// shown, directly below the top bar otherwise). Reads from
// public.daily_scripture keyed on the user's LOCAL-TIMEZONE calendar
// date — two leaders in different timezones may see different verses
// at the same UTC moment when one has crossed local midnight.
//
// Cache: one fetch per local-tz calendar date per app session, kept at
// module scope so it survives Home-tab re-mounts. Refetches automatically
// when the day rolls over (the useEffect dep is the date string).
//
// Fallback (Founder designation 2026-05-21, hardcoded FE constants):
//   - Even calendar day → II Samuel 22:31 KJV
//   - Odd calendar day  → Revelation 22:20 KJV
// Used when no DB row exists for today AND when the query fails — strip
// is never blank or broken. Initial render shows the fallback
// synchronously; if a DB row arrives, it replaces the fallback.
//
// Display: italic-Cormorant verse followed by mono "reference · translation",
// with a 2px sky-accent left rule (CD "rule" variant per home-tab-handoff
// ScriptureStrip — Founder pick 2026-06-11, replacing the prior hanging-
// quote "open" variant). Verse caps at COLLAPSED_LINES so the strip's
// resting height stays consistent regardless of passage length; tapping
// expands/collapses with a 220ms ease. The "read on" / "fold" cue and tap
// affordance only appear when the verse actually overflows the cap
// (measured via an offscreen mirror Text).
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../utils/useReducedMotion';
import PageTurnText from './PageTurnText';
import { supabase } from '../../lib/supabase';
import {
  getLocalDateString,
  pickFallbackForDate,
  type ScriptureDisplay,
} from './DailyScriptureStripLogic';

// ─── Module-scope session cache ────────────────────────────────────────
//
// AC #10 — "Strip persists across all Home tab renders within the same
// session — no re-fetch on every render — cache for the day." This is
// the cache. Survives component re-mounts within the same JS isolate.
// Lost on app restart, which is correct (a new app session re-fetches
// today's row once).
//
// `row: null` = we fetched and there was no row for today (admin hasn't
// seeded yet) — render fallback. `sessionCache === null` = not yet
// fetched in this session.

type CacheEntry = { date: string; row: ScriptureDisplay | null };
let sessionCache: CacheEntry | null = null;

/**
 * Test-only: clear the module cache between test scenarios. Production
 * code never calls this — the cache is intentionally process-lifetime.
 */
export function _resetCacheForTesting(): void {
  sessionCache = null;
}

// Founder ruling 2026-06-11: cap resting height to ~half of what a long
// passage would otherwise grow to. 3 lines @ 33 lineHeight ≈ 99px verse
// area — matches AnnouncementCard collapse and keeps daily vertical
// rhythm consistent. Cue + tap affordance only surface when the verse
// actually exceeds this cap.
const COLLAPSED_LINES = 3;
// Must match styles.verse lineHeight — collapsed crop is a container
// maxHeight (clampHeight), never a numberOfLines flip (tear class,
// 2026-07-28).
const VERSE_LINE_HEIGHT = 26;

// ─── Component ─────────────────────────────────────────────────────────

export default function DailyScriptureStrip() {
  const now = new Date();
  const today = getLocalDateString(now);

  // Mount entrance — 250ms fade + 4px rise (Prayer Wall FilterPanel
  // grammar; Day-1 motion pass, Founder 2026-07-28). The strip is the
  // first thing the eye lands on, so it arrives softly instead of
  // popping. Skipped under reduced motion.
  //
  // Mount at FULL opacity, drop to 0 + start pre-paint (useLayoutEffect):
  // an ancestor at opacity 0 during the mount commit suppresses
  // onTextLayout for descendants on Fabric, which would kill this strip's
  // own read-on mirror on long verses (same mechanism as the StaggerRow
  // regression, Day-1 2026-07-28).
  const reduced = useReducedMotion();
  const mountAnim = useRef(new Animated.Value(1)).current;
  React.useLayoutEffect(() => {
    if (reduced) return;
    mountAnim.setValue(0);
    Animated.timing(mountAnim, { toValue: 1, duration: 250, easing: Easing.ease, useNativeDriver: true }).start();
  }, [reduced, mountAnim]);

  // Initial render: synchronous fallback (or cached row if we have one).
  // Strip is NEVER blank, even on cold start before the fetch completes.
  const [display, setDisplay] = useState<ScriptureDisplay>(() => {
    if (sessionCache?.date === today) {
      return sessionCache.row ?? pickFallbackForDate(now);
    }
    return pickFallbackForDate(now);
  });

  // Overflow signal — reported by PageTurnText, which owns the entire
  // clamp/measure mechanism (see its header for the tear saga).
  const [overflows, setOverflows] = useState(false);

  // Tap-to-expand. New verse starts collapsed.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setExpanded(false); }, [display.reference]);
  const toggleExpanded = () => {
    if (!overflows) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((v) => !v);
  };

  useEffect(() => {
    // Cache hit — no fetch needed; ensure display matches the cache.
    if (sessionCache?.date === today) {
      setDisplay(sessionCache.row ?? pickFallbackForDate(new Date()));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('daily_scripture')
          .select('content, reference, translation')
          .eq('scripture_date', today)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          // RLS / network error — fallback stays; cache the negative so
          // re-mounts within the session don't re-hammer the endpoint.
          sessionCache = { date: today, row: null };
          return;
        }

        if (data) {
          const row: ScriptureDisplay = {
            content: String(data.content),
            reference: String(data.reference),
            translation: String(data.translation),
          };
          sessionCache = { date: today, row };
          setDisplay(row);
        } else {
          // No DB row for today — cache the null + keep fallback showing.
          sessionCache = { date: today, row: null };
        }
      } catch {
        if (cancelled) return;
        // Unhandled throw (e.g. supabase-js bug, JSON parse) — same
        // anti-broken posture: cache the null, fallback already showing.
        sessionCache = { date: today, row: null };
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [today]);

  return (
    <Animated.View
      style={{
        opacity: mountAnim,
        transform: [{ translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
      }}
    >
    <Pressable
      onPress={toggleExpanded}
      disabled={!overflows}
      style={styles.wrap}
      accessible
      accessibilityRole={overflows ? 'button' : undefined}
      accessibilityState={overflows ? { expanded } : undefined}
      accessibilityLabel={`${display.content} ${display.reference} ${display.translation}`}
      accessibilityHint={overflows ? (expanded ? 'Tap to fold' : 'Tap to read on') : undefined}
    >
      <View style={styles.rule} />
      <PageTurnText
        text={display.content}
        style={styles.verse}
        lineHeight={VERSE_LINE_HEIGHT}
        lines={COLLAPSED_LINES}
        expanded={expanded}
        onOverflowsChange={setOverflows}
      />
      {/* Sky-rule "more" signal — when the verse overflows the 3-line
          clamp, the left sky rule visually continues past the verse
          with a tiny sky pip sitting just below the reference line.
          The pip is the "tap to read more" cue; tapping anywhere on
          the strip expands the verse and hides the pip + extension.
          When the verse already fits in ≤3 lines, neither element
          renders — the strip stays quiet. */}
      {overflows && !expanded ? <View style={styles.ruleExt} /> : null}
      {overflows && !expanded ? <View style={styles.rulePip} /> : null}
      <Text style={styles.ref}>
        <Text style={styles.refBook}>{display.reference}</Text>
        {` · ${display.translation}`}
      </Text>
      <View style={styles.hairline} />
    </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // "rule" variant: 24px left padding to clear the rule + the original
  // 4px horizontal breathing room on the right. paddingTop trimmed from
  // 24 → 12 (2026-06-11) to tighten the gap between the TODAY label and
  // the verse — the quote-mark variant needed the extra top room; the
  // rule doesn't.
  // paddingBottom: 0 — the hairline child owns the closing rhythm now
  // (its marginTop creates the breathing room between ref and rule).
  wrap: { position: 'relative', paddingLeft: 24, paddingRight: 4, paddingTop: 12, paddingBottom: 0 },
  // 2px sky-accent vertical bar, spanning verse → just above the reference
  // line (matches CD home-tab-handoff ScriptureStrip "rule" variant).
  rule: {
    position: 'absolute',
    left: 4,
    top: 16,
    bottom: 34,
    width: 2,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },
  // Verse — 2026-06-11 experiment: matches NetworkFeed card title
  // (displayRegular 21/26 ls 0.1, non-italic). Overrides the prior
  // scriptureItalic 300 23/33 0.2 — keep this comment so the rollback is
  // a single edit if Founder reinstates the italic-for-scripture rule.
  verse: {
    fontFamily: Typography.displayRegular,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: 0.1,
    color: Colors.text,
  },
  // Reference line — mono; book in sky, " · translation" muted.
  ref: {
    fontFamily: Typography.mono,
    fontSize: 13,
    letterSpacing: 0.5,
    color: Colors.textMuted,
    marginTop: 10,
  },
  refBook: { color: Colors.accent },
  // Sky-rule extension — sits below the main rule, slightly faded, when
  // the verse overflows. Pairs with the pip to telegraph "more is
  // beneath the clamp; tap the strip to expand."
  ruleExt: {
    position: 'absolute',
    left: 4,
    bottom: 22,
    width: 2,
    height: 12,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    opacity: 0.5,
  },
  // Sky pip — small solid dot below the rule extension. The visible
  // tap-affordance signal; hidden once the strip is expanded.
  rulePip: {
    position: 'absolute',
    left: 3,
    bottom: 14,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },
  // Faint grey hairline closing the scripture block — sits a touch below
  // the reference line so the "fixed header" zone (top bar + TODAY +
  // verse) ends cleanly here, with scrolling content beginning under it.
  hairline: {
    marginTop: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(240,237,230,0.18)',
  },
});
