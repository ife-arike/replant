// ─────────────────────────────────────────────
// MyOpenPrayersView — KAN-23 v2 (Ticket E)
//
// "My open prayers" surface inside the Prayer Wall tab. Reached from
// the landing's "View my open prayers →" quick-link.
//
// Cards reuse the prayer-card chrome with three differences:
//   - No › chevron — replaced by an ••• overflow trigger top-right.
//   - Author line in the meta: "by {author_display_name}" mono 10 pt.
//   - Card body tap is a no-op (the actions live in the overflow).
//
// Overflow menu (popover anchored top-right of card):
//   - Edit                — STUB
//   - Mark as praise      — STUB (opens composer sheet, submit no-op)
//   - Delete (red)        — STUB (opens confirm modal, confirm no-op)
//
// All three are explicit UI-only stubs per the dispatch's write-stub
// rule. Each tap landing site carries a `// TODO: wire …` comment so
// nothing about the behaviour is silent or surprising.
//
// Empty state: green ghost CTA "Receive intercession →" returns the
// leader to the landing view.
//
// Data: supabase.rpc('get_open_prayers', { p_church_id }). The user's
// church_id isn't on AuthState directly — we fetch it from public.users
// using the existing supabase client pattern (mirrors SettingsScreen +
// SettingsScreenContainer).
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthProvider';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import {
  formatRelativeTime,
} from './PrayerWallLogic';
import { OverflowIcon } from './PrayerIcons';

interface OpenPrayerRow {
  id: string;
  category: string | null;
  prayer_text: string;
  urgency: boolean;
  created_at: string;
  prayed_count: number;
  author_display_name: string | null;
  author_role: string | null;
}

type LoadState = 'initial' | 'idle' | 'error';

interface Props {
  /** Returns the leader to the landing view (used by empty-state CTA). */
  onBackToLanding: () => void;
}

const TESTIMONY_MAX_CHARS = 600;

export default function MyOpenPrayersView({ onBackToLanding }: Props) {
  const { session } = useAuth();
  const [churchId, setChurchId] = useState<string | null>(null);
  const [rows, setRows] = useState<OpenPrayerRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('initial');
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null);
  const [praiseRow, setPraiseRow] = useState<OpenPrayerRow | null>(null);

  // Resolve current leader's church_id via public.users — the auth
  // context doesn't carry it directly. Mirrors the pattern in
  // SettingsScreen.tsx around line 210.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.user?.id) return;
      const { data, error } = await supabase
        .from('users')
        .select('church_id')
        .eq('auth_id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data?.church_id) {
        // No church — empty state will show.
        setChurchId(null);
        setLoadState('idle');
        return;
      }
      setChurchId(data.church_id);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const loadInitial = useCallback(async () => {
    if (!churchId) return;
    setLoadState('initial');
    const { data, error } = await supabase.rpc('get_open_prayers', {
      p_church_id: churchId,
    });
    if (error) {
      setLoadState('error');
      return;
    }
    setRows((data ?? []) as OpenPrayerRow[]);
    setLoadState('idle');
  }, [churchId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  if (loadState === 'initial') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyCopy}>Couldn't load your prayer requests right now.</Text>
        <Pressable onPress={loadInitial} hitSlop={8} accessibilityRole="button">
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyCopy}>Your church has no open prayer requests yet.</Text>
        <Pressable
          onPress={onBackToLanding}
          accessibilityRole="button"
          style={styles.backCta}
        >
          <Text style={styles.backCtaText}>Receive intercession →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        renderItem={({ item }) => (
          <OpenPrayerCard
            row={item}
            onOpenMenu={() => setMenuRowId(item.id)}
          />
        )}
      />

      {/* Overflow menu */}
      {menuRowId !== null ? (
        <OverflowMenu
          onDismiss={() => setMenuRowId(null)}
          onEdit={() => {
            // TODO: wire edit → posting sheet (KAN-205).
            setMenuRowId(null);
          }}
          onMarkAsPraise={() => {
            const row = rows.find((r) => r.id === menuRowId) ?? null;
            setMenuRowId(null);
            setPraiseRow(row);
          }}
          onDelete={() => {
            setDeleteRowId(menuRowId);
            setMenuRowId(null);
          }}
        />
      ) : null}

      {/* Delete confirm modal */}
      <DeleteConfirmModal
        visible={deleteRowId !== null}
        onCancel={() => setDeleteRowId(null)}
        onConfirm={() => {
          // TODO: wire soft_delete_prayer_request RPC — pending SEC checkpoint.
          // No persistence today; close the modal so the leader gets
          // visual feedback the affordance fired.
          setDeleteRowId(null);
        }}
      />

      {/* Mark-as-praise composer */}
      <MarkAsPraiseComposer
        row={praiseRow}
        onDismiss={() => setPraiseRow(null)}
        onSubmit={() => {
          // TODO: wire create_testimony RPC — pending SEC checkpoint.
          // No persistence today; just dismiss so the leader sees the
          // composer close.
          setPraiseRow(null);
        }}
      />
    </View>
  );
}

// ─── Card ────────────────────────────────────────────────────────────

function OpenPrayerCard({
  row,
  onOpenMenu,
}: {
  row: OpenPrayerRow;
  onOpenMenu: () => void;
}) {
  const timestamp = formatRelativeTime(row.created_at);
  const author = row.author_display_name ?? 'A leader';

  // Body tap is a no-op per dispatch — wrap in View, not Pressable.
  return (
    <View
      style={[
        styles.card,
        { borderLeftColor: row.urgency ? Colors.red : Colors.accent },
      ]}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.body} numberOfLines={3}>{row.prayer_text}</Text>
        <Pressable
          onPress={onOpenMenu}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open prayer request actions"
          style={styles.overflowTrigger}
        >
          <OverflowIcon size={14} color={Colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.metaRow}>
        {row.category ? (
          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>{row.category}</Text>
          </View>
        ) : null}
        {row.urgency ? (
          <View style={styles.urgentChip}>
            <Text style={styles.urgentChipText}>Urgent</Text>
          </View>
        ) : null}
        <Text style={styles.authorLine}>by {author}</Text>
        {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
      </View>
    </View>
  );
}

// ─── Overflow menu ───────────────────────────────────────────────────

function OverflowMenu({
  onDismiss,
  onEdit,
  onMarkAsPraise,
  onDelete,
}: {
  onDismiss: () => void;
  onEdit: () => void;
  onMarkAsPraise: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal transparent visible onRequestClose={onDismiss} animationType="fade">
      <Pressable style={styles.menuBackdrop} onPress={onDismiss} accessibilityLabel="Dismiss menu">
        <View style={styles.menu}>
          <MenuItem label="Edit" onPress={onEdit} />
          <MenuItem label="Mark as praise" onPress={onMarkAsPraise} tone="green" />
          <View style={styles.menuDivider} />
          <MenuItem label="Delete" onPress={onDelete} tone="red" />
        </View>
      </Pressable>
    </Modal>
  );
}

function MenuItem({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone?: 'red' | 'green';
}) {
  const color = tone === 'red' ? Colors.red : tone === 'green' ? Colors.green : Colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
    >
      <Text style={[styles.menuItemText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Delete confirm ──────────────────────────────────────────────────

function DeleteConfirmModal({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent visible={visible} onRequestClose={onCancel} animationType="fade">
      <View style={styles.confirmBackdrop}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmEyebrow}>Delete prayer request</Text>
          <Text style={styles.confirmBody}>
            This will remove the request from the prayer wall. This cannot be undone.
          </Text>
          <View style={styles.confirmCtaRow}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              style={({ pressed }) => [styles.ctaGhost, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              style={({ pressed }) => [styles.ctaDelete, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaDeleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Mark-as-praise composer ─────────────────────────────────────────

function MarkAsPraiseComposer({
  row,
  onDismiss,
  onSubmit,
}: {
  row: OpenPrayerRow | null;
  onDismiss: () => void;
  onSubmit: () => void;
}) {
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const slideY = useRef(new Animated.Value(800)).current;

  useEffect(() => {
    if (row !== null) {
      setText('');
      setAnonymous(false);
      Animated.timing(slideY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      slideY.setValue(800);
    }
  }, [row, slideY]);

  if (row === null) return null;

  const handleDismiss = () => {
    if (text.trim().length > 0) {
      Alert.alert(
        'Discard testimony?',
        'You have unsaved testimony content.',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onDismiss },
        ],
      );
      return;
    }
    onDismiss();
  };

  const remaining = TESTIMONY_MAX_CHARS - text.length;

  return (
    <Modal transparent visible onRequestClose={handleDismiss} animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={styles.composerBackdrop} onPress={handleDismiss} accessibilityLabel="Dismiss composer" />
        <Animated.View style={[styles.composerSheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.grabHandle} />

          <Text style={styles.composerTitle}>Mark as praise</Text>

          <View style={styles.composerQuote}>
            <Text style={styles.composerQuoteLabel}>Original request</Text>
            <Text style={styles.composerQuoteText} numberOfLines={4}>{row.prayer_text}</Text>
          </View>

          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, TESTIMONY_MAX_CHARS))}
            multiline
            placeholder="What did God do? Share what He's done..."
            placeholderTextColor={Colors.textSubtle}
            style={styles.composerInput}
            accessibilityLabel="Testimony text"
          />

          <View style={styles.composerToolRow}>
            <View style={styles.composerAnonRow}>
              <Switch
                value={anonymous}
                onValueChange={setAnonymous}
                accessibilityLabel="Post anonymously"
                trackColor={{ false: Colors.border, true: Colors.green }}
              />
              <Text style={styles.composerAnonLabel}>Post anonymously</Text>
            </View>
            <Text style={styles.composerCharCount}>{remaining}</Text>
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={text.trim().length === 0}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.composerSubmit,
              text.trim().length === 0 && styles.composerSubmitDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.composerSubmitText}>Share testimony</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  listContent: { paddingVertical: 8, paddingHorizontal: 14 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyCopy: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  backCta: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(91, 173, 122, 0.45)',
    borderRadius: 6,
  },
  backCtaText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.green,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 2,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  body: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 20,
  },
  overflowTrigger: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  categoryChip: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(107, 181, 232, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 181, 232, 0.30)',
  },
  categoryChipText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.0,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  urgentChip: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(224, 85, 85, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(224, 85, 85, 0.30)',
  },
  urgentChipText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.0,
    color: Colors.red,
    textTransform: 'uppercase',
  },
  authorLine: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
  },
  timestamp: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },

  // Overflow menu
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    width: 240,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  menuItemText: {
    fontFamily: Typography.body,
    fontSize: 14,
  },
  menuDivider: {
    height: 0.25,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  // Delete confirm
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  confirmCard: {
    width: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 20,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  confirmEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Colors.red,
    textTransform: 'uppercase',
  },
  confirmBody: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  confirmCtaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  ctaGhost: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  ctaGhostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textMuted,
  },
  ctaDelete: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.red,
  },
  ctaDeleteText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.background,
  },

  // Composer
  composerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  composerSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 14,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 26,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: 'rgba(240, 237, 230, 0.18)',
    marginTop: 8,
  },
  composerTitle: {
    fontFamily: Typography.displayMedium,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  composerQuote: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(91, 173, 122, 0.06)',
    borderLeftWidth: 2,
    borderLeftColor: Colors.green,
    borderRadius: 4,
  },
  composerQuoteLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  composerQuoteText: {
    marginTop: 4,
    fontFamily: Typography.displayMediumItalic,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  composerInput: {
    minHeight: 120,
    maxHeight: 220,
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    fontFamily: Typography.displayMediumItalic,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  composerToolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  composerAnonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerAnonLabel: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  composerCharCount: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
  },
  composerSubmit: {
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSubmitDisabled: {
    opacity: 0.45,
  },
  composerSubmitText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.background,
  },
});
