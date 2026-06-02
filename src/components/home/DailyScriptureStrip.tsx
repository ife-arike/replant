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
// Non-tappable at MVP per AC. Display format: italic-Cormorant verse
// followed by mono-uppercase "reference · translation" — matches the
// wireframe scripture-strip block (Replant Wireframes v4.html lines
// 1080-1082).
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
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

// ─── Component ─────────────────────────────────────────────────────────

export default function DailyScriptureStrip() {
  const now = new Date();
  const today = getLocalDateString(now);

  // Initial render: synchronous fallback (or cached row if we have one).
  // Strip is NEVER blank, even on cold start before the fetch completes.
  const [display, setDisplay] = useState<ScriptureDisplay>(() => {
    if (sessionCache?.date === today) {
      return sessionCache.row ?? pickFallbackForDate(now);
    }
    return pickFallbackForDate(now);
  });

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

  // KAN-201 home redesign 2026-06-01 — "open" variant (Founder pick):
  // unboxed, with a faint hanging quote mark. The old bordered box was
  // removed; the open style now creates the visual separation from the
  // top bar (which dropped its hairline). Render layer only — all fetch /
  // cache / fallback logic above is unchanged.
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`${display.content} ${display.reference} ${display.translation}`}
    >
      <Text style={styles.quote}>{'“'}</Text>
      <Text style={styles.verse}>{display.content}</Text>
      <Text style={styles.ref}>
        <Text style={styles.refBook}>{display.reference}</Text>
        {` · ${display.translation}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', paddingHorizontal: 4, paddingTop: 24, paddingBottom: 18 },
  // Faint hanging quote mark — Cormorant 500 Medium at 64, sky at 12%.
  quote: {
    position: 'absolute',
    top: -8,
    left: -4,
    fontFamily: Typography.displayMedium,
    fontSize: 64,
    lineHeight: 64,
    color: 'rgba(107,181,232,0.12)',
  },
  // Verse — Cormorant 300 Light Italic, 23 / 33.
  verse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 23,
    lineHeight: 33,
    letterSpacing: 0.2,
    color: Colors.text,
  },
  // Reference line — mono; book in sky, " · translation" muted.
  ref: {
    fontFamily: Typography.mono,
    fontSize: 13,
    letterSpacing: 0.5,
    color: Colors.textMuted,
    marginTop: 18,
  },
  refBook: { color: Colors.accent },
});
