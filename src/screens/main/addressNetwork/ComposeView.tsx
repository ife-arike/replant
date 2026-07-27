// ─────────────────────────────────────────────
// ComposeView — the Compose surface. Count-driven, three render branches:
//   form (type picker → fields)  ·  submit success (§E)  ·  at capacity (§H)
//
// The type is chosen first (§B) — it routes the destination and decides the
// field set. "A Word from your Family" is a coming-soon row that opens the
// reused ComingSoonModal (never hidden, never a new popup). Confirmations
// are in-place screen states, never toasts.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../../constants/theme';
import ComingSoonModal from '../../../components/common/ComingSoonModal';
import LeaderWordCard from '../../../components/home/LeaderWordCard';
import PublishPreviewCard from './PublishPreviewCard';
import AttributionCards from './AttributionCards';
import { BackChevronIcon, ChevronDownIcon, CheckIcon, EyeIcon, TwoDotIcon } from './icons';
import { submitAddressNetwork } from './addressNetworkApi';
import {
  BODY_LABEL,
  DEFAULT_WORD_KICKER,
  OPEN_CAP,
  TYPE_DESTINATION,
  TYPE_LABEL,
  type ATNType,
  type Attribution,
} from './types';
import {
  previewAuthor,
  readingAttributionLine,
  type ComposeIdentity,
} from './useComposeIdentity';
import { HAIRLINE, SKY_08, SKY_25 } from './tokens';

// Founder copy — VERBATIM, never restyled or repunctuated.
const GUARDRAIL =
  'Please do not use this space to solicit assistance or to condemn. Let this platform edify, inform, or convict the body in love.';
const SUBMIT_NOTE =
  'The Replant team must approve the word before it reaches the network.';

// Coming-soon copy for the family type (into ComingSoonModal props).
const FAMILY_TITLE = 'A word to the persecuted';
const FAMILY_BODY =
  "Soon you'll be able to send encouragement to leaders enduring persecution, and they will read it on the Persecuted tab. For now, you can share a Word for Today or a Testimony.";

const TITLE_PLACEHOLDER_WORD = 'Add a title, or leave it as "A word for today".';
const TITLE_PLACEHOLDER_TESTIMONY = 'Give your testimony a title.';

interface Props {
  identity: ComposeIdentity;
  atCapacity: boolean;
  openCount: number;
  onSubmitted: () => void;
  onGoToSubmissions: () => void;
}

type Phase = 'form' | 'sent';

function animate() {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'),
  );
}

export default function ComposeView({
  identity,
  atCapacity,
  openCount,
  onSubmitted,
  onGoToSubmissions,
}: Props) {
  const [type, setType] = useState<ATNType | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attribution, setAttribution] = useState<Attribution>('show_name');
  const [phase, setPhase] = useState<Phase>('form');
  const [sending, setSending] = useState(false);
  const [touched, setTouched] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [comingSoonVisible, setComingSoonVisible] = useState(false);
  const [remainingAfterSend, setRemainingAfterSend] = useState(0);

  // Underground authors are forced to role_region (defense in depth; the
  // server forces it too). Never offered a choice client-side.
  const effectiveAttribution: Attribution = identity.isUnderground
    ? 'role_region'
    : attribution;

  const titleTrim = title.trim();
  const bodyTrim = body.trim();
  // Founder 2026-07-25: title required for ALL leader posts (a titleless
  // word published as the "A word for today" default, duplicating the
  // kicker). Server enforces the same (content_submission_create
  // title_required).
  const titleRequired = true;
  const titleOk = !titleRequired || titleTrim.length > 0;
  const bodyOk = bodyTrim.length > 0;
  const canSubmit = !!type && titleOk && bodyOk && !sending;

  const resetForm = () => {
    animate();
    setType(null);
    setTitle('');
    setBody('');
    setAttribution('show_name');
    setTouched(false);
    setPhase('form');
  };

  const onPickType = (t: ATNType) => {
    animate();
    setType(t);
    setTouched(false);
  };

  const onSubmit = async () => {
    setTouched(true);
    if (!type || !titleOk || !bodyOk || sending) return;
    setSending(true);
    await submitAddressNetwork({
      type,
      title: type === 'word' ? titleTrim || null : titleTrim,
      body: bodyTrim,
      attribution: effectiveAttribution,
    });
    setRemainingAfterSend(Math.max(0, OPEN_CAP - (openCount + 1)));
    setSending(false);
    animate();
    setPhase('sent');
    onSubmitted();
  };

  // ── Submit success (§E) ─────────────────────────────────────────────
  if (phase === 'sent') {
    const slotLeft = remainingAfterSend >= 1;
    return (
      <View style={styles.center}>
        <View style={[styles.mark, styles.markOk]}>
          <CheckIcon size={26} color={Colors.accent} />
        </View>
        <Text style={styles.centerTitle}>It&apos;s with the team.</Text>
        <Text style={styles.centerSub}>
          {slotLeft ? (
            <>
              We&apos;ll read it soon and let you know right here. You have{' '}
              <Text style={styles.centerSubStrong}>one open slot left</Text>.
            </>
          ) : (
            <>We&apos;ll read it soon and let you know right here. That fills both your slots for now.</>
          )}
        </Text>
        {slotLeft ? (
          <Pressable
            onPress={resetForm}
            accessibilityRole="button"
            accessibilityLabel="Share another"
            style={({ pressed }) => [styles.shareAgain, pressed && styles.pressed]}
          >
            <Text style={styles.shareAgainLabel}>Share another</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onGoToSubmissions} accessibilityRole="link" hitSlop={8}>
          <Text style={styles.centerLink}>View my submissions →</Text>
        </Pressable>
      </View>
    );
  }

  // ── At capacity (§H) — a first-class branch, not a disabled button ──
  if (atCapacity) {
    return (
      <View style={styles.center}>
        <View style={[styles.mark, styles.markHold]}>
          <TwoDotIcon size={24} color={Colors.textMuted} />
        </View>
        <Text style={styles.centerTitle}>You have two open submissions.</Text>
        <Text style={styles.centerSub}>
          We keep it to two at a time, so each one gets a careful read. When one is
          answered, or you withdraw it, you can share again.
        </Text>
        <Pressable onPress={onGoToSubmissions} accessibilityRole="link" hitSlop={8}>
          <Text style={styles.centerLink}>View my submissions →</Text>
        </Pressable>
      </View>
    );
  }

  // ── Form: type picker (§B) or fields (§C / §D) ──────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {type === null ? (
          <>
            <Text style={styles.prompt}>What would you like to share?</Text>
            <View style={styles.typeList}>
              <TypeRow
                title={TYPE_LABEL.word}
                desc={TYPE_DESTINATION.word}
                onPress={() => onPickType('word')}
              />
              <TypeRow
                title={TYPE_LABEL.testimony}
                desc={TYPE_DESTINATION.testimony}
                onPress={() => onPickType('testimony')}
              />
              <TypeRow
                title="A Word from your Family"
                desc="Encouragement for leaders enduring persecution."
                soon
                onPress={() => setComingSoonVisible(true)}
                last
              />
            </View>
          </>
        ) : (
          <>
            {/* Sharing — filled picker (tap to change type) */}
            <Field label="Sharing">
              <Pressable
                onPress={() => {
                  animate();
                  setType(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Sharing: ${TYPE_LABEL[type]}. Tap to change.`}
                style={styles.picker}
              >
                <Text style={styles.pickerLabel}>{TYPE_LABEL[type]}</Text>
                <ChevronDownIcon size={18} color={Colors.textMuted} />
              </Pressable>
            </Field>

            {/* Guardrail — verbatim, quiet, not a warning box */}
            <View style={styles.guard}>
              <Text style={styles.guardText}>{GUARDRAIL}</Text>
            </View>

            {/* Title — required for every leader post (Founder 2026-07-25) */}
            <Field
              label="Title"
              suffix="· required"
            >
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={
                  type === 'testimony' ? TITLE_PLACEHOLDER_TESTIMONY : TITLE_PLACEHOLDER_WORD
                }
                placeholderTextColor={Colors.textSubtle}
                style={styles.titleInput}
                maxLength={120}
                accessibilityLabel="Title"
              />
              {touched && titleRequired && !titleOk ? (
                <Text style={styles.hint}>Please add a title.</Text>
              ) : null}
            </Field>

            {/* Body — Cormorant roman (NOT scriptureItalic) */}
            <Field label={BODY_LABEL[type]}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={
                  type === 'testimony' ? 'Write your testimony here.' : 'Write your word here.'
                }
                placeholderTextColor={Colors.textSubtle}
                style={styles.bodyInput}
                multiline
                textAlignVertical="top"
                maxLength={5000}
                accessibilityLabel={BODY_LABEL[type]}
              />
              {touched && !bodyOk ? (
                <Text style={styles.hint}>Please write something first.</Text>
              ) : null}
            </Field>

            {/* How you'll appear */}
            <Field label="How you'll appear">
              <AttributionCards
                identity={identity}
                value={attribution}
                onChange={setAttribution}
              />
            </Field>

            {/* Preview — opens the live card */}
            <Pressable
              onPress={() => setPreviewVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Preview how it appears"
              style={({ pressed }) => [styles.previewBtn, pressed && styles.pressed]}
            >
              <EyeIcon size={16} color={Colors.accent} />
              <Text style={styles.previewLabel}>Preview how it appears</Text>
            </Pressable>

            {/* Submit for review */}
            <Pressable
              onPress={onSubmit}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel="Submit for review"
              style={({ pressed }) => [
                styles.submit,
                !canSubmit && styles.submitDim,
                pressed && canSubmit && styles.pressed,
              ]}
            >
              <Text style={styles.submitLabel}>Submit for review</Text>
            </Pressable>
            <Text style={styles.submitNote}>{SUBMIT_NOTE}</Text>
          </>
        )}
      </ScrollView>

      {/* Coming-soon (family type) — reused ComingSoonModal, reworded */}
      <ComingSoonModal
        visible={comingSoonVisible}
        title={FAMILY_TITLE}
        body={FAMILY_BODY}
        onDismiss={() => setComingSoonVisible(false)}
      />

      {/* Preview — the live card with the leader's current input */}
      <Modal
        visible={previewVisible}
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.previewRoot} edges={['top']}>
          <View style={styles.previewNav}>
            <Pressable
              onPress={() => setPreviewVisible(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
            >
              <BackChevronIcon size={20} color={Colors.text} />
            </Pressable>
            <Text style={styles.previewNavTitle}>Preview</Text>
            <View style={styles.previewNavRight} />
          </View>
          <ScrollView contentContainerStyle={styles.previewScroll}>
            <Text style={styles.previewCaption}>How it appears · Home feed</Text>
            {type === 'word' ? (
              <LeaderWordCard
                announcementId="atn-preview"
                kicker={titleTrim || DEFAULT_WORD_KICKER}
                lead={bodyTrim}
                author={{ ...previewAuthor(identity, effectiveAttribution), time: 'just now' }}
              />
            ) : type === 'testimony' ? (
              <PublishPreviewCard
                variant="publish"
                kicker="Testimony"
                title={titleTrim}
                body={bodyTrim}
                attribution={readingAttributionLine(identity, effectiveAttribution)}
              />
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── field wrapper ───────────────────────────────────────────────────
function Field({
  label,
  suffix,
  children,
}: {
  label: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {suffix ? <Text style={styles.fieldLabelSuffix}> {suffix}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

// ── type row ────────────────────────────────────────────────────────
function TypeRow({
  title,
  desc,
  soon,
  onPress,
  last,
}: {
  title: string;
  desc: string;
  soon?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={soon ? `${title}. Coming soon.` : title}
      style={[styles.typeRow, last && styles.typeRowLast]}
    >
      <View style={styles.typeMain}>
        <Text style={[styles.typeTitle, soon && styles.typeTitleSoon]}>{title}</Text>
        <Text style={[styles.typeDesc, soon && styles.typeDescSoon]}>{desc}</Text>
      </View>
      {soon ? (
        <View style={styles.soonPill}>
          <Text style={styles.soonPillText}>Soon</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
    gap: 20,
  },
  prompt: {
    fontFamily: Typography.displayRegular,
    fontSize: 21,
    lineHeight: 27, // 1.3 × 21
    color: Colors.text,
  },

  // type list
  typeList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    minHeight: 52,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  typeRowLast: { borderBottomWidth: 0 },
  typeMain: { flex: 1, minWidth: 0 },
  typeTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
  },
  typeTitleSoon: { color: Colors.textSubtle },
  typeDesc: {
    fontFamily: Typography.sansLight,
    fontSize: 12,
    lineHeight: 18, // 1.5 × 12
    color: Colors.textMuted,
    marginTop: 3,
  },
  typeDescSoon: { color: Colors.textSubtle },
  soonPill: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  soonPillText: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.12, // 0.14em × 8
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },

  // fields
  field: { gap: 0 },
  fieldLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.88, // 0.08em × 11
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: 9,
  },
  fieldLabelSuffix: {
    fontFamily: Typography.body,
    letterSpacing: 0,
    textTransform: 'none',
    color: Colors.textSubtle,
  },

  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  pickerLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
  },

  guard: {
    paddingVertical: 3,
    paddingLeft: 16,
    borderLeftWidth: 1.5,
    borderLeftColor: HAIRLINE,
  },
  guardText: {
    fontFamily: Typography.displayRegular,
    fontSize: 15,
    lineHeight: 24, // 1.6 × 15
    color: Colors.textMuted,
  },

  titleInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
  },
  bodyInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    minHeight: 148,
    fontFamily: Typography.displayRegular, // Cormorant 400 roman — human voice
    fontSize: 17,
    lineHeight: 26, // ~1.55 × 17
    color: Colors.text,
  },
  hint: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.red,
    marginTop: 8,
  },

  previewBtn: {
    minHeight: 46,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.transparent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  previewLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13.5,
    color: Colors.text,
  },

  submit: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDim: { opacity: 0.45 },
  submitLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.background,
  },
  submitNote: {
    fontFamily: Typography.sansLight,
    fontSize: 11.5,
    lineHeight: 17,
    color: Colors.textSubtle,
    textAlign: 'center',
    marginTop: -8,
  },
  pressed: { opacity: 0.85 },

  // centered states (success / at capacity)
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    paddingVertical: 40,
    gap: 15,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  markOk: {
    backgroundColor: SKY_08,
    borderWidth: 1.5,
    borderColor: SKY_25,
  },
  markHold: {
    borderWidth: 1.5,
    borderColor: HAIRLINE,
  },
  centerTitle: {
    fontFamily: Typography.displayMedium,
    fontSize: 27,
    lineHeight: 32, // 1.2 × 27
    color: Colors.text,
    textAlign: 'center',
  },
  centerSub: {
    fontFamily: Typography.sansLight,
    fontSize: 13.5,
    lineHeight: 23, // 1.7 × 13.5
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  centerSubStrong: {
    fontFamily: Typography.bodyMedium,
    color: Colors.text,
  },
  shareAgain: {
    minHeight: 48,
    paddingHorizontal: 26,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  shareAgainLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.background,
  },
  centerLink: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.accent,
    marginTop: 8,
  },

  // preview modal
  previewRoot: { flex: 1, backgroundColor: Colors.background },
  previewNav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  previewNavTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 20,
    color: Colors.text,
  },
  previewNavRight: { width: 20 },
  previewScroll: {
    padding: 20,
    gap: 14,
  },
  previewCaption: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.44, // 0.16em × 9
    textTransform: 'uppercase',
    color: Colors.textSubtle,
  },
});
