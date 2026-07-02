// ─────────────────────────────────────────────
// VisibilityFlipModal — §21 (Ruling #19)  ·  NEW · UNDERGROUND-ONLY
//
// Modal-on-launch notice the admin's visibility-override action produces. Only
// underground churches have show_church_name — mount only when
// viewerChurchType === 'underground'. Chrome stays identical to every other
// modal: nothing stands out in a captured screen.
//
// CRITICAL: this notice does NOT NAME the channel of contact — that is
// admin-internal meta only. Copy is LOCKED. Locale-safe: no idioms, no
// time-of-day. "Visible / Hidden" map to show_church_name; the internal
// "Brave / Safe" jargon never surfaces to a leader.
//
// Direction:
//   'h2v'  Hidden → Visible (show_church_name flipped to true). Accent = sky.
//   'v2h'  Visible → Hidden (show_church_name flipped to false). Accent = muted.
// ─────────────────────────────────────────────

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

function ReplantMark({ color }: { color: string }) {
  return (
    <View style={[styles.glyph, { borderColor: color }]}>
      <Svg width={18} height={18} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.3}>
        <Path d="M8 14V6M8 6C8 4 6.5 2.5 4.5 2.5 4.5 5 6 6 8 6ZM8 6c0-2 1.5-3.5 3.5-3.5C11.5 5 10 6 8 6Z" />
      </Svg>
    </View>
  );
}

interface Props {
  visible: boolean;
  direction: 'h2v' | 'v2h';
  onDismiss: () => void;
}

export default function VisibilityFlipModal({ visible, direction, onDismiss }: Props) {
  const toVisible = direction === 'h2v';
  const accent = toVisible ? Colors.accent : Colors.textMuted;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal>
          <ReplantMark color={accent} />
          <Text style={[styles.eyebrow, { color: accent }]}>Your church</Text>
          <Text style={styles.title} accessibilityRole="header">
            Your visibility setting was updated
          </Text>

          <View
            style={[
              styles.pill,
              { borderColor: toVisible ? Colors.borderAccent : 'rgba(240,237,230,0.14)' },
            ]}
          >
            <View style={[styles.pillDot, { backgroundColor: accent }]} />
            <Text style={[styles.pillText, { color: accent }]}>
              {toVisible ? 'Now Visible' : 'Now Hidden'}
            </Text>
          </View>

          {/* LOCKED copy. Does NOT name the channel of contact. */}
          <Text style={styles.flipText}>
            {toVisible ? (
              <>
                Your church is now listed as <Text style={styles.flipStrong}>Visible</Text> in the
                Replant network. Your location remains hidden.
              </>
            ) : (
              <>
                Your church is now listed as <Text style={styles.flipStrong}>Hidden</Text>. Other
                leaders will see “Underground Church” and your region only.
              </>
            )}
          </Text>

          <TouchableOpacity
            style={styles.ghost}
            onPress={onDismiss}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Got it"
          >
            <Text style={styles.ghostText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,8,8,0.8)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  card: { width: '100%', backgroundColor: Colors.surfaceElevated, borderWidth: 0.5, borderColor: 'rgba(240,237,230,0.14)', borderRadius: Radius.xl, padding: 26 },

  glyph: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  eyebrow: { fontFamily: Typography.bodyMedium, fontSize: 11, letterSpacing: 1.98, textTransform: 'uppercase', marginBottom: 12 },
  title: { fontFamily: Typography.displayMedium, fontSize: 23, color: Colors.text, lineHeight: 28, marginBottom: 14 },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 16 },
  pillDot: { width: 7, height: 7, borderRadius: 3.5 },
  pillText: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },

  flipText: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted, lineHeight: 24, marginBottom: 18 },
  flipStrong: { color: Colors.text, fontFamily: Typography.bodyMedium },

  ghost: { minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(240,237,230,0.08)', alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: Typography.body, fontSize: 15, color: Colors.textMuted },
});
