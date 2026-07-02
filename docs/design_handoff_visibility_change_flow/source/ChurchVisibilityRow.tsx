// ChurchVisibilityRow — entry affordance inside Settings → Church (Surface 01).
//
// CD SCAFFOLD (design_handoff_visibility_change_flow · KAN-274). Lift the
// structure + tokens; wire the real AuthProvider + VisibilityChangeStack nav.
//
// WHERE IT MOUNTS:
//   Rendered inside SettingsScreen's existing 'church' section body, BELOW the
//   RAG status row. It is NOT a new section and NOT a new top-level menu item
//   (Founder WHERE ruling, locked 2026-06-27).
//
// WHO SEES IT:
//   Underground churches only. The host already threads viewerChurchType into
//   SettingsScreen — gate the whole block on it. Regular churches render
//   nothing here (the flow's screens don't exist for them at all).
//
// STATE, NOT A SWITCH:
//   The pill reports show_church_name; the button is a REQUEST that pushes the
//   schedule screen. Nothing on this row mutates visibility. Once a request is
//   pending, the row swaps to the scheduled-call card (same footprint).
//
// Voice: clinical, peer-respecting. No "toggle"/"flip" user-side; the action is
// "Request to change to Visible / Hidden". Italic = scripture only — none here.
// No new tokens: every value resolves to constants/theme.ts.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';

type ShowChurchName = boolean;

interface VisibilityChangeRequest {
  status: 'pending' | 'revealed' | 'in_call' | 'validated' | 'expired' | 'failed';
  direction: 'hidden_to_visible' | 'visible_to_hidden';
  windowStart: string; // ISO
  windowEnd: string;   // ISO
  windowLabel: string; // server-formatted, leader-local, e.g. "Today · 14:00 – 16:00"
}

export default function ChurchVisibilityRow() {
  const navigation = useNavigation<any>();
  // AuthProvider gains visibilityChangeRequest per the KAN-274 implementation.
  const { showChurchName, visibilityChangeRequest } = useAuth() as unknown as {
    showChurchName: ShowChurchName;
    visibilityChangeRequest: VisibilityChangeRequest | null;
  };

  const isVisible = showChurchName === true;
  const target = isVisible ? 'Hidden' : 'Visible';

  // ── Scheduled-call face — a window is picked, admin hasn't completed ──
  const pending =
    visibilityChangeRequest &&
    (visibilityChangeRequest.status === 'pending' ||
      visibilityChangeRequest.status === 'revealed');

  if (pending && visibilityChangeRequest) {
    const dirLabel =
      visibilityChangeRequest.direction === 'hidden_to_visible'
        ? 'Hidden → Visible'
        : 'Visible → Hidden';
    return (
      <View style={styles.block}>
        <Text style={styles.label}>Visibility in the network</Text>
        <View style={styles.schedCard}>
          <Text style={styles.schedEyebrow}>Verification call scheduled</Text>
          <Text style={styles.schedWhen}>{visibilityChangeRequest.windowLabel}</Text>
          <Text style={styles.schedSub}>
            Changing {dirLabel} · we'll call within this window
          </Text>
          <View style={styles.schedActions}>
            <TouchableOpacity
              style={styles.schedBtn}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('VisibilityChange', { screen: 'Schedule', params: { reschedule: true } })
              }
            >
              <Text style={styles.schedBtnText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.schedBtn, styles.schedBtnDanger]}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('VisibilityChange', { screen: 'Cancel' })
              }
            >
              <Text style={[styles.schedBtnText, styles.schedBtnTextDanger]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Idle face — current state + request CTA pointing at the opposite ──
  return (
    <View style={styles.block}>
      <Text style={styles.label}>Visibility in the network</Text>
      <View style={styles.stateRow}>
        <Text style={styles.stateLabel}>You are currently</Text>
        <View style={[styles.pill, isVisible && styles.pillVisible]}>
          <View style={[styles.pillDot, isVisible && styles.pillDotVisible]} />
          <Text style={[styles.pillLbl, isVisible && styles.pillLblVisible]}>
            {isVisible ? 'Visible' : 'Hidden'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.request}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Request to change to ${target}`}
        onPress={() =>
          navigation.navigate('VisibilityChange', {
            screen: 'Schedule',
            params: { direction: isVisible ? 'visible_to_hidden' : 'hidden_to_visible' },
          })
        }
      >
        <Text style={styles.requestText}>Request to change to {target}</Text>
      </TouchableOpacity>
      <Text style={styles.caption}>
        Our team confirms every change on a short call before it goes through.
        You'll pick a window when you're somewhere safe to talk.
      </Text>
    </View>
  );
}

const HAIR = 'rgba(240, 237, 230, 0.18)';

const styles = StyleSheet.create({
  block: { paddingTop: 14, paddingBottom: 4, borderTopWidth: 0.5, borderTopColor: HAIR, marginTop: 4 },
  label: { fontFamily: Typography.mono, fontSize: 11, letterSpacing: 1.76, textTransform: 'uppercase', color: Colors.textMuted, marginBottom: 6 },

  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 14 },
  stateLabel: { fontFamily: Typography.sansLight, fontSize: 14, color: Colors.textMuted },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: HAIR, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  pillVisible: { borderColor: Colors.borderAccent },
  pillDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.textMuted },
  pillDotVisible: { backgroundColor: Colors.accent },
  pillLbl: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: Colors.textMuted },
  pillLblVisible: { color: Colors.accent },

  request: {
    minHeight: 48, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.borderAccent,
    backgroundColor: 'rgba(107, 181, 232, 0.10)', alignItems: 'center', justifyContent: 'center',
  },
  requestText: { fontFamily: Typography.bodyMedium, fontSize: 14.5, color: Colors.accent },
  caption: { fontFamily: Typography.sansLight, fontSize: 12, color: Colors.textMuted, lineHeight: 18.6, marginTop: 11 },

  schedCard: { borderWidth: 1, borderColor: Colors.borderAccent, backgroundColor: 'rgba(107, 181, 232, 0.04)', borderRadius: Radius.lg, padding: 15 },
  schedEyebrow: { fontFamily: Typography.mono, fontSize: 9, letterSpacing: 1.44, textTransform: 'uppercase', color: Colors.accent, marginBottom: 9 },
  schedWhen: { fontFamily: Typography.display, fontSize: 19, color: Colors.text, lineHeight: 23.75, marginBottom: 4 },
  schedSub: { fontFamily: Typography.sansLight, fontSize: 12, color: Colors.textMuted },
  schedActions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  schedBtn: { flex: 1, minHeight: 40, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  schedBtnDanger: { borderColor: 'rgba(224,85,85,0.22)', backgroundColor: 'rgba(224,85,85,0.06)' },
  schedBtnText: { fontFamily: Typography.bodyMedium, fontSize: 12.5, color: Colors.textMuted },
  schedBtnTextDanger: { color: '#e8918b' },
});
