// LeaderSearch — KAN-69 §6.2 / HANDOFF §6.2.
//
// Push screen over the Leaders list. Autofocused search field, ~250ms
// debounce, results at 2+ chars. Matches **name + church only** — no
// location, no country, no region (HANDOFF §6.2). Underground churches
// are excluded from the corpus server-side (churches_public view drops
// type='underground' rows); their real name is never searchable.
// Underground leaders DO appear (their `users` row exists), but their
// church renders as "Underground Church".
//
// Tap flow:
//   - Inactive leader → toast (not implemented at this layer — bubbles
//     up via onPick + parent toast).
//   - Existing conversation (caller, picked) → open it.
//   - No existing → open a lazily-created thread (server INSERT happens
//     on first send via send-message, KAN-71).
//
// BA FOLLOW-UP: a SECURITY DEFINER search_leaders RPC would let the BE
// own the underground-name-elision invariant + give us pagination +
// leader-name matching (PostgREST doesn't ilike across a joined column
// efficiently). For MVP we query churches_public + users separately
// and join in-memory.

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

async function searchLeaders(query: string, excludeUserId: string | null): Promise<SearchedLeader[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // Two parallel queries — church-name match + leader-name match.
  // Underground churches are absent from churches_public by construction.
  const churchSearch = supabase
    .from('churches_public')
    .select('id, name, type')
    .ilike('name', `%${q}%`)
    .eq('is_active', true)
    .limit(20);
  const nameSearch = supabase
    .from('users')
    .select('id, full_name, role, anonymous, churches:church_id(id, name, type, is_active)')
    .ilike('full_name', `%${q}%`)
    .eq('is_active', true)
    .eq('verification_status', 'verified')
    .limit(20);
  const [churchesRes, namesRes] = await Promise.all([churchSearch, nameSearch]);

  // For each matched church, fetch verified leaders.
  const churchIds = (churchesRes.data ?? []).map((c: any) => c.id);
  let churchLeaders: any[] = [];
  if (churchIds.length > 0) {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, role, anonymous, churches:church_id(id, name, type, is_active)')
      .in('church_id', churchIds)
      .eq('is_active', true)
      .eq('verification_status', 'verified')
      .limit(40);
    churchLeaders = data ?? [];
  }

  // Merge + dedupe.
  const byId = new Map<string, any>();
  for (const u of [...(namesRes.data ?? []), ...churchLeaders]) {
    if (excludeUserId && u.id === excludeUserId) continue;
    byId.set(u.id, u);
  }

  // Compose SearchedLeader rows.
  const results: SearchedLeader[] = [];
  byId.forEach((u: any) => {
    const church = u.churches;
    // SAFETY: underground leaders surface here (their user row exists),
    // but their church renders ONLY as 'Underground Church' — the real
    // name is never used in row text and is absent from churches_public.
    const underground = church?.type === 'underground';
    const churchName = underground ? 'Underground Church' : (church?.name ?? '');
    const initial = (u.full_name ?? '').trim().charAt(0).toUpperCase() || '·';
    results.push({
      userId: u.id,
      fullName: u.full_name ?? '',
      role: u.role ?? null,
      anonymous: !!u.anonymous,
      underground,
      churchName,
      monogramInitial: initial,
    });
  });
  // Stable sort: name asc.
  results.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return results;
}

export default function LeaderSearch({ callerUserId, onBack, onPick }: Props) {
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
    searchLeaders(term, callerUserId)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, callerUserId]);

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
          <Text style={styles.hint}>
            Search the network by a leader's name{'\n'}or the name of their church.
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
