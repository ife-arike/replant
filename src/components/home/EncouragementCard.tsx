// ─────────────────────────────────────────────
// EncouragementCard — short-form leader encouragement
// (KAN-201 card system 2026-06-02)
//
// For card_type = 'encouragement'. A leader voice, not an admin
// announcement — a white-dot letterhead eyebrow over the warm card
// surface signals the type (Day-1 polish, Founder 2026-07-28: green
// retired from the Home eyebrow register; dot motion is urgent-only, so
// this dot holds still — FeedEyebrow owns the register, KAN-348). The lead deliberately does NOT use the FeedTitle
// register (Founder 2026-07-28: "not just title text") — it reads as a
// warmer mid-size serif note (Cormorant 500 Medium 18/28; the earlier
// states were scripture-italic, then title-roman per round-2 2026-07-22).
// Rests at a 3-line clamp with a "read on" ⇄ "fold" page-turn — the cue
// only surfaces when the lead overflows the clamp (app-wide
// overflow-gating ruling). A verse anchor and an author row sit below.
//
// Pastoral decision: encouragement cards are READ, not replied to — no
// comment thread renders. The commentCount / onCommentPosted props are
// accepted for routing-shape parity but intentionally unused.
//
// Author attribution: frozen upstream in NetworkFeed (source_label byline +
// seal; the feed never resolves authors client-side — SME interim 2026-07-22).
// Two independent axes (decoupled 2026-06-21):
//   • users.anonymous = true → name becomes "A fellow {role}", initial "A".
//   • underground church + safe (show_church_name=false) → church display
//     becomes '' (no name, no city, no country).
// Both can be true, neither, or either. An underground leader who chose
// to be known by name still arrives here with their real name + initial,
// just with the church display held. author_id NEVER reaches this
// component (SEC Obs D).
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Colors, Radius, Typography, type TagType } from '../../constants/theme';
import FeedEyebrow from './FeedEyebrow';
import { RpMark } from './HomeIcons';
import ScripturePull from './ScripturePull';
import PageTurnText from './PageTurnText';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Lead resting clamp — matches AnnouncementCard so Home's collapsed rhythm
// stays consistent. Cue + tap only surface when the lead overflows.
const COLLAPSED_LINES = 3;
// Must match s.lead lineHeight — feeds PageTurnText's pre-measure
// window estimate; the clamp itself is PageTurnText's height window,
// never a numberOfLines flip (tear class, 2026-07-28).
const LEAD_LINE_HEIGHT = 28;

type Props = {
  lead: string; // the full encouragement (short — 1-2 lines)
  verse?: string; // anchor reference e.g. "Matthew 11:28"
  // Lifted verse text (Day-1, 2026-07-28). When present, ScripturePull
  // renders the full pull-quote in place of the bare anchor line.
  verseText?: string;
  time: string;
  // seal → Replant seal in the avatar circle (frozen attribution; the feed
  // passes source_label as name). initial drives the lettered circle otherwise.
  author: { initial?: string; seal?: boolean; name: string; church: string };
  announcementId: string;
  // Accepted for routing-shape parity; encouragement cards do not open a
  // comment thread (pastoral decision — read, not replied to).
  commentCount?: number;
  onCommentPosted?: () => void;
  // KAN-348 — urgency rides the orthogonal tag_type; urgent takes the dot.
  tag?: TagType;
};

export default function EncouragementCard({ lead, verse, verseText, time, author, tag }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Overflow signal — reported by PageTurnText, which owns the entire
  // clamp/measure mechanism (see its header for the tear saga).
  const [overflows, setOverflows] = useState(false);

  const toggleExpand = () => {
    if (!overflows) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((v) => !v);
  };

  return (
    <View style={s.card}>
      {/* Leader-voice white register; urgent takes the dot over (KAN-348). */}
      <FeedEyebrow tag={tag} baseColor={Colors.text} label="Encouragement" time={time} />

      <Pressable
        onPress={toggleExpand}
        disabled={!overflows}
        accessibilityRole={overflows ? 'button' : undefined}
        accessibilityState={overflows ? { expanded } : undefined}
        accessibilityHint={overflows ? (expanded ? 'Tap to fold' : 'Tap to read on') : undefined}
      >
        <PageTurnText
          text={lead}
          style={s.lead}
          lineHeight={LEAD_LINE_HEIGHT}
          lines={COLLAPSED_LINES}
          expanded={expanded}
          onOverflowsChange={setOverflows}
        />
        {overflows && (
          <View style={s.readon}>
            <View style={s.readonRule} />
            <Text style={s.readonText}>{expanded ? 'fold' : 'read on'}</Text>
          </View>
        )}
      </Pressable>

      {verseText ? (
        <ScripturePull text={verseText} reference={verse} />
      ) : (
        !!verse && (
          <View style={s.meta}>
            <Text style={s.verse}>{verse}</Text>
          </View>
        )
      )}

      <View style={s.author}>
        <View style={s.av}>
          {author.seal
            ? <RpMark width={16} height={16} opacity={0.8} />
            : <Text style={s.avInitial}>{author.initial ?? '·'}</Text>}
        </View>
        {/* flexShrink + single-line ellipsis — long names/ministries must
            truncate with "…", never push the row past the card edge
            (Founder 2026-07-28 device walk). */}
        <View style={s.authorText}>
          <Text style={s.name} numberOfLines={1}>{author.name}</Text>
          {!!author.church && <Text style={s.church} numberOfLines={1}>{author.church}</Text>}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardWarm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 20,
    overflow: 'hidden',
  },


  // Encouragement voice (Day-1 rework, Founder 2026-07-28): NOT the title
  // register — a warmer mid-size serif with generous leading, so an
  // encouragement reads as a note passed to you rather than a headline.
  // History: scripture-italic → title-roman (round-2 2026-07-22) → this.
  lead: { fontFamily: Typography.displayMedium, fontSize: 18, lineHeight: 28, letterSpacing: 0.15, color: Colors.text },

  // Page-turn cue — exact style values from AnnouncementCard so the
  // read-on grammar reads identically app-wide.
  readon: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  readonRule: { width: 24, height: 1, backgroundColor: Colors.border },
  readonText: { fontFamily: Typography.mono, fontSize: 12, letterSpacing: 1.2, color: Colors.textSubtle },

  meta: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  verse: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 0.5, color: Colors.accent },

  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  av: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avInitial: { fontFamily: Typography.displayRegular, fontSize: 15, color: Colors.textMuted },
  authorText: { flexShrink: 1 },
  name: { fontFamily: Typography.bodyMedium, fontSize: 13.5, color: Colors.text },
  church: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },
});
