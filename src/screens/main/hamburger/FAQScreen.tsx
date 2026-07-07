// FAQScreen — hamburger sprint (CD v5 final, Founder-locked 2026-06-09).
// Pushed slide_from_right from the Home-tab hamburger panel.
//
// Single-open accordion (opening one closes the currently open one).
// LayoutAnimation.easeInEaseOut runs before each toggle. Search bar is a
// visual stub (post-MVP — no filtering logic). Contact card opens a mailto.
// Title italic via Typography.scriptureItalic; colours via Colors tokens.

import React, { useState } from 'react';
import {
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../../../constants/theme';
import type { RootStackParamList } from '../../../navigation/types';
import HamburgerNavBar from './HamburgerNavBar';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Android requires explicit opt-in for LayoutAnimation.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// KAN-205 B-2 sweep (ratified 2026-07-03) — user-facing contact surfaces
// reconcile to the ruled accounts@ (was info@ here, connect@ in Settings).
const CONTACT_EMAIL = 'accounts@projectreplant.org';

const FAQ_DATA = [
  { q: 'What is Replant?',
    a: 'Replant is a secure global network that connects Christian leaders — clergy, elders, and ministry leaders — across churches, cities, and continents for prayer, support, and unity.' },
  { q: 'Who is this for?',
    a: 'Replant is for Christian leaders across all church expressions. The only requirement is a sincere confession of Jesus Christ as Lord and Saviour.' },
  { q: 'Can a ministry secretary or church administrator join on behalf of the leader?',
    a: "Replant is built for the leader themselves — not a representative. The platform is designed so that ministry leaders have a direct, personal presence within the network. While secretaries and administrators serve a vital role in every ministry, Replant requires the leader's own registration. Their voice, their faith, and their relationships are what the network is built around." },
  { q: 'Is this a social media platform?',
    a: 'No. Replant is not a social media platform, and that is intentional. There are no likes, no follower counts, no algorithms deciding what you see, and no ministry promotion.' },
  { q: 'What is the foundation of Replant?',
    a: 'The Holy Bible is the only source of truth on this platform. No exceptions.' },
  { q: 'Can house churches and underground churches join?',
    a: 'Absolutely. House churches, churches without walls, online congregations, and underground churches are not only eligible — they are actively encouraged to join.' },
  { q: 'Can a pastor remain anonymous on the network?',
    a: 'Yes — a pastor may remain anonymous within the network. Their personal name can be hidden from other leaders. Their church or ministry name, however, is always visible. Real identity information is always required at registration for security and legal purposes, and is kept strictly confidential.' },
  { q: 'Is there a limit per church?',
    a: 'A maximum of two (2) pastors or leaders may register per church or ministry on the Replant network.' },
  { q: 'What if two churches share a name?',
    a: 'This is acceptable. Location information is used to distinguish churches that share the same name. Additionally, each verified church is assigned a unique Replant Network ID upon verification — making it straightforward to identify and search for specific churches across the network.' },
  { q: 'Are conversations private?',
    a: 'Conversations within Replant are protected within the network and are not shared externally.' },
  { q: 'How is the Persecuted Church section protected?',
    a: 'Submissions are encrypted. Sensitive details are accessible only to verified leaders within the network. Underground church locations are never made public.' },
  { q: 'Can we send financial support through Replant?',
    a: 'At this time, Replant does not facilitate direct financial transfers between ministries.' },
  { q: 'How can churches actually help one another right now?',
    a: 'Through prayer, resources, manpower, advice, and encouragement.' },
  // KAN-205 — account-deletion entries (CONTENT §7, verbatim; ratified
  // 2026-07-03). SEC-COORD on the second answer resolved: "open the app
  // and sign in" holds for underground accounts too — self-deleted UG
  // leaders restore via the same post-sign-in prompt as everyone else,
  // so the full middle clause stays.
  { q: 'What happens when I delete my account?',
    a: 'Deletion starts a 30-day window. During that window your account is closed but can still be restored. After 30 days it is permanently deleted — your name, email address, and phone number are removed, and you can no longer sign in.' },
  { q: 'Can I come back after deleting my account?',
    a: 'Within 30 days, yes. Open the app and sign in, and you will be offered the choice to restore your account exactly as you left it. After 30 days the deletion is permanent, and returning means starting fresh with a new account.' },
  { q: 'What happens to what I shared?',
    a: 'Prayers, testimonies, comments, and messages you already sent remain with the people you shared them with. After permanent deletion they are no longer attached to your name.' },
];

export default function FAQScreen() {
  const navigation = useNavigation<NavProp>();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex((cur) => (cur === index ? null : index));
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <HamburgerNavBar title="FAQ" onBack={() => navigation.goBack()} />

      {/* Eyebrow + title block */}
      <View style={styles.titleBlock}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowHairline} />
          <Text style={styles.eyebrow}>Common questions</Text>
        </View>
        {/* No whitespace between {'\n'} and the nested Text — JSX indentation
            before a sibling Text renders as a leading space in RN. */}
        <Text style={styles.title}>{'Frequently '}<Text style={styles.titleItalic}>{'Asked Questions'}</Text></Text>
      </View>

      {/* Search bar — visual stub (post-MVP, no filtering) */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search questions…"
          placeholderTextColor={Colors.textSubtle}
          editable={false}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {FAQ_DATA.map((item, index) => {
          const open = openIndex === index;
          const num = String(index + 1).padStart(2, '0');
          return (
            <View key={item.q}>
              <Pressable
                onPress={() => toggle(index)}
                accessibilityRole="button"
                accessibilityLabel={item.q}
                style={styles.questionRow}
              >
                <Text style={styles.questionNum}>{num}</Text>
                <Text style={[styles.questionText, open && styles.questionTextOpen]}>
                  {item.q}
                </Text>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
                    stroke={open ? Colors.accent : Colors.textSubtle}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
              {open && (
                <View style={styles.answerWrap}>
                  <View style={styles.answerPanel}>
                    <Text style={styles.answerText}>{item.a}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Contact card */}
        <Pressable
          onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
          accessibilityRole="button"
          accessibilityLabel={`Email ${CONTACT_EMAIL}`}
          style={styles.contactCard}
        >
          <Text style={styles.contactLabel}>Still have questions?</Text>
          <Text style={styles.contactEmail}>{CONTACT_EMAIL}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Title block
  titleBlock: {
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  eyebrowHairline: {
    width: 20,
    height: 0.5,
    backgroundColor: Colors.accent,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 3.3, // 0.30em × 11
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 30,
    lineHeight: 34,
    color: Colors.text,
    marginBottom: 18,
  },
  titleItalic: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 30,
    color: Colors.accent,
  },

  // Search bar (stub)
  searchBar: {
    marginHorizontal: 22,
    marginBottom: 14,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  searchIcon: {
    fontFamily: Typography.mono,
    fontSize: 18,
    color: Colors.textSubtle,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.sansLight,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },

  // Accordion list
  listContent: {
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  questionNum: {
    fontFamily: Typography.mono,
    fontSize: 11,
    color: Colors.textSubtle,
    width: 24,
  },
  questionText: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 16,
    color: Colors.text,
  },
  questionTextOpen: {
    color: Colors.accent,
  },
  answerWrap: {
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 16,
    paddingLeft: 36,
  },
  answerPanel: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderLeftWidth: 1.5,
    borderLeftColor: Colors.borderAccent,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  answerText: {
    fontFamily: Typography.sansLight,
    fontSize: 14.5,
    lineHeight: 26, // 1.8 × 14.5
    color: Colors.textMuted,
  },

  // Contact card
  contactCard: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    alignItems: 'center',
  },
  contactLabel: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    letterSpacing: 1.89, // ~0.18em × 10.5
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: 6,
    textAlign: 'center',
  },
  contactEmail: {
    fontFamily: Typography.mono,
    fontSize: 14,
    color: Colors.accent,
    textAlign: 'center',
  },
});
