// ─────────────────────────────────────────────
// EditReviewScreen — the consent loop (§G). Opened from an Edits-proposed
// row. The team's edited version is presented for READING, in the shape it
// will publish; the original is one toggle away. Nothing reaches the
// network until the leader confirms.
//
//   Confirm, publish it   → publish RPC (status → live), pop back
//   Request changes       → a note back to the team (status → in_review),
//                           surfaced on the admin dashboard under
//                           Announcements as an ATN sub-tab (Ruling 8).
//                           NEVER the Replant Team chat thread.
//   Withdraw this submission → withdraw RPC (frees a slot). This is where
//                           the Edits-proposed withdraw lives.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../../../constants/theme';
import type { RootStackParamList } from '../../../navigation/types';
import AtnNavBar from './AtnNavBar';
import PublishPreviewCard from './PublishPreviewCard';
import Segmented from './Segmented';
import { publishSubmission, requestChanges, withdrawSubmission } from './addressNetworkApi';
import { TYPE_LABEL } from './types';
import { readingAttributionLine, useComposeIdentity } from './useComposeIdentity';
import { HAIRLINE, SCRIM } from './tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type ReviewRoute = RouteProp<RootStackParamList, 'AddressNetworkEditReview'>;

const FRAMING = 'The team has proposed some edits. Please review and take action.';

type Toggle = 'proposed' | 'original';

export default function EditReviewScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<ReviewRoute>();
  const s = route.params.submission;
  const identity = useComposeIdentity();

  const [view, setView] = useState<Toggle>('proposed');
  const [busy, setBusy] = useState(false);
  const [noteVisible, setNoteVisible] = useState(false);
  const [note, setNote] = useState('');

  const isTestimony = s.type === 'testimony';
  const baseKicker = isTestimony ? 'Testimony' : 'A word for today';
  const attribution = readingAttributionLine(identity, s.attribution);

  const onConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await publishSubmission(s.id);
      navigation.goBack();
    } catch {
      Alert.alert('Error', "Couldn't publish. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onSendNote = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await requestChanges(s.id, note.trim());
      setNoteVisible(false);
      navigation.goBack();
    } catch {
      Alert.alert('Error', "Couldn't send your note. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onWithdraw = () => {
    Alert.alert(
      'Withdraw this submission?',
      'It will be removed and a slot will free up. You can always share again.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await withdrawSubmission(s.id);
              navigation.goBack();
            } catch {
              Alert.alert('Error', "Couldn't withdraw. Try again.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AtnNavBar title="The team's edits" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.framing}>{FRAMING}</Text>

        <Segmented<Toggle>
          options={[
            { key: 'proposed', label: 'Proposed' },
            { key: 'original', label: 'Your original' },
          ]}
          value={view}
          onChange={setView}
          compact
        />

        {view === 'proposed' ? (
          <PublishPreviewCard
            variant="publish"
            kicker={`${baseKicker} · as it will publish`}
            title={isTestimony ? (s.proposedTitle ?? s.title) : null}
            body={s.proposedBody ?? s.body}
            attribution={attribution}
          />
        ) : (
          <PublishPreviewCard
            variant="original"
            kicker={`${baseKicker} · what you sent`}
            title={isTestimony ? s.title : null}
            body={s.body}
            attribution={attribution}
          />
        )}

        <Text style={styles.compareNote}>Toggle to compare with what you sent.</Text>
        <Text style={styles.kindNote}>{TYPE_LABEL[s.type]}</Text>
      </ScrollView>

      {/* Pinned actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={onConfirm}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Confirm, publish it"
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
        >
          <Text style={styles.btnPrimaryLabel}>Confirm, publish it</Text>
        </Pressable>
        <Pressable
          onPress={() => setNoteVisible(true)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Request changes"
          style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
        >
          <Text style={styles.btnGhostLabel}>Request changes</Text>
        </Pressable>
        <Pressable onPress={onWithdraw} disabled={busy} hitSlop={8} accessibilityRole="button">
          <Text style={styles.withdraw}>Withdraw this submission</Text>
        </Pressable>
      </View>

      {/* Request-changes note — an in-flow note back to the team */}
      <Modal
        visible={noteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteVisible(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.noteFlex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.noteScrim}>
            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Ask the team for a change</Text>
              <Text style={styles.noteSub}>
                Tell the team what to reconsider. It goes back to them, not to the
                network.
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="What would you like them to look at again?"
                placeholderTextColor={Colors.textSubtle}
                style={styles.noteInput}
                multiline
                textAlignVertical="top"
                maxLength={1000}
                accessibilityLabel="Note to the team"
              />
              <View style={styles.noteButtons}>
                <Pressable
                  onPress={() => setNoteVisible(false)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.noteCancel, pressed && styles.pressed]}
                >
                  <Text style={styles.noteCancelLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onSendNote}
                  disabled={busy || note.trim().length === 0}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.noteSend,
                    (busy || note.trim().length === 0) && styles.submitDim,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.noteSendLabel}>Send to the team</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
    gap: 16,
  },
  framing: {
    fontFamily: Typography.sansLight,
    fontSize: 13,
    lineHeight: 21, // 1.65 × 13
    color: Colors.textMuted,
  },
  compareNote: {
    fontFamily: Typography.sansLight,
    fontSize: 11.5,
    color: Colors.textSubtle,
    textAlign: 'center',
  },
  kindNote: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.26,
    textTransform: 'uppercase',
    color: Colors.textSubtle,
    textAlign: 'center',
  },

  actions: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 26,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 10,
  },
  btn: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: Colors.accent },
  btnPrimaryLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.background,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.transparent,
  },
  btnGhostLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.textMuted,
  },
  withdraw: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12.5,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingTop: 4,
  },
  pressed: { opacity: 0.85 },
  submitDim: { opacity: 0.45 },

  // note modal
  noteFlex: { flex: 1 },
  noteScrim: {
    flex: 1,
    backgroundColor: SCRIM,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  noteCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: HAIRLINE,
    borderRadius: 14,
    padding: 22,
    gap: 12,
  },
  noteTitle: {
    fontFamily: Typography.displayMedium,
    fontSize: 21,
    color: Colors.text,
  },
  noteSub: {
    fontFamily: Typography.sansLight,
    fontSize: 12.5,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  noteInput: {
    minHeight: 96,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 13,
    fontFamily: Typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.text,
  },
  noteButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  noteCancel: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCancelLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
  noteSend: {
    flex: 1.4,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteSendLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.background,
  },
});
