// ─────────────────────────────────────────────
// WallComposeView — Prayer Wall rebuild · View 5 (Post a request)
// Spec: docs/design_handoff_prayer_wall_NEW/README.md §View 5.
//
// A faithful port of PostPrayerRequestModal's field set as a VIEW of
// the Prayer Wall screen (not a Modal, not a route — the header stays
// mounted). The RPC contract and validation are kept exactly:
// create_prayer_request(p_content, p_category, p_urgent,
// p_anonymous_override) RETURNS uuid; the six error codes map through
// the modal's exported errorCopy so the surfaces cannot drift.
//
// Differences from the modal are PRESENTATIONAL ONLY, per the README:
// Cormorant 21/30.5 textarea, square mono chips, custom-coloured
// switches, and a "Lift it up" submit that is deliberately NOT blue
// (the blue wash was rejected in review).
//
// The character counter resets to 0 whenever this view opens — a stale
// amber count over an empty field was a real prototype bug. The host
// remounts this component per open (keyed), and local state starts
// clean either way.
//
// On success the host returns to Feed with the new request EXPANDED
// (create_prayer_request returns the new row's uuid) and toasts
// "Lifted up. The body will pray it through."
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { errorCopy } from '../church/PostPrayerRequestModal';
import { CATEGORIES, type PrayerCategory } from './PrayerWallLogic';
import { COMPOSE_MAX_CHARS, counterStage } from './wallNewLogic';

interface Props {
  churchName: string | null;
  isUnderground: boolean;
  defaultAnonymous?: boolean;
  onBack: () => void;
  onSuccess: (newRequestId: string | null) => void;
}

export default function WallComposeView({
  churchName, isUnderground, defaultAnonymous = false, onBack, onSuccess,
}: Props) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PrayerCategory | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [anonymous, setAnonymous] = useState(defaultAnonymous);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && category !== null && !submitting;

  const stage = counterStage(content.length);
  const counterColor =
    stage === 'red' ? Colors.red : stage === 'amber' ? Colors.amber : 'rgba(240,237,230,0.35)';

  // Attribution reacts to the anonymous toggle (README item 2).
  const attribution =
    isUnderground || anonymous
      ? `This request will be posted anonymously on behalf of ${churchName ?? 'your church'}.`
      : `This request will be posted on behalf of ${churchName ?? 'your church'}.`;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);
    const { data, error } = await supabase.rpc('create_prayer_request', {
      p_content: trimmed,
      p_category: category,
      p_urgent: urgent,
      p_anonymous_override: isUnderground ? true : anonymous,
    });
    if (error) {
      // DEFINER fn RAISEs the code as message text (same as the modal).
      setErrorMsg(errorCopy(error.message));
      setSubmitting(false);
      return;
    }
    onSuccess(typeof data === 'string' ? data : null);
  };

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to the wall">
        <Text style={s.back}>← BACK</Text>
      </Pressable>

      <View style={s.headRow}>
        <Text style={s.heading}>Post a request</Text>
        <View style={s.headRule} />
      </View>

      <Text style={s.attribution}>{attribution}</Text>

      <Text style={s.fieldLabel}>YOUR PRAYER</Text>
      <TextInput
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={COMPOSE_MAX_CHARS}
        editable={!submitting}
        placeholder="Share what your church is bringing before the Lord."
        placeholderTextColor="rgba(240,237,230,0.30)"
        style={s.textarea}
        textAlignVertical="top"
      />
      <Text
        style={[s.counter, { color: counterColor }]}
        accessibilityLiveRegion={stage !== 'muted' ? 'polite' : 'none'}
        accessibilityLabel={`${content.length} of ${COMPOSE_MAX_CHARS} characters${stage === 'red' ? ' — nearly full' : stage === 'amber' ? ' — getting long' : ''}`}
      >
        {content.length} / {COMPOSE_MAX_CHARS}
      </Text>

      <Text style={s.fieldLabel}>CATEGORY</Text>
      <View style={s.chipRow}>
        {CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              disabled={submitting}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[s.chip, active && s.chipOn]}
            >
              <Text style={[s.chipLabel, active && s.chipLabelOn]}>{c.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>

      <ToggleRow
        title="Mark as urgent"
        description="For requests needing immediate intercession."
        value={urgent}
        onChange={setUrgent}
        disabled={submitting}
      />
      {/* Hidden entirely for underground churches — always anonymous. */}
      {!isUnderground ? (
        <ToggleRow
          title="Post anonymously"
          description="Your name will be hidden. Your church will still be shown."
          value={anonymous}
          onChange={setAnonymous}
          disabled={submitting}
        />
      ) : null}

      {errorMsg ? <Text style={s.error}>{errorMsg}</Text> : null}

      <Pressable
        onPress={() => void submit()}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Lift it up — submit prayer request"
        accessibilityState={{ disabled: !canSubmit }}
        style={[s.submit, !canSubmit && { opacity: 0.4 }]}
      >
        {submitting ? (
          <ActivityIndicator color={Colors.text} />
        ) : (
          <Text style={s.submitLabel}>LIFT IT UP</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function ToggleRow({
  title, description, value, onChange, disabled,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: 'rgba(240,237,230,0.07)', true: 'rgba(107,181,232,0.35)' }}
        thumbColor={Colors.text}
        ios_backgroundColor="rgba(240,237,230,0.07)"
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 44 },

  back: { fontFamily: Typography.mono, fontSize: 9.5, letterSpacing: 1.6, color: Colors.accent },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22, marginBottom: 14 },
  heading: { fontFamily: Typography.displayRegular, fontSize: 22, color: Colors.text },
  headRule: { flex: 1, height: 1, backgroundColor: 'rgba(107,181,232,0.14)' },

  attribution: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    lineHeight: 22.5,
    color: 'rgba(240,237,230,0.50)',
  },

  fieldLabel: {
    marginTop: 24,
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.8,
    color: 'rgba(240,237,230,0.35)',
  },
  textarea: {
    marginTop: 10,
    minHeight: 132,
    fontFamily: Typography.displayRegular,
    fontSize: 21,
    lineHeight: 30.5,
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,237,230,0.14)',
    paddingBottom: 10,
  },
  counter: {
    marginTop: 8,
    alignSelf: 'flex-end',
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.12)',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  chipOn: { borderColor: 'rgba(107,181,232,0.50)' },
  chipLabel: { fontFamily: Typography.mono, fontSize: 9, letterSpacing: 1.3, color: 'rgba(240,237,230,0.50)' },
  chipLabelOn: { color: Colors.accent },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.borderAccentSubtle,
  },
  toggleTitle: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.text },
  toggleDesc: {
    marginTop: 3,
    fontFamily: Typography.sansLight,
    fontSize: 11.5,
    lineHeight: 17,
    color: 'rgba(240,237,230,0.42)',
  },

  error: { marginTop: 16, fontFamily: Typography.body, fontSize: 13, lineHeight: 19, color: Colors.red },

  // Deliberately not blue — the blue wash was rejected in review.
  submit: {
    marginTop: 26,
    backgroundColor: 'rgba(240,237,230,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.30)',
    borderRadius: 7,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitLabel: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 2, color: Colors.text },
});
