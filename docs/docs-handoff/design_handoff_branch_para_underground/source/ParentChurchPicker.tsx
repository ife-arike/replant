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
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

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
export type ParentSelection = ParentChurch | { deferred: true } | null;

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
      <DeferredCard onChange={onChange} />
    );
  }
  if (value) {
    return <SelectedCard parent={value} onClear={() => onChange(null)} />;
  }

  const input = (
    <TextInput
      style={[styles.input, mode === 'rpl' && styles.inputRpl]}
      value={query}
      onChangeText={runQuery}
      placeholder={mode === 'rpl' ? 'e.g. 5C7F2' : 'Search church name'}
      placeholderTextColor={Colors.textSubtle}
      autoCapitalize={mode === 'rpl' ? 'characters' : 'words'}
      autoCorrect={false}
    />
  );

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

      {searching && <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.md }} />}

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
              <Text style={styles.resultMeta}>
                {p.type} · {p.city}, {p.country} · RPL ID {p.rplId}
              </Text>
            </TouchableOpacity>
          ))}
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
      <Text style={styles.selectedMeta}>
        {parent.type}{parent.isHeadquarters ? '  ·  HQ' : ''} · {parent.city}, {parent.country} · RPL ID {parent.rplId}
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

function DeferredCard({ onChange }: { onChange: (p: ParentSelection) => void }) {
  return (
    <View style={[styles.selected, styles.deferredCard]}>
      <Text style={[styles.selectedEyebrow, { color: Colors.amber }]}>Parent to be linked</Text>
      <Text style={styles.selectedName}>Parent not on Replant yet</Text>
      <Text style={styles.selectedMeta}>
        Register your branch now — we'll link it to the parent automatically once
        they join and verify. You go through the full Church branch flow either way.
      </Text>
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

  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 15, paddingVertical: 13, fontFamily: Typography.body, fontSize: 15, color: Colors.text, minHeight: 48 },
  inputRpl: { fontFamily: Typography.mono, letterSpacing: 2 },

  results: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden' },
  result: { padding: 13, borderBottomWidth: 0.5, borderBottomColor: Colors.border, gap: 3 },
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultName: { fontFamily: Typography.bodyMedium, fontSize: 14.5, color: Colors.text },
  resultMeta: { fontFamily: Typography.body, fontSize: 12, color: Colors.textMuted },

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
  selectedEyebrow: { fontFamily: Typography.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.accent },
  selectedName: { fontFamily: Typography.displayMedium, fontSize: 20, color: Colors.text },
  selectedMeta: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.textMuted, lineHeight: 18 },
  selectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 0.5, borderTopColor: Colors.border },
  selectedVrf: { fontFamily: Typography.body, fontSize: 12, color: Colors.textMuted },
  change: { fontFamily: Typography.body, fontSize: 12, color: Colors.accent },

  badge: { borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: Typography.mono, fontSize: 8.5, letterSpacing: 1, textTransform: 'uppercase' },
});
