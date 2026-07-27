// ─────────────────────────────────────────────
// CommentThread — in-place comment thread (KAN-201 home redesign)
//
// Opens in place beneath a card. Conversational sans (NOT scripture
// italic). Fetches its own data on mount via get_comments(announcementId)
// and posts via post_comment — the parent card does NOT pre-fetch.
//
// Two independent masking axes (decoupled 2026-06-21):
//   1. users.anonymous → the LEADER's name is held → author_name === null
//      on the wire → "A fellow {role}" label, square avatar with "A".
//   2. churches.type='underground' + show_church_name=false → the CHURCH is
//      held → church_name === null on the wire → region label fallback,
//      round avatar with lock icon.
// The two are independent: an underground leader who did NOT toggle
// anonymous still surfaces their real name. Masking is enforced
// server-side in get_comments; the client never receives author_id.
//
// Two ways to close: the parent card's footer toggle, or the "Hide"
// control in this thread header. Tapping inside the thread must not
// toggle the card body — the parent renders this inside its own
// Pressable boundary and the inputs here stop propagation implicitly
// (TextInput / Pressable capture their own touches).
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors, Radius, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase } from '../../lib/supabase';
import { commentIdentity } from './CommentThreadLogic';
import { Chevron, LockIcon } from './HomeIcons';

// Display shape for one comment row. Mirrors the get_comments RPC return
// (id, body, created_at, is_masked, mask_reason, masked_region, full_name,
// church_name, role) — author_id is NEVER part of this shape (the RPC
// does not return it). `role` is the raw users.role enum value; it is
// present for all mask_reason values (the RPC returns role even for masked
// rows to allow humanised "A fellow [role]" display). `mask_reason` drives
// all masking decisions client-side; `is_masked` is retained for any
// legacy consumers but `mask_reason` is the canonical discriminant.
export type Comment = {
  id: string;
  body: string;
  created_at: string;
  is_masked: boolean;
  mask_reason: 'none' | 'anon' | 'underground' | 'no_church';
  masked_region: string | null;
  author_name: string | null;  // matches get_comments RPC column name
  church_name: string | null;
  role: string | null;
  // get_comments v3 composed contract (kan338_0006, KAN-338 FE cutover):
  // the server composes ALL identity display; the FE renders verbatim and
  // derives only the avatar affordance from the three LIVE-state booleans
  // (never from the write-time mask_reason — the F1/F3 defect class).
  display_name: string;
  name_held: boolean;
  church_label: string;
  church_held: boolean;
  is_underground: boolean;
  avatar_initial: string | null;
};

type RpcCommentRow = Comment;

// Identity display is fully server-composed since get_comments v3
// (kan338_0006): `display_name` renders verbatim, `church_label` carries
// the church name or macro-region label, and the avatar affordance comes
// from commentIdentity() off the LIVE-state booleans. No name composition
// and no mask_reason branching happens on the client anymore.

// Threads rest at this many comments; the rest open on demand (Founder
// 2026-07-27). Newest stay visible — a thread reads bottom-up, so the
// fold hides the OLDEST, matching how the card body folds.
const COMMENT_PAGE = 5;

// Local relative-time — light-touch, mirrors the feed's register. Kept
// inline so the thread has no cross-module coupling beyond the RPC.
function relTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < m) return 'just now';
  if (diff < h) return `${Math.floor(diff / m)}m`;
  if (diff < d) return `${Math.floor(diff / h)}h`;
  return `${Math.floor(diff / d)}d`;
}

export function CommentThread({
  announcementId,
  count,
  onClose,
  onCommentPosted,
}: {
  announcementId: string;
  count: number;
  onClose: () => void;
  onCommentPosted?: () => void;
}) {
  const { branch } = useAuth();
  // Unverified leaders can READ comments but not POST — the composer is
  // simply absent for them (the post_comment RPC also hard-gates this).
  const canPost = branch === 'active';

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Long threads rest at COMMENT_PAGE and open on demand (Founder
  // 2026-07-27) so a busy card never buries the rest of the feed. Same
  // page-turn grammar as the cards: quiet rule + mono label, no button.
  const [showAll, setShowAll] = useState(false);

  const loadComments = async () => {
    setLoading(true);
    setErrored(false);
    const { data, error } = await supabase.rpc('get_comments', {
      p_announcement_id: announcementId,
    });
    if (error) {
      setErrored(true);
      setLoading(false);
      return;
    }
    setComments(((data ?? []) as RpcCommentRow[]).map((r) => ({ ...r })));
    setLoading(false);
  };

  // Post-submit re-fetch — keeps the existing comment list visible while
  // the authoritative server rows (masking, region) silently replace it.
  // Distinct from loadComments so the spinner only shows on initial load,
  // never after a successful post (device pass: the list flickered away).
  const reloadAfterPost = async () => {
    setRefreshing(true);
    const { data, error } = await supabase.rpc('get_comments', {
      p_announcement_id: announcementId,
    });
    if (!error) {
      setComments(((data ?? []) as RpcCommentRow[]).map((r) => ({ ...r })));
    }
    setRefreshing(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_comments', {
        p_announcement_id: announcementId,
      });
      if (cancelled) return;
      if (error) {
        setErrored(true);
        setLoading(false);
        return;
      }
      setComments(((data ?? []) as RpcCommentRow[]).map((r) => ({ ...r })));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [announcementId]);

  const submitComment = async () => {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.rpc('post_comment', {
      p_announcement_id: announcementId,
      p_body: body,
    });
    setSubmitting(false);
    if (error) {
      // Quiet failure — keep the draft so the leader can retry.
      return;
    }
    setDraft('');
    // Optimistically bump the parent footer count before the silent
    // re-fetch lands (device pass: footer stuck at 0 after posting).
    onCommentPosted?.();
    // Re-fetch so masking + server-side fields (is_masked / region) are
    // authoritative rather than guessed client-side for the new row.
    // reloadAfterPost (not loadComments) keeps the list visible — no spinner.
    void reloadAfterPost();
  };

  const total = loading || errored ? count : comments.length;
  // Keep the NEWEST COMMENT_PAGE; the fold hides older ones above them.
  const hidden = showAll ? 0 : Math.max(0, comments.length - COMMENT_PAGE);
  const visible = hidden > 0 ? comments.slice(hidden) : comments;

  return (
    <View>
      <View style={s.head}>
        <Text style={s.headLabel}>Comments {'·'} {total}</Text>
        <Pressable onPress={onClose} hitSlop={8} style={s.hide}>
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Chevron color={Colors.accent} />
          </View>
        </Pressable>
      </View>

      {loading && comments.length === 0 && !refreshing ? (
        <View style={s.loading}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : errored ? (
        <Pressable onPress={loadComments} hitSlop={8} style={s.retryWrap}>
          <Text style={s.retry}>Couldn't load comments — tap to retry</Text>
        </Pressable>
      ) : (
        <View style={s.list}>
          {hidden > 0 && !showAll && (
            <Pressable
              onPress={() => setShowAll(true)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${hidden} earlier ${hidden === 1 ? 'comment' : 'comments'}`}
              style={s.moreRow}
              hitSlop={6}
            >
              <View style={s.moreRule} />
              <Text style={s.moreText}>
                {`show ${hidden} earlier ${hidden === 1 ? 'comment' : 'comments'}`}
              </Text>
            </Pressable>
          )}
          {visible.map((c) => {
            // Server-composed identity + live-state avatar affordance
            // (KAN-338 FE cutover — the seven states are pinned in
            // CommentThreadLogic.test.ts; the round lock now correctly
            // covers anonymous underground leaders).
            const id = commentIdentity(c);
            return (
              <View key={c.id} style={s.row}>
                <View style={[s.av, id.round && s.avRound]}>
                  {id.glyph === 'initial' ? (
                    <Text style={s.avInitial}>{id.initial}</Text>
                  ) : id.glyph === 'letterA' ? (
                    <Text style={s.avInitial}>A</Text>
                  ) : (
                    <LockIcon />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text style={s.cname} numberOfLines={1}>{id.displayName}</Text>
                    <Text style={s.ctime}>{relTime(c.created_at)}</Text>
                  </View>
                  {!!id.churchLine && <Text style={s.cchurch} numberOfLines={1}>{id.churchLine}</Text>}
                  <Text style={s.ctext}>{c.body}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {canPost && (
        <View style={s.compose}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a word…"
            placeholderTextColor={Colors.textSubtle}
            style={s.field}
            editable={!submitting}
            multiline
          />
          <Pressable
            onPress={submitComment}
            disabled={!draft.trim() || submitting}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
          >
            <Text style={[s.send, (!draft.trim() || submitting) && s.sendDisabled]}>
              Post
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  headLabel: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textMuted, letterSpacing: 0.4 },
  hide: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  loading: { paddingVertical: 22, alignItems: 'center' },
  retryWrap: { paddingVertical: 18, alignItems: 'center' },
  retry: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textSubtle, letterSpacing: 0.4 },

  list: { marginTop: 16, gap: 18 },
  // Page-turn affordance — mirrors the cards' read-on cue: hairline rule
  // + lowercase mono, never a filled button.
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  moreRule: { width: 24, height: 1, backgroundColor: Colors.border },
  moreText: { fontFamily: Typography.mono, fontSize: 12, letterSpacing: 1.2, color: Colors.textSubtle },
  row: { flexDirection: 'row', gap: 11 },
  av: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm + 4,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avRound: { borderRadius: 15 },
  avInitial: { fontFamily: Typography.displayRegular, fontSize: 14, color: Colors.textMuted },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  cname: { fontFamily: Typography.bodyMedium, fontSize: 13.5, color: Colors.text, flex: 1 },
  ctime: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle, flexShrink: 0 },
  cchurch: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle, marginTop: 1 },
  ctext: { fontFamily: Typography.body, fontSize: 14, lineHeight: 21, color: 'rgba(240,237,230,0.72)', marginTop: 4 },

  compose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  field: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.text,
    maxHeight: 100,
  },
  send: { fontFamily: Typography.mono, fontSize: 11.5, color: Colors.accent, letterSpacing: 0.4 },
  sendDisabled: { color: Colors.textSubtle },
});
