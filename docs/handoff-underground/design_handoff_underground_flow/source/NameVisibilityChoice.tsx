// ─────────────────────────────────────────────
// NameVisibilityChoice — NEW (Ask 2 · Rulings #10 + #11)
// Shown after the underground RegCP1 form, before final submit.
// Functional language only — NO "brave" / "safe".
// Default = "Keep our name hidden".
//
// Asymmetric reversibility (LOCKED, ruling #11):
//   hidden → shown : leader self-serve within 7 days of registration, then locks.
//   shown  → hidden: NEVER self-reversible — admin-only via direct contact (#25).
// The commit-to-show modal communicates that gravity.
//
// Founder-final layout: STACKED RADIO (no card chrome).
// CD-ALT: bordered cards — preserved as a comment below.
//
// Neither option is visually nudged — identical weight/color; only a quiet
// "Default" pill marks the pre-selection. The choice belongs to the leader.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

export type NameVisibility = 'show' | 'hidden';

type Props = {
  value: NameVisibility;                 // controlled; default 'hidden'
  onChange: (v: NameVisibility) => void; // fires only after modal confirm for 'show'
  onSubmit: () => void;                  // proceeds to create-church submit
};

export default function NameVisibilityChoice({ value, onChange, onSubmit }: Props) {
  const [modal, setModal] = useState(false);

  // Selecting "show" stages it; the irreversible commit happens at submit via
  // the modal. Selecting "hidden" is always free (it's the safe default).
  const pick = (v: NameVisibility) => onChange(v);

  const submit = () => {
    if (value === 'show') { setModal(true); return; }
    onSubmit();
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>
        Other leaders across the network can pray for and connect with your church.
        You decide what they see.
      </Text>

      {/* Founder-final: stacked radio rows (no card chrome) */}
      <View style={styles.list}>
        <Option
          on={value === 'show'}
          title="Show our name"
          helper="Other leaders can see your church’s name when they pray for you or connect with you. They will not see where you are."
          onPress={() => pick('show')}
        />
        <Option
          on={value === 'hidden'}
          title="Keep our name hidden"
          isDefault
          helper="Other leaders see “Underground Church · {region}” instead of your name. Your region is shown so the body of Christ can still pray with you."
          onPress={() => pick('hidden')}
        />
      </View>

      <Text style={styles.foot}>This choice applies to your whole church. Take your time.</Text>

      <TouchableOpacity style={styles.cta} onPress={submit} activeOpacity={0.85}>
        <Text style={styles.ctaText}>Submit Church</Text>
      </TouchableOpacity>

      {/* Irreversible-commit modal — only for show. Pastoral, not panic. */}
      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Are you sure?</Text>
            <Text style={styles.modalBody}>
              Once your name is shown, <Text style={styles.b}>it cannot be hidden again</Text> —
              only your network changes. We will not be able to revert this from inside the app.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.ghost]} onPress={() => setModal(false)}>
                <Text style={styles.ghostText}>Go back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.danger]} onPress={() => { setModal(false); onSubmit(); }}>
                <Text style={styles.dangerText}>I’m sure, show our name</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Option({
  on, title, helper, onPress, isDefault,
}: {
  on: boolean; title: string; helper: string; onPress: () => void; isDefault?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.opt} onPress={onPress} activeOpacity={0.8}
      accessibilityRole="radio" accessibilityState={{ selected: on }}>
      <View style={styles.optHead}>
        <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
        <Text style={styles.optTitle}>{title}</Text>
        {isDefault && <Text style={styles.defaultPill}>DEFAULT</Text>}
      </View>
      <Text style={styles.optHelper}>{helper}</Text>
    </TouchableOpacity>
  );
}

// ── CD-ALT (not selected): bordered cards ────────────────────────────────────
// Same two <Option>s wrapped in Colors.surface cards (borderWidth 1, Radius.lg,
// padding 17) with the selected card tinted borderColor accent@25. Switch by
// adding the card chrome to styles.opt; no logic change.

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg },
  intro: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.textMuted, fontWeight: '300', lineHeight: 22 },
  list: { },
  opt: { paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, gap: 7 },
  optHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(240,237,230,0.18)', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: Colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  optTitle: { fontFamily: Typography.bodyMedium, fontSize: 15.5, color: Colors.text },
  defaultPill: {
    fontFamily: Typography.mono, fontSize: 8, letterSpacing: 1.2, color: Colors.textMuted,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: 7, paddingVertical: 2, marginLeft: 'auto', overflow: 'hidden',
  },
  optHelper: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.textMuted, fontWeight: '300', lineHeight: 19, paddingLeft: 31 },
  foot: { fontFamily: Typography.body, fontSize: 12, color: Colors.textSubtle, fontWeight: '300', lineHeight: 18, textAlign: 'center', paddingHorizontal: Spacing.md },
  cta: { backgroundColor: Colors.accent, borderRadius: Radius.lg, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: Typography.bodyMedium, fontSize: 16, color: Colors.background },

  modalScrim: { flex: 1, backgroundColor: Colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 26 },
  modal: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(240,237,230,0.14)', padding: 24, width: '100%' },
  modalTitle: { fontFamily: Typography.display, fontSize: 23, color: Colors.text, marginBottom: 12 },
  modalBody: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.textMuted, fontWeight: '300', lineHeight: 21, marginBottom: 22 },
  b: { fontFamily: Typography.bodyMedium, color: Colors.text },
  modalActions: { gap: 10 },
  modalBtn: { minHeight: 48, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  ghost: { borderWidth: 1, borderColor: Colors.border },
  ghostText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.textMuted },
  danger: { backgroundColor: 'rgba(224,85,85,0.12)' },
  dangerText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.red },
});
