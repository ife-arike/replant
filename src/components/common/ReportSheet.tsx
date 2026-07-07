// KAN-304 — Report to the Replant team.
//
// One sheet, six UGC surfaces (DM message, branch message, prayer, testimony,
// comment, church profile). Reachable from each surface's entry affordance
// ("Report this message/prayer/…"). Copy is VERBATIM from the CONTENT lane.
//
// ── Load-bearing behaviour ──
//   • Reporter protection (SEC §1.3; register §C invariant 3 — seized-device
//     test): this component stores NOTHING about what was reported. The only
//     "already reported" memory is an in-SESSION Set held by the PARENT and
//     passed in via `alreadyReportedKeys`; it is never persisted and never
//     derived from a server signal.
//   • Uniform outcome: submitReport returns {ok} | rate_limited | error only.
//     The confirmation is shown for {ok} whether the report was new or a
//     duplicate the server deduped — the client cannot tell (anti-oracle).
//   • The sheet renders exactly the attribution already on screen — it accepts
//     no author identity and resolves none (SEC §3.3a); masked stays masked.
//   • A11y (KAN-315 bar): accessibilityViewIsModal on the sheet; every control
//     labelled/roled/stated; reason rows are a labelled radio group; the free
//     text input is labelled; confirmation/rate/already/error states announce
//     via accessibilityLiveRegion="polite" + role="alert" (LoginScreen pattern).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import {
  type ReportReason,
  type ReportSurface,
  submitReport,
} from '../../api/reports';

const ANIM_MS = 220;
const DETAIL_MAX = 500;

// ── Reason catalog (CONTENT §2, verbatim). Order + applicability per §3. ──
interface ReasonDef {
  code: ReportReason;
  label: string;
  desc: string;
}

// Canonical wording (church-profile overrides R4 label/desc — see below).
const REASONS: Record<ReportReason, ReasonDef> = {
  locate_identify: {
    code: 'locate_identify',
    label: 'Trying to find out who or where someone is',
    desc: 'Pressing for names, locations, or meeting places',
  },
  threats: {
    code: 'threats',
    label: 'Threats, or someone may be unsafe',
    desc: 'Someone is being threatened or could be in danger',
  },
  asking_for_money: {
    code: 'asking_for_money',
    label: 'Asking for money',
    desc: 'Pressure to send money, gifts, or support',
  },
  impersonation: {
    code: 'impersonation',
    label: "Pretending to be someone they're not",
    desc: 'A false name, church, or role',
  },
  false_teaching: {
    code: 'false_teaching',
    label: 'False teaching or spiritual manipulation',
    desc: 'Misusing Scripture or spiritual authority to control',
  },
  spam: {
    code: 'spam',
    label: 'Spam',
    desc: 'Unwanted promotion or repeated messages',
  },
  wellbeing_concern: {
    code: 'wellbeing_concern',
    label: "I'm concerned for this person's safety or wellbeing",
    desc: 'They may be struggling or in distress',
  },
  something_else: {
    code: 'something_else',
    label: 'Something else',
    desc: 'Anything not listed here',
  },
};

// Church-profile R4 variant copy (CONTENT §3: "Not a real church or
// misrepresenting itself.").
const CHURCH_IMPERSONATION: ReasonDef = {
  code: 'impersonation',
  label: 'Not a real church or misrepresenting itself',
  desc: 'A false name, or claiming to be something it is not',
};

// Per-surface reason ORDER (CONTENT §3 ordering + applicability matrix):
//   Thread surfaces (DM, branch): safety first.
//   Content surfaces (prayer, testimony, comment): concern-shaped lead.
//   Church profile: identity-fraud lead; no threats/false-teaching/wellbeing.
const SURFACE_REASONS: Record<ReportSurface, ReportReason[]> = {
  dm_message: [
    'locate_identify', 'threats', 'asking_for_money', 'impersonation',
    'false_teaching', 'spam', 'wellbeing_concern', 'something_else',
  ],
  branch_message: [
    'locate_identify', 'threats', 'asking_for_money', 'impersonation',
    'false_teaching', 'spam', 'wellbeing_concern', 'something_else',
  ],
  prayer_request: [
    'wellbeing_concern', 'threats', 'locate_identify', 'asking_for_money',
    'impersonation', 'false_teaching', 'spam', 'something_else',
  ],
  testimony: [
    'wellbeing_concern', 'threats', 'locate_identify', 'asking_for_money',
    'impersonation', 'false_teaching', 'spam', 'something_else',
  ],
  comment: [
    'wellbeing_concern', 'threats', 'locate_identify', 'asking_for_money',
    'impersonation', 'false_teaching', 'spam', 'something_else',
  ],
  church_profile: [
    'impersonation', 'asking_for_money', 'locate_identify', 'spam',
    'something_else',
  ],
};

// Per-surface object noun for the entry-affordance label + sheet cross-ref.
export const SURFACE_NOUN: Record<ReportSurface, string> = {
  dm_message: 'message',
  branch_message: 'message',
  prayer_request: 'prayer',
  testimony: 'testimony',
  comment: 'comment',
  church_profile: 'church profile',
};

/**
 * Stable in-session key for the already-reported hint. The PARENT owns the Set
 * and never persists it (seized-device test). Not derived from any server state.
 */
export function reportKey(surface: ReportSurface, targetId: string): string {
  return `${surface}:${targetId}`;
}

type SheetView = 'form' | 'confirmation' | 'rate_limited' | 'already' | 'error';

export interface ReportSheetProps {
  open: boolean;
  surface: ReportSurface;
  targetId: string;
  onDismiss: () => void;
  // In-session set of `${surface}:${targetId}` the reporter already reported this
  // app session. Held by the parent, never persisted. When the current target is
  // in it, the sheet opens directly on the "already reported" receipt.
  alreadyReportedKeys?: Set<string>;
  // Called after a successful submit so the parent can add the key to its Set.
  onReported?: (key: string) => void;
}

export default function ReportSheet({
  open,
  surface,
  targetId,
  onDismiss,
  alreadyReportedKeys,
  onReported,
}: ReportSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [view, setView] = useState<SheetView>('form');
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const slideY = useRef(new Animated.Value(600)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  const key = useMemo(() => reportKey(surface, targetId), [surface, targetId]);
  const reasonCodes = SURFACE_REASONS[surface];

  const resolveReason = useCallback(
    (code: ReportReason): ReasonDef =>
      surface === 'church_profile' && code === 'impersonation'
        ? CHURCH_IMPERSONATION
        : REASONS[code],
    [surface],
  );

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (active) setReduced(r);
    });
    return () => {
      active = false;
    };
  }, []);

  // Reset to a clean form each time the sheet opens; jump to "already" when the
  // target is in the parent's in-session set.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setSelected(null);
      setDetail('');
      setSubmitting(false);
      setView(alreadyReportedKeys?.has(key) ? 'already' : 'form');
      if (reduced) {
        slideY.setValue(0);
        backdrop.setValue(0.55);
      } else {
        Animated.parallel([
          Animated.timing(slideY, {
            toValue: 0,
            duration: ANIM_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(backdrop, {
            toValue: 0.55,
            duration: ANIM_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else if (mounted) {
      if (reduced) {
        setMounted(false);
      } else {
        Animated.parallel([
          Animated.timing(slideY, {
            toValue: 600,
            duration: ANIM_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(backdrop, {
            toValue: 0,
            duration: ANIM_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => setMounted(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reduced]);

  const canSubmit =
    selected !== null &&
    !submitting &&
    // 'something_else' requires a description.
    (selected !== 'something_else' || detail.trim().length > 0);

  const handleSubmit = useCallback(async () => {
    if (!selected || submitting) return;
    if (selected === 'something_else' && detail.trim().length === 0) return;
    setSubmitting(true);
    const result = await submitReport({
      surface,
      targetId,
      reason: selected,
      detail: detail.trim().length > 0 ? detail : null,
    });
    setSubmitting(false);
    if (result.ok) {
      onReported?.(key);
      setView('confirmation');
    } else if (result.reason === 'rate_limited') {
      setView('rate_limited');
    } else {
      // Draft (detail) is preserved — we do not clear it on error.
      setView('error');
    }
  }, [selected, detail, submitting, surface, targetId, key, onReported]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Dim backdrop — tap dismisses. */}
        <Pressable
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Dismiss report form"
          accessibilityRole="button"
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdrop }]}
          />
        </Pressable>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideY }] }]}
          accessibilityViewIsModal
        >
          <View style={styles.grabHandle} />

          {view === 'form' && (
            <ReportForm
              reasonCodes={reasonCodes}
              resolveReason={resolveReason}
              selected={selected}
              onSelect={setSelected}
              detail={detail}
              onChangeDetail={setDetail}
              canSubmit={canSubmit}
              submitting={submitting}
              onSubmit={handleSubmit}
              onCancel={onDismiss}
            />
          )}

          {view === 'confirmation' && <ConfirmationView onClose={onDismiss} />}
          {view === 'rate_limited' && <RateLimitedView onClose={onDismiss} />}
          {view === 'already' && <AlreadyReportedView onClose={onDismiss} />}
          {view === 'error' && (
            <ErrorView
              onRetry={() => {
                setView('form');
              }}
              onClose={onDismiss}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Form view ──
function ReportForm({
  reasonCodes,
  resolveReason,
  selected,
  onSelect,
  detail,
  onChangeDetail,
  canSubmit,
  submitting,
  onSubmit,
  onCancel,
}: {
  reasonCodes: ReportReason[];
  resolveReason: (c: ReportReason) => ReasonDef;
  selected: ReportReason | null;
  onSelect: (c: ReportReason) => void;
  detail: string;
  onChangeDetail: (v: string) => void;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.bodyContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title} accessibilityRole="header">
        Report to the Replant team
      </Text>

      <Text style={styles.framing}>
        This goes only to the Replant team — you won&apos;t be identified to anyone
        involved. A report begins a careful review by people. It never decides one
        on its own.
      </Text>

      <Text
        style={styles.groupLabel}
        accessibilityRole="header"
        // Labels the radio group for screen readers.
        accessibilityLabel="What's the concern?"
      >
        What&apos;s the concern?
      </Text>

      <View accessibilityRole="radiogroup">
        {reasonCodes.map((code) => {
          const def = resolveReason(code);
          const isSel = selected === code;
          return (
            <Pressable
              key={code}
              onPress={() => onSelect(code)}
              style={[styles.reasonRow, isSel && styles.reasonRowSel]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSel }}
              accessibilityLabel={def.label}
              accessibilityHint={def.desc}
            >
              <View style={[styles.radioDot, isSel && styles.radioDotSel]}>
                {isSel && <View style={styles.radioInner} />}
              </View>
              <View style={styles.reasonText}>
                <Text style={[styles.reasonLabel, isSel && styles.reasonLabelSel]}>
                  {def.label}
                </Text>
                <Text style={styles.reasonDesc}>{def.desc}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Conditional cross-tradition fairness line — false teaching only. */}
      {selected === 'false_teaching' && (
        <Text style={styles.fairnessLine} accessibilityLiveRegion="polite">
          Concerns about teaching are weighed by people on the Replant team, never
          by an automatic filter. The church spans many traditions, and we hold that
          with care.
        </Text>
      )}

      {/* Free-text field. Label above; no placeholder (a11y). */}
      <Text style={styles.fieldLabel} nativeID="report-detail-label">
        Anything that helps us understand — optional
      </Text>
      <TextInput
        style={styles.input}
        value={detail}
        onChangeText={(t) => onChangeDetail(t.slice(0, DETAIL_MAX))}
        multiline
        maxLength={DETAIL_MAX}
        textAlignVertical="top"
        accessibilityLabel="Anything that helps us understand"
        accessibilityHint="Optional. Add anything that helps the team understand what happened."
        aria-labelledby="report-detail-label"
        placeholderTextColor={Colors.textSubtle}
      />

      <Text style={styles.noRetaliation}>
        This stays between you and the Replant team.
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={[styles.btnPrimary, !canSubmit && styles.btnPrimaryDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Send to the team"
          accessibilityState={{ disabled: !canSubmit }}
          accessibilityHint={
            selected === null ? 'Choose a reason first' : undefined
          }
        >
          <Text style={styles.btnPrimaryText}>
            {submitting ? 'Sending…' : 'Send to the team'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          style={styles.btnGhost}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityHint="Closes without sending"
        >
          <Text style={styles.btnGhostText}>Cancel</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── Confirmation view (CONTENT §3) ──
function ConfirmationView({ onClose }: { onClose: () => void }) {
  return (
    <View
      style={styles.stateView}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={styles.stateTitle} accessibilityRole="header">
        It&apos;s with the team.
      </Text>
      <Text style={styles.stateBody}>
        The Replant team reviews every report. You won&apos;t be identified to anyone
        involved.
      </Text>
      <Text style={styles.stateBody}>
        If the team needs more from you, they&apos;ll reach out. You may not see what
        happens next — reviews stay quiet to protect everyone involved.
      </Text>
      <Pressable
        onPress={onClose}
        style={styles.btnPrimary}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={styles.btnPrimaryText}>Done</Text>
      </Pressable>
    </View>
  );
}

// ── Rate-limited view (CONTENT §5) ──
function RateLimitedView({ onClose }: { onClose: () => void }) {
  return (
    <View
      style={styles.stateView}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={styles.stateBody}>
        You&apos;ve sent several reports in a short time, so this one needs a short
        wait. Everything you&apos;ve already sent is with the team.
      </Text>
      <Pressable
        onPress={onClose}
        style={styles.btnPrimary}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Text style={styles.btnPrimaryText}>Close</Text>
      </Pressable>
    </View>
  );
}

// ── Already-reported view (CONTENT §5) ──
function AlreadyReportedView({ onClose }: { onClose: () => void }) {
  return (
    <View
      style={styles.stateView}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={styles.stateBody}>You&apos;ve already raised this — it&apos;s with the team.</Text>
      <Pressable
        onPress={onClose}
        style={styles.btnPrimary}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Text style={styles.btnPrimaryText}>Close</Text>
      </Pressable>
    </View>
  );
}

// ── Error view (CONTENT §5) — draft preserved; retry returns to the form ──
function ErrorView({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  return (
    <View
      style={styles.stateView}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={styles.stateBody}>
        Your report didn&apos;t send. Check your connection and try again — what you
        wrote is still here.
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onRetry}
          style={styles.btnPrimary}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.btnPrimaryText}>Try again</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          style={styles.btnGhost}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.btnGhostText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.lg,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: Spacing.md },
  title: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  framing: {
    fontFamily: Typography.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  groupLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.transparent,
    marginBottom: Spacing.xs,
  },
  reasonRowSel: {
    borderColor: Colors.borderAccent,
    backgroundColor: Colors.linkWell,
  },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    marginTop: 2,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotSel: { borderColor: Colors.accent },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  reasonText: { flex: 1 },
  reasonLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14.5,
    lineHeight: 20,
    color: Colors.text,
  },
  reasonLabelSel: { color: Colors.text },
  reasonDesc: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.textMuted,
    marginTop: 1,
  },
  fairnessLine: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  fieldLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  input: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm + 2,
    fontFamily: Typography.body,
    fontSize: 14.5,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  noRetaliation: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.textMuted,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  actions: { marginTop: Spacing.sm },
  btnPrimary: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md - 2,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  btnPrimaryDisabled: { opacity: 0.4 },
  btnPrimaryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.background,
  },
  btnGhost: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md - 2,
    alignItems: 'center',
  },
  btnGhostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.textMuted,
  },
  stateView: { paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  stateTitle: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  stateBody: {
    fontFamily: Typography.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
});
