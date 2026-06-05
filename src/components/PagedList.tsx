// PagedList — reusable paginated list with "← previous · X–Y of N · next →" footer.
// Extracted from PersecutedScreen feed pagination. Reusable on Prayer Wall.
// ROUND_SIZE items per page, mono typography, no button border.

import React, { useCallback, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../constants/theme';

const DEFAULT_ROUND_SIZE = 4;

interface PagedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactElement;
  keyExtractor: (item: T) => string;
  roundSize?: number;
  round: number;
  onRoundChange: (round: number) => void;
  ListHeaderComponent?: React.ReactElement;
  ListFooterComponent?: React.ReactElement;
}

export default function PagedList<T>({
  data,
  renderItem,
  keyExtractor,
  roundSize = DEFAULT_ROUND_SIZE,
  round,
  onRoundChange,
  ListHeaderComponent,
  ListFooterComponent,
}: PagedListProps<T>) {
  const listRef = useRef<FlatList>(null);
  const total = data.length;
  const totalRounds = Math.max(1, Math.ceil(total / roundSize));
  const start = round * roundSize;
  const end = Math.min(start + roundSize, total);
  const slice = data.slice(start, end);
  const isFirst = round === 0;
  const isLast = round >= totalRounds - 1;

  const goNext = useCallback(() => {
    if (!isLast) {
      onRoundChange(round + 1);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [isLast, onRoundChange, round]);

  const goPrev = useCallback(() => {
    if (!isFirst) {
      onRoundChange(round - 1);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [isFirst, onRoundChange, round]);

  const renderFooter = useCallback(() => (
    <View>
      {total > roundSize && (
        <View style={styles.roundNav}>
          <Pressable
            onPress={goPrev}
            disabled={isFirst}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.navLink}
          >
            <Svg width={8} height={8} viewBox="0 0 12 12" fill="none">
              <Path
                d="M8 2L4 6l4 4"
                stroke={isFirst ? Colors.textSubtle : Colors.accent}
                strokeWidth={1.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={[styles.navLinkText, isFirst ? styles.navDisabled : styles.navActive]}>
              previous
            </Text>
          </Pressable>

          <Text style={styles.navCount}>
            {start + 1}–{end} of {total}
          </Text>

          <Pressable
            onPress={goNext}
            disabled={isLast}
            accessibilityRole="button"
            accessibilityLabel="Next page"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.navLink}
          >
            <Text style={[styles.navLinkText, isLast ? styles.navDisabled : styles.navActive]}>
              next
            </Text>
            <Svg width={8} height={8} viewBox="0 0 12 12" fill="none">
              <Path
                d="M4 2l4 4-4 4"
                stroke={isLast ? Colors.textSubtle : Colors.accent}
                strokeWidth={1.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </View>
      )}
      {ListFooterComponent}
    </View>
  ), [total, roundSize, isFirst, isLast, start, end, goPrev, goNext, ListFooterComponent]);

  return (
    <FlatList
      ref={listRef}
      data={slice}
      renderItem={({ item, index }) => renderItem(item, index)}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={renderFooter()}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 28,
  },
  roundNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 22,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navLinkText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.0, // 0.10em × 10
  },
  navActive: {
    color: Colors.accent,
  },
  navDisabled: {
    color: Colors.textSubtle,
  },
  navCount: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.0,
    color: Colors.textMuted,
  },
});
