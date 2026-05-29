// BranchCreate — KAN-69 §7.5 / HANDOFF §7.5.
//
// Push screen for "Start a branch". Name field (≤48 chars) + host chip
// (caller's ministry, locked) + searchable ministry pick list (cap 6
// invitees = 7 ministries total per HANDOFF). On send: invokes the
// SECURITY DEFINER create_branch(p_name, p_invited_user_ids[]) RPC
// (KAN-214 Migration 2 + follow-up amendment) which validates the
// ministry cap server-side (counts DISTINCT church_ids across invited
// users, not raw user count), writes branches + branch_members rows,
// and emits branch_created (plus branch_activated if the branch was
// created with no invitees).
//
// "Invited user IDs" semantic: the RPC takes USER ids, not ministry ids
// — selecting a ministry brings ALL of its verified active leaders into
// the invitee list. Each leader becomes their own branch_members row
// with consent_status='invited'.
//
// SEC: the ministry corpus is loaded via get_invite_candidates
// SECURITY DEFINER RPC (KAN-214 follow-up migration 20260529000003).
// The RPC enforces:
//   - underground-name masking (real names absent from predicate AND
//     return value; only "Underground Church" is searchable);
//   - caller's own church excluded;
//   - verified+active leaders only;
//   - city/country elided for underground rows;
//   - leader_count + leaders[] bundled so submit doesn't need a
//     second round-trip to expand a ministry into user_ids.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

interface Props {
  callerUserId: string | null;
  callerChurchId: string | null;
  callerChurchName: string;
  onBack: () => void;
  onCreated: (branchId: string) => void;
  onToast: (text: string) => void;
}

interface MinistryRow {
  ministryId: string;
  name: string;
  underground: boolean;
  leaderIds: string[];
  leaderCount: number;
  city: string | null;
  country: string | null;
}

const MAX_INVITEES = 6; // 7 ministries total = host + 6 invitees.

// ── inline icons ──────────────────────────────────────────────────────
function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={Colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function LockIcon() {
  return (
    <Svg width={12} height={13} viewBox="0 0 14 16" fill="none">
      <Rect x={2.5} y={6.5} width={9} height={7.5} rx={1.4} stroke={Colors.accent} strokeWidth={1.3} />
      <Path d="M4.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2" stroke={Colors.accent} strokeWidth={1.3} />
    </Svg>
  );
}
function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={Colors.textSubtle} strokeWidth={1.6} />
      <Path d="M21 21l-4.3-4.3" stroke={Colors.textSubtle} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
function CheckIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
      <Path d="M2.5 7.5l3 3 6-7" stroke="#07232f" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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

// Load selectable ministries via the get_invite_candidates SECURITY
// DEFINER RPC. The RPC excludes the caller's own church + the verified+
// active leader gate + the underground-name masking + the empty-
// ministry HAVING filter — the FE just maps the rows into pick shape.
// `query` is optional; the RPC supports server-side filtering on
// ministry name (with the underground label masking).
async function loadMinistries(query: string | null): Promise<MinistryRow[]> {
  const args: Record<string, unknown> = {};
  if (query && query.trim().length > 0) args.p_query = query.trim();
  const { data, error } = await supabase.rpc('get_invite_candidates', args);
  if (error || !data) return [];
  return (data as any[]).map((r) => {
    const leaders = Array.isArray(r.leaders) ? r.leaders : [];
    const leaderIds = leaders
      .map((l: any) => l?.user_id)
      .filter((id: unknown): id is string => typeof id === 'string');
    return {
      ministryId: r.ministry_id,
      name: r.ministry_name,
      underground: !!r.underground,
      leaderIds,
      leaderCount: typeof r.leader_count === 'number'
        ? r.leader_count
        : leaderIds.length,
      city: r.city ?? null,
      country: r.country ?? null,
    };
  });
}

export default function BranchCreate({
  callerUserId,
  callerChurchId,
  callerChurchName,
  onBack,
  onCreated,
  onToast,
}: Props) {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set()); // ministry ids
  const [ministries, setMinistries] = useState<MinistryRow[]>([]);
  const [loadingMinistries, setLoadingMinistries] = useState(true);
  const [sending, setSending] = useState(false);

  // Initial corpus load — no query filter.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMinistries(true);
      try {
        const rows = await loadMinistries(null);
        if (!cancelled) setMinistries(rows);
      } finally {
        if (!cancelled) setLoadingMinistries(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Client-side filter on the loaded corpus. The RPC already capped at
  // 50 rows; client-side filter is the right shape for the picker UX
  // (no per-keystroke network call). If the corpus grows past 50 in
  // practice, switching to server-side filtering is a one-liner here
  // (call loadMinistries(query) on debounced query change).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ministries;
    return ministries.filter((m) => m.name.toLowerCase().includes(q));
  }, [ministries, query]);

  const togglePick = useCallback((ministryId: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(ministryId)) {
        next.delete(ministryId);
      } else if (next.size < MAX_INVITEES) {
        next.add(ministryId);
      }
      return next;
    });
  }, []);

  const totalMinistries = picked.size + 1; // + host
  const totalLeaders = useMemo(() => {
    let n = 0;
    ministries.forEach((m) => { if (picked.has(m.ministryId)) n += m.leaderCount; });
    return n;
  }, [ministries, picked]);

  const canSend = name.trim().length > 0 && picked.size >= 1 && !sending;

  const handleSend = useCallback(async () => {
    if (!canSend || !callerUserId) return;
    // Resolve invitee user IDs from selected ministries.
    const inviteeIds: string[] = [];
    ministries.forEach((m) => {
      if (picked.has(m.ministryId)) inviteeIds.push(...m.leaderIds);
    });
    // Server cap is "≤ 6 distinct MINISTRIES" (KAN-214 follow-up
    // migration 20260529000003 fixed the original USER-count cap).
    // The FE cap of 6 ministry selections + this cap match exactly,
    // so a legitimately-sized branch never trips branch_cap_exceeded.
    setSending(true);
    try {
      const { data, error } = await supabase.rpc('create_branch', {
        p_name: name.trim(),
        p_invited_user_ids: inviteeIds,
      });
      if (error) {
        if (error.message?.includes('branch_cap_exceeded')) {
          onToast('Too many leaders invited — try fewer ministries.');
        } else if (error.message?.includes('unverified_invitee')) {
          onToast('One of the leaders is no longer active in the network.');
        } else {
          onToast("Couldn't start the branch. Try again.");
        }
        return;
      }
      const branchId = data as unknown as string;
      onToast('Branch created — waiting for consent.');
      onCreated(branchId);
    } finally {
      setSending(false);
    }
  }, [canSend, callerUserId, ministries, picked, name, onToast, onCreated]);

  return (
    <View style={styles.root}>
      <View style={styles.nav}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        <Text style={styles.navTitle}>Start a branch</Text>
        <View style={{ width: 20 }} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.ministryId}
        ListHeaderComponent={
          <View style={styles.scroll}>
            <Text style={styles.eyebrow}>
              "I AM THE VINE, YE ARE THE BRANCHES" · JOHN 15:5
            </Text>
            <Text style={styles.fieldLabel}>Name this branch</Text>
            <TextInput
              style={styles.nameField}
              value={name}
              onChangeText={(t) => setName(t.slice(0, 48))}
              placeholder="e.g. East Africa Outreach"
              placeholderTextColor={Colors.textSubtle}
              maxLength={48}
              autoCapitalize="words"
            />
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Invite ministries</Text>
              <Text style={styles.capCount}>{picked.size} of {MAX_INVITEES} selected</Text>
            </View>
            {/* Host chip — locked */}
            <View style={styles.hostChip}>
              <View style={styles.hostMono}>
                <Text style={styles.hostMonoText}>
                  {callerChurchName.charAt(0).toUpperCase() || '·'}
                </Text>
              </View>
              <View style={styles.hostMeta}>
                <Text style={styles.hostName} numberOfLines={1}>{callerChurchName}</Text>
                <Text style={styles.hostSub}>Your ministry · host</Text>
              </View>
              <LockIcon />
            </View>
            <View style={styles.search}>
              <SearchIcon />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search ministries"
                placeholderTextColor={Colors.textSubtle}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            {loadingMinistries && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={Colors.textSubtle} />
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const on = picked.has(item.ministryId);
          const atCap = !on && picked.size >= MAX_INVITEES;
          return (
            <Pressable
              onPress={() => !atCap && togglePick(item.ministryId)}
              disabled={atCap}
              style={({ pressed }) => [
                styles.pickRow,
                on && styles.pickRowOn,
                atCap && styles.pickRowDisabled,
                pressed && !atCap && { backgroundColor: 'rgba(240,237,230,0.02)' },
              ]}
            >
              <View style={[styles.pickMono, item.underground && styles.pickMonoAnon]}>
                {item.underground
                  ? <AnonGlyph />
                  : <Text style={styles.pickMonoText}>{item.name.charAt(0).toUpperCase()}</Text>}
              </View>
              <View style={styles.pickCenter}>
                <Text style={styles.pickName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.pickChurch} numberOfLines={1}>
                  {item.underground
                    ? `${item.leaderCount} leader${item.leaderCount > 1 ? 's' : ''}`
                    : `${item.city ?? ''}${item.city && item.country ? ', ' : ''}${item.country ?? ''} · ${item.leaderCount} leader${item.leaderCount > 1 ? 's' : ''}`}
                </Text>
              </View>
              <View style={[styles.pickBox, on && styles.pickBoxOn]}>
                {on && <CheckIcon />}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loadingMinistries ? (
            <Text style={styles.searchHint}>No ministries found.</Text>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 140 }}
      />

      <View style={styles.foot}>
        <Text style={styles.footSummary}>
          {totalMinistries} ministries · {totalLeaders + (callerUserId ? 1 : 0)} leaders will be invited
        </Text>
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.btnPrimary,
            !canSend && styles.btnPrimaryDisabled,
            pressed && canSend && { opacity: 0.85 },
          ]}
        >
          {sending
            ? <ActivityIndicator color="#07232f" />
            : <Text style={styles.btnPrimaryText}>Send invitations</Text>}
        </Pressable>
      </View>
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
  },
  navTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    color: Colors.text,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62,
    color: Colors.textMuted,
    textAlign: 'left',
    marginVertical: 14,
  },
  fieldLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62,
    color: Colors.textSubtle,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  nameField: {
    fontFamily: Typography.displayMedium,
    fontSize: 19,
    color: Colors.text,
    height: 48,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  capCount: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.27,
    color: Colors.textMuted,
  },
  hostChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(107,181,232,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  hostMono: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: 'rgba(107,181,232,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  hostMonoText: {
    fontFamily: Typography.displayMedium,
    fontSize: 16,
    color: Colors.accent,
  },
  hostMeta: { flex: 1, minWidth: 0 },
  hostName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.text,
  },
  hostSub: {
    fontFamily: Typography.body,
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 42,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 11,
    marginTop: 4,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    padding: 0,
  },
  searchHint: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 40,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  pickRowOn: { backgroundColor: 'rgba(107,181,232,0.04)' },
  pickRowDisabled: { opacity: 0.35 },
  pickMono: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  pickMonoAnon: { borderColor: 'rgba(240,237,230,0.10)' },
  pickMonoText: {
    fontFamily: Typography.displayMedium,
    fontSize: 15,
    color: Colors.text,
  },
  pickCenter: { flex: 1, minWidth: 0 },
  pickName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.text,
  },
  pickChurch: {
    fontFamily: Typography.body,
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  pickBox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(240,237,230,0.30)',
    alignItems: 'center', justifyContent: 'center',
  },
  pickBoxOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  foot: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: 'rgba(8,8,8,0.95)',
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    gap: 10,
  },
  footSummary: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  btnPrimary: {
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryDisabled: {
    backgroundColor: Colors.surfaceElevated,
  },
  btnPrimaryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: '#07232f',
    letterSpacing: 0.3,
  },
});
