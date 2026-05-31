// App root — KAN-87 foundation (AC-3, AC-4).
//
// Order of operations on launch:
//   1. expo-splash-screen.preventAutoHideAsync() at module scope keeps the
//      native splash visible until fonts AND initial auth check resolve.
//   2. useFonts loads CormorantGaramond + DMSans .ttf modules from the
//      @expo-google-fonts packages (theme.fontModules). Family-name keys
//      match Typography string literals — Android-asymmetric fallback bug
//      is avoided per FE plan 10976 #5 / SM ruling 10977.
//   3. AuthProvider fires auth-status-check (KAN-44 deployed function id
//      68fceb12) and exposes { session, branch, … }.
//   4. AppGate hides the splash once both fonts AND initial auth are ready,
//      then mounts NavigationContainer + RootNavigator.
//   5. RootNavigator registers Screens based on auth branch (AC-5).

import * as SplashScreen from "expo-splash-screen";
SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op — preventAutoHideAsync may be called multiple times in dev hot-reload.
});

import React, { useEffect } from "react";
import { Linking, StatusBar, View } from "react-native";
import { useFonts, isLoaded as fontIsLoaded } from "expo-font";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/contexts/AuthProvider";
import { HamburgerProvider } from "./src/contexts/HamburgerContext";
import { ConnectBadgeProvider } from "./src/contexts/ConnectBadgeContext";
import HamburgerPanel from "./src/components/hamburger/HamburgerPanel";
import DeactivationModal from "./src/components/auth/DeactivationModal";
import RootNavigator from "./src/navigation/RootNavigator";
import { navigationRef } from "./src/navigation/navigationRef";
import { supabase } from "./src/lib/supabase";
import { Colors, fontModules, Typography } from "./src/constants/theme";

// KAN-38 — Extract the PKCE code from an incoming deep link URL.
// With PKCE flow, Supabase delivers a one-time code in the query string:
//   replant://reset-password?code=XXXX
// exchangeCodeForSession exchanges it server-side and fires PASSWORD_RECOVERY
// in onAuthStateChange → AuthProvider routes to the password_recovery branch.
async function handleDeepLink(url: string): Promise<void> {
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const code = new URLSearchParams(query).get('code');
  if (!code) return;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn('[DeepLink] exchangeCodeForSession failed:', error.message);
  }
  // On success: onAuthStateChange fires PASSWORD_RECOVERY →
  // AuthProvider sets branch = 'password_recovery' → RootNavigator mounts
  // SetNewPasswordScreen (Screen 06B). No further action needed here.
}

function AppGate() {
  const auth = useAuth();

  // KAN-38 — Deep-link listener for password recovery.
  // Warm start: app is open when leader taps the reset link.
  // Cold start: app launches fresh from the reset link.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleDeepLink(url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) void handleDeepLink(url);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!auth.loading) {
      // AC-11 runtime check — log Font.isLoaded() for each registered family
      // so the Metro log captures programmatic confirmation.
      console.log("[App] AC-11 Font.isLoaded checks:");
      for (const family of Object.keys(fontModules)) {
        console.log(`  ${family}: ${fontIsLoaded(family)}`);
      }
      console.log("[App] auth.branch resolved to:", auth.branch);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [auth.loading, auth.branch]);

  if (auth.loading) return <View style={{ flex: 1, backgroundColor: Colors.background }} />;

  return (
    <NavigationContainer ref={navigationRef}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, fontsError] = useFonts(fontModules);

  if (fontsError) {
    console.error("[App] font load error:", fontsError);
  }
  if (!fontsLoaded && !fontsError) {
    return null; // splash held by preventAutoHideAsync above
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <AuthProvider>
        <HamburgerProvider>
          {/* connect-polish-1 Fix E — ConnectBadgeProvider mounts the
              useConnectUnreadBadge hook ONCE for the whole app, inside
              AuthProvider (the hook calls useAuth) and outside
              NavigationContainer so the Realtime channel survives
              navigation tree changes. ConnectTabIcon + DMThreadView
              both consume via useConnectBadge — DMThreadView calls
              refresh() on unmount so the badge decrements immediately
              when a leader navigates out of a read thread. */}
          <ConnectBadgeProvider>
            <AppGate />
            {/* HamburgerPanel mounted as a sibling so its Modal overlay
                sits above NavigationContainer's tree on open. KAN-76. */}
            <HamburgerPanel />
            {/* KAN-36 v2 — DeactivationModal renders above the navigator
                when AuthProvider sets deactivationModalPath. AuthProvider
                also signs out on detection, so by the time this is
                visible the leader is on Login (unauthenticated branch). */}
            <DeactivationModal />
          </ConnectBadgeProvider>
        </HamburgerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// Force-include Typography import so theme.ts isn't tree-shaken; some bundlers
// drop modules whose only consumption is at type level.
void Typography;
