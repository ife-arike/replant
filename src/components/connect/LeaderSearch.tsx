// LeaderSearch — KAN-69 §6.2 / HANDOFF §6.2.
//
// Push screen over the Leaders list. Autofocused search field, ~250ms
// debounce, results at 2+ chars. Matches **name + church only** — no
// location, no country, no region (HANDOFF §6.2).
//
// SEC: the underground-name-masking invariant is enforced SERVER-SIDE
// by the search_leaders SECURITY DEFINER RPC (KAN-214 follow-up
// migration 20260529000003). The RPC:
//   - excludes underground real names from the predicate; only the
//     literal "Underground Church" label is searchable;
//   - returns church_name pre-masked for underground rows;
//   - excludes the caller from results;
//   - gates verified+active leaders + verified+active churches.
// The FE never sees an unmasked underground name.
//
// Tap flow:
//   - Inactive leader → toast (not implemented at this layer — bubbles
//     up via onPick + parent toast).
//   - Existing conversation (caller, picked) → open it.
//   - No existing → open a lazily-created thread (server INSERT happens
//     on first send via send-message, KAN-71).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getLeaderDisplayName } from '../../utils/getLeaderDisplayName';
import { getRoleLabel } from '../../utils/displayHelpers';

export interface SearchedLeader {
  userId: string;
  fullName: string;
  role: string | null;
  anonymous: boolean;
  underground: boolean;
  churchName: string; // 'Underground Church' for underground
  monogramInitial: string;
}

interface Props {
  // callerUserId retained for parent-side existing-thread lookup; this
  // component no longer uses it for filtering (the RPC excludes the
  // caller server-side via auth.uid()).
  callerUserId: string | null;
  onBack: () => void;
  onPick: (leader: SearchedLeader) => void;
}

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={Colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={Colors.accent} strokeWidth={1.6} />
      <Path d="M21 21l-4.3-4.3" stroke={Colors.accent} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
function ClearIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M3 3l8 8M11 3l-8 8" stroke={Colors.textMuted} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
function ChevronIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5l7 7-7 7" stroke={Colors.textSubtle} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function AnonGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8.5} r={3.5} stroke={Colors.textMuted} strokeWidth={1.4} />
      <Path d="M5.5 19a6.5 6.5 0 0 1 13 0" stroke={Colors.textMuted} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

async function searchLeaders(query: string): Promise<SearchedLeader[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // Server-side search via search_leaders SECURITY DEFINER RPC.
  // The RPC enforces underground-name masking, caller exclusion, and
  // verified+active gating — the FE never sees raw church/user rows
  // here and cannot accidentally surface an unmasked underground name.
  // Server already orders by full_name and caps at 30 results.
  const { data, error } = await supabase.rpc('search_leaders', { p_query: q });
  if (error || !data) return [];
  return (data as any[]).map((r) => {
    const fullName: string = r.full_name ?? '';
    const initial = fullName.trim().charAt(0).toUpperCase() || '·';
    return {
      userId: r.user_id,
      fullName,
      role: r.role ?? null,
      anonymous: !!r.anonymous,
      underground: !!r.underground,
      churchName: r.church_name ?? '',
      monogramInitial: initial,
    };
  });
}

export default function LeaderSearch({ onBack, onPick }: Props) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SearchedLeader[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  // Autofocus on mount with a small delay (matches the prototype).
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, []);

  // 250ms debounce per HANDOFF §6.2.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(id);
  }, [q]);

  // Run search on debounced value.
  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchLeaders(term)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  const active = debounced.trim().length >= 2;

  const renderRow = ({ item }: { item: SearchedLeader }) => {
    const [first = '', ...rest] = item.fullName.split(' ');
    const last = rest.join(' ');
    const display = getLeaderDisplayName({
      firstName: first,
      lastName: last,
      roleLabel: getRoleLabel(item.role),
      churchName: item.churchName,
      anonymous: item.anonymous,
    });
    return (
      <Pressable
        onPress={() => onPick(item)}
        style={({ pressed }) => [styles.resultRow, pressed && { backgroundColor: 'rgba(240,237,230,0.02)' }]}
      >
        <View style={[
          styles.monogram,
          (item.anonymous || item.underground) && styles.monogramAnon,
        ]}>
          {(item.anonymous || item.underground)
            ? <AnonGlyph />
            : <Text style={styles.monogramInitial}>{item.monogramInitial}</Text>}
        </View>
        <View style={styles.center}>
          <Text style={styles.name} numberOfLines={1}>{display}</Text>
          <Text style={styles.church} numberOfLines={1}>{item.churchName}</Text>
        </View>
        <ChevronIcon />
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.nav}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        <Text style={styles.navTitle}>New Message</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={styles.field}>
        <SearchIcon />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder="Find a leader"
          placeholderTextColor={Colors.textSubtle}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Clear search">
            <ClearIcon />
          </Pressable>
        )}
      </View>

      {!active && (
        <View style={styles.hintBox}>
          {/* B7 (device pass): hint copy updated to mention RPL Network
              ID. LABEL CHANGE ONLY — search_leaders RPC does not match
              against church_code yet; that's a separate DBA ticket. No
              client-side church_code filtering is added here. */}
          <Text style={styles.hint}>
            Search the network by a leader's name, church name, or RPL Network ID.
          </Text>
        </View>
      )}

      {active && loading && (
        <View style={styles.loaderBox}>
          <ActivityIndicator color={Colors.textSubtle} />
        </View>
      )}

      {active && !loading && results.length === 0 && (
        <View style={styles.hintBox}>
          <Text style={styles.hint}>No leaders found matching that search.</Text>
        </View>
      )}

      {active && !loading && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(l) => l.userId}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  nav: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  navTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    color: Colors.text,
  },
  field: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    height: 46,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  hintBox: { padding: 40, paddingHorizontal: 30, alignItems: 'center' },
  hint: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  loaderBox: { padding: 40, alignItems: 'center' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  monogram: {
    width: 40, height: 36,
    borderRadius: 11,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramAnon: { borderColor: 'rgba(240,237,230,0.10)' },
  monogramInitial: {
    fontFamily: Typography.displayMedium,
    fontSize: 16,
    color: Colors.text,
  },
  center: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14.5,
    color: Colors.text,
    letterSpacing: 0.07,
  },
  church: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
