// components/LinkCard.tsx — an announcement that carries an external link.
// The post reads first; the link is a quiet framed resource block, not a banner.
// Needs announcements.link_url (NEW — flag for DBA).
import React from 'react';
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import { Colors, Typography, Radius, Tags, TagType } from '../theme';
import { RpMark, LinkIcon, Arrow } from './icons';

type Props = {
  tag?: TagType;
  title: string;
  body: string;
  time: string;
  resource: string;   // human label, e.g. "Where the Church Stands — 2026"
  source: string;     // e.g. "briefing · external link"
  url: string;        // announcements.link_url
};

export function LinkCard({ tag = 'update', title, body, time, resource, source, url }: Props) {
  const tg = Tags[tag];
  return (
    <View style={s.card}>
      <View style={s.eyebrow}>
        <View style={[s.dot, { backgroundColor: tg.color }]} />
        <Text style={s.eyebrowLabel}>{tg.label}</Text>
        <View style={s.eyebrowRule} />
        <Text style={s.eyebrowTime}>{time}</Text>
      </View>

      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>

      <Pressable style={s.link} onPress={() => Linking.openURL(url)}>
        <LinkIcon />
        <View style={{ flex: 1 }}>
          <Text style={s.rt}>{resource}</Text>
          <Text style={s.rs}>{source}</Text>
        </View>
        <View style={s.go}>
          <Text style={s.goText}>Open</Text>
          <Arrow />
        </View>
      </Pressable>

      <View style={s.foot}>
        <RpMark width={17} height={17} opacity={0.65} />
        <Text style={s.by}>Replant Team</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.by}>{time}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.cardSurface, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, borderRadius: Radius.lg, padding: 20, overflow: 'hidden' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowLabel: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1.26, color: Colors.textMuted },
  eyebrowRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  eyebrowTime: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },
  title: { fontFamily: Typography.displayRegular, fontSize: 21, lineHeight: 26, color: Colors.text, letterSpacing: 0.1 },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 9 },

  link: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderAccent, borderRadius: Radius.md + 2, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: Colors.linkWell },
  rt: { fontFamily: Typography.bodyMedium, fontSize: 13.5, color: Colors.text },
  rs: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle, marginTop: 3 },
  go: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goText: { fontFamily: Typography.mono, fontSize: 11, color: Colors.accent },

  foot: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  by: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textSubtle },
});
