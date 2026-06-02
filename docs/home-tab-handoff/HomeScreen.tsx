// HomeScreen.tsx — assembles the Home tab.
// Order: TopBar · TODAY + ScriptureStrip · NETWORK UPDATES + feed.
// The existing 5-tab bar is provided by navigation and is NOT redefined here.
//
// PREFERRED CONFIG (set once, here): scripture "open", card "letterhead", title 21.
// Swap the three constants below to try the alternates (see README).
import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from './theme';
import { TopBar } from './components/TopBar';
import { SectionLabel } from './components/SectionLabel';
import { ScriptureStrip } from './components/ScriptureStrip';
import { AnnouncementCard } from './components/AnnouncementCard';
import { LeaderWordCard } from './components/LeaderWordCard';
import { LinkCard } from './components/LinkCard';
import type { Comment } from './components/CommentThread';

// ── preferred config ──────────────────────────────────────────────
const SCRIPTURE_VARIANT = 'open' as const;       // 'open' | 'rule'
const CARD_VARIANT      = 'letterhead' as const;  // 'letterhead' | 'rule'
const TITLE_SIZE        = 21 as const;            // 20 | 21 | 22
// ──────────────────────────────────────────────────────────────────

const SAMPLE_COMMENTS: Comment[] = [
  { id: '1', initial: 'R', name: 'Minister Ruth', church: 'Maranatha Ministries', time: '1h', text: 'Rejoicing with you. We will hold the new leaders in prayer this week.' },
  { id: '2', initial: 'E', name: 'Evangelist Ife', church: 'What A God Ministries', time: '2h', text: 'Welcome, family. You are not walking this road alone.' },
  { id: '3', masked: true, name: 'A leader in the network', church: 'region held', time: '3h', text: 'Grateful to be counted among you. Glory to God.' },
];

export function HomeScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <TopBar />
      <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
        <SectionLabel>Today</SectionLabel>
        <ScriptureStrip
          variant={SCRIPTURE_VARIANT}
          verse="He which testifieth these things saith, Surely I come quickly. Amen. Even so, come, Lord Jesus."
          reference="Revelation 22:20"
          translation="KJV"
        />

        <SectionLabel>Network updates</SectionLabel>
        <View style={{ gap: 14 }}>
          <AnnouncementCard
            variant={CARD_VARIANT} titleSize={TITLE_SIZE} tag="update"
            title="New leaders welcomed this week"
            body="This week we welcomed leaders from East Africa, South Asia, and Eastern Europe into the verified network. The body is growing — pray for those just finding their footing here."
            time="2h ago" commentCount={3} comments={SAMPLE_COMMENTS}
          />

          <LeaderWordCard
            kicker="A word for today"
            lead="Do not despise the day of small things. The seed hidden in the ground is not idle — it is becoming."
            body="Tend what is small today: the one believer, the quiet prayer, the unseen faithfulness. Heaven counts it differently than we do."
            verse="Zechariah 4:10"
            author={{ initial: 'D', name: 'Pastor Daniel Okoro', church: 'Grace Chapel, Nairobi', time: '5h ago' }}
            commentCount={6} comments={SAMPLE_COMMENTS}
          />

          <AnnouncementCard
            variant={CARD_VARIANT} titleSize={TITLE_SIZE} tag="notice"
            title="Three leaders need urgent intercession"
            body="Three leaders in the network have shared heartcries requiring prayer this week. No names. No locations. Open the Prayer Wall and hold them before the Lord."
            time="1d ago" commentCount={12} comments={SAMPLE_COMMENTS}
          />

          <LinkCard
            tag="update"
            title="Where the Church stands · 2026 briefing"
            body="A fresh read on where the body meets the most pressure this year. Let it shape how you pray."
            time="2d ago"
            resource="Where the Church Stands — 2026"
            source="briefing · external link"
            url="https://example.org/briefing"
          />

          <AnnouncementCard
            variant={CARD_VARIANT} titleSize={TITLE_SIZE} tag="urgent"
            title="Digital security alert for some regions"
            body="We've received credible reports of surveillance targeting leaders in certain regions. If you've seen unusual login activity or contact requests, do not respond — report it through Connect."
            time="3d ago" commentCount={5} comments={SAMPLE_COMMENTS}
          />
        </View>

        <Text style={s.end}>— held in prayer —</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 28 },
  end: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 0.5, color: Colors.textSubtle, textAlign: 'center', paddingVertical: 22 },
});
