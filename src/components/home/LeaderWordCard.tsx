// ─────────────────────────────────────────────
// LeaderWordCard — a verified leader's word to the network
// (KAN-201 home redesign)
//
// NOT a testimony — an encouragement / daily-bread reflection. Warm
// surface (intentional, distinct from admin cards). The verse anchor sits
// opposite the time; comments are right-aligned in the author row,
// matching the announcement cards, and open the thread in place.
//
// Attribution is FROZEN server-side at publish (KAN-338): NetworkFeed
// passes the source_label byline + source_sublabel church slot verbatim
// with the Replant seal. No client-side resolution exists anywhere on
// this path — no users/churches lookup, no author_id. Underground words
// publish under the Team seal with a role+region byline composed by the
// server (SEC F1).
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
import { Colors, FeedTitle, Radius, Typography } from '../../constants/theme';
import { Chevron, CommentIcon, RpMark } from './HomeIcons';
import { CommentThread } from './CommentThread';
import ScripturePull from './ScripturePull';
import PageTurnText from './PageTurnText';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Body resting clamp — matches AnnouncementCard so Home's collapsed rhythm
// stays consistent. Cue + tap only surface when the clamped text overflows.
const COLLAPSED_LINES = 3;
// Must match s.body / s.lead lineHeights — feed PageTurnText's pre-measure
// window estimates; the clamp itself is PageTurnText's height window,
// never a numberOfLines flip (tear class, 2026-07-28; this card was
// the Founder's repro).
const BODY_LINE_HEIGHT = 23;
const LEAD_LINE_HEIGHT = FeedTitle.lineHeight;

interface Props {
  announcementId: string;
  kicker?: string; // "A word for today" | "Encouragement"
  lead: string; // the reflective opening line (serif roman — Ruling 2)
  body?: string; // optional continuation
  verse?: string; // anchor reference, e.g. "Zechariah 4:10"
  // Lifted verse text (Day-1, 2026-07-28). When present, ScripturePull
  // renders the full pull-quote (text + verse reference) in place of the
  // bare anchor line.
  verseText?: string;
  // seal → Replant seal in the avatar circle (frozen attribution; the feed
  // passes source_label as name). initial drives the lettered circle otherwise.
  author: { initial?: string; seal?: boolean; name: string; church: string; time: string };
  commentCount?: number;
}

export default function LeaderWordCard({
  announcementId,
  kicker = 'A word for today',
  lead,
  body,
  verse,
  verseText,
  author,
  commentCount,
}: Props) {
  const [cOpen, setCOpen] = useState(false);
  // Local count so the footer reflects a just-posted comment immediately
  // (commentCount is a static feed-snapshot prop, never refreshed live).
  const [localCount, setLocalCount] = useState(commentCount ?? 0);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setCOpen((v) => !v);
  };

  // Page-turn: clamp the body when present; when only the lead exists,
  // clamp the lead. PageTurnText owns the measurement (see its header).
  const bodyText = body?.trim() ? body : undefined;
  const hasBody = bodyText !== undefined;

  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const toggleExpand = () => {
    if (!overflows) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((v) => !v);
  };

  return (
    <View style={s.card}>
      <View style={s.eyebrow}>
        <View style={s.dotWrap}>
          <View style={s.dotHalo} />
          <View style={s.dot} />
        </View>
        <Text style={s.eyebrowLabel}>{kicker}</Text>
        <View style={s.eyebrowRule} />
        <Text style={s.when}>{author.time}</Text>
      </View>

      <Pressable
        onPress={toggleExpand}
        disabled={!overflows}
        accessibilityRole={overflows ? 'button' : undefined}
        accessibilityState={overflows ? { expanded } : undefined}
        accessibilityHint={overflows ? (expanded ? 'Tap to fold' : 'Tap to read on') : undefined}
      >
        {/* This card was the Founder's tear repro — the clamp mechanics
            live in PageTurnText now. The lead clamps only when it IS the
            clamped text (no body); the body clamps when present. */}
        {hasBody ? (
          <>
            <Text style={s.lead}>{lead}</Text>
            <View style={s.bodyWrap}>
              <PageTurnText
                text={bodyText}
                style={[s.body, s.bodyInWrap]}
                lineHeight={BODY_LINE_HEIGHT}
                lines={COLLAPSED_LINES}
                expanded={expanded}
                onOverflowsChange={setOverflows}
              />
            </View>
          </>
        ) : (
          <PageTurnText
            text={lead}
            style={s.lead}
            lineHeight={LEAD_LINE_HEIGHT}
            lines={COLLAPSED_LINES}
            expanded={expanded}
            onOverflowsChange={setOverflows}
          />
        )}
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

      {/* author row carries the right-aligned comments */}
      <View style={s.author}>
        <View style={s.av}>
          {author.seal
            ? <RpMark width={16} height={16} opacity={0.8} />
            : <Text style={s.avInitial}>{author.initial ?? '·'}</Text>}
        </View>
        {/* flexShrink + single-line ellipsis — a long name/ministry must
            truncate with "…", never crowd the comments affordance into
            the card edge (Founder 2026-07-28 device walk). */}
        <View style={s.authorText}>
          <Text style={s.name} numberOfLines={1}>{author.name}</Text>
          {!!author.church && <Text style={s.church} numberOfLines={1}>{author.church}</Text>}
        </View>
        <View style={{ flex: 1, minWidth: 12 }} />
        {commentCount != null && (
          <Pressable
            onPress={toggle}
            hitSlop={8}
            style={s.cc}
            accessibilityRole="button"
            accessibilityLabel={`${localCount} comments`}
          >
            <CommentIcon />
            <Text style={[s.ccText, cOpen && { color: Colors.accent }]}>{localCount} comments</Text>
            <View style={{ transform: [{ rotate: cOpen ? '180deg' : '0deg' }] }}>
              <Chevron />
            </View>
          </Pressable>
        )}
      </View>

      {cOpen && (
        <CommentThread
          announcementId={announcementId}
          count={localCount}
          onClose={() => setCOpen(false)}
          onCommentPosted={() => setLocalCount((c) => c + 1)}
        />
      )}
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
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  dotWrap: { width: 11, height: 11, alignItems: 'center', justifyContent: 'center' },
  // White leader-voice dot (Day-1 green retirement, Founder 2026-07-28).
  dotHalo: { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.text + '30' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.text },
  eyebrowLabel: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1.26, color: Colors.textMuted },
  eyebrowRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },

  // Ruling 2 (Address the Network, 2026-07-22): the leader-word lead is
  // Cormorant ROMAN, not italic. scriptureItalic stays reserved for
  // scripture + witness quotes; this is a leader's human voice.
  lead: { fontFamily: Typography.displayRegular, ...FeedTitle, letterSpacing: 0.1, color: Colors.text },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 12 },
  // Wrapper owns the top spacing (PageTurnText strips text margins).
  bodyWrap: { marginTop: 12 },
  bodyInWrap: { marginTop: 0 },

  // Page-turn cue — exact style values from AnnouncementCard so the
  // read-on grammar reads identically app-wide.
  readon: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  readonRule: { width: 24, height: 1, backgroundColor: Colors.border },
  readonText: { fontFamily: Typography.mono, fontSize: 12, letterSpacing: 1.2, color: Colors.textSubtle },

  meta: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  verse: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 0.5, color: Colors.accent },
  when: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },

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
  cc: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ccText: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textMuted },
});
