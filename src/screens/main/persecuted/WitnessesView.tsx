// ─────────────────────────────────────────────
// WitnessesView — Persecuted refinement View 2
// (design_handoff_persecuted_NEW/README.md; renamed from Bear Witness —
// μάρτυς means witness; the label carries martyrs and living confessors
// alike without saying "the dead.")
//
// Order is the point (README move #5): the tab opens on the LIVING —
// Standing this week — then Witness of the day, then Around the world.
// Not a memorial wall with statistics bolted on.
//
// Data posture (Founder ruling 2026-07-26 + the build's own precedent):
// nothing is fabricated. Standing renders its empty state until
// get_persecuted_standing() + admin situation-tagging exist (parked in
// NOTES); Witness of the day renders when a witness is provided (the
// current build ships PLACEHOLDER_WITNESS = null); stories render when
// field notes exist. Empty states are the approved copy, verbatim.
//
// The seal (7×7 unfilled red square) marks MARTYR entries only —
// confessors carry no seal, which is what makes the seal mean something.
// ─────────────────────────────────────────────

import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../constants/theme';
import { WallScriptureFooter } from '../../../components/prayer/WallPrimitives';
import type { WitnessData } from './components/WitnessOfDayCard';

const HEB_12_1 =
  'Wherefore seeing we also are compassed about with so great a cloud of witnesses, let us lay aside every weight, and let us run with patience the race that is set before us.';
const HEB_12_1_REF = 'HEBREWS 12:1 · KJV';

// No blog URL constant exists anywhere in the app — defined here
// pending Founder confirmation (site root per the website repo; the
// Astro blog lives under /blog).
const BLOG_URL = 'https://www.projectreplant.org/blog';

export interface StoryPreviewRow {
  id: string;
  meta: string; // e.g. "REPLANT FIELD NOTE · CENTRAL ASIA"
  title: string;
  excerpt: string;
}

// Extended witness shape — WitnessData plus the fields the reviewed
// card renders (README schema). Optional so today's null placeholder
// and tomorrow's seeded rotation both fit.
export interface WitnessDayData extends WitnessData {
  description?: string;
  scripture_text?: string;
  source_attribution?: string;
}

interface Props {
  witness: WitnessDayData | null;
  stories: StoryPreviewRow[];
}

export default function WitnessesView({ witness, stories }: Props) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      {/* ── Standing this week — the living, first ── */}
      <View style={s.standing}>
        <Text style={s.eyebrow}>STANDING THIS WEEK</Text>
        {/* Empty until get_persecuted_standing() exists — never fabricate. */}
        <Text style={s.standingEmpty}>
          Standing reports will be tallied here as leaders take their places across the body.
        </Text>
      </View>

      {/* ── Witness of the day ── */}
      <SectionHead title="Witness of the day" />
      {witness === null ? (
        <Text style={s.sectionEmpty}>
          The witnesses will be lifted up here, one a day. The first will be posted soon.
        </Text>
      ) : (
        <View style={s.witnessCard}>
          <View style={s.sealRow}>
            {witness.martyr ? <View style={s.seal} /> : null}
            <Text style={[s.sealWord, { color: witness.martyr ? Colors.red : 'rgba(240,237,230,0.42)' }]}>
              {witness.martyr ? 'MARTYR' : 'CONFESSOR'}
            </Text>
            <Text style={s.sealDot}>·</Text>
            <Text style={s.sealEra}>{witness.era.toUpperCase()}</Text>
          </View>
          <Text style={s.witnessRegion}>
            {[witness.region, witness.years_label].filter(Boolean).join(' · ').toUpperCase()}
          </Text>
          <Text style={s.witnessName}>{witness.name}</Text>
          <View style={s.quoteBlock}>
            <Text style={s.quote}>{witness.quote}</Text>
          </View>
          {witness.description ? <Text style={s.witnessBody}>{witness.description}</Text> : null}
          <View style={s.witnessScripture}>
            <Text style={s.witnessScriptureRef}>{witness.scripture_ref.toUpperCase()}</Text>
            {witness.scripture_text ? (
              <Text style={s.witnessScriptureText}>{witness.scripture_text}</Text>
            ) : null}
          </View>
          {witness.source_attribution ? (
            <Text style={s.witnessSource}>{witness.source_attribution}</Text>
          ) : null}
        </View>
      )}

      {/* ── Around the world ── */}
      <SectionHead
        title="Around the world"
        action="BLOG ›"
        onAction={() => Linking.openURL(BLOG_URL)}
      />
      {stories.length > 0 ? (
        <View style={s.storyList}>
          {stories.map((st) => (
            <Pressable
              key={st.id}
              onPress={() => Linking.openURL(BLOG_URL)}
              accessibilityRole="button"
              accessibilityLabel={st.title}
              style={s.storyRow}
            >
              <Text style={s.storyMeta}>{st.meta.toUpperCase()}</Text>
              <Text style={s.storyTitle}>{st.title}</Text>
              <Text style={s.storyExcerpt}>{st.excerpt}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable
        onPress={() => Linking.openURL(BLOG_URL)}
        accessibilityRole="button"
        accessibilityLabel="Read more on the blog"
        style={s.blogBtn}
      >
        <Text style={s.blogBtnLabel}>READ MORE ON THE BLOG</Text>
      </Pressable>

      <WallScriptureFooter eyebrow="A CLOUD OF WITNESSES" text={HEB_12_1} reference={HEB_12_1_REF} />
    </ScrollView>
  );
}

function SectionHead({
  title, action, onAction,
}: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionRule} />
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={s.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 8 },

  standing: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 4 },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.1,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  standingEmpty: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textMuted,
    marginTop: 14,
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
  sectionAction: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  sectionEmpty: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textMuted,
    paddingHorizontal: 22,
    paddingTop: 18,
  },

  witnessCard: { paddingHorizontal: 22, paddingTop: 20 },
  sealRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // The seal — 7×7 unfilled red square; martyrs only.
  seal: { width: 7, height: 7, borderWidth: 1, borderColor: Colors.red },
  sealWord: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sealDot: { color: 'rgba(240,237,230,0.30)', fontSize: 10 },
  sealEra: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  witnessRegion: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  witnessName: {
    fontFamily: Typography.displayRegular,
    fontSize: 27,
    lineHeight: 32.5,
    letterSpacing: 0.3,
    color: Colors.text,
    marginTop: 16,
  },
  quoteBlock: {
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(240,237,230,0.16)',
    paddingLeft: 14,
    marginTop: 20,
  },
  quote: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 19,
    lineHeight: 29,
    color: '#E6E1D5',
  },
  witnessBody: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    lineHeight: 28.5,
    color: Colors.text,
    marginTop: 22,
  },
  witnessScripture: {
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  witnessScriptureRef: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.7,
    color: 'rgba(240,237,230,0.38)',
    textTransform: 'uppercase',
  },
  witnessScriptureText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 26,
    color: '#E6E1D5',
    marginTop: 10,
  },
  witnessSource: {
    fontFamily: Typography.sansLight,
    fontSize: 10.5,
    lineHeight: 17,
    color: 'rgba(240,237,230,0.35)',
    marginTop: 20,
  },

  storyList: { paddingHorizontal: 22, marginTop: 18, gap: 20 },
  storyRow: {
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(240,237,230,0.14)',
    paddingVertical: 2,
    paddingLeft: 14,
  },
  storyMeta: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: 'rgba(240,237,230,0.40)',
    textTransform: 'uppercase',
  },
  storyTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    lineHeight: 24.7,
    color: Colors.text,
    marginTop: 7,
  },
  storyExcerpt: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(240,237,230,0.60)',
    marginTop: 6,
  },
  blogBtn: {
    marginHorizontal: 22,
    marginTop: 22,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.30)',
    borderRadius: 7,
    paddingVertical: 12,
    alignItems: 'center',
  },
  blogBtnLabel: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
});
