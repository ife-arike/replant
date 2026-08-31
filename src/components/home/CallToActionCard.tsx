// ─────────────────────────────────────────────
// CallToActionCard — an announcement with a prominent action affordance
// (KAN-201 card system 2026-06-02 · Founder addition)
//
// For card_type = 'call_to_action'. A filled sky-accent CTA row drives to
// link_url ("Join us", "Pray with us", "Read the report"). Distinct from
// LinkCard's quiet framed resource block — this one is meant to be acted
// on, so it carries weight. CTA label text is sourced from source_label
// (admin-set), defaulting to "Learn more".
//
// SEC Observation B (defence-in-depth): only http(s) URLs reach the OS
// link handler. safeOpen rejects every other scheme before openURL.
//
// D-56 author attribution: footer renders "Replant Team" — author_id is
// never selected over the wire and never reaches this component.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  Easing,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Colors, FeedTitle, Radius, Tags, Typography, type TagType } from '../../constants/theme';
import FeedEyebrow from './FeedEyebrow';
import { AUTHOR_ATTRIBUTION } from './NetworkFeedLogic';
import { Arrow, Chevron, CommentIcon, RpMark } from './HomeIcons';
import { CommentThread } from './CommentThread';
import { commentCountLabel } from './CommentThreadLogic';
import ScripturePull from './ScripturePull';
import PageTurnText from './PageTurnText';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// SEC Observation B — client-side scheme allow-list. Only http(s) reaches
// the OS link handler; everything else is silently ignored.
const safeOpen = (url: string) => {
  if (/^https?:\/\//i.test(url)) {
    void Linking.openURL(url);
  }
};

// Body resting clamp — matches AnnouncementCard so Home's collapsed rhythm
// stays consistent. Cue + tap only surface when the body overflows; the
// fold row sits above the CTA button.
const COLLAPSED_LINES = 3;
// Must match s.body lineHeight — feeds PageTurnText's pre-measure
// window estimate; the clamp itself is PageTurnText's height window,
// never a numberOfLines flip (tear class, 2026-07-28).
const BODY_LINE_HEIGHT = 23;

type Props = {
  tag?: TagType;
  title: string;
  body: string;
  ctaLabel: string; // button text e.g. "Join us", "Pray with us"
  url: string; // link_url — required for CTA
  time: string;
  announcementId: string;
  commentCount?: number;
  onCommentPosted?: () => void;
  // Verse anchor (Day-1, 2026-07-28) — ScripturePull renders it.
  verseText?: string | null;
  verseRef?: string | null;
};

export default function CallToActionCard({
  tag = 'update',
  title,
  body,
  ctaLabel,
  url,
  time,
  announcementId,
  commentCount,
  onCommentPosted,
  verseText,
  verseRef,
}: Props) {
  const [cOpen, setCOpen] = useState(false);
  const [localCount, setLocalCount] = useState(commentCount ?? 0);
  const tg = Tags[tag];

  // Page-turn body — 3-line clamp with a gated "read on" ⇄ "fold" cue.
  const [expanded, setExpanded] = useState(false);
  // Overflow signal — reported by PageTurnText, which owns the entire
  // clamp/measure mechanism (see its header for the tear saga).
  const [overflows, setOverflows] = useState(false);

  const toggleExpand = () => {
    if (!overflows) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((v) => !v);
  };

  const toggleComments = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setCOpen((v) => !v);
  };

  return (
    <View style={s.card}>
      {/* eyebrow / letterhead — FeedEyebrow owns the register (KAN-348) */}
      <FeedEyebrow tag={tag} label={tg.label} time={time} />

      <Text style={s.title}>{title}</Text>

      <Pressable
        onPress={toggleExpand}
        disabled={!overflows}
        accessibilityRole={overflows ? 'button' : undefined}
        accessibilityState={overflows ? { expanded } : undefined}
        accessibilityHint={overflows ? (expanded ? 'Tap to fold' : 'Tap to read on') : undefined}
      >
        <View style={s.bodyWrap}>
          <PageTurnText
            text={body}
            style={[s.body, s.bodyInWrap]}
            lineHeight={BODY_LINE_HEIGHT}
            lines={COLLAPSED_LINES}
            expanded={expanded}
            onOverflowsChange={setOverflows}
          />
        </View>
        {overflows && (
          <View style={s.readon}>
            <View style={s.readonRule} />
            <Text style={s.readonText}>{expanded ? 'fold' : 'read on'}</Text>
          </View>
        )}
      </Pressable>

      <ScripturePull text={verseText} reference={verseRef} />

      {/* CTA link — accent words + arrow, no fill (CD register) */}
      <Pressable
        style={s.cta}
        onPress={() => safeOpen(url)}
        accessibilityRole="link"
        accessibilityLabel={ctaLabel}
        hitSlop={8}
      >
        <Text style={s.ctaLabel}>{ctaLabel}</Text>
        <Arrow color={Colors.accent} />
      </Pressable>

      {/* footer — seal · Replant Team · [comments right-aligned] */}
      <View style={s.foot}>
        <RpMark width={17} height={17} opacity={0.65} />
        <Text style={s.by}>{AUTHOR_ATTRIBUTION}</Text>
        <View style={{ flex: 1 }} />
        {commentCount != null && (
          <Pressable
            onPress={toggleComments}
            hitSlop={8}
            style={s.cc}
            accessibilityRole="button"
            accessibilityLabel={commentCountLabel(localCount)}
          >
            <CommentIcon />
            <Text style={[s.ccText, cOpen && { color: Colors.accent }]}>{commentCountLabel(localCount)}</Text>
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
          onCommentPosted={() => {
            setLocalCount((c) => c + 1);
            onCommentPosted?.();
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 20,
    overflow: 'hidden',
  },


  title: { fontFamily: Typography.displayRegular, ...FeedTitle, color: Colors.text, letterSpacing: 0.1 },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 9 },
  // Wrapper owns the top spacing (PageTurnText strips text margins).
  bodyWrap: { marginTop: 9 },
  bodyInWrap: { marginTop: 0 },

  // Page-turn cue — exact style values from AnnouncementCard so the
  // read-on grammar reads identically app-wide.
  readon: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  readonRule: { width: 24, height: 1, backgroundColor: Colors.border },
  readonText: { fontFamily: Typography.mono, fontSize: 12, letterSpacing: 1.2, color: Colors.textSubtle },

  // CTA = words as a hyperlink + arrow (CD register; the filled sky pill
  // was rejected by the Founder 2026-07-22). Left-aligned, accent text.
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  ctaLabel: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.accent },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  by: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textSubtle },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ccText: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textMuted },
});
