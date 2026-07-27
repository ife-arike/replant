// ─────────────────────────────────────────────
// MyVoiceView — Persecuted refinement View 4 (header action, not a tab)
// (design_handoff_persecuted_NEW/README.md.)
//
// Named My Voice: every entry in the feed is a voice, so the leader's
// own are their voice. Intro (SET ASIDE FOR YOU — was red) → rows with
// the sender's tier + status track → Psalm 34:4 footer.
//
// The status track reads by BRIGHTNESS, not hue — Received .45 → Seen
// .72 → Responded full. The green Responded step, green CTA card,
// green envelope and chevron are all gone; "Open secure message ›" is
// a quiet sky text action.
//
// Copy note honoured (README): the intro promises a read and prayer,
// and direct contact only IF ASKED — never a response the process
// cannot guarantee.
// ─────────────────────────────────────────────

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Typography } from '../../../constants/theme';
import { formatRelativeTime } from '../../../components/prayer/PrayerWallLogic';
import { WallScriptureFooter } from '../../../components/prayer/WallPrimitives';
import { isFilledTier, tierTint, tierWord } from './persecutedNewLogic';

const PSALM_34_4 = 'I sought the Lord, and he heard me, and delivered me from all my fears.';
const PSALM_34_4_REF = 'PSALM 34:4 · KJV';

export interface MyVoiceRow {
  id: string;
  severity: string;
  created_at: string;
  feed_content: string | null;
  status: string; // received | seen | responded
  responded_at: string | null;
  thread_id: string | null;
}

export type MyVoiceLoadState = 'initial' | 'idle' | 'error';

interface Props {
  rows: MyVoiceRow[];
  loadState: MyVoiceLoadState;
  onOpenThread: (threadId: string) => void;
  onShare: () => void;
  onRetry: () => void;
}

// Status fallback when feed_content has not yet been set by review —
// the leader still sees a truthful line about where their words are.
const STATUS_EXCERPT_FALLBACK: Record<string, string> = {
  received: 'Your heartcry has been received and is set aside for the team.',
  seen: 'Your heartcry has been read and is being prayed through.',
  responded: 'The team has responded to your heartcry.',
};

const STEPS = ['received', 'seen', 'responded'] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], string> = {
  received: 'RECEIVED',
  seen: 'SEEN',
  responded: 'RESPONDED',
};
// Brightness ladder — progress toward being heard is a brightening.
const STEP_DONE_COLOR: Record<(typeof STEPS)[number], string> = {
  received: 'rgba(240,237,230,0.45)',
  seen: 'rgba(240,237,230,0.72)',
  responded: '#F0EDE6',
};

export default function MyVoiceView({ rows, loadState, onOpenThread, onShare, onRetry }: Props) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      {/* Intro — SET ASIDE FOR YOU (was red). */}
      <View style={s.intro}>
        <Text style={s.introEyebrow}>SET ASIDE FOR YOU</Text>
        <Text style={s.introBody}>
          Our team reads each one, prays through it, and reaches you directly if you ask us to.
        </Text>
      </View>

      {loadState === 'initial' ? (
        <View style={s.stateWrap}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : loadState === 'error' ? (
        <View style={s.stateWrap}>
          <Text style={s.errorCopy}>Couldn't load your voice right now.</Text>
          <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
            <Text style={s.retry}>TAP TO RETRY</Text>
          </Pressable>
        </View>
      ) : rows.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyHeading}>Nothing written yet.</Text>
          <Text style={s.emptyBody}>
            If a day comes when you need to be heard, this space will hold it. Until then, the
            body is praying around you.
          </Text>
          <Pressable
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel="Share my heartcry"
            style={s.emptyCta}
          >
            <Text style={s.emptyCtaLabel}>SHARE MY HEARTCRY</Text>
          </Pressable>
        </View>
      ) : (
        rows.map((row) => <VoiceRow key={row.id} row={row} onOpenThread={onOpenThread} />)
      )}

      <WallScriptureFooter eyebrow="THE LORD HEARS" text={PSALM_34_4} reference={PSALM_34_4_REF} />
    </ScrollView>
  );
}

function VoiceRow({ row, onOpenThread }: { row: MyVoiceRow; onOpenThread: (id: string) => void }) {
  const excerpt =
    row.feed_content ?? STATUS_EXCERPT_FALLBACK[row.status] ?? STATUS_EXCERPT_FALLBACK.received;
  const stepIndex = Math.max(0, STEPS.indexOf(row.status as (typeof STEPS)[number]));

  return (
    <View style={s.row}>
      <View style={s.eyebrow}>
        <View style={[s.tierDot, isFilledTier(row.severity) ? s.tierDotFilled : s.tierDotHollow]} />
        <Text style={[s.tierWordText, { color: tierTint(row.severity) }]} numberOfLines={1}>
          {tierWord(row.severity).toUpperCase()}
        </Text>
        <Text style={s.when} numberOfLines={1}>
          {formatRelativeTime(row.created_at)}
        </Text>
      </View>

      <Text style={s.excerpt}>{excerpt}</Text>

      {/* Status track — brightness, not hue. */}
      <View
        style={s.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ now: stepIndex + 1, min: 1, max: STEPS.length }}
        accessibilityLabel={`Status: ${STEP_LABEL[STEPS[stepIndex]]}`}
      >
        {STEPS.map((step, i) => {
          const done = i <= stepIndex;
          const color = done ? STEP_DONE_COLOR[step] : 'rgba(240,237,230,0.28)';
          return (
            <React.Fragment key={step}>
              {i > 0 ? (
                <View
                  style={[
                    s.trackRule,
                    { backgroundColor: i <= stepIndex ? STEP_DONE_COLOR[STEPS[i]] : 'rgba(240,237,230,0.10)' },
                  ]}
                />
              ) : null}
              <View style={s.step}>
                <View
                  style={[
                    s.stepDot,
                    done
                      ? { borderColor: STEP_DONE_COLOR[step], backgroundColor: STEP_DONE_COLOR[step] }
                      : { borderColor: 'rgba(240,237,230,0.14)', backgroundColor: 'transparent' },
                  ]}
                />
                <Text style={[s.stepLabel, { color }]}>{STEP_LABEL[step]}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {row.status === 'responded' && row.thread_id ? (
        <Pressable
          onPress={() => onOpenThread(row.thread_id as string)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open secure message"
        >
          <Text style={s.openThread}>OPEN SECURE MESSAGE ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 8 },

  intro: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 20 },
  introEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  introBody: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    lineHeight: 28,
    color: '#E6E1D5',
    marginTop: 12,
  },

  row: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderRowSubtle,
    paddingVertical: 19,
    paddingHorizontal: 22,
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tierDot: { width: 5, height: 5, borderRadius: 3, flexShrink: 0 },
  tierDotFilled: { backgroundColor: Colors.red },
  tierDotHollow: { borderWidth: 1, borderColor: Colors.redRing, backgroundColor: 'transparent' },
  tierWordText: {
    flex: 1,
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  when: { fontFamily: Typography.body, fontSize: 10.5, color: 'rgba(240,237,230,0.38)' },

  excerpt: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    lineHeight: 27,
    color: Colors.text,
    marginTop: 10,
  },

  track: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 0.5 },
  stepLabel: { fontFamily: Typography.mono, fontSize: 8.5, letterSpacing: 1.5 },
  trackRule: { height: 0.5, flex: 1, marginHorizontal: 6 },

  openThread: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
    marginTop: 16,
  },

  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  emptyHeading: { fontFamily: Typography.displayRegular, fontSize: 21, color: Colors.text },
  emptyBody: {
    fontFamily: Typography.sansLight,
    fontSize: 13,
    lineHeight: 21.5,
    color: 'rgba(240,237,230,0.50)',
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 12,
  },
  // The empty state is the invitation — one of the two deliberate
  // interactive reds (outlined, never filled).
  emptyCta: {
    marginTop: 22,
    borderWidth: 0.5,
    borderColor: 'rgba(224,85,85,0.30)',
    borderRadius: 6,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  emptyCtaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.red,
    textTransform: 'uppercase',
  },

  stateWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  errorCopy: { fontFamily: Typography.body, fontSize: 13, color: Colors.textMuted },
  retry: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
});
