// ArticleReaderScreen — pushed from Bear Witness story tap.
// In-app reader. NEVER opens external URL. Body uses Typography.displayRegular
// (NOT italic) for long-form reading. Pull quote with 2px red border.

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
import { Colors, Typography } from '../../../../constants/theme';
import { supabase } from '../../../../lib/supabase';
import BackRow from '../components/BackRow';
import type { RootStackParamList } from '../../../../navigation/types';

const CREAM = '#E6E1D5';
const FAINT = 'rgba(240,237,230,0.08)';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'ArticleReader'>;

interface ArticleData {
  id: string;
  source: string;
  author: string;
  title: string;
  body_md: string;
  pull_quote: string | null;
  scripture_ref: string | null;
  scripture_text: string | null;
}

// Placeholder article for before data is seeded
const PLACEHOLDER_ARTICLE: ArticleData = {
  id: 'placeholder',
  source: 'Replant Editorial',
  author: 'Replant Team',
  title: 'Three families, one basement.',
  body_md: `When the prohibition came down, the families thought it would last a fortnight. The gathering was small — fourteen adults and twenty children across three households — and the elders had agreed at the outset that whatever happened, the children would not be made to feel the weight of it. They would gather differently. They would gather at the same hour. They would not stop.

It has been nine months.

The basement is in the home of the oldest family. The wife asked us not to share the story of how they came to faith because, she said, the story is not finished and the parts that are finished she would like to keep. We respected that. What we can share is this: the gathering meets on Sunday mornings, the children sing the same songs they sang upstairs, the bread is unleavened because the wife learned to bake it when she was a girl, and the Word is read aloud in two languages so that the older saints and the younger families both hear it the way it first came to them.

We asked the husband what they had learned about the church in nine months of forbidden gathering. He thought for a long time. Then he said: we have learned that the church is the people, and the people are the room, and the room can be small.

When the prohibition is lifted — and they all believe it will be, eventually — the families plan to keep meeting in the basement. They have come to love it there.`,
  pull_quote: 'The body does not need permission to gather. It needs only courage and one room.',
  scripture_ref: 'Matthew 18:20',
  scripture_text: 'For where two or three are gathered in my name, there am I among them.',
};

export default function ArticleReaderScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { articleId } = route.params;
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (articleId === 'placeholder') {
        setArticle(PLACEHOLDER_ARTICLE);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc('get_article', {
        p_article_id: articleId,
      });
      if (!error && data && data.length > 0) {
        setArticle(data[0] as ArticleData);
      } else {
        setArticle(PLACEHOLDER_ARTICLE);
      }
      setLoading(false);
    })();
  }, [articleId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.leftEdge} pointerEvents="none" />
        <ReaderNavBar onBack={() => navigation.goBack()} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.red} />
        </View>
      </SafeAreaView>
    );
  }

  if (!article) return null;

  const paragraphs = article.body_md.split('\n\n').filter(Boolean);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.leftEdge} pointerEvents="none" />
      <ReaderNavBar onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Reader meta */}
        <View style={styles.meta}>
          <Text style={styles.metaSource}>
            {article.source} · <Text style={styles.metaAuthorSky}>{article.author}</Text>
          </Text>
          <Text style={styles.metaTitle} accessibilityRole="header">{article.title}</Text>
          <Text style={styles.metaRead}>6 min read</Text>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={styles.bodyParagraph} selectable={false}>{p}</Text>
          ))}

          {/* Pull quote */}
          {article.pull_quote && (
            <View accessible accessibilityHint="Pull quote" style={styles.pullQuote}>
              <Text style={styles.pullQuoteText}>{'"'}{article.pull_quote}{'"'}</Text>
            </View>
          )}
        </View>

        {/* Scripture footer */}
        {article.scripture_ref && article.scripture_text && (
          <View style={styles.scriptureFoot}>
            <Text style={styles.scriptureEyebrow}>WHERE TWO OR THREE</Text>
            <Text style={styles.scriptureVerse}>{article.scripture_text}</Text>
            <Text style={styles.scriptureRef}>{article.scripture_ref.toUpperCase()}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── NavBar for reader ──────────────────────────────────────────────
function ReaderNavBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.navbar}>
      <BackRow onPress={onBack} />
      <Text style={styles.navTitle}>Bear Witness</Text>
      <Text style={styles.navSubtitle}>AN EDITORIAL · HELD IN-APP</Text>
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

  // Meta
  meta: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
  },
  metaSource: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  metaAuthorSky: {
    color: Colors.accent,
  },
  metaTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 30,
    lineHeight: 35,
    color: Colors.text,
    marginBottom: 8,
  },
  metaRead: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 13,
    color: Colors.textMuted,
  },

  // Body — Typography.displayRegular (NOT italic) for long-form
  body: {
    paddingHorizontal: 22,
  },
  bodyParagraph: {
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    lineHeight: 27,
    color: CREAM,
    marginBottom: 18,
  },

  // Pull quote
  pullQuote: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.red,
    paddingLeft: 18,
    paddingVertical: 14,
    marginVertical: 18,
    backgroundColor: 'rgba(224,85,85,0.03)',
  },
  pullQuoteText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 22,
    lineHeight: 32,
    color: CREAM,
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
