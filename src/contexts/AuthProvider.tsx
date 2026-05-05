// AuthProvider — KAN-87 foundation (AC-5).
//
// Single auth-status-check (KAN-44 deployed function id 68fceb12) on mount;
// re-fires on AppState 'active' to catch the lag window between deactivation
// and JWT expiry (per KAN-44 DBA 10924). 401 path force-clears the session
// and routes to login; non-200 / 5xx routes to login defensively.
//
// Response contract is the locked KAN-44 shape (comment 10292): {
//   verification_status: 'active' | 'pending' | 'deactivated',
//   verification_deadline: string | null,
//   days_remaining: number | null
// }
//
// 'unauthenticated' is the FE-side branch used when there is no session OR
// the function returned 401. RootNavigator maps it to the AuthNavigator
// (login placeholder).

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
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "../lib/supabase";

export type AuthBranch =
  | "loading"
  | "unauthenticated"
  | "active"
  | "pending"
  | "deactivated";

export interface AuthState {
  session: Session | null;
  branch: AuthBranch;
  verificationDeadline: string | null;
  daysRemaining: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [branch, setBranch] = useState<AuthBranch>("loading");
  const [verificationDeadline, setVerificationDeadline] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);
  const sessionRef = useRef<Session | null>(null);

  // Keep sessionRef in sync — used by AppState handler without re-binding.
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const callAuthStatusCheck = useCallback(async (s: Session) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      console.log("[AuthProvider] calling auth-status-check at", FN_URL);
      const response = await fetch(FN_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${s.access_token}`,
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
      });
      console.log("[AuthProvider] auth-status-check responded:", response.status);

      if (response.status === 401) {
        // KAN-44 401 path — session invalid. Force-clear and route to login.
        await supabase.auth.signOut();
        setSession(null);
        setBranch("unauthenticated");
        setVerificationDeadline(null);
        setDaysRemaining(null);
        return;
      }

      if (!response.ok) {
        // 5xx — defensive: route to login. Future: surface a soft error.
        console.warn("[AuthProvider] non-OK auth-status-check:", response.status);
        setBranch("unauthenticated");
        return;
      }

      const data = (await response.json()) as AuthStatusResponse;
      setBranch(data.verification_status);
      setVerificationDeadline(data.verification_deadline);
      setDaysRemaining(data.days_remaining);
    } catch (err) {
      console.error("[AuthProvider] auth-status-check threw:", err);
      setBranch("unauthenticated");
    } finally {
      inFlight.current = false;
    }
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (!data.session) {
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setBranch("unauthenticated");
        setVerificationDeadline(null);
        setDaysRemaining(null);
        return;
      }
      void callAuthStatusCheck(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, [callAuthStatusCheck, initialize]);

  // Re-fire on AppState 'active' transition (DBA 10924 lag-window catcher).
  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      if (next === "active" && sessionRef.current) {
        void callAuthStatusCheck(sessionRef.current);
      }
    };
    const sub = AppState.addEventListener("change", handler);
    return () => sub.remove();
  }, [callAuthStatusCheck]);

  return (
    <AuthContext.Provider
      value={{ session, branch, verificationDeadline, daysRemaining, loading, refresh: initialize }}
    >
      {children}
    </AuthContext.Provider>
  );
}
