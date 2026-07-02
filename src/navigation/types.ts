// Navigator param-list types — KAN-87 foundation.
//
// RootStack switches between the auth-gated branches and the active app
// surface (Tabs + Settings). Each branch's Screens are conditionally
// registered in RootNavigator based on useAuth().branch — see
// src/navigation/RootNavigator.tsx. KAN-36 v2 removed the Deactivated
// branch; deactivation surfaces as a top-level modal overlay
// (src/components/auth/DeactivationModal.tsx), not a routed screen.

import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabsParamList = {
  Home: undefined;
  "The Church": undefined;
  Persecuted: undefined;
  "Prayer Wall": { initialView?: 'journal'; pendingChurch?: string } | undefined;
  Connect: { initialSubTab?: 'ministries' | 'leaders'; conversationId?: string } | undefined;
};

// MainStackParamList = the active-branch native-stack: Tabs + pushed screens.
// HeartcrySubmission is the KAN-64 form pushed from the Persecuted tab's
// "Share Your Heartcry" CTA; no tab bar visible while it's on top.
// Persecuted tab reader screens (pushed from pill tab scenes) — slide_from_right.
export type MainStackParamList = {
  Tabs: NavigatorScreenParams<TabsParamList>;
  Settings: undefined;
  HeartcrySubmission: undefined;
  // Persecuted tab readers (pushed from pill tab scenes)
  ArticleReader: { articleId: string };
  GuidanceReader: { slug: string };
  StoryArchive: undefined;
  WitnessArchive: undefined;
  // Hamburger sprint (CD v5 final, Founder-locked 2026-06-09) — four new
  // screens pushed from the Home-tab hamburger panel. TheVision / Outreach /
  // FAQ slide_from_right; InviteToReplant presents as a full-screen modal.
  TheVision: undefined;
  OutreachMissions: undefined;
  InviteToReplant: undefined;
  FAQ: undefined;
  // Underground one-shot reveal (2026-06-20). Founding leader of a verified
  // underground church taps through a 2-step gate to see the join code
  // exactly once. Presented full-screen, NON-DISMISSIBLE via gesture or
  // hardware back. Auto-routes from VerifiedTakeover on the Home tab when
  // auth-status-check returns underground_join_code_pending_reveal: true.
  // Per Founder ratification (override of original CD design): the route
  // is NOT forced — the FIRST screen in the JoinCodeReveal flow is a
  // pre-reveal "I'm somewhere private" gate that allows the leader to
  // cancel and come back later. Multi-session safe.
  JoinCodeReveal: undefined;
};

// RootStackParamList = the conditional union across all auth branches.
// Only one branch's screens are registered at a time per RootNavigator.
//
// KAN-10 (per SM ruling 11047, Path B) replaces the unauthenticated branch's
// Login placeholder with the Declaration of Faith screen. The post-affirm
// route now mounts the OnboardingNavigator (KAN-11/83/12 screens) as a
// nested stack rather than the AccountSetup1 placeholder. The Login route
// stays in the param list so KAN-38 can re-add it without a type-list churn.
export type RootStackParamList = MainStackParamList & {
  DeclarationOfFaith: undefined;
  Onboarding: undefined;
  Login: undefined;
  // KAN-35 (Founder ruling 2026-05-22): pending leaders now route into
  // the Tabs + Settings tree alongside active. PendingPlaceholderScreen
  // is deregistered from RootNavigator; the verification countdown banner
  // on Home replaces its functional purpose. Type entry removed too
  // since no other production code references it.
  PasswordRecovery: undefined;
};
