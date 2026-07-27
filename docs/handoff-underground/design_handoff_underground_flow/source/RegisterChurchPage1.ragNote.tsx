// ─────────────────────────────────────────────
// RegisterChurchPage1 — RAG note refinement (Ask 5 · Ruling #33)
// FOCUSED DIFF for src/screens/onboarding/RegisterChurchPage1Screen.tsx
// (the underground RAG block, currently ~lines 855–905). Not a full-file
// replacement — shown as before/after so the change is unambiguous.
//
// The current note contradicts itself: a "Self-declaration. You can update this
// at any time from Settings." note ABOVE the options, then a "Status locked —
// underground churches are designated Not Operating Freely." note BELOW. Founder
// picked the lighter single line. CONTENT's first proposal ("We acknowledge the
// cost…") was too dramatic.
//
// Founder-final tone: SOFT BLUE informational. CD-ALT: neutral grey.
// RAG behavior is UNCHANGED — rag_status='red' forced server-side; Green/Amber
// muted + non-interactive. Only the surrounding copy changes.
// ─────────────────────────────────────────────

/* ── BEFORE (remove both notes) ──────────────────────────────────────────────
{isUnderground && (
  <View style={styles.fieldGroup}>
    <Text style={styles.label}>Current Status</Text>
    <Text style={styles.fieldNote}>
      Self-declaration. You can update this at any time from Settings.   // ← REMOVE (contradiction)
    </Text>
    <View style={styles.ragOptions}>
      { …RAG_OPTIONS map, unchanged… }
    </View>
    <Text style={styles.fieldNote}>
      Status locked — underground churches are designated Not Operating Freely.  // ← REMOVE
    </Text>
  </View>
)}
*/

/* ── AFTER (single soft-blue note below the row) ──────────────────────────── */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

// drop-in replacement for the underground RAG block's notes.
// The RAG_OPTIONS .map() stays exactly as-is between these.
export function UndergroundStatusNote() {
  return (
    <View style={ragNoteStyles.note}>
      {/* ⓘ in soft-blue; CD-ALT neutral: swap to an em-dash glyph + grey */}
      <Text style={ragNoteStyles.ico}>ⓘ</Text>
      <Text style={ragNoteStyles.text}>
        This is set for underground churches and can’t be changed in the app.
      </Text>
    </View>
  );
}

// Usage inside RegisterChurchPage1Screen:
//   <Text style={styles.label}>Current Status</Text>
//   <View style={styles.ragOptions}>{RAG_OPTIONS.map(/* unchanged */)}</View>
//   <UndergroundStatusNote />            // ← replaces BOTH old fieldNote lines

const ragNoteStyles = StyleSheet.create({
  // Founder-final: soft blue (sky@04 fill, sky@25 border).
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(107,181,232,0.04)',
    borderWidth: 1,
    borderColor: Colors.borderAccent,           // rgba(107,181,232,0.25)
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: Spacing.xs,
  },
  ico: { fontFamily: Typography.body, fontSize: 12, color: Colors.accent, marginTop: 1 },
  text: { flex: 1, fontFamily: Typography.body, fontSize: 12.5, color: Colors.textMuted, fontWeight: '300', lineHeight: 18 },

  // ── CD-ALT (not selected): neutral grey ──
  // note:  backgroundColor Colors.surface, borderColor Colors.border
  // ico:   color Colors.textMuted, glyph '—'
  // text:  unchanged
});

// Rationale: red is reserved for things the leader can ACT on (errors, dismissal
// gravity). The lock is simply a fact about how underground churches are
// recorded — it should read informational, not alarming.
