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
import { StatusBar, View } from "react-native";
import { useFonts, isLoaded as fontIsLoaded } from "expo-font";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/contexts/AuthProvider";
import RootNavigator from "./src/navigation/RootNavigator";
import { Colors, fontModules, Typography } from "./src/constants/theme";

function AppGate() {
  const auth = useAuth();

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
    <NavigationContainer>
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
        <AppGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// Force-include Typography import so theme.ts isn't tree-shaken; some bundlers
// drop modules whose only consumption is at type level.
void Typography;
