// ─────────────────────────────────────────────
// LeaderWordCard — a verified leader's word to the network
// (KAN-201 home redesign)
//
// NOT a testimony — an encouragement / daily-bread reflection. Warm
// surface (intentional, distinct from admin cards). The verse anchor sits
// opposite the time; comments are right-aligned in the author row,
// matching the announcement cards, and open the thread in place.
//
// The author name + church are resolved upstream in NetworkFeed from the
// leader's users/churches rows. Underground churches NEVER surface here —
// NetworkFeed masks them to "A leader in the network" before this card
// renders (client-side guard, SEC Observation D). author_id is never
// passed to this component.
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Colors, Radius, Typography } from '../../constants/theme';
import { Chevron, CommentIcon } from './HomeIcons';
import { CommentThread } from './CommentThread';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Body resting clamp — matches AnnouncementCard so Home's collapsed rhythm
// stays consistent. Cue + tap only surface when the clamped text overflows.
const COLLAPSED_LINES = 3;

interface Props {
  announcementId: string;
  kicker?: string; // "A word for today" | "Encouragement"
  lead: string; // the reflective opening line (serif italic)
  body?: string; // optional continuation
  verse?: string; // anchor reference, e.g. "Zechariah 4:10"
  author: { initial: string; name: string; church: string; time: string };
  commentCount?: number;
}

export default function LeaderWordCard({
  announcementId,
  kicker = 'A word for today',
  lead,
  body,
  verse,
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
  // clamp the lead. The mirror measures whichever text is clamped so the
  // "read on" cue only surfaces on true overflow (overflow-gating ruling).
  const bodyText = body?.trim() ? body : undefined;
  const hasBody = bodyText !== undefined;
  const clampText = bodyText ?? lead;

  const [expanded, setExpanded] = useState(false);
  const [naturalLines, setNaturalLines] = useState<number | null>(null);
  const measuredForRef = useRef<string | null>(null);
  useEffect(() => {
    setNaturalLines(null);
    measuredForRef.current = null;
  }, [clampText]);

  const handleMirrorLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (measuredForRef.current === clampText) return;
    measuredForRef.current = clampText;
    setNaturalLines(e.nativeEvent.lines.length);
  };

  const overflows = naturalLines !== null && naturalLines > COLLAPSED_LINES;

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
        <Text
          style={s.lead}
          numberOfLines={!hasBody && !expanded ? COLLAPSED_LINES : undefined}
        >
          {lead}
        </Text>
        {hasBody && (
          <Text style={s.body} numberOfLines={expanded ? undefined : COLLAPSED_LINES}>
            {bodyText}
          </Text>
        )}
        {/* Offscreen mirror — measures whichever text is clamped (body when
            present, else the lead) so the cue only renders on true overflow. */}
        <Text
          style={[hasBody ? s.body : s.lead, s.mirror]}
          onTextLayout={handleMirrorLayout}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          {clampText}
        </Text>
        {overflows && (
          <View style={s.readon}>
            <View style={s.readonRule} />
            <Text style={s.readonText}>{expanded ? 'fold' : 'read on'}</Text>
          </View>
        )}
      </Pressable>

      {!!verse && (
        <View style={s.meta}>
          <Text style={s.verse}>{verse}</Text>
        </View>
      )}

      {/* author row carries the right-aligned comments */}
      <View style={s.author}>
        <View style={s.av}>
          <Text style={s.avInitial}>{author.initial}</Text>
        </View>
        <View>
          <Text style={s.name}>{author.name}</Text>
          {!!author.church && <Text style={s.church}>{author.church}</Text>}
        </View>
        <View style={{ flex: 1 }} />
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
  dotHalo: { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.green + '30' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  eyebrowLabel: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1.26, color: Colors.textMuted },
  eyebrowRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },

  lead: { fontFamily: Typography.scriptureItalic, fontSize: 22, lineHeight: 30, letterSpacing: 0.1, color: Colors.text },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 12 },

  // Offscreen mirror + page-turn cue — exact style values from
  // AnnouncementCard so the read-on grammar reads identically app-wide.
  mirror: { position: 'absolute', left: 20, right: 20, top: -10000, opacity: 0 },
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
  name: { fontFamily: Typography.bodyMedium, fontSize: 13.5, color: Colors.text },
  church: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ccText: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textMuted },
});
