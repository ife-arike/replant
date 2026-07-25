// ─────────────────────────────────────────────
// WallJournalView — Prayer Wall rebuild · View 4 (Intercession journal)
// Spec: docs/design_handoff_prayer_wall_NEW/README.md §View 4.
//
// A view of the Prayer Wall screen, not a route — reached from the
// header; the header stays mounted (tabs' indicator hides while open).
//
// Three sections:
//   1. Free-text entries (NEW — Founder 2026-07-24: "journal having the
//      free text space makes it feel like a journal"). Composer + Keep.
//      RPCs create_journal_entry / get_journal_entries ship in this
//      branch's migration; both calls are DEFENSIVE — if the migration
//      is not yet deployed the section degrades to its empty line and
//      Keep toasts a quiet failure instead of wedging.
//   2. Standing in the gap — auto-populated: tapping Intercede anywhere
//      on the wall files the request here (this is the whole point —
//      it keeps the tap from being insincere). Release un-intercedes
//      via the stand_in_the_gap toggle; the host syncs feed rows.
//   3. Churches you carry — populated from The Church tab. Hard limit
//      10. Release → remove_intercession_hold, toast verbatim.
//
// Entries are private — RLS on journal_entries is deny-all; access is
// SECURITY DEFINER RPCs scoped to auth.uid() (house pattern, see the
// migration header).
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { Chevron } from '../home/HomeIcons';
import { getLocationLine } from './PrayerWallLogic';
import { sentencePreview, windowStanding } from './wallNewLogic';
import { GapMark } from './WallPrimitives';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const OFF_WHITE = '#E6E1D5';
const CARRY_LIMIT = 10;

// Wire shapes — mirrored from IntercessionJournalView (KAN-23).
interface HoldRow {
  id: string;
  church_id: string;
  church_name: string;
  city: string | null;
  country: string | null;
  created_at: string;
}

interface StandingRow {
  prayer_request_id: string;
  prayer_text: string;
  church_name: string;
  city: string | null;
  country: string | null;
  prayed_at: string;
}

// Wire shape of get_journal_entries (new migration).
interface EntryRow {
  id: string;
  entry_text: string;
  created_at: string;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function entryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function sinceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

interface Props {
  onBack: () => void;
  pendingChurch?: string | null;
  // Release on a standing row un-intercedes; the host flips the matching
  // feed row's i_prayed / prayed_count so the wall stays consistent.
  onReleasedRequest: (requestId: string) => void;
  onToast: (msg: string) => void;
}

export default function WallJournalView({ onBack, pendingChurch, onReleasedRequest, onToast }: Props) {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [entriesAvailable, setEntriesAvailable] = useState(true); // false → RPC missing/erroring
  const [standing, setStanding] = useState<StandingRow[]>([]);
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [keeping, setKeeping] = useState(false);
  // Founder device pass 2026-07-24: both list sections collapse by
  // default (settings behaviour) — counts stay visible in the header.
  const [gapOpen, setGapOpen] = useState(false);
  const [carryOpen, setCarryOpen] = useState(false);

  // Arriving from The Church tab with a pending church must never land
  // on a collapsed section — the full-notice would be invisible.
  useEffect(() => {
    if (pendingChurch) setCarryOpen(true);
  }, [pendingChurch]);

  const load = useCallback(async () => {
    const [entriesRes, holdsRes, standingRes] = await Promise.all([
      supabase.rpc('get_journal_entries'),
      supabase.rpc('get_intercession_holds'),
      supabase.rpc('get_standing_in_gap_history'),
    ]);
    // Entries are defensive — a missing RPC (migration not deployed)
    // degrades the section rather than erroring the view.
    if (entriesRes.error) setEntriesAvailable(false);
    else {
      setEntriesAvailable(true);
      setEntries((entriesRes.data ?? []) as EntryRow[]);
    }
    if (!holdsRes.error) setHolds((holdsRes.data ?? []) as HoldRow[]);
    // 30-day window · 25 visible (Founder-approved 2026-07-25). A view
    // over the record, never the record — counts are untouched.
    if (!standingRes.error) setStanding(windowStanding((standingRes.data ?? []) as StandingRow[]));
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const animate = () =>
    LayoutAnimation.configureNext(
      LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );

  const keep = async () => {
    const text = draft.trim();
    if (text.length === 0 || keeping) return;
    setKeeping(true);
    const { data, error } = await supabase.rpc('create_journal_entry', { p_entry_text: text });
    setKeeping(false);
    if (error) {
      // Failure grammar (Founder device pass 2026-07-24): say the state,
      // not an apology — the draft stays in the composer, nothing lost.
      onToast('Not kept yet — your words are still here. Try again in a moment.');
      return;
    }
    animate();
    setEntries((prev) => [
      { id: (data as string) ?? `local-${Date.now()}`, entry_text: text, created_at: new Date().toISOString() },
      ...prev,
    ]);
    setDraft('');
    onToast('Kept. Only you can see this.');
  };

  const releaseStanding = async (row: StandingRow) => {
    // stand_in_the_gap is a toggle — calling it again removes the
    // intercession (and the prayed_by row behind the count).
    const { error } = await supabase.rpc('stand_in_the_gap', {
      p_prayer_request_id: row.prayer_request_id,
    });
    if (error) {
      onToast('Not released yet — try again in a moment.');
      return;
    }
    animate();
    setStanding((prev) => prev.filter((r) => r.prayer_request_id !== row.prayer_request_id));
    onReleasedRequest(row.prayer_request_id);
  };

  const releaseHold = async (hold: HoldRow) => {
    const { error } = await supabase.rpc('remove_intercession_hold', { p_hold_id: hold.id });
    if (error) {
      onToast('Not released yet — try again in a moment.');
      return;
    }
    animate();
    setHolds((prev) => prev.filter((h) => h.id !== hold.id));
    onToast('Released. You can carry another.');
  };

  if (!loaded) {
    return (
      <View style={s.stateWrap}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  const holdsFull = holds.length >= CARRY_LIMIT;

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to the wall">
        <Text style={s.back}>← BACK TO THE WALL</Text>
      </Pressable>

      <View style={s.headRow}>
        <Text style={s.heading}>Intercession journal</Text>
        <View style={s.headRule} />
      </View>
      <Text style={s.privateLine}>Private — only you can see this.</Text>

      {/* ── Composer ── */}
      <View style={s.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={500}
          editable={!keeping}
          placeholder="A name, a burden, a line of prayer…"
          placeholderTextColor="rgba(240,237,230,0.30)"
          style={s.composerInput}
          textAlignVertical="top"
        />
        <Pressable
          onPress={() => void keep()}
          disabled={draft.trim().length === 0 || keeping}
          accessibilityRole="button"
          accessibilityLabel="Keep this entry"
          style={[s.keepBtn, (draft.trim().length === 0 || keeping) && { opacity: 0.4 }]}
        >
          <View style={s.keepRing} />
          <Text style={s.keepLabel}>KEEP</Text>
        </Pressable>
      </View>

      {/* ── Entries ── */}
      {entries.length === 0 ? (
        <Text style={s.entriesEmpty}>
          Nothing kept yet. Write a name or a burden above — only you will see it.
        </Text>
      ) : (
        entries.map((e) => (
          <View key={e.id} style={s.entry}>
            <Text style={s.entryDate}>{entryDate(e.created_at)}</Text>
            <Text style={s.entryText}>{e.entry_text}</Text>
          </View>
        ))
      )}
      {!entriesAvailable ? (
        <Text style={s.entriesEmpty}>Entries are resting for a moment — check back soon.</Text>
      ) : null}

      {/* ── Standing in the gap (collapsible — settings behaviour) ── */}
      <Pressable
        onPress={() => { animate(); setGapOpen((v) => !v); }}
        accessibilityRole="button"
        accessibilityState={{ expanded: gapOpen }}
        accessibilityLabel={`Standing in the gap — ${standing.length} held`}
        style={s.sectionHead}
      >
        <Text style={s.sectionHeading}>Standing in the gap</Text>
        <View style={s.sectionRule} />
        <Text style={s.sectionCount}>{standing.length} held</Text>
        <View style={{ transform: [{ rotate: gapOpen ? '180deg' : '0deg' }] }}>
          <Chevron />
        </View>
      </Pressable>
      {!gapOpen ? null : standing.length === 0 ? (
        <Text style={s.sectionEmpty}>Requests you intercede for on the wall gather here.</Text>
      ) : (
        standing.map((row) => (
          <View key={row.prayer_request_id} style={s.standRow}>
            <GapMark active />
            <View style={s.standBody}>
              <Text style={s.standLocation} numberOfLines={1}>
                {getLocationLine(row.church_name, row.country).toUpperCase()}
              </Text>
              <Text style={s.standText} numberOfLines={2}>
                {sentencePreview(row.prayer_text).preview}
              </Text>
            </View>
            <Pressable
              onPress={() => void releaseStanding(row)}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              accessibilityRole="button"
              accessibilityLabel={`Release — stop interceding for this request`}
            >
              <Text style={s.release}>RELEASE</Text>
            </Pressable>
          </View>
        ))
      )}

      {/* ── Churches you carry (collapsible — settings behaviour) ── */}
      <Pressable
        onPress={() => { animate(); setCarryOpen((v) => !v); }}
        accessibilityRole="button"
        accessibilityState={{ expanded: carryOpen }}
        accessibilityLabel={`Churches you carry — ${holds.length} of ${CARRY_LIMIT}`}
        style={s.sectionHead}
      >
        <Text style={s.sectionHeading}>Churches you carry</Text>
        <View style={s.sectionRule} />
        <Text style={s.sectionCount}>
          {holds.length} of {CARRY_LIMIT}
        </Text>
        <View style={{ transform: [{ rotate: carryOpen ? '180deg' : '0deg' }] }}>
          <Chevron />
        </View>
      </Pressable>
      {!carryOpen ? null : (
      <>
      {/* Copy verbatim — Founder device pass 2026-07-24. */}
      <Text style={s.carrySub}>Added from the Church Tab. Add up to ten ministries at a time.</Text>
      {pendingChurch && holdsFull ? (
        <Text style={s.fullNotice}>
          You carry ten already. Release one to take up {pendingChurch}.
        </Text>
      ) : null}
      {holds.length === 0 ? (
        <Text style={s.sectionEmpty}>
          None yet. Pray for a church from The Church and it will be held here.
        </Text>
      ) : (
        holds.map((hold) => (
          <View key={hold.id} style={s.holdRow}>
            <View style={s.holdDot} />
            <View style={s.standBody}>
              <Text style={s.holdName} numberOfLines={1}>
                {hold.church_name}
              </Text>
              <Text style={s.holdMeta} numberOfLines={1}>
                {[[hold.city, hold.country].filter(Boolean).join(', '), `since ${sinceDate(hold.created_at)}`]
                  .filter(Boolean)
                  .join(' · ')
                  .toUpperCase()}
              </Text>
            </View>
            <Pressable
              onPress={() => void releaseHold(hold)}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              accessibilityRole="button"
              accessibilityLabel={`Release ${hold.church_name}`}
            >
              <Text style={s.release}>RELEASE</Text>
            </Pressable>
          </View>
        ))
      )}
      </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 44 },
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  back: { fontFamily: Typography.mono, fontSize: 9.5, letterSpacing: 1.6, color: Colors.accent },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 },
  heading: { fontFamily: Typography.displayRegular, fontSize: 22, color: Colors.text },
  headRule: { flex: 1, height: 1, backgroundColor: 'rgba(107,181,232,0.14)' },
  privateLine: {
    marginTop: 7,
    fontFamily: Typography.scriptureItalic,
    fontSize: 14.5,
    color: 'rgba(240,237,230,0.45)',
  },

  composer: { marginTop: 22 },
  composerInput: {
    minHeight: 84,
    fontFamily: Typography.displayRegular,
    fontSize: 20,
    lineHeight: 29,
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,237,230,0.14)',
    paddingBottom: 10,
  },
  keepBtn: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, alignSelf: 'flex-start' },
  keepRing: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: OFF_WHITE },
  keepLabel: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1.8, color: OFF_WHITE },

  entriesEmpty: {
    marginTop: 20,
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(240,237,230,0.40)',
  },
  entry: {
    marginTop: 20,
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(240,237,230,0.12)',
    paddingLeft: 14,
  },
  entryDate: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: 'rgba(240,237,230,0.35)',
  },
  entryText: {
    marginTop: 6,
    fontFamily: Typography.scriptureItalic,
    fontSize: 18,
    lineHeight: 28,
    color: OFF_WHITE,
  },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 36 },
  sectionHeading: { fontFamily: Typography.displayRegular, fontSize: 19, color: Colors.text },
  sectionRule: { flex: 1, height: 1, backgroundColor: 'rgba(107,181,232,0.14)' },
  sectionCount: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.40)',
  },
  sectionEmpty: {
    marginTop: 14,
    fontFamily: Typography.sansLight,
    fontSize: 13,
    lineHeight: 21.5,
    color: 'rgba(240,237,230,0.50)',
  },

  standRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 18 },
  standBody: { flex: 1 },
  standLocation: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.4,
    color: 'rgba(240,237,230,0.45)',
  },
  standText: {
    marginTop: 4,
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    lineHeight: 24.6,
    color: OFF_WHITE,
  },
  release: { fontFamily: Typography.mono, fontSize: 8, letterSpacing: 1.4, color: 'rgba(240,237,230,0.35)' },

  carrySub: {
    marginTop: 8,
    fontFamily: Typography.sansLight,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(240,237,230,0.42)',
  },
  fullNotice: {
    marginTop: 10,
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.amber,
  },
  holdRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 16 },
  holdDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent },
  holdName: { fontFamily: Typography.body, fontSize: 13, color: Colors.text },
  holdMeta: {
    marginTop: 3,
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.3,
    color: 'rgba(240,237,230,0.35)',
  },
});
