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
import * as SecureStore from "expo-secure-store";
import { on401 } from "../lib/auth-events";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "../lib/supabase";
import { signOutAndClear, PENDING_SIGNOUT_KEY } from "../utils/signOutAndClear";

// KAN-36 v2 (SEC c.14235 + Founder c.14236, locked 2026-05-24) — the
// "deactivated" branch was removed. Deactivation now surfaces as a modal
// overlay on the Login surface, not a routed Stack.Screen. AuthProvider
// triggers the modal AND calls signOut on detection, so the branch flips
// straight from active/pending/loading to unauthenticated and the user
// lands back on the login form behind the modal.
//
// Underground Verification Queue (manifest 2026-06-22) — two NEW
// branches derived from the auth-status-check `branch_substate` field
// (BE lane extends auth-status-check separately). FE consumes
// defensively: if the BE has not yet shipped the field, both default
// off and the leader sees the existing pending/active surface unchanged.
//
//   'request_info'  Admin has sent a question; the team is waiting on
//                   the leader. TheChurchScreen suppresses the
//                   verified-gate tiny-line ("This process may take up
//                   to 30 days…") because the wait is now on the
//                   leader's side. HomeScreen renders RequestInfoModal
//                   on launch.
//
//   'soft_deleted'  Verification could not be completed; record is in
//                   the 30-day soft-delete window. Leader can READ
//                   Home / Persecuted / Prayer Wall / Connect but
//                   cannot WRITE (RLS gates this server-side; the FE
//                   hides compose paths as defense-in-depth). The
//                   leader is NEVER logged out — every notice is
//                   revisitable from the Home outcome banner (§19).
export type AuthBranch =
  | "loading"
  | "unauthenticated"
  | "active"
  | "pending"
  | "password_recovery"
  | "request_info"
  | "soft_deleted";

// Mirrored from supabase/functions/auth-status-check/logic.ts; must stay
// in lockstep. KAN-36 v2 binary-only contract — no third value.
export type RecoveryPath = "verification_renewal" | "support_contact";

// Flow-gaps F4/G10 (2026-07-13) — mirrored from logic.ts. Closed enum
// selecting the Founder-ratified rejection lockout copy variant on the
// DeactivationModal. Present iff the deactivation cause is a rejection;
// recovery_path stays binary (c.14235 untouched). Held in memory only —
// never persisted to disk.
export type LockoutReason = "church_rejected" | "leader_rejected";

export interface AuthState {
  session: Session | null;
  branch: AuthBranch;
  verificationDeadline: string | null;
  daysRemaining: number | null;
  // Underground flow (2026-06-20). True iff auth-status-check returned
  // underground_join_code_pending_reveal: true on the most recent check.
  // Conditions are server-side (verified underground + founding leader +
  // not yet revealed). The FE surfaces the "code ready to view" prompt on
  // Home when this is true; tapping routes to the JoinCodeReveal screen.
  // Never advertised to non-underground viewers — the BE omits the field
  // entirely when false. We default to false here on a missing field.
  undergroundJoinCodePendingReveal: boolean;
  loading: boolean;
  // KAN-36 v2 — non-null when a deactivation modal is on screen. The
  // session has already been signed out by the time this is set (modal
  // is presented over the login surface, not over an authenticated
  // session). DeactivationModal reads this and renders the matching
  // copy variant; calls dismissDeactivationModal on tap-outside / tap-
  // contact / tap-elsewhere.
  deactivationModalPath: RecoveryPath | null;
  // Flow-gaps F4 (2026-07-13) — non-null only when the deactivation is a
  // rejection; DeactivationModal renders the ratified rejection copy for
  // the matching variant and falls back to the RecoveryPath variants when
  // null (old-server degradation is the generic copy, by design).
  deactivationLockoutReason: LockoutReason | null;
  dismissDeactivationModal: () => void;
  refresh: () => Promise<void>;
  // KAN-38 — used by SetNewPasswordScreen (Screen 06B) after success /
  // expired states to drop the recovery session and bounce the leader
  // back to Login via the unauthenticated branch.
  clearPasswordRecovery: () => Promise<void>;
  // KAN-42 — leader-invoked sign-out from SettingsScreen (and future
  // hamburger / deactivation popup call sites). Calls signOutAndClear
  // (which manages the pending_signout_revocation deferred-retry flag)
  // then runs the same ordered clear-and-route SEC 11015 #4 uses for 401s.
  signOut: () => Promise<void>;
  // B35 (KAN-12) — direct branch flip used by tryAutoSignIn in
  // AccountSetupPage2 to navigate the leader to Home immediately after
  // signInWithPassword resolves. See header at src/utils/
  // asp2OptimisticPending.ts for the SEC contract and threat model.
  // SEC ruling KAN-12 c.14155 (APPROVE WITH CONDITIONS) — new callers
  // require SEC review. Does NOT call initialize/refresh/
  // callAuthStatusCheck — those would re-introduce the inFlight
  // double-fire that PR #62 removed. onAuthStateChange-triggered
  // callAuthStatusCheck self-corrects to the real branch ~1-3s later.
  setOptimisticPending: () => void;
}

interface AuthStatusResponse {
  verification_status: "active" | "pending" | "deactivated";
  verification_deadline: string | null;
  days_remaining: number | null;
  // KAN-36 v2 — present iff verification_status === "deactivated". The
  // BE guarantees one of the two binary values; we default to
  // "support_contact" on a missing field so an unknown future-pre-v4
  // function deploy never surfaces "verification_renewal" by accident.
  recovery_path?: RecoveryPath;
  // Underground flow (2026-06-20). True iff caller is the founding leader
  // of a verified underground church AND the code hasn't been revealed
  // yet. Omitted from the response body when false (so non-underground
  // viewers never see the field). Default false in the consumer.
  underground_join_code_pending_reveal?: boolean;
  // Underground Verification Queue (manifest 2026-06-22) — BE lane
  // extends auth-status-check to return this field when the leader is in
  // one of the two sub-states the queue produces. Omitted in normal
  // active/pending responses. The FE maps it onto the AuthBranch:
  //   'request_info' → branch="request_info"
  //   'soft_deleted' → branch="soft_deleted"
  // Default undefined → fall through to verification_status as today.
  branch_substate?: "request_info" | "soft_deleted";
  // Flow-gaps F4 (2026-07-13) — present iff verification_status ===
  // "deactivated" AND the cause is a rejection. Omitted otherwise; the
  // consumer defaults to null (generic deactivated copy).
  lockout_reason?: LockoutReason;
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
  const [deactivationModalPath, setDeactivationModalPath] = useState<RecoveryPath | null>(null);
  // Flow-gaps F4 (2026-07-13) — rejection-copy selector; lives and dies
  // with deactivationModalPath (set together, cleared together).
  const [deactivationLockoutReason, setDeactivationLockoutReason] =
    useState<LockoutReason | null>(null);
  // Underground flow (2026-06-20) — see header on AuthState.
  const [undergroundJoinCodePendingReveal, setUndergroundJoinCodePendingReveal] =
    useState(false);

  const dismissDeactivationModal = useCallback(() => {
    setDeactivationModalPath(null);
    setDeactivationLockoutReason(null);
  }, []);

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
      setUndergroundJoinCodePendingReveal(false);
      // (3) Clear persisted storage (SecureStore adapter removeItem nukes
      //     both ciphertext + AES key). signOut also revokes refresh server-
      //     side. signOut errors don't block local clearing.
      await supabase.auth.signOut().catch(() => {});
    } finally {
      // Allow re-entry once the route flip has settled.
      setTimeout(() => { cleared.current = false; }, 1000);
    }
  }, []);

  // B14 — returns Promise<boolean> so initialize() can fall back to a
  // "pending" branch when the check 5xx'd (SEC 11015 #3a — session
  // retained, branch unchanged, but RootNavigator never flips on cold
  // start). `true` means "branch was set (or a recent debounced check
  // already set it)"; `false` means "branch left untouched, caller may
  // apply a fallback." onAuthStateChange / AppState callers ignore the
  // return value — the fallback is initialize-only.
  const callAuthStatusCheck = useCallback(async (s: Session): Promise<boolean> => {
    // SEC 11015 #3b — 30s debounce.
    const now = Date.now();
    if (now - lastCheckedAt.current < DEBOUNCE_MS) {
      console.log(
        `[AuthProvider] skip auth-status-check — ${now - lastCheckedAt.current}ms since last (debounce ${DEBOUNCE_MS}ms)`,
      );
      // A recent check already set the branch — no fallback needed.
      return true;
    }
    if (inFlight.current) return false;
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
        return false;
      }

      if (!response.ok) {
        // SEC 11015 #3a — 5xx must NOT log out. Keep session, log, retry on
        // next AppState 'active' transition.
        lastCheckedAt.current = 0; // reset so 3s retry is not debounced
        console.warn(
          `[AuthProvider] auth-status-check non-OK ${response.status} — session retained, will retry on next active`,
        );
        // B32 — one-time short-fuse retry 3s later. Replaces the
        // safety-net role refresh() used to play from tryAutoSignIn,
        // which created the inFlight double-fire that B30 had to gate
        // against. lastCheckedAt is reset to 0 on the non-ok path (line
        // above this comment), so the 30s debounce does not block this
        // retry. No signOut, no branch change — SEC 11015 #3a preserved;
        // this only retries the read.
        setTimeout(() => {
          if (sessionRef.current) void callAuthStatusCheck(sessionRef.current);
        }, 3_000);
        return false;
      }

      const data = (await response.json()) as AuthStatusResponse;
      if (data.verification_status === "deactivated") {
        // KAN-36 v2 (SEC c.14235 + Founder c.14236, locked 2026-05-24) —
        // surface as a modal on the Login surface, not as a routed branch.
        // The session must be cleared before the leader re-engages with
        // the login form; supabase.auth.signOut() fires SIGNED_OUT, which
        // the onAuthStateChange handler below flips to branch:
        // "unauthenticated". The modal stays mounted (top-level overlay
        // in App.tsx) until the leader dismisses it.
        //
        // recovery_path defaults to "support_contact" on a missing field
        // so a stale pre-v4 function deploy never surfaces the renewal
        // copy by accident. The BE contract guarantees one of the two
        // values when v4+ is live, but defending the FE here costs
        // nothing and preserves the conservative-on-unknown invariant.
        setDeactivationModalPath(data.recovery_path ?? "support_contact");
        // Flow-gaps F4 (2026-07-13) — rejection decoration. Missing field
        // (old server, non-rejection deactivation) → null → generic copy.
        setDeactivationLockoutReason(data.lockout_reason ?? null);
        setVerificationDeadline(null);
        setDaysRemaining(null);
        // KAN-36 bug fix — reset debounce so the leader's next sign-in
        // attempt gets a fresh auth-status-check. Without this, any
        // sign-in within 30s of the deactivated response is debounced,
        // callAuthStatusCheck returns early, setDeactivationModalPath
        // never fires, and the LoginScreen loading state stays stuck.
        // The user is being signed out here, so the next sign-in is
        // effectively a new session — the debounce window does not apply.
        lastCheckedAt.current = 0;
        await supabase.auth.signOut().catch(() => {
          // signOut errors don't block local clearing — onAuthStateChange
          // still fires SIGNED_OUT on the local SDK side, and any server
          // revocation failure surfaces on the next foreground/initialize
          // (no need to retry here).
        });
        return true;
      }
      // Underground Verification Queue (manifest 2026-06-22). When BE
      // surfaces a branch_substate, prefer it — it strictly narrows the
      // verification_status (the BE only sets it when the leader is in
      // one of the two sub-states). If absent, fall through to
      // verification_status. This keeps the FE forward-compatible:
      // when BE has not yet shipped the extension, the field is
      // undefined and behavior is unchanged.
      const resolvedBranch: AuthBranch =
        data.branch_substate === "request_info"
          ? "request_info"
          : data.branch_substate === "soft_deleted"
            ? "soft_deleted"
            : data.verification_status;
      setBranch(resolvedBranch);
      setVerificationDeadline(data.verification_deadline);
      setDaysRemaining(data.days_remaining);
      // A successful non-deactivated check clears any stale modal state —
      // e.g., a leader who got deactivated on one account dismissed the
      // modal, signed in with a working account, and now is active.
      setDeactivationModalPath(null);
      // Underground flow (2026-06-20) — BE omits the field when false.
      // Default false on missing/non-boolean.
      setUndergroundJoinCodePendingReveal(
        data.underground_join_code_pending_reveal === true,
      );
      return true;
    } catch (err) {
      // AbortError fires when we replace the controller mid-flight — expected,
      // not a failure. Other errors are network failures (DNS, timeout, etc.)
      // and per SEC 11015 #3a must leave the session intact.
      if ((err as Error)?.name === "AbortError") return false;
      console.warn(
        "[AuthProvider] auth-status-check network error — session retained, will retry on next active:",
        err,
      );
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [performClearAndRoute]);

  const initialize = useCallback(async () => {
    setLoading(true);
    // KAN-42 — deferred revocation retry. If a previous sign-out failed
    // server-side (offline), the flag persists across launches. Retry
    // now; ONLY delete the flag on a confirmed success so a still-offline
    // retry leaves the flag in place for the next foreground (AC #3-4).
    const pendingRevocation = await SecureStore.getItemAsync(PENDING_SIGNOUT_KEY).catch(() => null);
    if (pendingRevocation) {
      try {
        await supabase.auth.signOut();
        // Success — server-side revocation confirmed, flag can go.
        await SecureStore.deleteItemAsync(PENDING_SIGNOUT_KEY).catch(() => {});
      } catch {
        // Still offline — flag stays for next foreground retry.
      }
    }
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
    // B14 — capture the return value. If the check 5xx'd or hit a
    // network error, branch is still "loading" (or "unauthenticated"
    // from a prior clear); RootNavigator never flips to a real branch
    // and the leader sees a frozen splash on cold start. Fall back to
    // "pending" so the authenticated tree mounts; the next
    // AppState "active" / network-recovered check self-corrects to
    // the real status. SEC 11015 #3a honoured — no signOut, session
    // retained. Only initialize() applies this fallback;
    // onAuthStateChange + AppState handlers ignore the return value
    // because they fire on already-authenticated state where the
    // branch was already set on initialize().
    const branchSet = await callAuthStatusCheck(data.session);
    if (!branchSet) {
      console.warn(
        '[AuthProvider] initialize: auth-status-check did not set branch (5xx/network) — falling back to "pending"',
      );
      setBranch('pending');
    }
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
        setDeactivationModalPath(null);
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
      // initialize() owns the cold-start check — INITIAL_SESSION is the same
      // session getSession() returns, fired synchronously during subscription
      // setup. Calling callAuthStatusCheck here races with initialize()'s own
      // call and trips the inFlight guard, causing initialize() to fall back
      // to 'pending' and flash the verification banner for active leaders.
      if (event === "INITIAL_SESSION") return;
      // SIGNED_IN is a fresh credential presentation — the debounce does not
      // apply. TOKEN_REFRESHED and other events keep their debounce intact.
      // Without this reset, a leader who signs in within DEBOUNCE_MS of the
      // initialize() check (very common — initialize fires on mount, login
      // follows seconds later) trips the debounce inside
      // callAuthStatusCheck, returns early without setBranch, and the
      // RootNavigator never transitions off LoginScreen. Mirrors the same
      // pattern the deactivated branch uses before its re-check.
      if (event === "SIGNED_IN") {
        lastCheckedAt.current = 0;
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

  // KAN-42 — leader-invoked sign-out. signOutAndClear writes the
  // pending_signout_revocation flag, calls supabase.auth.signOut()
  // (local-first SDK; clears local session regardless of network
  // outcome), and clears the flag on success. performClearAndRoute
  // then runs the SEC 11015 #4 ordered abort + in-memory clear +
  // branch flip — its inner signOut() is a no-op here (already signed
  // out), but the abort + state-clear ordering matters.
  const signOut = useCallback(async () => {
    await signOutAndClear();
    await performClearAndRoute();
  }, [performClearAndRoute]);

  // ────────────────────────────────────────────────────────────────
  // B35 (KAN-12) — Optimistic branch flip for ASP2 skip-flow.
  //
  // SECURITY BOUNDARY:
  //   (a) Safety contract — new-account-only. Every freshly created
  //       account is provably `verification_status = 'pending'` on
  //       INSERT (BE-03 Step 5). This call sets the FE's `branch`
  //       state to "pending" so RootNavigator transitions to Home
  //       before the asynchronous callAuthStatusCheck completes,
  //       sealing the duplicate-tap race (B35).
  //   (b) Threat model reference — BE (RLS + auth-status-check) is the
  //       authoritative enforcement layer. This is a UI-only optimistic
  //       set; no access is granted by it. RLS still gates every
  //       read/write by the leader's real verification_status.
  //       auth-status-check (fired by onAuthStateChange after the
  //       signInWithPassword session lands) runs 1-3s later and
  //       overwrites this optimistic value with the server's truth.
  //   (c) Cross-reference — `supabase/functions/create-account/`
  //       guarantees `verification_status = 'pending'` on the
  //       public.users INSERT; the optimistic branch matches that
  //       guaranteed state. Cannot drift "active" or "deactivated"
  //       except via a subsequent auth-status-check correction.
  //   (d) FUTURE CALLERS REQUIRE SEC REVIEW. The caller-context guard
  //       at src/utils/asp2OptimisticPending.ts enforces Condition 1
  //       (type-checked CallerContext literal) — adding a new context
  //       value is a SEC-reviewable change.
  //
  // Touches `branch` ONLY. Does NOT touch session, verificationDeadline,
  // daysRemaining, or loading — those land via the subsequent
  // callAuthStatusCheck without a race. SEC 11015 #3a unaffected:
  // no signOut, no auth-state flush.
  //
  // SEC ruling: KAN-12 c.14155 (APPROVE WITH CONDITIONS).
  // ────────────────────────────────────────────────────────────────
  const setOptimisticPending = useCallback(() => {
    setBranch("pending");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        branch,
        verificationDeadline,
        daysRemaining,
        undergroundJoinCodePendingReveal,
        loading,
        deactivationModalPath,
        deactivationLockoutReason,
        dismissDeactivationModal,
        refresh: initialize,
        clearPasswordRecovery,
        signOut,
        setOptimisticPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
