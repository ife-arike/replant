// ConnectBadgeContext — connect-polish-1 Fix E.
//
// Lifts useConnectUnreadBadge into a single Provider so its returned
// state (count, label, shown) AND its `refresh` callback are shared
// by every consumer. Before this provider existed, ConnectTabIcon
// instantiated the hook directly — meaning the Realtime channel + RPC
// fetches lived inside the tab icon's tree, with no way for surfaces
// in another part of the tree (DMThreadView) to trigger a refresh.
//
// Architecturally: BadgeProvider mounts ONCE per app, inside
// AuthProvider (the hook calls useAuth) and outside NavigationContainer
// so it survives navigation tree mutations. Consumers are pure readers
// of Context — no child-sets-parent flow.
//
// Why a refresh is needed at all: `conversations` is NOT in the
// supabase_realtime publication (KAN-216 schema-facts). Calls to
// `mark_conversation_read` write to conversations.last_read_at_x but
// fire no Realtime event. The badge would otherwise only catch up on
// the next `messages INSERT`, leaving a stale count between read and
// next-message. DMThreadView calls refresh() on unmount so the badge
// decrement is immediate.
//
// Acknowledged: gating DMThreadView's refresh() on initialFetchComplete
// is approximate — an errored initial load (no mark_conversation_read
// fired) will still trigger refresh(). That's a single extra cheap RPC
// returning the same count; not a correctness issue.

import React, { createContext, useContext, useMemo } from 'react';
import {
  useConnectUnreadBadge,
  type ConnectUnreadBadge,
} from '../hooks/useConnectUnreadBadge';

// Inert default so a consumer mounted outside the Provider gets
// reasonable zeros instead of throwing. The shown flag is false so no
// UI fires. refresh is a no-op resolving Promise so call sites don't
// need null-checks.
const DEFAULT: ConnectUnreadBadge = {
  count: 0,
  label: undefined,
  shown: false,
  refresh: async () => undefined,
};

const ConnectBadgeContext = createContext<ConnectUnreadBadge>(DEFAULT);

export function ConnectBadgeProvider({ children }: { children: React.ReactNode }) {
  // Single hook instance for the whole app. Returns a fresh value object
  // on each render of the Provider; memoise so consumers reading via
  // useContext don't re-render on object identity churn unless one of
  // the inner fields actually changed.
  const badge = useConnectUnreadBadge();
  const value = useMemo<ConnectUnreadBadge>(
    () => ({
      count: badge.count,
      label: badge.label,
      shown: badge.shown,
      refresh: badge.refresh,
    }),
    [badge.count, badge.label, badge.shown, badge.refresh],
  );
  return (
    <ConnectBadgeContext.Provider value={value}>
      {children}
    </ConnectBadgeContext.Provider>
  );
}

// useConnectBadge — consumer hook. Returns the same shape as
// useConnectUnreadBadge so any prior call site can swap one for the
// other. Consumers must be inside ConnectBadgeProvider; outside the
// provider they get the inert default (count: 0, refresh: no-op).
export function useConnectBadge(): ConnectUnreadBadge {
  return useContext(ConnectBadgeContext);
}
