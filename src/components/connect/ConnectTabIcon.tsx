// ConnectTabIcon — KAN-68 §15.1.
//
// Wraps the bottom-tab `ConnectIcon` with a numeric unread badge that
// follows the iOS/Android native badge convention (red disc, white
// numerals, separation ring matching the bar background).
//
// We render the badge as a custom positioned overlay rather than
// using React Navigation's stock `tabBarBadge`, because the stock
// rendering can't deliver the exact §15.1 dimensions / colors /
// border treatment (it pulls platform defaults). The hit area is
// owned by React Navigation; we render visually on top.
//
// Hidden when the count is zero OR the leader has disabled the
// "New message badge" preference (§15.2 / `useNotifBadgeEnabled`).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ConnectIcon } from '../icons/TabIcons';
import { Colors, Typography } from '../../constants/theme';
// connect-polish-1 Fix E — consume the lifted badge state via Context.
// The hook itself lives in ConnectBadgeProvider (App.tsx) so there's
// only one Realtime channel + RPC fetcher across the whole app, and
// DMThreadView can refresh() the count on unmount.
import { useConnectBadge } from '../../contexts/ConnectBadgeContext';

interface Props {
  color: string;
}

export default function ConnectTabIcon({ color }: Props) {
  const { label, shown, count } = useConnectBadge();
  return (
    <View style={styles.wrap}>
      <ConnectIcon color={color} />
      {shown && label ? (
        <View
          style={styles.badge}
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            count === 1
              ? '1 unread message'
              : `${count > 99 ? '99 or more' : count} unread messages`
          }
        >
          <Text style={styles.badgeText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // The icon is 20×20; we don't expand the wrap or RN will resize
    // the touch target. Children outside the wrap's box still render
    // (default RN overflow: visible).
    width: 20,
    height: 20,
  },
  badge: {
    // §15.1 — top: -8, left: 10 relative to the 20×20 icon.
    position: 'absolute',
    top: -8,
    left: 10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.red,
    // 2px solid background-color ring — separates the badge from the
    // bar. boxSizing: border-box is implicit in RN.
    borderWidth: 2,
    borderColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10.5,
    lineHeight: 12,
    color: '#FFFFFF',
    // No letter spacing — the digits are short enough to read at this size.
  },
});
