// GuidanceReaderScreen — pushed from Take Heart guidance card tap.
// SECURITY: NEVER open external URL. No telemetry. selectable={false}.
// No screen_view event. No track('opened_guidance'). Silent surface.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Rect } from 'react-native-svg';
import { Colors, Typography } from '../../../../constants/theme';
import { supabase } from '../../../../lib/supabase';
import BackRow from '../components/BackRow';
import type { RootStackParamList } from '../../../../navigation/types';

const CREAM = '#E6E1D5';
const FAINT = 'rgba(240,237,230,0.08)';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'GuidanceReader'>;

interface GuidanceStep {
  n: string;
  label: string;
  body: string;
  scripture?: { text: string; ref: string };
}

interface GuidanceData {
  eyebrow: string;
  title: string;
  subtitle: string | null;
  steps: GuidanceStep[];
  scripture_ref: string | null;
  scripture_text: string | null;
}

// Placeholder guidance for before data is seeded
const PLACEHOLDER_GUIDANCE: Record<string, GuidanceData> = {
  raid: {
    eyebrow: 'For Leaders',
    title: 'If your fellowship is raided.',
    subtitle: 'A brief, practical guide. Read once, return when needed. Held entirely in-app — nothing on this page is logged or sent anywhere.',
    steps: [
      { n: '01', label: 'Protect the gathered first.',
        body: 'Names before things. Get the most vulnerable — children, the elderly, recent converts, anyone not yet known to authorities — out first. Have a pre-agreed exit and a pre-agreed assembly point at least two streets removed.',
        scripture: { text: 'He will tend his flock like a shepherd; he will gather the lambs in his arms.', ref: 'Isaiah 40:11' } },
      { n: '02', label: 'Destroy nothing that could not be replaced.',
        body: 'Do not burn records in the moment. Do not flush anything. Have a pre-prepared sanitized phone or device that contains nothing connecting to other fellowships. The truth is not the enemy. Documentation that endangers others is.',
        scripture: { text: 'Be wise as serpents and innocent as doves.', ref: 'Matthew 10:16' } },
      { n: '03', label: 'Do not lie. Do not volunteer.',
        body: 'Answer what is asked, truthfully and minimally. Names other than your own are not yours to give. Locations of other gatherings are not yours to give. "I do not wish to answer that question" is a complete sentence.',
        scripture: { text: 'Let what you say be simply "Yes" or "No." Anything more than this comes from evil.', ref: 'Matthew 5:37' } },
      { n: '04', label: 'Pray aloud where you can.',
        body: 'If you are detained, pray aloud. Not for performance — for the comfort of the saints near you and for the witness of those who hold you. Many have come to faith hearing the prayers of their prisoners.',
        scripture: { text: 'About midnight Paul and Silas were praying and singing hymns to God, and the prisoners were listening to them.', ref: 'Acts 16:25' } },
      { n: '05', label: 'Reach Replant when you can.',
        body: 'When you are clear and safe, share a heartcry. Do not include details that name others. We will pray, we will respond, and the body will be told only what it needs to know to stand with you.',
        scripture: { text: 'Bear one another\'s burdens, and so fulfill the law of Christ.', ref: 'Galatians 6:2' } },
    ],
    scripture_ref: 'Matthew 10:16',
    scripture_text: 'Behold, I am sending you out as sheep in the midst of wolves; so be wise as serpents and innocent as doves.',
  },

  digital: {
    eyebrow: 'For Leaders',
    title: 'Digital security, brief.',
    subtitle: 'Six habits that protect you and the body. Read once, return when needed. Held entirely in-app — nothing on this page is logged or sent anywhere.',
    steps: [
      { n: '01', label: 'Use encrypted messaging.',
        body: 'Signal, not WhatsApp. Never SMS. WhatsApp encrypts content but logs metadata — who you contacted, when, how often, and from where. That metadata is enough to map your entire network. Signal logs almost nothing. If your government blocks Signal, use a VPN or bridge. If your co-leaders are on WhatsApp, move them. This is not a preference — it is a protection.',
        scripture: { text: 'The prudent sees danger and takes refuge, but the simple keep going and pay the penalty.', ref: 'Proverbs 22:3' } },
      { n: '02', label: 'Keep a separate device.',
        body: 'If possible, use a dedicated phone for fellowship communications — one that holds nothing personal, no contacts with real names, no photos of gatherings. Before any border crossing, checkpoint, or travel through a monitored area, factory-reset the fellowship device. You can restore it later. You cannot un-seize it once it is in their hands.',
        scripture: { text: 'See, I am sending you out like sheep among wolves. Therefore be as shrewd as snakes and as innocent as doves.', ref: 'Matthew 10:16' } },
      { n: '03', label: 'Password discipline.',
        body: 'Every account gets a unique password. Never reuse one across services — if one falls, they all fall. Never share passwords verbally or by message. If a co-leader needs access to something, use a password manager with shared vaults. Write nothing on paper that could be found in a search.',
        scripture: { text: 'Whoever is faithful in a very little is faithful also in much.', ref: 'Luke 16:10' } },
      { n: '04', label: 'Kill location services when you gather.',
        body: 'Before every gathering, disable location services, Bluetooth, and WiFi scanning on your phone. These broadcast your position constantly, even when you think the screen is off. A single device pinging a cell tower at the same coordinates every Thursday at 7pm is enough to establish a pattern. Tell your people: airplane mode is not paranoia. It is discipline.',
        scripture: { text: 'A prudent person foresees danger and takes precautions. The simpleton goes blindly on and suffers the consequences.', ref: 'Proverbs 27:12' } },
      { n: '05', label: 'Never photograph the gathering.',
        body: 'No photos of the meeting, the attendees, the location, or the journey there. Not even for encouragement. Not even for prayer. If law enforcement seizes your phone, every face in those photos becomes a target, every location becomes a raid site, every gathering becomes evidence. If you want to remember the moment, write it in your heart. The Spirit will keep it.',
        scripture: { text: 'But Mary treasured up all these things, pondering them in her heart.', ref: 'Luke 2:19' } },
      { n: '06', label: 'If you suspect compromise, act in person.',
        body: 'If you believe your device, your accounts, or your communications have been compromised: change every password immediately. Then notify your co-leaders IN PERSON — not by call, not by message, not by any digital channel. Assume the compromised channel is being watched. Once you are safe, share a heartcry on Replant so the wider body knows to pray — but include no names, no locations, no details that could be used.',
        scripture: { text: 'Plans fail for lack of counsel, but with many advisers they succeed.', ref: 'Proverbs 15:22' } },
    ],
    scripture_ref: 'Proverbs 27:12',
    scripture_text: 'The prudent sees danger and hides himself, but the simple go on and suffer for it.',
  },

  arrest: {
    eyebrow: 'For Leaders',
    title: 'If you are arrested.',
    subtitle: 'What to say, what not to say, and how the body will continue without you. Held entirely in-app — nothing on this page is logged or sent anywhere.',
    steps: [
      { n: '01', label: 'Have a pre-agreed signal.',
        body: 'Before you ever need it, establish a signal with one trusted person — a specific word in a message, a missed call at an unusual hour, a text to a pre-agreed number. It means one thing: "I have been taken." The body needs to know within hours, not days. If you disappear without a signal, precious time is lost — time for prayer, for legal help, for protecting those connected to you.',
        scripture: { text: 'Two are better than one, because they have a good reward for their toil. For if they fall, one will lift up his fellow.', ref: 'Ecclesiastes 4:9-10' } },
      { n: '02', label: 'In the first moments — pray, not panic.',
        body: 'The first minutes set the tone for everything that follows. Fear will tell you to bargain, to explain, to talk your way out. Do not listen. Breathe. Pray — silently or aloud. The Lord is with you. He has not been surprised. The same Spirit that sustained Paul in the Philippian jail, Peter in Herod\'s prison, and Jeremiah in the cistern is present with you now.',
        scripture: { text: 'When you pass through the waters, I will be with you; and through the rivers, they shall not overwhelm you.', ref: 'Isaiah 43:2' } },
      { n: '03', label: 'What to say.',
        body: 'Your name — truthfully. Your faith, if asked — truthfully. You are not ashamed of the gospel. Beyond that, answer only what is asked, and answer minimally. "I don\'t know" is not a sin when it is true. "I choose not to answer that" is not a crime in most jurisdictions. Know your local legal rights BEFORE you need them — the time to learn what you may refuse is not the moment you are asked.',
        scripture: { text: 'Always be prepared to give an answer to everyone who asks you to give the reason for the hope that you have. But do this with gentleness and respect.', ref: '1 Peter 3:15' } },
      { n: '04', label: 'What not to say.',
        body: 'Names of other leaders. Locations of other gatherings. Details about your network — its size, its structure, its methods of communication. If they already know, they do not need you to confirm it. Confirmation from your mouth turns suspicion into evidence. Silence protects. You are not betraying your interrogators by withholding; you are shepherding your flock.',
        scripture: { text: 'Set a guard, O Lord, over my mouth; keep watch over the door of my lips!', ref: 'Psalm 141:3' } },
      { n: '05', label: 'Your family.',
        body: 'Have a plan — written nowhere, held in the minds of two or three trusted people. Who takes over your household responsibilities. Who contacts your spouse. Who ensures your children are safe and cared for. Who handles finances for the first weeks. This plan should exist BEFORE it is needed. To prepare is not to lack faith. It is to love your family well in advance of the hour.',
        scripture: { text: 'But if anyone does not provide for his relatives, and especially for members of his household, he has denied the faith.', ref: '1 Timothy 5:8' } },
      { n: '06', label: 'The body continues.',
        body: 'Your church knows what to do. You have taught them the Word. You have raised leaders. You have modeled faithfulness. Now trust the Spirit in them. Do not carry the weight of the church\'s future on your shoulders in that cell — Christ carries it. The church survived the stoning of Stephen, the beheading of James, the crucifixion of Peter. It will survive your absence. And by God\'s mercy, your absence may be brief.',
        scripture: { text: 'I will build my church, and the gates of hell shall not prevail against it.', ref: 'Matthew 16:18' } },
    ],
    scripture_ref: '2 Timothy 4:6-7',
    scripture_text: 'For I am already being poured out as a drink offering, and the time of my departure has come. I have fought the good fight, I have finished the race, I have kept the faith.',
  },

  prohibition: {
    eyebrow: 'For Leaders',
    title: 'Continuing under prohibition.',
    subtitle: 'How the early church gathered when forbidden, and what they wrote to each other when they could not. Held entirely in-app — nothing on this page is logged or sent anywhere.',
    steps: [
      { n: '01', label: 'The precedent.',
        body: 'The early church gathered in homes, catacombs, and open fields. They met before dawn and after dark. They were forbidden by the Sanhedrin, hunted by Rome, and scattered by persecution — and they grew. Prohibition is not new. The playbook exists. You are not the first generation of leaders to face this, and the God who sustained them is the same God who sustains you.',
        scripture: { text: 'For we cannot help speaking about what we have seen and heard.', ref: 'Acts 4:20' } },
      { n: '02', label: 'Smaller, not fewer.',
        body: 'Break your large gathering into house-sized cells of five to twelve. Each cell has its own leader, its own meeting rhythm, and its own location. No cell knows where the others meet. If one is discovered, the others continue unbroken. This is not organizational theory — it is how the church in China grew from one million to over one hundred million under the most sustained prohibition in modern history.',
        scripture: { text: 'And day by day, attending the temple together and breaking bread in their homes, they received their food with glad and generous hearts.', ref: 'Acts 2:46' } },
      { n: '03', label: 'The Word is the anchor.',
        body: 'When gathering is scarce, the Word must be abundant. Memorize passages together — not as an exercise, but as a lifeline. If printed Bibles are dangerous, distribute handwritten copies of key passages. If even those are dangerous, carry the Word in your mind. They can confiscate paper. They can seize devices. They cannot take what is written on your heart.',
        scripture: { text: 'Remember Jesus Christ, risen from the dead. This is my gospel, for which I am suffering, bound with chains as a criminal. But the word of God is not bound!', ref: '2 Timothy 2:8-9' } },
      { n: '04', label: 'Communion persists.',
        body: 'Bread and wine — or whatever you have — in a living room, around a kitchen table, at midnight. The Lord\'s Table does not require a building, a pulpit, or a license from the state. It requires His people, gathered in His name, remembering His death until He comes. If you have bread and a cup, you have everything you need. Do not let prohibition steal the Table from you.',
        scripture: { text: 'For where two or three are gathered in my name, there am I among them.', ref: 'Matthew 18:20' } },
      { n: '05', label: 'Communication under prohibition.',
        body: 'Use pre-agreed codes for meeting times and locations. Do not discuss fellowship business on monitored channels — not by phone, not by text, not on social media. Meet in person when possible. When not possible, use Replant — it was built for exactly this. Rotate meeting locations. Vary your arrival times. Do not establish patterns that can be mapped. Predictability is the enemy of safety.',
        scripture: { text: 'The hearts of the wise make their mouths prudent, and their lips promote instruction.', ref: 'Proverbs 16:23' } },
      { n: '06', label: 'Endurance, not escape.',
        body: 'Do not pray only for the prohibition to end. Pray for faithfulness while it lasts. Many of the church\'s greatest seasons of growth happened under prohibition. The church in China, in Iran, in the Soviet Union, in North Korea — they did not merely survive. They multiplied. Suffering and growth are not opposites in the kingdom. The blood of the martyrs has always been the seed of the church.',
        scripture: { text: 'Count it all joy, my brothers, when you meet trials of various kinds, for you know that the testing of your faith produces steadfastness.', ref: 'James 1:2-3' } },
    ],
    scripture_ref: 'Acts 5:29',
    scripture_text: 'We must obey God rather than men.',
  },
};

export default function GuidanceReaderScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { slug } = route.params;
  const [guidance, setGuidance] = useState<GuidanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // NO telemetry — no screen_view, no track('opened_guidance')
    (async () => {
      const { data, error } = await supabase.rpc('get_guidance', { p_slug: slug });
      if (!error && data && data.length > 0) {
        const row = data[0] as any;
        setGuidance({
          eyebrow: row.eyebrow,
          title: row.title,
          subtitle: row.subtitle,
          steps: row.steps as GuidanceStep[],
          scripture_ref: row.scripture_ref,
          scripture_text: row.scripture_text,
        });
      } else {
        // KAN-347 DELIBERATE EXCEPTION (flagged on the ticket): guidance is
        // safety-critical, in-app-authored content. A leader opening this
        // mid-crisis must never hit a retry wall, so fetch FAILURE and
        // unknown slug both serve the in-app library version. The other
        // three readers render honest error states; this surface trades
        // freshness for availability by design.
        setGuidance(PLACEHOLDER_GUIDANCE[slug] ?? PLACEHOLDER_GUIDANCE.raid);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.leftEdge} pointerEvents="none" />
        <GuidanceNavBar onBack={() => navigation.goBack()} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.red} />
        </View>
      </SafeAreaView>
    );
  }

  if (!guidance) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.leftEdge} pointerEvents="none" />
      <GuidanceNavBar onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Intro */}
        <View style={styles.intro}>
          <Text style={styles.introEyebrow}>{guidance.eyebrow.toUpperCase()}</Text>
          <Text style={styles.introTitle} selectable={false}>{guidance.title}</Text>
          {guidance.subtitle && (
            <Text style={styles.introSub} selectable={false}>{guidance.subtitle}</Text>
          )}
          <View style={styles.secureBadge}>
            <Svg width={8} height={10} viewBox="0 0 10 12">
              <Rect x={1.5} y={5} width={7} height={6} rx={1} fill="none" stroke={Colors.accent} />
              <Path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke={Colors.accent} />
            </Svg>
            <Text style={styles.secureBadgeText}>Held in-app</Text>
          </View>
        </View>

        {/* Steps */}
        <View style={styles.stepsList}>
          {guidance.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNum} selectable={false}>{step.n}</Text>
              <View style={styles.stepBody}>
                <Text style={styles.stepLabel} selectable={false}>{step.label}</Text>
                <Text style={styles.stepCopy} selectable={false}>{step.body}</Text>
                {step.scripture && (
                  <View style={styles.stepScripture}>
                    <Text style={styles.stepScriptureText} selectable={false}>
                      {'"'}{step.scripture.text}{'"'}
                    </Text>
                    <Text style={styles.stepScriptureRef}>{step.scripture.ref.toUpperCase()}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Scripture footer */}
        {guidance.scripture_ref && guidance.scripture_text && (
          <View style={styles.scriptureFoot}>
            <Text style={styles.scriptureEyebrow}>WISE AS SERPENTS</Text>
            <Text style={styles.scriptureVerse} selectable={false}>{guidance.scripture_text}</Text>
            <Text style={styles.scriptureRef}>{guidance.scripture_ref.toUpperCase()}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function GuidanceNavBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.navbar}>
      <BackRow onPress={onBack} />
      <Text style={styles.navTitle}>Take Heart</Text>
      <Text style={styles.navSubtitle}>GUIDANCE · HELD IN-APP · NOTHING LOGGED</Text>
      <View style={styles.navHairline} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  leftEdge: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 1.5,
    backgroundColor: Colors.red,
    opacity: 0.25,
    zIndex: 1,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 40 },

  // NavBar
  navbar: { paddingTop: 14, paddingBottom: 10 },
  navTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 26,
    letterSpacing: 0.4,
    color: Colors.red,
    paddingHorizontal: 20,
  },
  navSubtitle: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginTop: 6,
    paddingHorizontal: 20,
  },
  navHairline: {
    height: 0.5,
    backgroundColor: 'rgba(217,89,79,0.30)',
    marginTop: 14,
    marginHorizontal: 20,
  },

  // Intro
  intro: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
  },
  introEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    color: Colors.red,
    marginBottom: 12,
  },
  introTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 26,
    lineHeight: 32,
    color: Colors.text,
    marginBottom: 10,
  },
  introSub: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    lineHeight: 23,
    color: CREAM,
    marginBottom: 14,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.30)',
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  secureBadgeText: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.53,
    color: Colors.accent,
  },

  // Steps
  stepsList: {
    paddingHorizontal: 22,
    gap: 22,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepNum: {
    fontFamily: Typography.mono,
    fontSize: 11,
    color: Colors.red,
    width: 28,
    paddingTop: 4,
  },
  stepBody: {
    flex: 1,
  },
  stepLabel: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    color: Colors.text,
    marginBottom: 8,
  },
  stepCopy: {
    fontFamily: Typography.displayRegular,
    fontSize: 15.5,
    lineHeight: 24,
    color: CREAM,
    marginBottom: 12,
  },

  // Step scripture block
  stepScripture: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(107,181,232,0.40)',
    paddingLeft: 14,
    paddingVertical: 6,
  },
  stepScriptureText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    lineHeight: 22,
    color: CREAM,
    marginBottom: 6,
  },
  stepScriptureRef: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    color: Colors.accent,
  },

  // Scripture footer
  scriptureFoot: {
    marginTop: 40,
    marginHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FAINT,
    alignItems: 'center',
  },
  scriptureEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    color: Colors.accent,
    marginBottom: 14,
  },
  scriptureVerse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 26,
    color: CREAM,
    letterSpacing: 0.17,
    maxWidth: 320,
    textAlign: 'center',
    marginBottom: 12,
  },
  scriptureRef: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 2.09,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
});
