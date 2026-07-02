// VisibilityChangeScheduleScreen — explainer + window picker (Surface 02).
//
// CD SCAFFOLD (design_handoff_visibility_change_flow · KAN-274). First card of
// VisibilityChangeStack. The explainer is the point: tell the leader a person
// will call, and why, BEFORE they commit. The picker is deliberately coarse —
// a day rail + 2-hour windows (Founder Q1: granularity staged for ratification).
//
// The leader is choosing WHEN THEY WILL BE SAFE AND FREE, not a precise minute.
// Windows are server-supplied (admin availability ∩ leader-local daylight); the
// client never invents slots. Direction is carried from the entry CTA, never
// re-chosen here.
//
// Voice: clinical. Italic = scripture only — none here. No new tokens.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Typography, Radius } from '../../constants/theme';

interface WindowSlot {
  id: string;
  label: string;      // "14:00 – 16:00"
  startsISO: string;
  endsISO: string;
  past?: boolean;
}
interface DayOption {
  id: string;
  dow: string;        // "Wed"
  day: string;        // "12"
  windows: WindowSlot[];
}

export default function VisibilityChangeScheduleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const direction: 'hidden_to_visible' | 'visible_to_hidden' =
    route.params?.direction ?? 'hidden_to_visible';
  const target = direction === 'hidden_to_visible' ? 'Visible' : 'Hidden';
  const from = direction === 'hidden_to_visible' ? 'Hidden' : 'Visible';

  // Server-supplied — placeholder shape for the scaffold.
  const days: DayOption[] = route.params?.days ?? [];

  const [dayId, setDayId] = useState(days[0]?.id ?? null);
  const [winId, setWinId] = useState<string | null>(null);
  const day = days.find((d) => d.id === dayId);

  const submit = async () => {
    if (!day || !winId) return;
    const w = day.windows.find((x) => x.id === winId);
    if (!w) return;
    // POST request-visibility-change { direction, window_start, window_end }
    // → request enters `pending`. On 200, pop back to Settings.
    navigation.popToTop();
    navigation.navigate('Tabs', { screen: 'Settings' });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.hTitle}>Verification call</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Our team needs to confirm it's you</Text>
        <Text style={styles.body}>
          Before your church changes from <Text style={styles.bodyStrong}>{from}</Text> to{' '}
          <Text style={styles.bodyStrong}>{target}</Text>, someone on our team will call to confirm
          it's really you making the change — not someone who got hold of your phone. Choose a window
          when you'll be <Text style={styles.bodyStrong}>in a safe place to talk</Text>.
        </Text>

        <Text style={styles.winLabel}>Day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRail}>
          {days.map((d) => {
            const on = d.id === dayId;
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.dayChip, on && styles.dayChipOn]}
                onPress={() => { setDayId(d.id); setWinId(null); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.dcDow, on && styles.dcDowOn]}>{d.dow}</Text>
                <Text style={styles.dcDay}>{d.day}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.winLabel}>Window · 2-hour blocks</Text>
        <View style={styles.winList}>
          {(day?.windows ?? []).map((w) => {
            const on = w.id === winId;
            return (
              <TouchableOpacity
                key={w.id}
                style={styles.winRow}
                disabled={w.past}
                onPress={() => setWinId(w.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.winRadio, on && styles.winRadioOn]}>
                  {on && <View style={styles.winRadioDot} />}
                </View>
                <Text style={[styles.winTime, w.past && styles.winTimePast]}>{w.label}</Text>
                {w.past && <Text style={styles.winTag}>Passed</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.foot}>
        <TouchableOpacity
          style={[styles.cta, !winId && styles.ctaDisabled]}
          disabled={!winId}
          onPress={submit}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Request this window</Text>
        </TouchableOpacity>
        <Text style={styles.footCap}>You can reschedule or cancel any time before the call.</Text>
      </View>
    </View>
  );
}

const HAIR = 'rgba(240, 237, 230, 0.18)';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 6, paddingBottom: 14 },
  back: { color: Colors.accent, fontSize: 28, lineHeight: 28 },
  hTitle: { fontFamily: Typography.display, fontSize: 21, color: Colors.text },
  scroll: { paddingHorizontal: 26, paddingBottom: 14 },
  title: { fontFamily: Typography.display, fontSize: 26, color: Colors.text, lineHeight: 30, marginBottom: 16 },
  body: { fontFamily: Typography.sansLight, fontSize: 13.5, color: Colors.textMuted, lineHeight: 23.2, marginBottom: 12 },
  bodyStrong: { fontFamily: Typography.bodyMedium, color: Colors.text },
  winLabel: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: Colors.textMuted, marginTop: 18, marginBottom: 4 },
  dayRail: { gap: 9, paddingVertical: 6, marginBottom: 12 },
  dayChip: { width: 58, paddingVertical: 11, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', gap: 4 },
  dayChipOn: { borderColor: Colors.accent, backgroundColor: 'rgba(107,181,232,0.10)' },
  dcDow: { fontFamily: Typography.mono, fontSize: 9, letterSpacing: 1.08, textTransform: 'uppercase', color: Colors.textMuted },
  dcDowOn: { color: Colors.accent },
  dcDay: { fontFamily: Typography.display, fontSize: 20, color: Colors.text, lineHeight: 20 },
  winList: { flexDirection: 'column' },
  winRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: HAIR },
  winRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: HAIR, alignItems: 'center', justifyContent: 'center' },
  winRadioOn: { borderColor: Colors.accent },
  winRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  winTime: { fontFamily: Typography.body, fontSize: 15, color: Colors.text },
  winTimePast: { color: Colors.textSubtle },
  winTag: { marginLeft: 'auto', fontFamily: Typography.mono, fontSize: 9, letterSpacing: 0.9, textTransform: 'uppercase', color: Colors.textSubtle },
  foot: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 30, borderTopWidth: 0.5, borderTopColor: Colors.border, gap: 11 },
  cta: { minHeight: 54, borderRadius: Radius.lg, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { fontFamily: Typography.bodyMedium, fontSize: 15.5, color: Colors.background },
  footCap: { fontFamily: Typography.sansLight, fontSize: 11, color: Colors.textSubtle, textAlign: 'center' },
});
