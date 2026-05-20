// AuthProvider — KAN-87 foundation (AC-5) + SEC rework per ruling 11015
// (items #3 + #4).
//
// Single auth-status-check (KAN-44 deployed function id 68fceb12) on mount;
// re-fires on AppState 'active' to catch the lag window between deactivation
// and JWT expiry (per KAN-44 DBA 10924).
//
// SEC ruling 11015 #3 conditions:
//   (a) Network failure / 5xx must NOT log the user out. Only an actual 401
//       from auth-status-check (or any other Supabase endpoint via the
//       global fetch interceptor in supabase.ts) triggers clear-and-route.
//   (b) 30-second debounce on every auth-status-check trigger. lastCheckedAt
//       useRef holds the last completion time; entries within 30 s skip.
//   (c) Skip the check if no session exists locally (already short-circuited
//       at the call sites — initialize, onAuthStateChange, AppState handler
//       all check session presence first).
//
// SEC ruling 11015 #4 — ordered 401 clear-and-route:
//   (1) Abort any in-flight fetches carrying the dead JWT (AbortController
//       swapped per check, .abort() called first).
//   (2) Clear in-memory session (AuthProvider state).
//   (3) Clear persisted storage (supabase.auth.signOut → SecureStore adapter
//       removeItem → ciphertext + AES key both wiped).
//   (4) Navigate to Login (handled implicitly by RootNavigator's branch
//       transition once branch flips to "unauthenticated").
//
// Cross-endpoint 401 (KAN-44 ruling 10955 cross-ref): supabase.ts's global
// fetch interceptor emits via auth-events on any Supabase 401. AuthProvider
// subscribes via on401() at mount; same handler fires regardless of which
// endpoint surfaced the stale-JWT rejection.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { on401 } from "../lib/auth-events";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "../lib/supabase";

export type AuthBranch =
  | "loading"
  | "unauthenticated"
  | "active"
  | "pending"
  | "deactivated"
  | "password_recovery";

export interface AuthState {
  session: Session | null;
  branch: AuthBranch;
  verificationDeadline: string | null;
  daysRemaining: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
  // KAN-38 — used by SetNewPasswordScreen (Screen 06B) after success /
  // expired states to drop the recovery session and bounce the leader
  // back to Login via the unauthenticated branch.
  clearPasswordRecovery: () => Promise<void>;
}

interface AuthStatusResponse {
  verification_status: "active" | "pending" | "deactivated";
  verification_deadline: string | null;
  days_remaining: number | null;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

const FN_URL = `${SUPABASE_URL}/functions/v1/auth-status-check`;
const DEBOUNCE_MS = 30_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [branch, setBranch] = useState<AuthBranch>("loading");
  const [verificationDeadline, setVerificationDeadline] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const inFlight = useRef(false);
  const lastCheckedAt = useRef(0);                          // SEC 11015 #3b — debounce
  const abortControllerRef = useRef<AbortController | null>(null); // SEC 11015 #4 — abort
  const sessionRef = useRef<Session | null>(null);
  const cleared = useRef(false);                            // dedupe parallel 401 paths

  useEffect(() => { sessionRef.current = session; }, [session]);

  // SEC 11015 #4 — ordered clear-and-route.
  // (1) abort in-flight → (2) clear in-memory → (3) clear persisted →
  // (4) navigate (implicit via branch=unauthenticated).
  const performClearAndRoute = useCallback(async () => {
    if (cleared.current) return; // already running / just ran
    cleared.current = true;
    try {
      // (1) Abort any in-flight fetch carrying the dead JWT.
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // (2) Clear in-memory state.
      setSession(null);
      setBranch("unauthenticated");
      setVerificationDeadline(null);
      setDaysRemaining(null);
      // (3) Clear persisted storage (SecureStore adapter removeItem nukes
      //     both ciphertext + AES key). signOut also revokes refresh server-
      //     side. signOut errors don't block local clearing.
      await supabase.auth.signOut().catch(() => {});
    } finally {
      // Allow re-entry once the route flip has settled.
      setTimeout(() => { cleared.current = false; }, 1000);
    }
  }, []);

  const callAuthStatusCheck = useCallback(async (s: Session) => {
    // SEC 11015 #3b — 30s debounce.
    const now = Date.now();
    if (now - lastCheckedAt.current < DEBOUNCE_MS) {
      console.log(
        `[AuthProvider] skip auth-status-check — ${now - lastCheckedAt.current}ms since last (debounce ${DEBOUNCE_MS}ms)`,
      );
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;

    // Swap AbortController so the prior in-flight (if any) is canceled.
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      console.log("[AuthProvider] calling auth-status-check");
      const response = await fetch(FN_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${s.access_token}`,
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      console.log("[AuthProvider] auth-status-check responded:", response.status);

      lastCheckedAt.current = Date.now();

      if (response.status === 401) {
        // SEC 11015 #4 — only an actual 401 triggers clear-and-route.
        await performClearAndRoute();
        return;
      }

      if (!response.ok) {
        // SEC 11015 #3a — 5xx must NOT log out. Keep session, log, retry on
        // next AppState 'active' transition.
        console.warn(
          `[AuthProvider] auth-status-check non-OK ${response.status} — session retained, will retry on next active`,
        );
        return;
      }

      const data = (await response.json()) as AuthStatusResponse;
      setBranch(data.verification_status);
      setVerificationDeadline(data.verification_deadline);
      setDaysRemaining(data.days_remaining);
    } catch (err) {
      // AbortError fires when we replace the controller mid-flight — expected,
      // not a failure. Other errors are network failures (DNS, timeout, etc.)
      // and per SEC 11015 #3a must leave the session intact.
      if ((err as Error)?.name === "AbortError") return;
      console.warn(
        "[AuthProvider] auth-status-check network error — session retained, will retry on next active:",
        err,
      );
    } finally {
      inFlight.current = false;
    }
  }, [performClearAndRoute]);

  const initialize = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (!data.session) {
      // SEC 11015 #3c — no session, no check.
      setBranch("unauthenticated");
      setVerificationDeadline(null);
      setDaysRemaining(null);
      setLoading(false);
      return;
    }
    await callAuthStatusCheck(data.session);
    setLoading(false);
  }, [callAuthStatusCheck]);

  // Mount — read existing session + initial check. Subscribe to auth changes.
  useEffect(() => {
    void initialize();
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      // KAN-38 — PASSWORD_RECOVERY: deep-link token exchange landed.
      // Park the leader on the password_recovery branch with the
      // recovery session in scope so SetNewPasswordScreen can call
      // updateUser. Do NOT run auth-status-check — the leader is
      // mid-reset and is not "active" yet.
      if (event === "PASSWORD_RECOVERY") {
        setSession(newSession);
        setBranch("password_recovery");
        setVerificationDeadline(null);
        setDaysRemaining(null);
        return;
      }

      setSession(newSession);
      if (!newSession) {
        // SEC 11015 #3c — sign-out path; no session to check against.
        setBranch("unauthenticated");
        setVerificationDeadline(null);
        setDaysRemaining(null);
        return;
      }
      void callAuthStatusCheck(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, [callAuthStatusCheck, initialize]);

  // AppState 'active' re-verify (DBA 10924 lag-window catcher).
  // SEC 11015 #3c — short-circuit if no session.
  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      if (next !== "active") return;
      if (!sessionRef.current) return;
      void callAuthStatusCheck(sessionRef.current);
    };
    const sub = AppState.addEventListener("change", handler);
    return () => sub.remove();
  }, [callAuthStatusCheck]);

  // SEC 11015 #4 cross-endpoint coverage — listen for 401s emitted by the
  // global fetch interceptor in supabase.ts. Any Supabase project endpoint
  // returning 401 (REST, Storage, Realtime, Functions) triggers the same
  // ordered clear-and-route as a direct auth-status-check 401.
  useEffect(() => {
    return on401(() => { void performClearAndRoute(); });
  }, [performClearAndRoute]);

  // KAN-38 — SetNewPasswordScreen calls this on success / expired to drop
  // the recovery session and bounce back to Login. Implemented as the
  // same ordered clear-and-route SEC 11015 #4 uses for 401s.
  const clearPasswordRecovery = useCallback(async () => {
    await performClearAndRoute();
  }, [performClearAndRoute]);

  return (
    <AuthContext.Provider
      value={{
        session,
        branch,
        verificationDeadline,
        daysRemaining,
        loading,
        refresh: initialize,
        clearPasswordRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
