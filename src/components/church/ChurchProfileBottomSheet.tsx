// ─────────────────────────────────────────────
// ChurchProfileBottomSheet — KAN-20
//
// Reusable bottom sheet showing a church's profile, fetched on tap via
// the get_church_profile RPC (SECURITY DEFINER). Built to be imported
// directly by the Local-tab map screen AND by KAN-21 (globe view) — it
// is NOT a page-local component. Consumers control it with `churchId`
// (null = closed) and dismiss via `onDismiss`.
//
// Sheet mechanics mirror the established in-repo pattern
// (PrayerWallDetailSheet / TestimonyDetailSheet): RN Modal + Animated
// slide-up + PanResponder swipe-down + dim-only backdrop. @gorhom/bottom-
// sheet, reanimated, gesture-handler and expo-blur are all NOT installed
// (KAN-20 Step 0); this pattern needs none of them.
//
// Data contract — get_church_profile returns:
//   { id, name, type, rag_status, rag_label, city, country,
//     state_declaration, needs[], resources[], has_emergency_plan,
//     open_to_collaboration, website_url, primary_language,
//     denomination_affiliation, congregation_size_range,
//     show_contact_on_profile, member_since, leaders[] }
//   leaders: { name: string|null, role: string(raw enum), anonymous: bool }
//     - anonymous=true  → name is null → render role pill + "Name withheld"
//     - anonymous=false → full_name (server returns the complete name —
//                         device-pass-fixes-1 Fix 1: display_name_preference
//                         is no longer consulted on this surface, since
//                         the profile card shows the full identity, not
//                         a Connect-style first-name token)
//   contact_email + address appended ONLY when show_contact_on_profile=true.
//   Pending churches: rag_label = "Verification in progress", leaders = [].
//
// Safety: anonymous leaders never carry a name field client-side. Phone is
// never in the response. Unverified viewers never open the sheet at all.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useReducedMotion } from '../../utils/useReducedMotion';
import {
  getChurchTypeLabel,
  getCongregationSizeLabel,
  getRoleLabel,
} from '../../utils/displayHelpers';
import { XIcon, HeartIcon } from '../prayer/PrayerIcons';

// ─── Types ────────────────────────────────────────────────────────────

export interface ChurchProfileLeader {
  name: string | null;
  role: string;
  anonymous: boolean;
}

export interface ChurchProfile {
  id: string;
  name: string;
  type: string;
  rag_status: string;
  rag_label: string;
  city: string | null;
  country: string | null;
  state_declaration: string | null;
  needs: string[] | null;
  resources: string[] | null;
  has_emergency_plan: boolean | null;
  open_to_collaboration: boolean | null;
  website_url: string | null;
  primary_language: string | null;
  denomination_affiliation: string | null;
  congregation_size_range: string | null;
  show_contact_on_profile: boolean;
  member_since: string;
  leaders: ChurchProfileLeader[];
  // Contact — present only when show_contact_on_profile = true.
  contact_email?: string | null;
  address?: string | null;
  // Network ID pill (RPL-XXXXX). NOTE: get_church_profile does not return
  // a church_code/network_id field today — the pill renders only if a
  // future RPC revision supplies it. Flagged in the KAN-20 build summary.
  network_id?: string | null;
}

interface Props {
  /** Target church id. null = sheet closed. */
  churchId: string | null;
  /** Is this the viewer's own church? Enables the My Church variant. */
  isOwnChurch?: boolean;
  /** Viewer's verification status. false → verify-gate modal, no sheet. */
  viewerVerified: boolean;
  onDismiss: () => void;
  /** My Church "Edit profile" CTA. */
  onEditProfile?: () => void;
  /** Connect button — navigates to Connect tab. */
  onNavigateToConnect?: () => void;
}

const { height: SCREEN_H } = Dimensions.get('window');
// Fix 5 (2026-05-28): snap height bumped 0.62 → 0.65 per dispatch
// "60–70% of screen".
// KAN-20 R3 (2026-05-28): bumped 0.65 → 0.86 to match CD
// .profile-sheet { height: 86% } directly. With the sticky header
// extracted from the scroller (R3 Fix 3c), the leader's identity stays
// pinned at the top across the full sheet height — the longer body
// can breathe.
const SHEET_RATIO = 0.86;
const SHEET_HEIGHT = SCREEN_H * SHEET_RATIO;
const ANIM_MS = 320;
const SWIPE_DISMISS_THRESHOLD = 80;
const TOAST_MS = 2200;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMemberSince(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function joinList(items: string[] | null): string | null {
  if (!items || items.length === 0) return null;
  return items.join(', ');
}

// ─── Component ────────────────────────────────────────────────────────

export default function ChurchProfileBottomSheet({
  churchId,
  isOwnChurch = false,
  viewerVerified,
  onDismiss,
  onEditProfile,
  onNavigateToConnect,
}: Props) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [profile, setProfile] = useState<ChurchProfile | null>(null);

  // Local MVP UI state (no backend wiring this ticket).
  const [saved, setSaved] = useState(false);
  const [prayed, setPrayed] = useState(false);
  const [contactVisible, setContactVisible] = useState(false); // My Church toggle mirror
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // ── Verify-gate: unverified viewers never open the sheet ──
  useEffect(() => {
    if (churchId !== null && !viewerVerified) {
      Alert.alert(
        'Verify your account',
        'Verify your account to view church details.',
        [{ text: 'OK', onPress: onDismiss }],
      );
    }
    // onDismiss intentionally omitted — fire once per churchId change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churchId, viewerVerified]);

  const open = churchId !== null && viewerVerified;

  // ── Fetch on open ──
  const fetchProfile = useCallback(async (id: string) => {
    setLoading(true);
    setError(false);
    setProfile(null);
    const { data, error: rpcErr } = await supabase.rpc('get_church_profile', {
      p_church_id: id,
    });
    if (rpcErr || data === null || data === undefined) {
      setError(true);
      setLoading(false);
      return;
    }
    const p = data as ChurchProfile;
    setProfile(p);
    setContactVisible(!!p.show_contact_on_profile);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open && churchId) {
      void fetchProfile(churchId);
    }
  }, [open, churchId, fetchProfile]);

  // ── Slide animation ──
  useEffect(() => {
    if (open) {
      setMounted(true);
      if (reduced) {
        slideY.setValue(0);
        backdropOpacity.setValue(0.55);
      } else {
        Animated.parallel([
          Animated.timing(slideY, { toValue: 0, duration: ANIM_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(backdropOpacity, { toValue: 0.55, duration: ANIM_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
      }
    } else if (mounted) {
      const done = () => {
        setMounted(false);
        setProfile(null);
        setError(false);
      };
      if (reduced) {
        slideY.setValue(SHEET_HEIGHT);
        backdropOpacity.setValue(0);
        done();
      } else {
        Animated.parallel([
          Animated.timing(slideY, { toValue: SHEET_HEIGHT, duration: ANIM_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(backdropOpacity, { toValue: 0, duration: ANIM_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]).start(done);
      }
    }
    // mounted excluded — react to open changes, not mount churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reduced]);

  // ── Toast ──
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
    }, TOAST_MS);
  }, [toastOpacity]);

  // ── Swipe-down dismiss ──
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) slideY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > SWIPE_DISMISS_THRESHOLD) {
          onDismissRef.current();
        } else {
          Animated.timing(slideY, { toValue: 0, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  // ── Action handlers (MVP stubs / local) ──
  const handleConnect = () => {
    onDismiss();
    onNavigateToConnect?.();
  };

  const handlePray = () => {
    // Fix D (2026-05-28): toggle. On-add → toast; on-remove → silent.
    const next = !prayed;
    setPrayed(next);
    if (next) showToast('Added to your intercession list');
    // MVP: write-only, no backend. TODO: wire intercession list.
  };

  const handleSave = () => {
    setSaved((s) => !s); // MVP local stub. TODO: persist saved churches.
  };

  const handleShare = () => {
    showToast('Sharing coming soon'); // MVP stub. TODO: wire Share sheet.
  };

  const handleReport = () => {
    showToast('Report received'); // MVP stub. TODO: wire report-concern flow.
  };

  const handleToggleVisibility = () => {
    // My Church visibility toggle — confirmation then stub.
    const turningOn = !contactVisible;
    if (turningOn) {
      Alert.alert(
        'Show contact on profile',
        'Other leaders will be able to see your email and address. You can change this at any time.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: () => {
              setContactVisible(true);
              // TODO(KAN-209): persist show_contact_on_profile via RPC/update.
            },
          },
        ],
      );
    } else {
      setContactVisible(false);
      // TODO(KAN-209): persist show_contact_on_profile = false.
    }
  };

  const handleWebsite = (url: string) => {
    void Linking.openURL(url.startsWith('http') ? url : `https://${url}`).catch(() => {});
  };

  if (!mounted) return null;

  const sizeLabel = profile ? getCongregationSizeLabel(profile.congregation_size_range) : null;
  const haveText = profile ? joinList(profile.resources) : null;
  const needText = profile ? joinList(profile.needs) : null;
  const memberSince = profile ? formatMemberSince(profile.member_since) : null;
  const showContactSection =
    !!profile?.show_contact_on_profile && !!(profile?.contact_email || profile?.address);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Dim backdrop — tap dismisses (the visible map sits above). */}
        <Pressable onPress={onDismiss} style={StyleSheet.absoluteFill} accessibilityLabel="Dismiss church profile">
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]} />
        </Pressable>

        {/* Sheet */}
        <Animated.View
          style={[styles.sheet, { height: SHEET_HEIGHT, transform: [{ translateY: slideY }] }]}
        >
          {/* Grip + close (grip area owns the swipe-down responder) */}
          <View {...panResponder.panHandlers}>
            <View style={styles.grabHandle} />
            {/* KAN-20 R4 — hitSlop bumped 10 → 12 on every edge so the
                Pressable's touch target lands at 28 + 24 = 52 pt × 52 pt,
                comfortably above Apple HIG / Material 44 pt minimum and
                easier to find with the thumb at the top-right corner. */}
            <Pressable
              onPress={onDismiss}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              style={styles.closeX}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <XIcon size={14} color={Colors.textMuted} />
            </Pressable>
          </View>

          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <View style={styles.stateBox}>
              <Text style={styles.errorText}>Couldn't load this church right now.</Text>
              <Pressable onPress={() => churchId && fetchProfile(churchId)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.retryText}>Tap to retry</Text>
              </Pressable>
            </View>
          ) : profile ? (
            <>
              {/* KAN-20 R3 — Sticky head: lives OUTSIDE the ScrollView so
                  RAG/RPL row, church name, leaders, and location stay
                  pinned at the top while the body scrolls. Matches CD
                  .profile-head (flex-shrink: 0, border-bottom hairline). */}
              <View style={styles.profileHead}>
                <View style={styles.ragRow}>
                  <View style={[styles.ragPill, { backgroundColor: ragSoftBg(profile.rag_status) }]}>
                    <View style={[styles.ragDot, { backgroundColor: ragColor(profile.rag_status) }]} />
                    <Text style={[styles.ragLabel, { color: ragColor(profile.rag_status) }]}>
                      {profile.rag_label}
                    </Text>
                  </View>
                  {profile.network_id ? (
                    <Text style={styles.rplTag}>{profile.network_id}</Text>
                  ) : null}
                </View>

                <Text style={styles.churchName}>{profile.name}</Text>

                {/* Leaders (hidden entirely when empty — e.g. pending) */}
                {profile.leaders.length > 0 ? (
                  <View style={styles.leadersStack}>
                    {profile.leaders.slice(0, 2).map((l, i) => (
                      <View key={i} style={styles.leaderRow}>
                        <View style={styles.rolePill}>
                          <Text style={styles.rolePillText}>{getRoleLabel(l.role)}</Text>
                        </View>
                        {l.anonymous || !l.name ? (
                          <Text style={styles.nameWithheld}>Name withheld</Text>
                        ) : (
                          <Text style={styles.leaderName}>{l.name}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                ) : null}

                <Text style={styles.locationLine}>
                  {[profile.city, profile.country].filter(Boolean).join(', ')}
                  {profile.city || profile.country ? ' · ' : ''}
                  {getChurchTypeLabel(profile.type)}
                </Text>

                {isOwnChurch ? (
                  <View style={styles.ownEyebrow}>
                    <Text style={styles.ownEyebrowText}>THIS IS HOW OTHERS SEE YOU</Text>
                  </View>
                ) : null}
              </View>

              <ScrollView
                style={styles.bodyScroll}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
              >
                {/* ── Identity ── */}
                <SectionHeader>Identity</SectionHeader>
                <KVRow k="Type" v={getChurchTypeLabel(profile.type)} />
                <KVRow k="Denomination" v={profile.denomination_affiliation || '—'} />
                <KVRow k="Language" v={profile.primary_language || '—'} />
                <KVRow k="Congregation" v={sizeLabel || 'Not specified'} />
                <KVRow k="Member since" v={memberSince || '—'} />
                {profile.website_url ? (
                  <Pressable onPress={() => handleWebsite(profile.website_url as string)}>
                    <KVRow k="Website" v={profile.website_url} valueStyle={styles.linkValue} />
                  </Pressable>
                ) : null}

                {/* ── Posture ── */}
                <SectionHeader>Posture</SectionHeader>
                <Freeform label="What we have" body={haveText} />
                <Freeform label="What we need" body={needText} />
                <View style={styles.eapRow}>
                  <EapChip
                    label="Emergency Plan"
                    on={!!profile.has_emergency_plan}
                    onText="In place"
                    offText="Not yet"
                  />
                  <EapChip
                    label="Open to collaborate"
                    on={!!profile.open_to_collaboration}
                    onText="Yes"
                    offText="No"
                  />
                </View>

                {/* ── Contact (conditional) ── */}
                <SectionHeader>Contact</SectionHeader>
                {showContactSection ? (
                  <>
                    {profile.contact_email ? (
                      <KVRow k="Email" v={profile.contact_email} valueStyle={styles.linkValue} />
                    ) : null}
                    {profile.address ? <KVRow k="Address" v={profile.address} /> : null}
                    <Text style={styles.contactNote}>
                      CONTACT DETAILS ARE SHARED BY THE LEADER'S CHOICE. REPLANT NEVER SHARES PHONE NUMBERS.
                    </Text>
                  </>
                ) : (
                  <View style={styles.contactEmptyBox}>
                    <Text style={styles.contactEmptyText}>
                      This leader has not shared contact details on their profile. You can still
                      reach out by sending a connection request — Replant will pass it along.
                    </Text>
                  </View>
                )}

                {/* ── My Church controls ── */}
                {isOwnChurch ? (
                  <>
                    <SectionHeader>Your Controls</SectionHeader>
                    <Pressable
                      onPress={handleToggleVisibility}
                      style={styles.toggleRow}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: contactVisible }}
                    >
                      <View style={styles.toggleTextCol}>
                        <Text style={styles.toggleTitle}>
                          {contactVisible ? 'Other leaders can see your contact info' : 'Contact info hidden'}
                        </Text>
                        <Text style={styles.toggleSub}>
                          Other verified leaders can see your email and address. Change anytime.
                        </Text>
                      </View>
                      <View style={[styles.switchTrack, contactVisible && styles.switchTrackOn]}>
                        <View style={[styles.switchKnob, contactVisible && styles.switchKnobOn]} />
                      </View>
                    </Pressable>
                  </>
                ) : null}

                <View style={{ height: 12 }} />
              </ScrollView>

              {/* ── Sticky action bar ── */}
              <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                {isOwnChurch ? (
                  <>
                    <Pressable
                      onPress={onEditProfile}
                      style={[styles.btn, styles.btnPrimary, { flex: 2 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Edit church profile"
                    >
                      <Text style={styles.btnPrimaryText}>Edit Profile</Text>
                    </Pressable>
                    <Pressable onPress={onDismiss} style={[styles.btn, styles.btnGhost, { flex: 1 }]} accessibilityRole="button">
                      <Text style={styles.btnGhostText}>Close</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable onPress={handleConnect} style={[styles.btn, styles.btnPrimary, { flex: 2 }]} accessibilityRole="button" accessibilityLabel="Send connection request">
                      <Text style={styles.btnPrimaryText}>Connect</Text>
                    </Pressable>
                    <Pressable onPress={handlePray} style={[styles.btn, styles.btnGhost, { flex: 1 }]} accessibilityRole="button" accessibilityLabel="Add to intercession list">
                      <View style={styles.prayInner}>
                        <HeartIcon size={13} color={prayed ? Colors.red : Colors.accent} filled={prayed} />
                        <Text style={styles.btnGhostText}>{prayed ? 'Praying' : 'Pray'}</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={handleSave} style={[styles.btn, styles.btnIcon]} accessibilityRole="button" accessibilityLabel={saved ? 'Saved' : 'Save'}>
                      <BookmarkIcon size={15} color={saved ? Colors.accent : Colors.textMuted} filled={saved} />
                    </Pressable>
                    <Pressable onPress={handleShare} style={[styles.btn, styles.btnIcon]} accessibilityRole="button" accessibilityLabel="Share">
                      <ShareIcon size={15} color={Colors.textMuted} />
                    </Pressable>
                    <Pressable onPress={handleReport} style={[styles.btn, styles.btnIcon]} accessibilityRole="button" accessibilityLabel="Report a concern">
                      <FlagIcon size={15} color={Colors.textMuted} />
                    </Pressable>
                  </>
                )}
              </View>
            </>
          ) : null}

          {/* Toast */}
          {toast ? (
            <Animated.View style={[styles.toast, { opacity: toastOpacity, bottom: Math.max(insets.bottom, 12) + 64 }]} pointerEvents="none">
              <Text style={styles.toastText}>{toast}</Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>

    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function SectionHeader({ children }: { children: string }) {
  return <Text style={styles.sectionHeader}>{children.toUpperCase()}</Text>;
}

function KVRow({ k, v, valueStyle }: { k: string; v: string; valueStyle?: object }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvValue, valueStyle]} numberOfLines={3}>{v}</Text>
    </View>
  );
}

function Freeform({ label, body }: { label: string; body: string | null }) {
  return (
    <View style={styles.freeform}>
      <Text style={styles.freeformLabel}>{label}</Text>
      {body ? (
        <Text style={styles.freeformBody}>{body}</Text>
      ) : (
        <Text style={styles.freeformEmpty}>NOT YET SHARED</Text>
      )}
    </View>
  );
}

function EapChip({ label, on, onText, offText }: { label: string; on: boolean; onText: string; offText: string }) {
  return (
    <View style={styles.eapChip}>
      <Text style={styles.eapLabel}>{label}</Text>
      <View style={[styles.eapPill, on ? styles.eapPillYes : styles.eapPillNo]}>
        <Text style={[styles.eapPillText, on ? styles.eapPillTextYes : styles.eapPillTextNo]}>
          {on ? onText : offText}
        </Text>
      </View>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View style={styles.bodyContent}>
      <View style={[styles.skel, { width: 120, height: 22, borderRadius: 11 }]} />
      <View style={[styles.skel, { width: '70%', height: 26, marginTop: 14 }]} />
      <View style={[styles.skel, { width: '50%', height: 16, marginTop: 12 }]} />
      <View style={[styles.skel, { width: '40%', height: 14, marginTop: 16 }]} />
      <View style={[styles.skel, { width: '90%', height: 14, marginTop: 20 }]} />
      <View style={[styles.skel, { width: '85%', height: 14, marginTop: 8 }]} />
      <View style={[styles.skel, { width: '60%', height: 14, marginTop: 8 }]} />
      <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
    </View>
  );
}

function ragColor(rag: string): string {
  if (rag === 'green') return Colors.green;
  if (rag === 'amber') return Colors.amber;
  if (rag === 'red') return Colors.red;
  return Colors.textMuted; // pending / unknown
}

// Fix 5 — CD .rag-pill.{g,a,r} use the soft (~14% alpha) RAG tint as bg.
function ragSoftBg(rag: string): string {
  if (rag === 'green') return 'rgba(91, 173, 122, 0.14)';
  if (rag === 'amber') return 'rgba(212, 168, 85, 0.14)';
  if (rag === 'red')   return 'rgba(224, 85, 85, 0.14)';
  return 'rgba(240, 237, 230, 0.06)'; // pending / unknown — neutral
}

// ── Local icons (react-native-svg, matching repo icon convention) ──

function BookmarkIcon({ size = 15, color, filled = false }: { size?: number; color: string; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M4 2h8v12l-4-3-4 3z" stroke={color} strokeWidth={1.2} fill={filled ? color : 'none'} strokeLinejoin="round" />
    </Svg>
  );
}

function ShareIcon({ size = 15, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Circle cx={4} cy={8} r={1.8} stroke={color} strokeWidth={1.2} fill="none" />
      <Circle cx={12} cy={3.5} r={1.8} stroke={color} strokeWidth={1.2} fill="none" />
      <Circle cx={12} cy={12.5} r={1.8} stroke={color} strokeWidth={1.2} fill="none" />
      <Line x1={5.6} y1={7.3} x2={10.4} y2={4.5} stroke={color} strokeWidth={1.2} />
      <Line x1={5.6} y1={8.7} x2={10.4} y2={11.5} stroke={color} strokeWidth={1.2} />
    </Svg>
  );
}

function FlagIcon({ size = 15, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M3 2v12M3 2h9l-2 3 2 3H3" stroke={color} strokeWidth={1.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    // KAN-20 R3 — outer sheet bg switched from Colors.surfaceElevated
    // (#181818) to Colors.background (#080808) to match CD
    // .profile-sheet { background: var(--bg) #0b0b0c }. Hierarchy:
    // outer dark → inner freeform / contact boxes use Colors.surface
    // (lighter) for the layered chrome the CD calls for.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  // KAN-20 R3 — Sticky header (CD .profile-head). Lives OUTSIDE the
  // ScrollView so name, RAG/RPL row, leaders stack, and location line
  // stay pinned while the body scrolls. flexShrink: 0 keeps the head
  // from being squeezed when the body has a lot of content. The
  // hairline border below matches CD `border-bottom: 0.5px solid
  // var(--faint)`.
  profileHead: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexShrink: 0,
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
  closeX: {
    position: 'absolute',
    top: 6,
    right: 16,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: { flex: 1 },
  // KAN-20 R3 — paddingTop dropped from 10 → 0. profileHead's
  // paddingBottom 16 + the first SectionHeader's marginTop 22 already
  // provide the breathing room; the extra 10 was double-counting.
  bodyContent: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 20 },

  // Header — Fix 5 (2026-05-28): typography refactored to CD styles.css
  // exact values. CD .rag-pill-row has the RAG pill on the left + RPL
  // pill on the right with justify space-between; we honor that.
  ragRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 36, // leave room for absolute close-X
    marginBottom: 12,
  },
  ragPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 8, paddingRight: 10,
    borderRadius: 999,
    // colored bg per CD (green-soft / amber-soft / red-soft) is applied
    // inline at the render site based on rag_status.
    backgroundColor: 'rgba(240, 237, 230, 0.06)',
  },
  ragDot: { width: 7, height: 7, borderRadius: 3.5 },
  ragLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.26, // 0.14em × 9
    textTransform: 'uppercase',
  },
  rplTag: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.44, // 0.16em × 9
    color: Colors.textMuted,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingVertical: 4, paddingHorizontal: 9,
    overflow: 'hidden',
  },
  churchName: {
    fontFamily: Typography.displayRegular, // CD: serif weight 300 (closest token = 400)
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: 0.26, // 0.01em × 26
    color: Colors.text,
  },
  leadersStack: { marginTop: 10, gap: 6 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rolePill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    backgroundColor: 'rgba(107, 181, 232, 0.06)', // sky-faint per CD
  },
  rolePillText: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.52, // 0.16em × 9.5
    textTransform: 'uppercase',
    color: Colors.accent,
    lineHeight: 11,
  },
  leaderName: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.text, flex: 1 },
  nameWithheld: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14,
    color: Colors.textMuted,
    flex: 1,
  },
  locationLine: {
    marginTop: 8,
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  ownEyebrow: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(107, 181, 232, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
  },
  ownEyebrowText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    color: Colors.accent,
  },

  // Sections — CD .section-h.eyebrow: 9.5px mono 0.24em sky
  sectionHeader: {
    marginTop: 22,
    marginBottom: 12,
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 2.28, // 0.24em × 9.5
    color: Colors.accent,
  },
  // CD .kv — 9.5px mono key (muted) / 13px sans value (right-aligned)
  kvRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  kvKey: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.52,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    minWidth: 88,
  },
  kvValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.text,
  },
  linkValue: { color: Colors.accent },

  // CD .freeform — surface card with mono label + serif italic body
  freeform: {
    marginBottom: 8,
    marginTop: 8,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 8,
  },
  freeformLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62, // 0.18em × 9
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  freeformBody: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14.5,
    lineHeight: 22,
    color: Colors.text,
  },
  freeformEmpty: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62,
    textTransform: 'uppercase',
    color: Colors.textSubtle,
  },
  // CD .eap-row
  eapRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  eapChip: {
    flex: 1,
    padding: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  eapLabel: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.53, // 0.18em × 8.5
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  eapPill: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  eapPillYes: { backgroundColor: 'rgba(91, 173, 122, 0.14)' },
  eapPillNo: { backgroundColor: 'rgba(31, 31, 35, 1)' }, // CD --surface3 for "n" pill
  eapPillText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.08, // 0.12em × 9
    textTransform: 'uppercase',
  },
  eapPillTextYes: { color: Colors.green },
  eapPillTextNo: { color: Colors.textMuted },

  contactNote: {
    marginTop: 10,
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    lineHeight: 15,
    color: Colors.textMuted,
  },
  contactEmptyBox: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 14,
  },
  contactEmptyText: { fontFamily: Typography.body, fontSize: 12.5, lineHeight: 19, color: Colors.textMuted },

  // My Church toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  toggleTextCol: { flex: 1 },
  toggleTitle: { fontFamily: Typography.bodyMedium, fontSize: 13.5, color: Colors.text },
  toggleSub: { marginTop: 3, fontFamily: Typography.body, fontSize: 11.5, lineHeight: 16, color: Colors.textMuted },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(240, 237, 230, 0.10)',
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: Colors.accent },
  switchKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.text },
  switchKnobOn: { alignSelf: 'flex-end', backgroundColor: Colors.background },

  // States
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  errorText: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryText: { fontFamily: Typography.mono, fontSize: 11, letterSpacing: 1.5, color: Colors.accent, textTransform: 'uppercase' },
  skel: { backgroundColor: 'rgba(240, 237, 230, 0.06)', borderRadius: 6 },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  // Fix 5 — CD .btn: 11px sans-medium 0.12em uppercase, padding 11/12
  btn: {
    minHeight: 44,
    borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  btnPrimary: { backgroundColor: Colors.accent },
  btnPrimaryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.32, // 0.12em × 11
    color: Colors.background,
    textTransform: 'uppercase',
  },
  btnGhost: { borderColor: Colors.borderAccent, backgroundColor: Colors.transparent },
  btnGhostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.32,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  prayInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnIcon: {
    width: 48,
    paddingHorizontal: 0,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },

  // Toast
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 8, 8, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  toastText: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.text },
});
