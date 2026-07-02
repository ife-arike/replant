// ─────────────────────────────────────────────
// ParentChurchPicker — NEW
// Identifies the parent church for a Church branch registration.
// Lookup by RPL ID OR by name; both surfaced together (Founder ruling).
// Selection writes the parent into OnboardingContext.branchOfChurchId
// (via onChange). Rendered inside the branch RegCP1, below the branch-name
// field, in place of the type/location fields.
//
// Data sources (BE):
//   RPL ID → find_church_by_rpl_id(p_rpl_id)        → one row or zero
//   name   → find_parentable_churches(p_query)       → 0..n rows
// Both EXCLUDE branch / para_ministry / underground types — a branch can
// never parent another branch (no nesting), and para/underground can't parent.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { getChurchTypeLabel } from '../../utils/displayHelpers';

// 2026-06-19 device pass v3 — match ASP2's SearchIcon glyph exactly so the
// picker's empty state feels continuous with the rest of the signup flow.
function SearchIcon({ color, size = 36 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm9.7 4.3-4.1-4.1 1.4-1.4 4.1 4.1-1.4 1.4Z"
        fill={color}
      />
    </Svg>
  );
}

export type ParentChurch = {
  id: string;
  name: string;
  city: string;
  country: string;
  type: string;                 // resolved BE-side; excludes branch/para/underground
  isHeadquarters: boolean;      // renders an HQ badge
  verificationStatus: 'verified' | 'pending';
  rplId: string;
};

// A leader whose parent isn't on Replant yet selects this sentinel. The branch
// still registers and runs the full branch flow; linking resolves later.
// NOTE: depends on the deferred-parent BE decision (see README Open Questions).
// 2026-06-19 — Founder's parent-delegation-is-top-down ruling: the deferred
// path now carries OPTIONAL claim fields. Leader can type what they know
// (or skip entirely). create_account_atomic writes the claim row only when
// claimName is non-empty; auto-link matches on name+city+country.
export type DeferredSelection = {
  deferred: true;
  claimName?: string;
  claimCity?: string;
  claimCountry?: string;
};
export type ParentSelection = ParentChurch | DeferredSelection | null;

type Mode = 'rpl' | 'name';
type Layout = 'segmented' | 'stacked';

type Props = {
  value: ParentSelection;
  onChange: (p: ParentSelection) => void;
  layout?: Layout;                              // CD-tweakable; default 'segmented'
  lookupByRplId: (rplId: string) => Promise<ParentChurch | null>;
  searchByName: (q: string) => Promise<ParentChurch[]>;
};

export default function ParentChurchPicker({
  value,
  onChange,
  layout = 'segmented',
  lookupByRplId,
  searchByName,
}: Props) {
  const [mode, setMode] = useState<Mode>('rpl');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ParentChurch[]>([]);
  const [rplMiss, setRplMiss] = useState(false);
  const [searching, setSearching] = useState(false);

  // Debounce + dispatch the right lookup. RPL ids are normalized to A–Z0–9.
  const runQuery = async (q: string) => {
    setQuery(q);
    setRplMiss(false);
    if (mode === 'rpl') {
      const norm = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (norm.length < 4) { setResults([]); return; }
      setSearching(true);
      const hit = await lookupByRplId(norm);
      setSearching(false);
      if (hit) setResults([hit]);
      else { setResults([]); setRplMiss(true); }
    } else {
      if (q.trim().length < 2) { setResults([]); return; }
      setSearching(true);
      const rows = await searchByName(q.trim());
      setSearching(false);
      setResults(rows);
    }
  };

  // ── selected (incl. deferred) collapses the search UI ──
  if (value && 'deferred' in value) {
    return (
      <DeferredCard value={value} onChange={onChange} />
    );
  }
  if (value) {
    return <SelectedCard parent={value} onClear={() => onChange(null)} />;
  }

  // 2026-06-19 device pass v3 — match ASP2's search-row pattern (input + blue
  // search button to the right). Same visual feel as the leader's prior search
  // step. Search still auto-fires on text-change (preserved from CD's pattern).
  const input = (
    <View style={styles.searchRow}>
      <TextInput
        style={styles.searchInput}
        value={query}
        onChangeText={runQuery}
        placeholder={mode === 'rpl' ? 'e.g., RPL-00001' : 'e.g., Maranatha Ministries'}
        placeholderTextColor={Colors.textSubtle}
        autoCapitalize={mode === 'rpl' ? 'characters' : 'words'}
        autoCorrect={false}
        returnKeyType="search"
      />
      <TouchableOpacity
        style={styles.searchButton}
        onPress={() => runQuery(query)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Search"
      >
        {searching ? (
          <ActivityIndicator color={Colors.background} size="small" />
        ) : (
          <SearchIcon color={Colors.background} size={20} />
        )}
      </TouchableOpacity>
    </View>
  );

  // 2026-06-19 — idle empty state matches ASP2's emptyStateCard pattern.
  // Centered icon + heading + helper inside a Colors.surface bordered card.
  const showIdleEmpty = !searching && query.trim().length === 0 && results.length === 0 && !rplMiss;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Find the parent church</Text>
        <Text style={styles.sub}>
          Identify the church this branch belongs to. Branches carry their own
          verification — the parent can be verified or pending.
        </Text>
      </View>

      {/* Mode selector — segmented (default) or stacked radios (CD-tweakable) */}
      {layout === 'segmented' ? (
        <View style={styles.seg}>
          {(['rpl', 'name'] as Mode[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.segBtn, mode === m && styles.segBtnOn]}
              onPress={() => { setMode(m); setQuery(''); setResults([]); setRplMiss(false); }}
            >
              <Text style={[styles.segText, mode === m && styles.segTextOn]}>
                {m === 'rpl' ? 'By RPL ID' : 'By name'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {input}

      {/* results */}
      {!searching && results.length > 0 && (
        <View style={styles.results}>
          {results.map(p => (
            <TouchableOpacity key={p.id} style={styles.result} onPress={() => onChange(p)} activeOpacity={0.7}>
              <View style={styles.resultNameRow}>
                <Text style={styles.resultName}>{p.name}</Text>
                {p.isHeadquarters && <Badge tone="hq">HQ</Badge>}
                <Badge tone={p.verificationStatus}>{p.verificationStatus === 'verified' ? 'Verified' : 'Pending'}</Badge>
              </View>
              {/* 2026-06-19 device pass v3: use getChurchTypeLabel for properly
                  capitalized type display ("Main Campus" not "main_campus"). */}
              <Text style={styles.resultMeta}>
                {getChurchTypeLabel(p.type)} · {p.city}, {p.country} · {p.rplId}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 2026-06-19 — idle empty state matches ASP2's emptyStateCard: centered
          SearchIcon, centered heading, centered helper. */}
      {showIdleEmpty && (
        <View style={styles.emptyStateCard}>
          <SearchIcon color={Colors.textMuted} size={36} />
          <Text style={styles.emptyStateHeading}>
            {mode === 'rpl' ? 'Search by Replant ID' : 'Search by church name'}
          </Text>
          <Text style={styles.emptyStateHelper}>
            {mode === 'rpl'
              ? "Type the parent church's RPL ID"
              : "Start typing the parent church's name"}
          </Text>
        </View>
      )}

      {/* empty (name search, no match) */}
      {!searching && mode === 'name' && query.trim().length >= 2 && results.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No churches found</Text>
          <Text style={styles.emptySub}>Check the spelling, or look up the parent's RPL ID.</Text>
        </View>
      )}

      {/* rplMiss (RPL lookup, no match) */}
      {!searching && rplMiss && (
        <View style={styles.error}>
          <Text style={styles.errorText}>
            No church matches that RPL ID. Check it with the parent church, or search by name instead.
          </Text>
        </View>
      )}

      {/* deferred entry — parent not on Replant yet */}
      <TouchableOpacity style={styles.defer} onPress={() => onChange({ deferred: true })} activeOpacity={0.7}>
        <Text style={styles.deferText}>Parent church not on Replant yet?</Text>
        <Text style={styles.deferStrong}>Register your branch & link later ›</Text>
      </TouchableOpacity>
    </View>
  );
}

function SelectedCard({ parent, onClear }: { parent: ParentChurch; onClear: () => void }) {
  return (
    <View style={styles.selected}>
      <Text style={styles.selectedEyebrow}>✓ Selected parent</Text>
      <Text style={styles.selectedName}>{parent.name}</Text>
      {/* 2026-06-18 device pass v2: drop the duplicate "RPL ID " label —
          parent.rplId already includes the "RPL-" prefix. */}
      <Text style={styles.selectedMeta}>
        {getChurchTypeLabel(parent.type)}{parent.isHeadquarters ? '  ·  HQ' : ''} · {parent.city}, {parent.country} · {parent.rplId}
      </Text>
      <View style={styles.selectedRow}>
        <Text style={styles.selectedVrf}>
          Verification: {parent.verificationStatus === 'verified' ? 'Verified' : 'Pending'}
        </Text>
        <TouchableOpacity onPress={onClear}><Text style={styles.change}>Change</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function DeferredCard({
  value,
  onChange,
}: {
  value: DeferredSelection;
  onChange: (p: ParentSelection) => void;
}) {
  // 2026-06-19 — optional claim fields. All can be left blank; we only write
  // a pending_parent_claims row at submit if claimName is filled. Spread the
  // existing value so partially-typed fields persist across rerenders.
  const update = (patch: Partial<DeferredSelection>) =>
    onChange({ ...value, ...patch });
  return (
    <View style={[styles.selected, styles.deferredCard]}>
      <Text style={[styles.selectedEyebrow, { color: Colors.amber }]}>Parent to be linked</Text>
      <Text style={styles.selectedName}>Parent not on Replant yet</Text>
      <Text style={styles.selectedMeta}>
        Register your branch now — it stands on its own. If the parent joins
        Replant later, either side can link the relationship.
      </Text>

      <View style={styles.claimFields}>
        <Text style={styles.claimHeader}>Tell us what you know (optional)</Text>
        <TextInput
          style={styles.claimInput}
          value={value.claimName ?? ''}
          onChangeText={(t) => update({ claimName: t })}
          placeholder="Parent church name"
          placeholderTextColor={Colors.textSubtle}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.claimInput}
          value={value.claimCity ?? ''}
          onChangeText={(t) => update({ claimCity: t })}
          placeholder="Parent city (optional)"
          placeholderTextColor={Colors.textSubtle}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.claimInput}
          value={value.claimCountry ?? ''}
          onChangeText={(t) => update({ claimCountry: t })}
          placeholder="Parent country (optional)"
          placeholderTextColor={Colors.textSubtle}
          autoCapitalize="words"
        />
        <Text style={styles.claimHelper}>
          Helps us auto-link if they join. Leave blank if you're unsure.
        </Text>
      </View>

      <View style={styles.selectedRow}>
        <Text style={styles.selectedVrf}>Link pending</Text>
        <TouchableOpacity onPress={() => onChange(null)}><Text style={styles.change}>Change</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function Badge({ tone, children }: { tone: 'hq' | 'verified' | 'pending'; children: React.ReactNode }) {
  const color = tone === 'hq' ? Colors.accent : tone === 'verified' ? Colors.green : Colors.amber;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <Text style={[styles.badgeText, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  head: { gap: 6 },
  title: { fontFamily: Typography.displayMedium, fontSize: 21, color: Colors.text },
  sub: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.textMuted, lineHeight: 19 },

  seg: { flexDirection: 'row', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 7, alignItems: 'center' },
  segBtnOn: { backgroundColor: 'rgba(107,181,232,0.15)' },
  segText: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textMuted },
  segTextOn: { color: Colors.accent },

  // 2026-06-19 device pass v3 — search row + input + button match ASP2's exact
  // pattern (AccountSetupPage2Screen.tsx searchSection/searchRow/searchInput/
  // searchButton). Same fontFamily + fontSize + padding so the look feels
  // continuous with ASP2. No letter-spacing tweak (the old `inputRpl` style
  // caused the placeholder to render with weird spacing).
  searchRow: { flexDirection: 'row', gap: Spacing.sm },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
    minHeight: 44,
  },
  searchButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 56,
  },

  results: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden' },
  result: { padding: 13, borderBottomWidth: 0.5, borderBottomColor: Colors.border, gap: 3 },
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultName: { fontFamily: Typography.bodyMedium, fontSize: 14.5, color: Colors.text },
  resultMeta: { fontFamily: Typography.body, fontSize: 12, color: Colors.textMuted },

  // 2026-06-19 — idle empty state matches ASP2's emptyStateCard exactly.
  emptyStateCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyStateHeading: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  emptyStateHelper: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // "no-results" small block (kept for the post-search-no-match case)
  empty: { borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: Radius.lg, padding: 20, alignItems: 'center', gap: 4 },
  emptyTitle: { fontFamily: Typography.bodyMedium, fontSize: 13.5, color: Colors.text },
  emptySub: { fontFamily: Typography.body, fontSize: 12, color: Colors.textMuted },

  error: { backgroundColor: 'rgba(224,85,85,0.06)', borderWidth: 1, borderColor: 'rgba(224,85,85,0.2)', borderRadius: Radius.md, padding: 13 },
  errorText: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.textMuted, lineHeight: 18 },

  defer: { paddingTop: 6, alignItems: 'center', gap: 4 },
  deferText: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.textMuted },
  deferStrong: { fontFamily: Typography.bodyMedium, fontSize: 12.5, color: Colors.amber },

  selected: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: 'rgba(107,181,232,0.25)', borderRadius: Radius.lg, padding: 16, gap: 8 },
  deferredCard: { borderColor: 'rgba(212,168,85,0.4)' },
  claimFields: { marginTop: 8, gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  claimHeader: { fontFamily: Typography.body, fontSize: 12, color: Colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' },
  claimInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, fontFamily: Typography.body, fontSize: 14, color: Colors.text, minHeight: 44 },
  claimHelper: { fontFamily: Typography.body, fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },
  selectedEyebrow: { fontFamily: Typography.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.accent },
  selectedName: { fontFamily: Typography.displayMedium, fontSize: 20, color: Colors.text },
  selectedMeta: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.textMuted, lineHeight: 18 },
  selectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 0.5, borderTopColor: Colors.border },
  selectedVrf: { fontFamily: Typography.body, fontSize: 12, color: Colors.textMuted },
  change: { fontFamily: Typography.body, fontSize: 12, color: Colors.accent },

  badge: { borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: Typography.mono, fontSize: 8.5, letterSpacing: 1, textTransform: 'uppercase' },
});
