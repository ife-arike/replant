// ─────────────────────────────────────────────
// MyOpenPrayersView — KAN-23 v2 (Ticket E) · Founder device-pass rebuild
//
// "My Prayers" surface inside the Prayer Wall tab. Reached from the
// landing's "View my open prayers →" quick-link. Lets a leader steward
// their church's own open prayer requests: edit, mark as answered, delete.
//
// Card chrome (rebuilt):
//   - Body text in heartcry italic (PRAYER_CARD_BODY_STYLE, 16 pt) — was
//     too small at 12 pt before.
//   - Leader attribution shows role + first name ("Minister Ifeoluwa")
//     via formatLeaderLine, sourced from author_role + author_display_name.
//   - Overflow trigger is a VERTICAL three-dot (⋮) anchored top-right.
//
// Two entry points to the action set:
//   1. Tap the card BODY → PrayerWallDetailSheet-style pull-up bottom
//      sheet with the full prayer + Edit / Mark as Answered / Delete.
//   2. Tap the ⋮ dots → a small contextual menu ANCHORED near the dots
//      (measured at runtime), not a centred modal.
//
// Actions:
//   - Edit            — update_prayer_request RPC does NOT exist yet, so
//                       Edit renders disabled/muted. See TODO below.
//   - Mark as Answered → AnsweredModal (full sheet): write a testimony +
//                       submit to wall (create_testimony), OR mark answered
//                       privately (soft_delete_prayer_request).
//   - Delete (red)    → centred confirm modal → soft_delete_prayer_request.
//
// Data: supabase.rpc('get_open_prayers', { p_church_id }). The user's
// church_id isn't on AuthState directly — we fetch it from public.users
// (mirrors SettingsScreen). The RPC returns church_name + country +
// category + urgency + prayed_count + author_display_name + author_role.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useAuth } from '../../contexts/AuthProvider';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { formatRelativeTime, getLocationLine } from './PrayerWallLogic';
import { formatLeaderLine } from '../../utils/displayHelpers';
import { OverflowVerticalIcon } from './PrayerIcons';
import { PRAYER_CARD_BODY_STYLE, PRAYER_DETAIL_STYLE } from './PrayerWallCard';

interface OpenPrayerRow {
  id: string;
  category: string | null;
  prayer_text: string;
  urgency: boolean;
  created_at: string;
  prayed_count: number;
  church_name: string | null;
  country: string | null;
  author_display_name: string | null;
  author_role: string | null;
}

type LoadState = 'initial' | 'idle' | 'error';

interface Props {
  /** Returns the leader to the landing view (used by empty-state CTA). */
  onBackToLanding: () => void;
}

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.88;
const ANIM_MS = 320;

const TESTIMONY_MAX_CHARS = 300;

// ── James 5:16 scripture banner ──────────────────────────────────────
const JAS_5_16_KJV =
  '"The effectual fervent prayer of a righteous man availeth much."';
const JAS_5_16_REF = 'JAMES 5:16 · KJV';

const TESTIMONY_ERROR_MESSAGES: Record<string, string> = {
  content_required: 'Please write what God has done.',
  content_too_long: 'Your testimony is too long (300 character limit).',
  not_verified: 'Only verified leaders can share testimonies.',
  request_not_found: 'This prayer request could not be found.',
  not_your_request: "You can only share testimonies for your church's prayer requests.",
  already_converted: 'This prayer request has already been marked as answered.',
};

/** Anchor rect for the contextual dots menu, in window coordinates. */
interface MenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function MyOpenPrayersView({ onBackToLanding }: Props) {
  const { session } = useAuth();
  const [churchId, setChurchId] = useState<string | null>(null);
  const [rows, setRows] = useState<OpenPrayerRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('initial');

  // Action surfaces — at most one open at a time.
  const [sheetRow, setSheetRow] = useState<OpenPrayerRow | null>(null);
  const [menuState, setMenuState] = useState<{ row: OpenPrayerRow; anchor: MenuAnchor } | null>(null);
  const [deleteRow, setDeleteRow] = useState<OpenPrayerRow | null>(null);
  const [answeredRow, setAnsweredRow] = useState<OpenPrayerRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Resolve current leader's church_id via public.users — the auth
  // context doesn't carry it directly. Mirrors SettingsScreen.
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
    // get_open_prayers derives the caller's church from auth.uid() (own-church only);
    // no p_church_id arg since the pre-UAT audit hardening (2026-07-01).
    const { data, error } = await supabase.rpc('get_open_prayers');
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

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  // ── Action dispatchers shared by both entry points ──────────────────
  const onEdit = useCallback(() => {
    // TODO: update_prayer_request RPC needed — DBA ticket required.
    // Edit is rendered disabled/muted everywhere until the RPC lands;
    // this handler is intentionally never reachable (guarded by the
    // disabled flag on the menu/sheet items).
  }, []);

  const onMarkAnswered = useCallback((row: OpenPrayerRow) => {
    setSheetRow(null);
    setMenuState(null);
    setAnsweredRow(row);
  }, []);

  const onDelete = useCallback((row: OpenPrayerRow) => {
    setSheetRow(null);
    setMenuState(null);
    setDeleteRow(row);
  }, []);

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
        ListHeaderComponent={<ScriptureBannerJas />}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        renderItem={({ item }) => (
          <OpenPrayerCard
            row={item}
            onOpenSheet={() => setSheetRow(item)}
            onOpenMenu={(anchor) => setMenuState({ row: item, anchor })}
          />
        )}
      />

      {/* Card body tap → pull-up detail sheet with the action row */}
      <PrayerActionSheet
        row={sheetRow}
        onDismiss={() => setSheetRow(null)}
        onEdit={onEdit}
        onMarkAnswered={onMarkAnswered}
        onDelete={onDelete}
      />

      {/* ⋮ tap → anchored contextual menu */}
      {menuState !== null ? (
        <AnchoredOverflowMenu
          anchor={menuState.anchor}
          onDismiss={() => setMenuState(null)}
          onEdit={onEdit}
          onMarkAnswered={() => onMarkAnswered(menuState.row)}
          onDelete={() => onDelete(menuState.row)}
        />
      ) : null}

      {/* Delete confirm modal (centred — brief confirmation) */}
      <DeleteConfirmModal
        visible={deleteRow !== null}
        onCancel={() => setDeleteRow(null)}
        onConfirm={async () => {
          if (!deleteRow) return;
          const targetId = deleteRow.id;
          const { data, error } = await supabase.rpc('soft_delete_prayer_request', {
            p_request_id: targetId,
          });
          const rpcError = (data as { error?: string } | null)?.error;
          if (error || rpcError) {
            Alert.alert('Could not delete', 'Please try again.');
            setDeleteRow(null);
            return;
          }
          removeRow(targetId);
          setDeleteRow(null);
        }}
      />

      {/* Mark-as-answered full modal */}
      <AnsweredModal
        row={answeredRow}
        onDismiss={() => setAnsweredRow(null)}
        onSubmitTestimony={async (testimonyText) => {
          if (!answeredRow) return;
          const targetId = answeredRow.id;
          const { data, error } = await supabase.rpc('create_testimony', {
            p_request_id: targetId,
            p_testimony_text: testimonyText,
          });
          const rpcError = (data as { error?: string } | null)?.error;
          if (error || rpcError) {
            const msg =
              TESTIMONY_ERROR_MESSAGES[rpcError ?? ''] ??
              'Something went wrong. Please try again.';
            Alert.alert('Could not share testimony', msg);
            // Do NOT dismiss — let the leader retry or edit.
            throw new Error(rpcError ?? 'rpc_error');
          }
          // create_testimony already marks the request 'answered', so it
          // drops out of the open feed on its own — no extra
          // soft_delete needed (that would overwrite status to
          // 'withdrawn'). We just mirror the removal locally.
          removeRow(targetId);
          setAnsweredRow(null);
          showToast('Your testimony has been shared with the wall.');
        }}
        onMarkPrivately={async () => {
          if (!answeredRow) return;
          const targetId = answeredRow.id;
          const { data, error } = await supabase.rpc('soft_delete_prayer_request', {
            p_request_id: targetId,
          });
          const rpcError = (data as { error?: string } | null)?.error;
          if (error || rpcError) {
            Alert.alert('Could not update', 'Please try again.');
            throw new Error(rpcError ?? 'rpc_error');
          }
          removeRow(targetId);
          setAnsweredRow(null);
        }}
      />

      {/* Success toast */}
      <SuccessToast message={toast} onDone={() => setToast(null)} />
    </View>
  );
}

// ─── James 5:16 scripture banner ────────────────────────────────────

function ScriptureBannerJas() {
  return (
    <View style={styles.scriptureBanner}>
      <Text style={styles.scriptureEyebrow}>{JAS_5_16_REF}</Text>
      <Text style={styles.scriptureVerse}>{JAS_5_16_KJV}</Text>
    </View>
  );
}

// ─── Card ────────────────────────────────────────────────────────────

function OpenPrayerCard({
  row,
  onOpenSheet,
  onOpenMenu,
}: {
  row: OpenPrayerRow;
  onOpenSheet: () => void;
  onOpenMenu: (anchor: MenuAnchor) => void;
}) {
  const timestamp = formatRelativeTime(row.created_at);
  // Role + first name ("Minister Ifeoluwa"). Own-church requests are
  // never anonymous to their own leader, so isAnonymous=false.
  const leaderLine = formatLeaderLine(row.author_role, row.author_display_name, false);
  const triggerRef = useRef<View>(null);

  const openMenuFromTrigger = () => {
    const node = triggerRef.current;
    if (!node) {
      onOpenMenu({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      onOpenMenu({ x, y, width, height });
    });
  };

  return (
    <Pressable
      onPress={onOpenSheet}
      accessibilityRole="button"
      accessibilityLabel="Open prayer request"
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: row.urgency ? Colors.red : Colors.accent },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardTopRow}>
        <Text style={[styles.body, PRAYER_CARD_BODY_STYLE]} numberOfLines={3}>
          {row.prayer_text}
        </Text>
        <View ref={triggerRef} collapsable={false}>
          <Pressable
            onPress={openMenuFromTrigger}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open prayer request actions"
            style={styles.overflowTrigger}
          >
            <OverflowVerticalIcon size={16} color={Colors.textMuted} />
          </Pressable>
        </View>
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
        <Text style={styles.authorLine} numberOfLines={1}>{leaderLine}</Text>
        {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
      </View>
    </Pressable>
  );
}

// ─── Pull-up action sheet (card body tap) ────────────────────────────

function PrayerActionSheet({
  row,
  onDismiss,
  onEdit,
  onMarkAnswered,
  onDelete,
}: {
  row: OpenPrayerRow | null;
  onDismiss: () => void;
  onEdit: () => void;
  onMarkAnswered: (row: OpenPrayerRow) => void;
  onDelete: (row: OpenPrayerRow) => void;
}) {
  const slideY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (row !== null) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: 0,
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.55,
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: SHEET_HEIGHT,
          duration: ANIM_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: ANIM_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  if (!mounted || row === null) return null;

  const locationLine = getLocationLine(row.church_name ?? 'Your church', row.country ?? null);
  const leaderLine = formatLeaderLine(row.author_role, row.author_display_name, false);
  const timestamp = formatRelativeTime(row.created_at);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable onPress={onDismiss} style={StyleSheet.absoluteFill} accessibilityLabel="Dismiss">
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]}
        />
      </Pressable>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={styles.grabHandle} />

        <Text
          style={[
            styles.sheetLocation,
            { color: row.urgency ? Colors.red : Colors.accent },
          ]}
          numberOfLines={2}
        >
          {locationLine.toUpperCase()}
        </Text>
        <Text style={styles.sheetLeaderLine}>{leaderLine}</Text>

        <Text style={[styles.sheetBody, PRAYER_DETAIL_STYLE]}>{row.prayer_text}</Text>

        <View style={styles.sheetMetaRow}>
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
          {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
        </View>

        {/* Action row */}
        <View style={styles.sheetActions}>
          <SheetActionButton label="Edit" tone="sky" disabled onPress={onEdit} />
          <View style={styles.actionDivider} />
          <SheetActionButton label="Mark as Answered" tone="sky" onPress={() => onMarkAnswered(row)} />
          <View style={styles.actionDivider} />
          <SheetActionButton label="Delete" tone="red" onPress={() => onDelete(row)} />
        </View>
      </Animated.View>
    </View>
  );
}

function SheetActionButton({
  label,
  tone,
  onPress,
  disabled,
}: {
  label: string;
  tone: 'sky' | 'red';
  onPress: () => void;
  disabled?: boolean;
}) {
  const color = disabled ? Colors.textSubtle : tone === 'red' ? Colors.red : Colors.accent;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.sheetActionBtn,
        pressed && !disabled && { backgroundColor: 'rgba(240, 237, 230, 0.04)' },
      ]}
    >
      <Text style={[styles.sheetActionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Anchored contextual menu (⋮ tap) ────────────────────────────────

const MENU_WIDTH = 180;
const MENU_GUTTER = 12;

function AnchoredOverflowMenu({
  anchor,
  onDismiss,
  onEdit,
  onMarkAnswered,
  onDelete,
}: {
  anchor: MenuAnchor;
  onDismiss: () => void;
  onEdit: () => void;
  onMarkAnswered: () => void;
  onDelete: () => void;
}) {
  const { width: winW } = Dimensions.get('window');
  const [menuH, setMenuH] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  // Right-align the menu under the dots, clamped to the screen edges.
  const rawLeft = anchor.x + anchor.width - MENU_WIDTH;
  const left = Math.max(MENU_GUTTER, Math.min(rawLeft, winW - MENU_WIDTH - MENU_GUTTER));
  const top = anchor.y + anchor.height + 4;

  const onMenuLayout = (e: LayoutChangeEvent) => {
    setMenuH(e.nativeEvent.layout.height);
  };

  return (
    <Modal transparent visible onRequestClose={onDismiss} animationType="none">
      <Pressable style={styles.menuBackdrop} onPress={onDismiss} accessibilityLabel="Dismiss menu">
        <Animated.View
          onLayout={onMenuLayout}
          style={[
            styles.menu,
            {
              left,
              top,
              opacity,
              transform: [{ scale }],
            },
            // Reposition above the dots if it would overflow the bottom.
            menuH > 0 && top + menuH > SCREEN_H - MENU_GUTTER
              ? { top: anchor.y - menuH - 4 }
              : null,
          ]}
        >
          <MenuItem label="Edit" onPress={onEdit} disabled />
          <View style={styles.menuDivider} />
          <MenuItem label="Mark as Answered" onPress={onMarkAnswered} tone="sky" />
          <View style={styles.menuDivider} />
          <MenuItem label="Delete" onPress={onDelete} tone="red" />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function MenuItem({
  label,
  onPress,
  tone,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'red' | 'sky';
  disabled?: boolean;
}) {
  const color = disabled
    ? Colors.textSubtle
    : tone === 'red'
      ? Colors.red
      : tone === 'sky'
        ? Colors.accent
        : Colors.text;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.menuItem, pressed && !disabled && { opacity: 0.7 }]}
    >
      <Text style={[styles.menuItemText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Delete confirm (centred) ────────────────────────────────────────

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
          <Text style={styles.confirmHeading}>Delete this prayer request?</Text>
          <Text style={styles.confirmBody}>This cannot be undone.</Text>
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

// ─── Mark-as-answered modal ──────────────────────────────────────────

function AnsweredModal({
  row,
  onDismiss,
  onSubmitTestimony,
  onMarkPrivately,
}: {
  row: OpenPrayerRow | null;
  onDismiss: () => void;
  onSubmitTestimony: (text: string) => Promise<void>;
  onMarkPrivately: () => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const slideY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (row !== null) {
      setText('');
      setSubmitting(false);
      Animated.timing(slideY, {
        toValue: 0,
        duration: ANIM_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      slideY.setValue(SHEET_HEIGHT);
    }
  }, [row, slideY]);

  if (row === null) return null;

  const handleDismiss = () => {
    if (submitting) return;
    if (text.trim().length > 0) {
      Alert.alert('Discard?', 'You have unsaved text.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDismiss },
      ]);
      return;
    }
    onDismiss();
  };

  const remaining = TESTIMONY_MAX_CHARS - text.length;

  const runGuarded = async (fn: () => Promise<void>) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fn();
    } catch {
      // Errors surface via Alert inside the handlers; re-enable the form.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible onRequestClose={handleDismiss} animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={styles.composerBackdrop} onPress={handleDismiss} accessibilityLabel="Dismiss" />
        <Animated.View style={[styles.composerSheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.grabHandle} />

          {/* Go back link, top-left */}
          <Pressable
            onPress={handleDismiss}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.goBackLink}
            disabled={submitting}
          >
            <Text style={styles.goBackText}>← Go back</Text>
          </Pressable>

          <Text style={styles.composerTitle}>How was this answered?</Text>
          <Text style={styles.composerSub}>Share a few words — how did God move?</Text>

          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, TESTIMONY_MAX_CHARS))}
            multiline
            editable={!submitting}
            placeholder="Describe what God did..."
            placeholderTextColor={Colors.textSubtle}
            style={styles.composerInput}
            accessibilityLabel="Testimony text"
          />
          <Text style={styles.composerCharCount}>{remaining}</Text>

          <Pressable
            onPress={() => runGuarded(() => onSubmitTestimony(text.trim()))}
            disabled={text.trim().length === 0 || submitting}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.composerSubmit,
              (text.trim().length === 0 || submitting) && styles.composerSubmitDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.composerSubmitText}>
              {submitting ? 'Sharing...' : 'Submit to Testimony Wall'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => runGuarded(onMarkPrivately)}
            disabled={submitting}
            accessibilityRole="button"
            style={({ pressed }) => [styles.composerGhost, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.composerGhostText}>Mark as answered privately</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Success toast ───────────────────────────────────────────────────

function SuccessToast({ message, onDone }: { message: string | null; onDone: () => void }) {
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message === null) return;
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 80, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => onDone());
    }, 3200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (message === null) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { opacity, transform: [{ translateY }] }]}
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
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
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    color: 'rgba(240, 237, 230, 0.65)',
    textAlign: 'center',
    lineHeight: 27,
  },
  retryText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  backCta: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 181, 232, 0.45)',
    borderRadius: 8,
    backgroundColor: Colors.transparent,
  },
  backCtaText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    letterSpacing: 0.3,
    color: Colors.accent,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 2,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  body: {
    flex: 1,
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
    marginTop: 10,
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
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  timestamp: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },

  // Pull-up action sheet
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SHEET_HEIGHT,
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  sheetLocation: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    lineHeight: 16,
  },
  sheetLeaderLine: {
    marginTop: 4,
    fontFamily: Typography.body,
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(240, 237, 230, 0.45)',
  },
  sheetBody: {
    marginTop: 14,
  },
  sheetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  sheetActions: {
    marginTop: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    // paddingTop: 8 removed — caused first row to appear taller than the others
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: 0,
  },
  sheetActionBtn: {
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
  },

  // Anchored overflow menu
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menu: {
    position: 'absolute',
    minWidth: MENU_WIDTH,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(240, 237, 230, 0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  menuItemText: {
    fontFamily: Typography.body,
    fontSize: 14,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
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
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  confirmHeading: {
    fontFamily: Typography.displayMedium,
    fontSize: 20,
    color: Colors.text,
    letterSpacing: 0.2,
  },
  confirmBody: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  confirmCtaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
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

  // Answered modal / composer
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
    gap: 12,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 26,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: 'rgba(240, 237, 230, 0.18)',
    marginTop: 8,
    marginBottom: 6,
  },
  goBackLink: {
    alignSelf: 'flex-start',
  },
  goBackText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  composerTitle: {
    fontFamily: Typography.displayMedium,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  composerSub: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
  },
  composerInput: {
    minHeight: 120,
    maxHeight: 220,
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  composerCharCount: {
    alignSelf: 'flex-end',
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: -4,
  },
  composerSubmit: {
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  composerSubmitDisabled: {
    opacity: 0.45,
  },
  composerSubmitText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.background,
  },
  composerGhost: {
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerGhostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },

  // James 5:16 scripture banner
  scriptureBanner: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 22,
  },
  scriptureEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.24 * 9, // 0.24em × 9
    textTransform: 'uppercase',
    color: '#6BB5E8',
    marginBottom: 10,
  },
  scriptureVerse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 25,
    color: '#E6E1D5',
    textAlign: 'center',
    maxWidth: 300,
  },

  // Success toast
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 181, 232, 0.30)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  toastText: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    textAlign: 'center',
  },
});
