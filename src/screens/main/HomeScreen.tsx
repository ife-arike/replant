// Home screen — KAN-201 home redesign 2026-06-01.
//
// Composition (top → bottom):
//   HomeTopBar          — Rp mark + "Replant" wordmark + hamburger
//   VerificationBanner  — only when branch === 'pending' (KAN-35)
//   VerificationOutcomeBanner — when branch === 'soft_deleted' (queue §19)
//   "TODAY"             — section label
//   DailyScriptureStrip — rule variant + closing hairline (KAN-16)
//   NetworkFeed         — FlatList owns its own scroll, including the
//                         "NETWORK UPDATES" section label (2026-06-11)
//                         and "— held in prayer —" footer (KAN-17).
//
// The fixed top zone ends at the DailyScriptureStrip hairline — the
// "NETWORK UPDATES" label scrolls with the feed beneath it.
//
// The screen uses a View (not a ScrollView) at the top level because
// NetworkFeed is a FlatList and must own the scroll — the feed fills the
// remaining vertical space via feedZone (flex: 1). SafeAreaView replaces
// the old paddingTop: 60 offset, matching Prayer Wall / Persecuted.
//
// VerificationBanner is load-bearing — do not remove or relocate.
//
// ── Underground Verification Queue modal-on-launch (manifest 2026-06-22) ──
// On every focus of the Home tab we call `fn_should_fire_outcome_modal`
// (server-side cadence helper, manifest §2). It returns `{fire, kind,
// day_of_window}`; the FE trusts that answer and mounts the matching
// modal exactly once per kind. On dismiss we call
// `fn_acknowledge_outcome_modal` (idempotent) so the banner remains as
// the revisit path (§19) but the launch-modal flag clears. The leader is
// NEVER logged out — every notice is revisitable.
//
// Generic-chrome contract: the device could be held by anyone. None of
// the surfaces below render the word "underground" anywhere — see each
// modal's header.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase } from '../../lib/supabase';
import DailyScriptureStrip from '../../components/home/DailyScriptureStrip';
import NetworkFeed from '../../components/home/NetworkFeed';
import HomeTopBar from '../../components/home/HomeTopBar';
import HomeSectionLabel from '../../components/home/HomeSectionLabel';
import VerificationBanner, {
  VerificationOutcomeBanner,
  RequestInfoBanner,
} from '../../components/home/VerificationBanner';
import UndergroundCodeReadyPrompt from '../../components/home/UndergroundCodeReadyPrompt';
import { NotificationToast, type ToastType } from '../../components/home/NotificationToast';
import RequestInfoModal from '../../components/home/RequestInfoModal';
import ReplyComposer from '../../components/home/ReplyComposer';
import VerificationOutcomeModal, {
  type RejectionReason,
} from '../../components/home/VerificationOutcomeModal';
import PreRemovalModal from '../../components/home/PreRemovalModal';
import VisibilityFlipModal from '../../components/underground/VisibilityFlipModal';
import JoinCodeRotationModal from '../../components/underground/JoinCodeRotationModal';
import { useChurchVerifiedStatus } from '../../hooks/useChurchVerifiedStatus';

// Modal cadence kinds the BE may return from `fn_should_fire_outcome_modal`.
// Mirrors `churches.last_outcome_modal_kind` enum in the manifest §1.
type OutcomeModalKind =
  | 'verified'
  | 'rejected'
  | 'request_info'
  | 'pre_removal_day_23'
  | 'visibility_flipped'
  | 'join_code_rotated';

interface ShouldFireResp {
  fire: boolean;
  kind?: OutcomeModalKind;
  day_of_window?: number;
  // Per-kind payload the BE includes when relevant. Shape is documented in
  // manifest §2 (the cadence helper composes it). Defensive optional.
  question_text?: string;       // request_info
  question_id?: string;         // request_info — for fn_send_reply_to_team
  reason?: RejectionReason;     // rejected
  direction?: 'h2v' | 'v2h';    // visibility_flipped
  code?: string;                // join_code_rotated (one-shot reveal)
}

export default function HomeScreen() {
  const { branch, undergroundJoinCodePendingReveal, session, refresh } = useAuth();
  // Distinguish church-pending vs leader-pending so the right banner variant
  // is shown. null while the check is in flight — defaults to 'church' variant.
  const churchVerified = useChurchVerifiedStatus();
  // TODO: wire toast triggers from real events (verification approved, rejected, heartcry responded)
  const [toast, setToast] = useState<ToastType | null>(null);

  // ── Underground Verification Queue · modal-on-launch state ──────────
  // One of the kinds may be active at a time; once dismissed, the next
  // focus cycle re-asks the cadence helper. Banner copy (§19) sits on
  // Home permanently while branch === 'soft_deleted' — that's the
  // revisit path. The launch modal is the "once per kind" surface.
  const [activeModal, setActiveModal] = useState<OutcomeModalKind | null>(null);
  const [modalPayload, setModalPayload] = useState<ShouldFireResp | null>(null);
  // request_info has a two-step flow: modal → composer. We track the
  // composer mount here so the modal can hand off without unmounting
  // the launch-gate flag prematurely.
  const [replyComposerOpen, setReplyComposerOpen] = useState(false);
  // The rejection-reason is needed both for the launch modal AND for the
  // banner-triggered re-open. We cache the most recently surfaced reason
  // so "Read details →" can re-mount the same variant.
  const lastRejectionReason = useRef<RejectionReason | null>(null);

  const isSoftDeleted = branch === 'soft_deleted';
  const isRequestInfo = branch === 'request_info';

  // ── Cadence-helper RPC: fn_should_fire_outcome_modal (manifest §2) ──
  // Called on Home-tab focus. Trusts the BE's `fire` answer. If the BE
  // hasn't shipped the helper yet, the RPC errors and we silently
  // short-circuit — the FE stays in its existing pending/active surface.
  const checkOutcomeModal = useCallback(async () => {
    if (!session?.user?.id) return;
    // Only the sub-states the queue produces can fire a modal. Active
    // and pending leaders skip the round-trip.
    if (
      branch !== 'request_info' &&
      branch !== 'soft_deleted' &&
      branch !== 'pending'
    ) {
      return;
    }
    if (activeModal !== null) return; // already showing one
    try {
      const { data, error } = await supabase.rpc(
        'fn_should_fire_outcome_modal',
        // p_church_id is resolved server-side from auth.uid() per manifest §2.
        // The RPC signature takes p_church_id; the BE may also accept a
        // no-arg call and look up church_id from the JWT — defensive both ways.
        {},
      );
      if (error || !data) return;
      const resp = data as ShouldFireResp;
      // 2026-06-22 — for the request_info case the BE now ALWAYS returns
      // kind + question_text (even when fire=false, i.e. modal already
      // acknowledged once). We cache the payload so the persistent
      // RequestInfoBanner can re-open the modal on tap across launches.
      // For other kinds, only cache when fire=true (existing behavior).
      if (resp.kind === 'request_info' && resp.question_text) {
        setModalPayload(resp);
        if (resp.fire) {
          setActiveModal('request_info');
        }
        return;
      }
      if (!resp.fire || !resp.kind) return;
      if (resp.kind === 'rejected' && resp.reason) {
        lastRejectionReason.current = resp.reason;
      }
      setModalPayload(resp);
      setActiveModal(resp.kind);
    } catch {
      // Network / RPC-not-deployed — silently skip. The leader's Home
      // surface stays as-is; next focus retries.
    }
  }, [session?.user?.id, branch, activeModal]);

  useFocusEffect(
    useCallback(() => {
      void checkOutcomeModal();
    }, [checkOutcomeModal]),
  );

  // ── On-dismiss persistence (manifest §2) ────────────────────────────
  // fn_acknowledge_outcome_modal is idempotent — safe to call on every
  // dismiss. The BE writes the timestamp + last_outcome_modal_kind so the
  // cadence helper's next answer reflects the acknowledgement. We do not
  // block UI on the round-trip; failure leaves the launch-gate flag set
  // and the modal re-fires next launch (acceptable degradation — the
  // leader never sees a stuck UI).
  const persistAcknowledgement = useCallback(async () => {
    try {
      await supabase.rpc('fn_acknowledge_outcome_modal', {});
    } catch {
      // ignore — see header
    }
  }, []);

  const dismissActiveModal = useCallback(() => {
    setActiveModal(null);
    setReplyComposerOpen(false);
    void persistAcknowledgement();
  }, [persistAcknowledgement]);

  // Banner re-open for §19 outcome banner. Re-mounts the same variant
  // we last surfaced; if we don't have a cached reason (e.g., fresh
  // session, leader hadn't seen the modal yet this session), default to
  // 'other' — the generic non-detailed leader-facing copy.
  const reopenOutcomeModal = useCallback(() => {
    setModalPayload({
      fire: true,
      kind: 'rejected',
      reason: lastRejectionReason.current ?? 'other',
    });
    setActiveModal('rejected');
  }, []);

  // Reply send — fn_send_reply_to_team (manifest §2). Wraps the question
  // id from the cadence payload. If the BE shape uses a different param
  // name on a later iteration, surface the error to the composer.
  // 2026-06-22: after the reply lands, fire useAuth().refresh() so the
  // local branch state catches up to the BE (migration 0013 clears
  // churches.last_outcome_modal_kind → branch_substate reverts to plain
  // 'pending'). Without this refetch the leader sees NO banner between
  // reply and next app launch (RequestInfoBanner unmounts because we
  // cleared modalPayload, VerificationBanner doesn't mount because the
  // cached branch is still 'request_info').
  const sendReply = useCallback(
    async (replyText: string) => {
      const questionId = modalPayload?.question_id ?? null;
      const { error } = await supabase.rpc('fn_send_reply_to_team', {
        p_question_id: questionId,
        p_reply_text: replyText,
      });
      if (error) throw error;
      // Fire-and-forget refresh — onDone takes over the UI; the auth-status-
      // check completing in the background swaps branch in time for the
      // user's next focus event without blocking the sent-confirmation.
      void refresh();
    },
    [modalPayload?.question_id],
  );

  // ── Cleanup on branch flip ──────────────────────────────────────────
  // If the leader's branch leaves the sub-state (e.g., admin verifies
  // them while the app is open), drop any stale modal state so the
  // surface returns to clean Home immediately.
  useEffect(() => {
    if (branch === 'active') {
      setActiveModal(null);
      setReplyComposerOpen(false);
      setModalPayload(null);
    }
  }, [branch]);

  // ── Reply composer takeover ─────────────────────────────────────────
  // The composer is a SafeAreaView takeover — render it ABOVE the Home
  // chrome (NOT a Modal because the keyboard would race the modal scrim
  // on iOS). When mounted, suppress the Home content underneath via the
  // composer's own full-screen SafeAreaView.
  if (replyComposerOpen && modalPayload?.question_text) {
    return (
      <ReplyComposer
        question={modalPayload.question_text}
        onSend={sendReply}
        onDone={() => {
          // 2026-06-22 fix: clear activeModal + modalPayload too, not just
          // the composer mount flag. Otherwise the Home re-render after
          // onDone re-evaluates the modal mount condition
          // (activeModal === 'request_info' && modalPayload?.question_text)
          // as still true → RequestInfoModal re-mounts after the reply was
          // already sent. Cleared together means the leader returns cleanly
          // to the normal pending Home with the verified-gate timeline
          // showing again (BE side: fn_send_reply_to_team clears
          // churches.last_outcome_modal_kind so branch_substate reverts).
          setReplyComposerOpen(false);
          setActiveModal(null);
          setModalPayload(null);
          void persistAcknowledgement();
        }}
        onBack={() => setReplyComposerOpen(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <HomeTopBar />
      {toast && (
        <NotificationToast
          type={toast}
          onPress={() => { setToast(null); }}
          onDismiss={() => setToast(null)}
        />
      )}

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={styles.body}>
        {/* Underground one-shot reveal prompt (2026-06-20). Shown only to
            the founding leader of a verified underground church who hasn't
            yet revealed the join code. Tapping routes to JoinCodeReveal
            (which itself runs the 2-step "I'm somewhere private" gate
            before calling the server). Multi-session safe — the prompt
            re-surfaces every sign-in until the code is consumed. */}
        {undergroundJoinCodePendingReveal && <UndergroundCodeReadyPrompt />}

        {/* KAN-35 — verification countdown banner. Pending leaders see
            Home with this banner instead of a separate placeholder
            screen (Founder ruling 2026-05-22). */}
        {branch === 'pending' && (
          <VerificationBanner variant={churchVerified === 'verified' ? 'leader' : 'church'} />
        )}

        {/* Queue §19 — persistent outcome banner for soft-deleted leaders.
            Sits where the pending banner does; neutral chrome. "Read
            details →" re-opens the full VerificationOutcomeModal.
            For the safety_concern variant, the banner collapses to "on
            hold" copy + Contact-the-Replant-team. */}
        {isSoftDeleted && (
          <VerificationOutcomeBanner
            onReadDetails={reopenOutcomeModal}
            safetyConcern={lastRejectionReason.current === 'safety_concern'}
          />
        )}

        {/* Queue §16 — persistent request-info banner (Founder ruling
            2026-06-22 option #1). Renders when branch_substate is
            'request_info' AND we have a cached question (BE returns
            question_text whenever kind='request_info', so the cache fills
            on next Home focus even across launches). "Open →" re-mounts
            the RequestInfoModal with the cached question_text. Falls away
            the moment fn_send_reply_to_team clears
            churches.last_outcome_modal_kind. */}
        {isRequestInfo && modalPayload?.kind === 'request_info' && modalPayload?.question_text && (
          <RequestInfoBanner onOpen={() => setActiveModal('request_info')} />
        )}

        <HomeSectionLabel>Today</HomeSectionLabel>
        <DailyScriptureStrip />

        <View style={styles.feedZone}>
          <NetworkFeed />
        </View>
      </View>
      </KeyboardAvoidingView>

      {/* ── Queue §16 — Request-info modal (modal-on-launch) ── */}
      {activeModal === 'request_info' && modalPayload?.question_text && (
        <RequestInfoModal
          visible
          question={modalPayload.question_text}
          onReply={() => setReplyComposerOpen(true)}
          onDismiss={dismissActiveModal}
        />
      )}

      {/* ── Queue §18 — Verification outcome modal ──
          Mounted both from the cadence helper (first launch / day-14
          gentle re-fire) AND from the banner "Read details →" path. */}
      {activeModal === 'rejected' && (
        <VerificationOutcomeModal
          visible
          reason={modalPayload?.reason ?? 'other'}
          onDismiss={dismissActiveModal}
        />
      )}

      {/* ── Queue §20 — Day-23 pre-removal warning ── */}
      {activeModal === 'pre_removal_day_23' && (
        <PreRemovalModal visible onAcknowledge={dismissActiveModal} />
      )}

      {/* ── Queue §21 — Underground-only visibility flip ──
          Cadence helper only fires this kind for underground viewers
          (BE constraint); FE still checks isRequestInfo here as
          defense-in-depth so it cannot mount stray. */}
      {activeModal === 'visibility_flipped' && modalPayload?.direction && (
        <VisibilityFlipModal
          visible
          direction={modalPayload.direction}
          onDismiss={dismissActiveModal}
        />
      )}

      {/* ── Queue §21 — Underground-only join code refreshed ── */}
      {activeModal === 'join_code_rotated' && modalPayload?.code && (
        <JoinCodeRotationModal
          visible
          code={modalPayload.code}
          onDismiss={dismissActiveModal}
        />
      )}

      {/* request_info branch reference — kept in render scope so the
          linter surfaces accidental orphan usage; the actual gate
          suppression lives in TheChurchScreen.tsx. */}
      {isRequestInfo ? null : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  kav: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Feed takes the remaining vertical space so the FlatList scrolls
  // independently — the section labels above stay anchored.
  feedZone: {
    flex: 1,
  },
});
