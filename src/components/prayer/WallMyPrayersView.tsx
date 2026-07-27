// ─────────────────────────────────────────────
// WallMyPrayersView — Prayer Wall rebuild · View 3 (My Prayers)
// Spec: docs/design_handoff_prayer_wall_NEW/README.md §View 3 + gate.
//
// Rows do not expand — the leader's own open requests render in full,
// with a ⋮ overflow that opens an INLINE menu (Mark as testimony /
// Remove) and an inline mark-as-testimony composer. No sheets, no
// routes; the header and tabs stay mounted (README structural move #1
// applied to this view's flows too).
//
// RPC contract (unchanged from MyOpenPrayersView):
//   get_open_prayers()                          — own church's open rows
//   create_testimony(p_request_id,
//                    p_testimony_text)          — RETURNS uuid; blank
//                    composer publishes DEFAULT_TESTIMONY_TEXT verbatim
//   soft_delete_prayer_request(p_request_id)
//
// Edit-a-request existed in the old view and is deliberately absent
// here (post-MVP, NOTES-postmvp.md).
//
// Gate: list hidden, sub-line NOT YET VERIFIED, post CTA hidden, gate
// panel with the accounts@ mail link (EMAIL re-used from
// VerificationBanner — README). Copy verbatim; prayer is never gated,
// only the feature.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { EMAIL } from '../home/VerificationBanner';
import { formatRelativeTime } from './PrayerWallLogic';
import { DEFAULT_TESTIMONY_TEXT, rpcAppError } from './wallNewLogic';
import { WallEmpty, WallScriptureFooter } from './WallPrimitives';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PSALM_55_22 = 'Cast thy burden upon the Lord, and he shall sustain thee.';
const PSALM_55_22_REF = 'PSALM 55:22 · KJV';

const OFF_WHITE = '#E6E1D5';

// Wire shape of get_open_prayers — mirrored from MyOpenPrayersView.
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

// create_testimony error codes → inline copy (aligned with
// MyOpenPrayersView's map). Audited live 2026-07-25: the RPC returns
// jsonb { error: code } over HTTP 200 — codes arrive in the PAYLOAD,
// not as error.message. Both paths feed this map.
function testifyErrorCopy(code: string | null | undefined): string {
  switch (code) {
    case 'content_too_long':   return 'Your testimony is too long (300 character limit).';
    case 'already_converted':  return 'This prayer request has already been marked as answered.';
    case 'not_verified':       return 'Your church must be verified to post.';
    default:                   return 'Something went wrong. Try again.';
  }
}

type LoadState = 'initial' | 'idle' | 'error';

interface Props {
  isVerified: boolean;
  onPost: () => void;
  // Fired after a successful mark-as-testimony so the host can refresh
  // the Testimonies rows (the new testimony must be there on next visit).
  onTestimonyCreated: () => void;
  onToast: (msg: string) => void;
}

export default function WallMyPrayersView({ isVerified, onPost, onTestimonyCreated, onToast }: Props) {
  const [rows, setRows] = useState<OpenPrayerRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('initial');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [testifyingId, setTestifyingId] = useState<string | null>(null);
  const [testimonyDraft, setTestimonyDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_open_prayers');
    if (error) {
      setLoadState('error');
      return;
    }
    setRows((data ?? []) as OpenPrayerRow[]);
    setLoadState('idle');
  }, []);

  useEffect(() => {
    if (!isVerified) return; // gated — list hidden, no fetch needed
    void load();
  }, [isVerified, load]);

  const animate = () =>
    LayoutAnimation.configureNext(
      LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );

  const openMenu = (id: string) => {
    animate();
    setMenuId((prev) => (prev === id ? null : id));
    setTestifyingId(null);
    setInlineError(null);
  };

  const beginTestify = (id: string) => {
    animate();
    setTestifyingId(id);
    setMenuId(null);
    setTestimonyDraft('');
    setInlineError(null);
  };

  const confirmTestify = async (row: OpenPrayerRow) => {
    if (submitting) return;
    setSubmitting(true);
    setInlineError(null);
    const text = testimonyDraft.trim() || DEFAULT_TESTIMONY_TEXT;
    const { data, error } = await supabase.rpc('create_testimony', {
      p_request_id: row.id,
      p_testimony_text: text,
    });
    setSubmitting(false);
    const appErr = error ? null : rpcAppError(data);
    if (error || appErr) {
      setInlineError(testifyErrorCopy(appErr ?? error?.message));
      return;
    }
    animate();
    setRows((prev) => prev.filter((r) => r.id !== row.id)); // leaves My Prayers
    setTestifyingId(null);
    onTestimonyCreated();
    onToast('Marked as testimony — moved to Testimonies.');
  };

  const remove = async (row: OpenPrayerRow) => {
    const { data, error } = await supabase.rpc('soft_delete_prayer_request', { p_request_id: row.id });
    if (error || rpcAppError(data)) {
      onToast('Not removed yet — try again in a moment.');
      return;
    }
    animate();
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setMenuId(null);
    onToast('Removed from your prayers.');
  };

  // ─── Gate panel ─────────────────────────────────────────────────────
  // Entry hub (Founder 2026-07-25): the heading block is fixed in every
  // branch of this view; content scrolls beneath the hairline boundary.
  if (!isVerified) {
    return (
      <View style={s.root}>
        <View style={s.hub}>
          <Text style={s.heading}>Your church's open prayers</Text>
          <Text style={s.subLine}>NOT YET VERIFIED</Text>
        </View>
        <ScrollView contentContainerStyle={s.gateScroll}>
        <View style={s.gatePanel}>
          <Text style={s.gateHeading}>Verification pending</Text>
          <Text style={s.gateBody}>
            Your church is visible to the network but limited until verified. Posting and
            interceding open once the Replant team confirms your church.
          </Text>
          <Text style={s.gateItalic}>
            You are welcome to read the wall and pray with the body in the meantime.
          </Text>
          <Pressable
            onPress={() => Linking.openURL(`mailto:${EMAIL}`)}
            accessibilityRole="button"
            accessibilityLabel={`Email the Replant team at ${EMAIL}`}
            hitSlop={8}
          >
            <Text style={s.gateMail}>QUESTIONS? EMAIL {EMAIL.toUpperCase()}</Text>
          </Pressable>
          <View style={s.gateRule} />
        </View>
        </ScrollView>
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={s.root}>
        <View style={s.hub}>
          <Text style={s.heading}>Your church's open prayers</Text>
          <Text style={s.subLine}>—</Text>
        </View>
        <View style={s.stateWrap}>
          <Text style={s.errorCopy}>Couldn't load your prayers right now.</Text>
          <Pressable onPress={() => { setLoadState('initial'); void load(); }} hitSlop={8} accessibilityRole="button">
            <Text style={s.retry}>TAP TO RETRY</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loadState === 'initial') {
    return (
      <View style={s.root}>
        <View style={s.hub}>
          <Text style={s.heading}>Your church's open prayers</Text>
          <Text style={s.subLine}>—</Text>
        </View>
        <View style={s.stateWrap}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  const totalInterceding = rows.reduce((sum, r) => sum + r.prayed_count, 0);

  return (
    <View style={s.root}>
      <View style={s.hub}>
        <Text style={s.heading}>Your church's open prayers</Text>
        {/* Counts must read 0, not hide (README empty-state rule). */}
        <Text style={s.subLine}>
          {rows.length} OPEN · {totalInterceding} INTERCEDING
        </Text>
      </View>
    <ScrollView contentContainerStyle={s.scroll}>

      {rows.length === 0 ? (
        <>
          <WallEmpty
            heading="Nothing lifted yet."
            body="When your church brings something before the Lord, post it here and the body will carry it with you."
          />
          <View style={{ paddingHorizontal: 22 }}>
            <PostButton onPost={onPost} topMargin={16} />
          </View>
        </>
      ) : (
        <>
          {rows.map((row) => (
            <View key={row.id} style={s.row}>
              <View style={s.rowTop}>
                <Text style={s.prayerText}>{row.prayer_text}</Text>
                <Pressable
                  onPress={() => openMenu(row.id)}
                  hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                  accessibilityRole="button"
                  accessibilityLabel="More actions"
                  accessibilityState={{ expanded: menuId === row.id }}
                >
                  <Text style={s.overflow}>⋮</Text>
                </Pressable>
              </View>

              <View style={s.metaRow}>
                <Text style={s.metaLeft} numberOfLines={1}>
                  Posted {formatRelativeTime(row.created_at)}
                </Text>
                <Text style={s.metaRight} numberOfLines={1}>
                  {row.prayed_count} interceding
                </Text>
              </View>

              {menuId === row.id ? (
                <View style={s.menu}>
                  <Pressable
                    onPress={() => beginTestify(row.id)}
                    style={s.menuRow}
                    accessibilityRole="button"
                    accessibilityLabel="Mark as testimony"
                  >
                    <View style={s.menuDot} />
                    <Text style={s.menuLabel}>MARK AS TESTIMONY</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void remove(row)}
                    style={s.menuRow}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this prayer request"
                  >
                    <Text style={s.menuLabelDim}>REMOVE</Text>
                  </Pressable>
                </View>
              ) : null}

              {testifyingId === row.id ? (
                <View style={s.testify}>
                  <Text style={s.testifyLabel}>THE ANSWER</Text>
                  <TextInput
                    value={testimonyDraft}
                    onChangeText={setTestimonyDraft}
                    multiline
                    maxLength={300}
                    editable={!submitting}
                    placeholder="Add a few words of praise — or mark it as it stands."
                    placeholderTextColor="rgba(240,237,230,0.30)"
                    style={s.testifyInput}
                    textAlignVertical="top"
                  />
                  {inlineError ? <Text style={s.inlineError}>{inlineError}</Text> : null}
                  <View style={s.testifyActions}>
                    <Pressable
                      onPress={() => void confirmTestify(row)}
                      disabled={submitting}
                      accessibilityRole="button"
                      accessibilityLabel="Mark as testimony"
                      style={[s.testifyBtn, submitting && { opacity: 0.5 }]}
                    >
                      {submitting ? (
                        <ActivityIndicator color={Colors.text} size="small" />
                      ) : (
                        <Text style={s.testifyBtnLabel}>MARK AS TESTIMONY</Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => { animate(); setTestifyingId(null); }}
                      disabled={submitting}
                      hitSlop={8}
                      accessibilityRole="button"
                    >
                      <Text style={s.cancel}>CANCEL</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ))}

          <View style={{ paddingHorizontal: 22 }}>
            <PostButton onPost={onPost} topMargin={20} />
          </View>
        </>
      )}

      <WallScriptureFooter text={PSALM_55_22} reference={PSALM_55_22_REF} />
    </ScrollView>
    </View>
  );
}

function PostButton({ onPost, topMargin }: { onPost: () => void; topMargin: number }) {
  return (
    <Pressable
      onPress={onPost}
      accessibilityRole="button"
      accessibilityLabel="Post a prayer request"
      style={({ pressed }) => [s.postBtn, { marginTop: topMargin }, pressed && { opacity: 0.7 }]}
    >
      <Text style={s.postBtnLabel}>+ POST A PRAYER REQUEST</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { paddingBottom: 8 },
  gateScroll: { paddingBottom: 40 },
  root: { flex: 1 },
  // Entry hub — fixed heading zone; bottom hairline is the scroll boundary.
  hub: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderAccentSubtle,
  },
  heading: { fontFamily: Typography.displayRegular, fontSize: 22, color: Colors.text },
  subLine: {
    marginTop: 7,
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.40)',
  },

  row: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderAccentSubtle,
    paddingTop: 19,
    paddingHorizontal: 22,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  prayerText: { flex: 1, fontFamily: Typography.displayRegular, fontSize: 18, lineHeight: 27, color: Colors.text },
  overflow: { fontSize: 16, color: 'rgba(240,237,230,0.40)', lineHeight: 20 },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 11,
    marginBottom: 19,
    gap: 12,
  },
  metaLeft: { fontFamily: Typography.body, fontSize: 10.5, color: 'rgba(240,237,230,0.38)' },
  metaRight: { fontFamily: Typography.body, fontSize: 10.5, color: 'rgba(240,237,230,0.45)' },

  menu: {
    borderWidth: 1,
    borderColor: Colors.borderAccentSubtle,
    borderRadius: 8,
    marginBottom: 19,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 15 },
  menuDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: OFF_WHITE, opacity: 0.85 },
  menuLabel: { fontFamily: Typography.mono, fontSize: 9.5, letterSpacing: 1.4, color: Colors.text },
  menuLabelDim: { fontFamily: Typography.mono, fontSize: 9.5, letterSpacing: 1.4, color: 'rgba(240,237,230,0.50)' },

  testify: {
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(240,237,230,0.18)',
    paddingLeft: 13,
    marginBottom: 19,
  },
  testifyLabel: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.38)',
  },
  testifyInput: {
    marginTop: 8,
    minHeight: 66,
    fontFamily: Typography.displayRegular, // roman — never synthetic italic
    fontSize: 18,
    lineHeight: 26,
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,237,230,0.14)',
    paddingBottom: 8,
  },
  inlineError: { marginTop: 8, fontFamily: Typography.body, fontSize: 12, lineHeight: 17, color: Colors.red },
  testifyActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 12 },
  testifyBtn: {
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.30)',
    borderRadius: 7,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  testifyBtnLabel: { fontFamily: Typography.mono, fontSize: 9.5, letterSpacing: 1.4, color: Colors.text },
  cancel: { fontFamily: Typography.mono, fontSize: 9.5, letterSpacing: 1.4, color: 'rgba(240,237,230,0.45)' },

  postBtn: {
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.30)',
    borderRadius: 7,
    paddingVertical: 13,
    alignItems: 'center',
  },
  postBtnLabel: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1.6, color: Colors.accent },

  gatePanel: {
    marginHorizontal: 22,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 24,
  },
  gateHeading: { fontFamily: Typography.displayRegular, fontSize: 22, color: Colors.text },
  gateBody: {
    marginTop: 10,
    fontFamily: Typography.sansLight,
    fontSize: 13,
    lineHeight: 21.5,
    color: 'rgba(240,237,230,0.50)',
  },
  gateItalic: {
    marginTop: 14,
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(240,237,230,0.45)',
  },
  gateMail: {
    marginTop: 20,
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: 'rgba(240,237,230,0.32)',
  },
  gateRule: { marginTop: 10, height: 1, backgroundColor: Colors.border },

  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  errorCopy: { fontFamily: Typography.body, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  retry: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1.5, color: Colors.accent },
});
