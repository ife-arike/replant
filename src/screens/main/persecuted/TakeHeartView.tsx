// ─────────────────────────────────────────────
// TakeHeartView — Persecuted refinement View 3
// (design_handoff_persecuted_NEW/README.md.)
//
// A word from your family (hero, empty state kept as reviewed — the
// eyebrow was sky at 70% and is now muted: sky is interactive only and
// with no words to cycle there is nothing to press) → Practical
// guidance (the four hand-drawn glyphs replaced by a quiet 01–04
// index; content verbatim, pushes GuidanceReader by existing slug) →
// The body with you (EAP block, sky fill stripped) → John 16:33 footer.
//
// Post-MVP (README): when leader-submitted words exist, restore the
// tap-to-cycle + 12s auto-advance with the dot pager in accent.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../constants/theme';
import ComingSoonModal from '../../../components/common/ComingSoonModal';
import { WallScriptureFooter } from '../../../components/prayer/WallPrimitives';

const JOHN_16_33 =
  'These things I have spoken unto you, that in me ye might have peace. In the world ye shall have tribulation: but be of good cheer; I have overcome the world.';
const JOHN_16_33_REF = 'JOHN 16:33 · KJV';

// Content unchanged, verbatim (README table). Slugs are the existing
// GuidanceReader routes.
const GUIDANCE: readonly { index: string; slug: string; title: string; sub: string }[] = [
  { index: '01', slug: 'digital', title: 'Digital security, brief.', sub: 'Six habits that protect you and the body. Read once, return when needed.' },
  { index: '02', slug: 'raid', title: 'If your fellowship is raided.', sub: 'Steps to protect the gathered, the records, and those who came new.' },
  { index: '03', slug: 'arrest', title: 'If you are arrested.', sub: 'What to say, what not to say, and how the body will continue without you.' },
  { index: '04', slug: 'prohibition', title: 'Continuing under prohibition.', sub: 'How the early church gathered when forbidden, and what they wrote to each other.' },
];

interface Props {
  onOpenGuidance: (slug: string) => void;
  onStartEap: () => void;
}

export default function TakeHeartView({ onOpenGuidance, onStartEap }: Props) {
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      {/* ── A word from your family — hero, empty state as reviewed ── */}
      <View style={s.hero}>
        <Text style={s.heroEyebrow}>A WORD FROM YOUR FAMILY</Text>
        <Text style={s.heroBody}>
          Words from the body will appear here as leaders share encouragement with those
          enduring persecution.
        </Text>
        <Pressable
          onPress={() => setComingSoonOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Find out how"
        >
          <Text style={s.heroLink}>FIND OUT HOW ›</Text>
        </Pressable>
      </View>

      {/* ── Practical guidance ── */}
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>Practical guidance</Text>
        <View style={s.sectionRule} />
      </View>
      <View style={s.guidanceList}>
        {GUIDANCE.map((g) => (
          <Pressable
            key={g.slug}
            onPress={() => onOpenGuidance(g.slug)}
            accessibilityRole="button"
            accessibilityLabel={g.title}
            style={({ pressed }) => [s.guidanceRow, pressed && { opacity: 0.8 }]}
          >
            <View style={s.guidanceIndex}>
              <Text style={s.guidanceIndexLabel}>{g.index}</Text>
            </View>
            <View style={s.guidanceText}>
              <Text style={s.guidanceTitle}>{g.title}</Text>
              <Text style={s.guidanceSub}>{g.sub}</Text>
            </View>
            <Text style={s.guidanceChevron}>›</Text>
          </Pressable>
        ))}
      </View>

      {/* ── The body with you — EAP ── */}
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>The body with you</Text>
        <View style={s.sectionRule} />
      </View>
      <View style={s.eapBlock}>
        <Text style={s.eapCopy}>
          Do you have an Emergency Action Plan with the churches around you?
        </Text>
        <Pressable
          onPress={onStartEap}
          accessibilityRole="button"
          accessibilityLabel="Start an EAP branch"
          style={s.eapBtn}
        >
          <Text style={s.eapBtnLabel}>START AN EAP BRANCH</Text>
        </Pressable>
      </View>

      <WallScriptureFooter eyebrow="TAKE HEART" text={JOHN_16_33} reference={JOHN_16_33_REF} />

      {/* Existing copy, verbatim (README: current copy kept). */}
      <ComingSoonModal
        visible={comingSoonOpen}
        onDismiss={() => setComingSoonOpen(false)}
        title="Share a word with the body."
        body="Soon, leaders will be able to send words of encouragement and comfort to those enduring persecution — and the body will see them here."
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 8 },

  hero: {
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 8,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  heroEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.1,
    color: 'rgba(240,237,230,0.45)',
    textTransform: 'uppercase',
  },
  heroBody: {
    fontFamily: Typography.sansLight,
    fontSize: 13,
    lineHeight: 21,
    color: 'rgba(240,237,230,0.50)',
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 16,
  },
  heroLink: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
    marginTop: 16,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 34,
    paddingHorizontal: 22,
  },
  sectionTitle: { fontFamily: Typography.displayRegular, fontSize: 19, color: Colors.text },
  sectionRule: { flex: 1, height: 1, backgroundColor: Colors.border },

  guidanceList: { paddingHorizontal: 22, marginTop: 16, gap: 10 },
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
  },
  // The quiet index — replaces the four hand-drawn glyphs (README:
  // keep the circle geometry; a library, not an icon set).
  guidanceIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(107,181,232,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceIndexLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: 'rgba(107,181,232,0.80)',
  },
  guidanceText: { flex: 1 },
  guidanceTitle: { fontFamily: Typography.displayRegular, fontSize: 17, lineHeight: 22, color: Colors.text },
  guidanceSub: {
    fontFamily: Typography.displayRegular,
    fontSize: 14.5,
    lineHeight: 21.75,
    color: Colors.textMuted,
    marginTop: 4,
  },
  guidanceChevron: { fontFamily: Typography.body, fontSize: 13, color: 'rgba(240,237,230,0.40)' },

  eapBlock: {
    marginHorizontal: 22,
    marginTop: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 18,
  },
  eapCopy: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    lineHeight: 27,
    color: '#E6E1D5',
  },
  eapBtn: {
    marginTop: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.30)',
    borderRadius: 7,
    paddingVertical: 12,
    alignItems: 'center',
  },
  eapBtnLabel: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
});
