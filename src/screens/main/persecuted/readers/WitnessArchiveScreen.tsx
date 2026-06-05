// WitnessArchiveScreen — pushed from Bear Witness "Witness archive" link.
// FlatList with filter chips. Featured witness of day at top when filter=all.
// Categories: All / Martyrs / Fathers / Mothers / God's generals / From scripture.

import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../../../../constants/theme';
import { supabase } from '../../../../lib/supabase';
import BackRow from '../components/BackRow';
import ArchiveIntro from '../components/ArchiveIntro';
import FilterChips, { type ChipOption } from '../components/FilterChips';
import MartyrBadge from '../components/MartyrBadge';
import type { RootStackParamList } from '../../../../navigation/types';

const CREAM = '#E6E1D5';
const FAINT = 'rgba(240,237,230,0.08)';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface WitnessRow {
  id: string;
  era: string;
  years_label: string;
  name: string;
  region: string | null;
  category: string;
  martyr: boolean;
  quote: string;
  scripture_ref: string;
  description: string | null;
}

const FILTER_OPTIONS: ChipOption[] = [
  { id: 'all', label: 'All' },
  { id: 'martyr', label: 'Martyrs' },
  { id: 'father', label: 'Fathers of the faith' },
  { id: 'mother', label: 'Mothers of the faith' },
  { id: 'general', label: "God's generals" },
  { id: 'scripture', label: 'From scripture' },
];

// Placeholder witness of day
const PLACEHOLDER_WITNESS_OF_DAY: WitnessRow = {
  id: 'wod-polycarp',
  era: 'AD 156',
  years_label: 'c. AD 69 – 156',
  name: 'Polycarp of Smyrna',
  region: 'Asia Minor',
  category: 'Father of the Faith',
  martyr: true,
  quote: 'Eighty-six years I have served Him, and He has done me no wrong. How can I blaspheme my King who saved me?',
  scripture_ref: 'Revelation 2:10',
  description: 'Burned alive in the arena. Eighty-six years served his King.',
};

// Placeholder witnesses
const PLACEHOLDER_WITNESSES: WitnessRow[] = [
  { id: 'w1', era: 'AD 36', years_label: 'c. AD 5 – 36', name: 'Stephen', region: null, category: 'From Scripture', martyr: true, quote: '', scripture_ref: 'Acts 7:55', description: 'The first martyr of the church, stoned for preaching Christ. Acts 7.' },
  { id: 'w2', era: 'AD 156', years_label: 'c. AD 69 – 156', name: 'Polycarp of Smyrna', region: 'Asia Minor', category: 'Father of the Faith', martyr: true, quote: '', scripture_ref: 'Revelation 2:10', description: 'Burned alive in the arena. Eighty-six years served his King.' },
  { id: 'w3', era: 'AD 203', years_label: 'c. AD 181 – 203', name: 'Perpetua & Felicity', region: 'Carthage', category: 'Mother of the Faith', martyr: true, quote: '', scripture_ref: 'Romans 8:18', description: 'Two young mothers, jailed in Carthage. Perpetua’s diary survives.' },
  { id: 'w4', era: '1415', years_label: 'c. 1372 – 1415', name: 'John Hus', region: 'Bohemia', category: 'Father of the Faith', martyr: true, quote: '', scripture_ref: 'John 8:32', description: 'Bohemian reformer, burned at Constance for preaching scripture in the vernacular.' },
  { id: 'w5', era: '1536', years_label: 'c. 1494 – 1536', name: 'William Tyndale', region: 'England', category: 'Father of the Faith', martyr: true, quote: '', scripture_ref: '1 Peter 1:23', description: 'Translated the Bible into English. Strangled and burned.' },
  { id: 'w6', era: '1555', years_label: '1487/1500 – 1555', name: 'Latimer & Ridley', region: 'England', category: 'Father of the Faith', martyr: true, quote: '', scripture_ref: '2 Timothy 4:7', description: 'Burned at Oxford. "Play the man, Master Ridley; we shall this day light such a candle."' },
  { id: 'w7', era: '1628–1688', years_label: '1628 – 1688', name: 'John Bunyan', region: 'England', category: 'Father of the Faith', martyr: false, quote: '', scripture_ref: 'Hebrews 11:13', description: 'Twelve years in prison for preaching without license. Wrote Pilgrim’s Progress there.' },
  { id: 'w8', era: '1859–1947', years_label: '1859 – 1947', name: 'Smith Wigglesworth', region: 'England', category: "God's General", martyr: false, quote: '', scripture_ref: 'Hebrews 11:1', description: 'Plumber turned evangelist; boldness and faith.' },
  { id: 'w9', era: '1867–1951', years_label: '1867 – 1951', name: 'Amy Carmichael', region: 'India', category: 'Mother of the Faith', martyr: false, quote: '', scripture_ref: 'Matthew 18:5', description: 'Fifty-five years in India without furlough, rescuing children from temple slavery.' },
  { id: 'w10', era: '1906–1945', years_label: '1906 – 1945', name: 'Dietrich Bonhoeffer', region: 'Germany', category: 'Father of the Faith', martyr: true, quote: '', scripture_ref: 'Philippians 1:21', description: 'Hanged at Flossenbürg by the Nazi regime.' },
  { id: 'w11', era: '1956', years_label: '1927 – 1956', name: 'Jim Elliot & companions', region: 'Ecuador', category: 'Father of the Faith', martyr: true, quote: '', scripture_ref: 'John 12:24', description: 'Five missionaries killed by the Waorani. Their wives returned, and a generation followed.' },
];

export default function WitnessArchiveScreen() {
  const navigation = useNavigation<NavProp>();
  const [filter, setFilter] = useState('all');
  const [witnesses, setWitnesses] = useState<WitnessRow[]>([]);
  const [witnessOfDay, setWitnessOfDay] = useState<WitnessRow>(PLACEHOLDER_WITNESS_OF_DAY);
  const [loading, setLoading] = useState(true);

  const loadWitnesses = useCallback(async (f: string) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_witnesses', { p_filter: f });
    if (!error && data && data.length > 0) {
      setWitnesses(data as WitnessRow[]);
    } else {
      // Fallback to placeholder
      const filtered = PLACEHOLDER_WITNESSES.filter((w) => {
        if (f === 'all') return true;
        if (f === 'martyr') return w.martyr;
        if (f === 'father') return w.category === 'Father of the Faith';
        if (f === 'mother') return w.category === 'Mother of the Faith';
        if (f === 'general') return w.category === "God's General";
        if (f === 'scripture') return w.category === 'From Scripture';
        return true;
      });
      setWitnesses(filtered);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadWitnesses(filter);
  }, [filter, loadWitnesses]);

  // Load witness of day
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('get_witness_of_day');
      if (!error && data && data.length > 0) {
        setWitnessOfDay(data[0] as WitnessRow);
      }
    })();
  }, []);

  const renderWitness = useCallback(({ item }: { item: WitnessRow }) => (
    <View style={styles.witnessRow}>
      <View style={styles.witnessEraCol}>
        <Text style={styles.witnessEra}>{item.era}</Text>
      </View>
      <View style={styles.witnessBodyCol}>
        <View style={styles.witnessNameRow}>
          <Text style={styles.witnessName}>{item.name}</Text>
          {item.martyr ? (
            <View style={styles.badgeSmallRed}>
              <Text style={styles.badgeSmallRedText}>Martyr</Text>
            </View>
          ) : (
            <View style={styles.badgeSmallMuted}>
              <Text style={styles.badgeSmallMutedText}>{item.category}</Text>
            </View>
          )}
        </View>
        {item.description ? (
          <Text style={styles.witnessDesc}>{item.description}</Text>
        ) : null}
        <Text style={styles.witnessVerse}>{item.scripture_ref}</Text>
      </View>
    </View>
  ), []);

  const keyExtractor = useCallback((item: WitnessRow) => item.id, []);

  const renderHeader = useCallback(() => (
    <>
      <ArchiveIntro
        eyebrow="A CLOUD OF WITNESSES"
        body="Martyrs, fathers and mothers of the faith, God's generals, and those Scripture remembers. One rises each day in the feed; here they are all together."
      />
      <FilterChips
        options={FILTER_OPTIONS}
        selectedId={filter}
        onSelect={setFilter}
      />

      {/* Featured witness of day — only when filter=all */}
      {filter === 'all' && (
        <>
          <Text style={styles.featuredEyebrow}>WITNESS OF THE DAY</Text>
          <View style={styles.featuredCard}>
            <View style={styles.featuredEraCol}>
              <Text style={styles.witnessEra}>{witnessOfDay.era}</Text>
            </View>
            <View style={styles.witnessBodyCol}>
              <View style={styles.witnessNameRow}>
                <Text style={styles.witnessName}>{witnessOfDay.name}</Text>
                {witnessOfDay.martyr && (
                  <View style={styles.badgeSmallRed}>
                    <Text style={styles.badgeSmallRedText}>Martyr</Text>
                  </View>
                )}
              </View>
              {witnessOfDay.region && (
                <Text style={styles.witnessDesc}>
                  {witnessOfDay.region} · {witnessOfDay.category}
                </Text>
              )}
              <Text style={styles.featuredQuote}>
                {'"'}{witnessOfDay.quote}{'"'}
              </Text>
              <Text style={styles.witnessVerse}>{witnessOfDay.scripture_ref}</Text>
            </View>
          </View>
          <Text style={styles.pastLabel}>Past witnesses</Text>
        </>
      )}
    </>
  ), [filter, witnessOfDay]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.leftEdge} pointerEvents="none" />
      <WitnessNavBar onBack={() => navigation.goBack()} />
      <FlatList
        data={witnesses}
        renderItem={renderWitness}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={
          <View style={styles.scriptureFoot}>
            <Text style={styles.scriptureEyebrow}>RUN WITH ENDURANCE</Text>
            <Text style={styles.scriptureVerse2}>
              Therefore, since we are surrounded by so great a cloud of witnesses, let us also lay aside every weight...
            </Text>
            <Text style={styles.scriptureRef}>HEBREWS 12:1</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

function WitnessNavBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.navbar}>
      <BackRow onPress={onBack} />
      <Text style={styles.navTitle}>Witness archive</Text>
      <Text style={styles.navSubtitle}>THOSE WHO CAME BEFORE</Text>
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
  listContent: { paddingBottom: 28 },

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

  // Featured
  featuredEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    color: Colors.red,
    paddingHorizontal: 22,
    marginTop: 18,
    marginBottom: 10,
  },
  featuredCard: {
    flexDirection: 'row',
    marginHorizontal: 22,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(224,85,85,0.03)',
    borderLeftWidth: 2,
    borderLeftColor: Colors.red,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    gap: 12,
  },
  featuredEraCol: {
    width: 78,
    flexShrink: 0,
  },
  featuredQuote: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 25,
    color: CREAM,
    marginTop: 6,
    marginBottom: 4,
  },
  pastLabel: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    color: Colors.text,
    paddingHorizontal: 22,
    marginTop: 18,
    marginBottom: 10,
  },

  // Witness row
  witnessRow: {
    flexDirection: 'row',
    marginHorizontal: 22,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FAINT,
    gap: 12,
  },
  witnessEraCol: {
    width: 78,
    flexShrink: 0,
  },
  witnessEra: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    color: Colors.textSubtle,
  },
  witnessBodyCol: {
    flex: 1,
  },
  witnessNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  witnessName: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    color: Colors.text,
  },
  badgeSmallRed: {
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(224,85,85,0.30)',
    backgroundColor: 'rgba(224,85,85,0.05)',
  },
  badgeSmallRedText: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    color: Colors.red,
  },
  badgeSmallMuted: {
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: Colors.textSubtle,
  },
  badgeSmallMutedText: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  witnessDesc: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15.5,
    lineHeight: 24,
    color: CREAM,
    marginBottom: 4,
  },
  witnessVerse: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.71,
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
  scriptureVerse2: {
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
