// RestoreScreen — KAN-205 sign-in-during-window restore prompt
// (CONTENT copy set §5; SEC design §2.4; Founder-ratified 2026-07-03).
//
// Mounted by RootNavigator as the ONLY screen when branch ===
// 'self_deleted' — NOT the tabs and NOT the rejection read-only shell.
// A leader who chose to leave should not wake up inside a read-only app;
// they get one quiet question: restore, or let the deletion finish.
//
// The prompt appears only AFTER successful password auth (auth-status-check
// returns the substate post-sign-in) — nothing pre-auth discloses that a
// deletable account exists (SEC §2.4 duress posture).
//
// Dates: users_select_own covers the leader's own soft-delete columns
// (verified live), so this screen reads soft_deleted_at +
// hard_delete_scheduled_at directly for the exact deleted-on /
// days-remaining rendering.
//
// One register for every account class — CONTENT §6 rules NO underground
// variant here ("§5 shows only after successful sign-in").
//
// Copy is VERBATIM from the ratified CONTENT file — do not rewrite.

import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthProvider';
import { wipeLocalAccountState } from '../../utils/wipeLocalAccountState';
import RpMark from '../../components/icons/RpMark';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const RESTORE_FAILED =
  "We couldn't restore your account. Write to accounts@projectreplant.org.";

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysRemaining(
  hardDeleteScheduledAt: string | null,
  softDeletedAt: string | null,
): number {
  // Prefer the authoritative schedule; fall back to the natural window.
  const target = hardDeleteScheduledAt
    ? Date.parse(hardDeleteScheduledAt)
    : softDeletedAt
      ? Date.parse(softDeletedAt) + 30 * 86_400_000
      : NaN;
  if (Number.isNaN(target)) return 0;
  const ms = target - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export default function RestoreScreen() {
  const { session, refresh, signOut, showGoodbye } = useAuth();
  const insets = useSafeAreaInsets();

  const [softDeletedAt, setSoftDeletedAt] = useState<string | null>(null);
  const [hardDeleteScheduledAt, setHardDeleteScheduledAt] = useState<string | null>(null);
  const [datesLoaded, setDatesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const busy = useRef(false);

  const authId = session?.user?.id ?? null;

  useEffect(() => {
    if (!authId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('soft_deleted_at, hard_delete_scheduled_at')
        .eq('auth_id', authId)
        .maybeSingle();
      if (cancelled) return;
      setSoftDeletedAt((data?.soft_deleted_at as string | null) ?? null);
      setHardDeleteScheduledAt(
        (data?.hard_delete_scheduled_at as string | null) ?? null,
      );
      setDatesLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authId]);

  const deletedOn = formatDate(softDeletedAt);
  const days = daysRemaining(hardDeleteScheduledAt, softDeletedAt);
  const dayWord = days === 1 ? 'day remains' : 'days remain';

  const handleRestore = async () => {
    if (busy.current) return;
    busy.current = true;
    setRestoring(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('fn_restore_my_account');
      if (rpcError) {
        // Window elapsed / admin-initiated / admin-expedited — every
        // refusal routes to a human (post-auth surface; one register).
        setError(RESTORE_FAILED);
        AccessibilityInfo.announceForAccessibility(RESTORE_FAILED);
        return;
      }
      setRestored(true);
      AccessibilityInfo.announceForAccessibility(
        'Restored. Your account is restored. Everything is as you left it.',
      );
      // Let the flash land, then re-run the status check — the branch
      // flips to active/pending and this screen unmounts.
      setTimeout(() => {
        void refresh();
      }, 1200);
    } catch {
      setError(GENERIC_ERROR);
      AccessibilityInfo.announceForAccessibility(GENERIC_ERROR);
    } finally {
      setRestoring(false);
      busy.current = false;
    }
  };

  const handleContinueDeletion = () => {
    if (busy.current || leaving) return;
    busy.current = true;
    // CONTENT §5 — the sign-out line shows briefly before returning to
    // the goodbye state over Login.
    setLeaving(true);
    AccessibilityInfo.announceForAccessibility(
      `Deletion continues. ${days} ${dayWord}, and the door stays open until then.`,
    );
    setTimeout(() => {
      void (async () => {
        showGoodbye();
        await wipeLocalAccountState();
        await signOut();
      })();
    }, 1800);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.markWrap}>
        <RpMark size={44} />
      </View>

      <View style={styles.content}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowHairline} />
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <View style={styles.eyebrowHairline} />
        </View>

        <Text style={styles.title} accessibilityRole="header">
          Your account is waiting.
        </Text>

        {!datesLoaded ? (
          <ActivityIndicator
            size="small"
            color={Colors.accent}
            style={styles.loading}
          />
        ) : restored ? (
          <>
            <Text style={styles.restoredFlash}>Restored</Text>
            <Text style={styles.body}>
              Your account is restored. Everything is as you left it.
            </Text>
          </>
        ) : leaving ? (
          <Text style={styles.body}>
            Deletion continues. {days} {dayWord}, and the door stays open until
            then.
          </Text>
        ) : (
          <>
            <Text style={styles.body}>
              {deletedOn
                ? `On ${deletedOn} you asked us to delete this account. `
                : 'You asked us to delete this account. '}
              {days} {dayWord} before that becomes permanent. You can restore
              everything as you left it, or let the deletion finish.
            </Text>

            {error && (
              <Text
                style={styles.errorText}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, restoring && styles.buttonDisabled]}
              onPress={() => void handleRestore()}
              disabled={restoring}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Restore my account"
              accessibilityState={{ disabled: restoring, busy: restoring }}
            >
              {restoring ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Text style={styles.primaryButtonText}>Restore my account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quietButton}
              onPress={handleContinueDeletion}
              disabled={restoring}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Continue with deletion"
              accessibilityState={{ disabled: restoring }}
            >
              <Text style={styles.quietButtonText}>Continue with deletion</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 32,
  },
  markWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 96,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  eyebrowHairline: {
    width: 16,
    height: 0.5,
    backgroundColor: 'rgba(107, 181, 232, 0.35)',
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 18,
  },
  loading: {
    marginTop: 12,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: 'rgba(240, 237, 230, 0.65)',
    lineHeight: 24,
    textAlign: 'center',
  },
  restoredFlash: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.2,
    color: Colors.accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.red,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  primaryButton: {
    marginTop: 30,
    borderWidth: 0.5,
    borderColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(107, 181, 232, 0.10)',
  },
  primaryButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.accent,
    letterSpacing: 0.2,
  },
  quietButton: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quietButtonText: {
    fontFamily: Typography.body,
    fontSize: 13.5,
    color: 'rgba(224, 85, 85, 0.75)',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
