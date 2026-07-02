# Replant Mobile Frontend — Pre-UAT Security + UX Audit

**Scope:** READ-ONLY static analysis of `/Users/ife/replant/src/` (+ `App.tsx`).
**Retained lens:** 20+yr React Native / mobile-security + UX SME.
**Stakes:** Life-safety. Real persecuted-Christian leaders live since 2026-06-28. A leaked real name for an anonymous poster, or a church name/location for an underground church, can expose a leader.
**Date:** 2026-07-01.

---

## Executive verdict

The app's identity-masking architecture is, on the whole, **built correctly and defensibly**. The dominant and correct pattern is **server-side masking**: the sensitive surfaces (`get_comments`, `get_church_profile`, `get_prayer_wall`, `get_testimonies`, `get_leader_thread_list`, `search_leaders`, `get_branch_members`, `get-nearby-churches`) return **pre-masked rows** — `NULL` name for anonymous, `NULL`/masked church + location for underground — and critically **do not send `author_id` or raw PII to the client at all**. The FE trusts the wire and never re-derives. The underground-viewer life-safety guards in `CamlView` and `TheChurchScreen` are present, first-thing, and layered.

**One structural exception breaks the pattern and is the headline finding: `NetworkFeed.useResolvedLeaderAuthor`** fetches **raw `users` name columns and raw `churches` rows client-side** and masks in JavaScript. This is the single place in the app where the real name of an anonymous leader is delivered to the device and only a client-side `if` hides it. It is a pre-existing, already-flagged risk; its true severity is **entirely a function of the RLS posture on `public.users` / `public.churches`**, which is out of scope here and pending a SEC panel. Flagged P1 (would be P0 if RLS is permissive).

No hardcoded secrets. No `expo-blur`. No stale "Overseer". Hamburger correctly Home-only. `covenant_ack` in SecureStore. Accessibility posture is strong. Deep-link + external-URL handling is safe.

---

## Findings

### P1-1 — `useResolvedLeaderAuthor` masks real leader identity CLIENT-SIDE (pre-existing, flagged)

**File:** `src/components/home/NetworkFeed.tsx:375-463` (consumed at `:466`, `:484`).

**Evidence.** The hook queries raw PII for *any* `author_id`, then decides masking in JS:
```
:383  .from('users')
:385  .select('first_name, middle_name, last_name, honorific, last_name_first,
              church_id, role, anonymous, display_name_preference')
:386  .eq('id', authorId).maybeSingle();
...
:405  .from('churches').select('name, type, show_church_name').eq('id', churchId)
...
:424  if (isAnon) { ...setAuthor({ initial:'A', name: resolveAnonLabel(role), ... }) }
:438  // not anonymous → setAuthor({ ... name: resolveDisplayName({firstName, lastName, honorific...}) })
```
The component's own header comment admits it (`:16-19`, `:60-62`): *"UNDERGROUND churches are masked client-side — SEC Obs D"* and *"author_id is selected ONLY to resolve leader-card attribution … NEVER rendered."* The masking is real and logically correct (both axes handled: anon → name held with church real; underground+safe → church held with name real). **But the raw `first_name`/`last_name`/`honorific` for an anonymous leader, and the raw `churches.name` for a safe-underground church, physically arrive on the device.** The only thing preventing exposure is (a) the client `if (isAnon)` branch and (b) RLS on `users`/`churches` masking those leaf columns from a cross-tier reader.

**Impact.** If RLS on `public.users` / `public.churches` does **not** restrict name/church leaf columns from a cross-tier viewer, then an adversary running the app (or inspecting network traffic / a patched client) reads the real name of any anonymous leader-word/encouragement author and the real name of any safe-underground church. That is a direct identity-exposure path on the Home feed. If RLS *does* mask those columns server-side for cross-tier readers, the client fetch returns nulls and the exposure is closed — but then the client-side masking is redundant belt-and-suspenders and the true contract should be made explicit.

**Why P1 not P0:** severity is gated on the RLS posture, which this static FE audit cannot confirm and which is explicitly deferred to a pending SEC panel (memory: `useResolvedLeaderAuthor_client_side_masking_pending_sec_panel.md`). Realtime rollout amplifies frequency but does not introduce the risk. **If the SEC panel finds `users`/`churches` leaf columns are readable cross-tier, reclassify P0.**

**Recommendation.** Move author resolution behind a SECURITY DEFINER RPC — e.g. `get_announcement_leader_author_by_id(author_id)` — that returns the **pre-masked** `{ initial, name, church }` shape (mirroring `get_comments` / `get_church_profile`), and never emits `author_id` or raw name/church columns to the client. This makes Home structurally identical to every other surface and removes the RLS dependency from the FE. Until then, treat the RLS masking of `users`/`churches` name/church columns as **load-bearing** and confirm it in the SEC panel before UAT sign-off.

---

### P2-1 — Debug `console.log` lines ship in the auth auto-sign-in path

**File:** `src/screens/onboarding/AccountSetupPage2Screen.tsx:711`, `:713` (also `App.tsx:74-78`).
**Evidence.** `:711 console.log('[tryAutoSignIn] calling signInWithPassword');` and `:713 console.log('[tryAutoSignIn] signInWithPassword result', { hasSession: !!data?.session, error: error?.message });`
**Impact.** **No PII/credential leak** — the password is logged only as a boolean (`:701 password: !!password`) and the result logs `hasSession` + `error.message` only. But `console.log` (vs the codebase's usual `console.warn` for ops) in the credential path is debug residue that should not ship. In release builds RN console output is generally stripped, but this shouldn't be relied on for auth-path logging.
**Recommendation.** Remove or gate behind `__DEV__` the plain `console.log` debug lines in `tryAutoSignIn` and the `AC-11 Font.isLoaded` block in `App.tsx` before UAT. (30 `console.*` total in `src/`; none leak token material — verified.)

---

### P3-1 — `ChurchProfileBottomSheet` website open bypasses the `safeOpen` scheme allow-list

**File:** `src/components/church/ChurchProfileBottomSheet.tsx:351`.
**Evidence.** `void Linking.openURL(url.startsWith('http') ? url : \`https://${url}\`).catch(()=>{});` — unlike `ArticleCard`/`LinkCard`/`CallToActionCard`, this call does not route through the `^https?://` `safeOpen` allow-list.
**Impact.** Low. `website_url` is a server-owned church profile field (not free-form viewer input at render time), and `startsWith('http')` blocks the obvious `javascript:`/`data:` schemes. Edge scheme-confusion (`httpx:`, `http-foo:`) is theoretically possible.
**Recommendation.** Reuse the shared `safeOpen` allow-list here for consistency (strict `^https?:\/\//i`). Consider hoisting `safeOpen` to a shared util so the four call sites can't drift.

---

### P3-2 — `network_id` / RPL pill contract gap (documented, not a leak)

**File:** `src/components/church/ChurchProfileBottomSheet.tsx:95-98`, `:416-418`.
**Evidence.** The sheet renders a `network_id` pill only if present, but `get_church_profile` does not currently return it (self-documented at `:95-98`).
**Impact.** Cosmetic/functional only — no identity risk. The pill silently never renders. Noted so it isn't mistaken for a live feature during UAT.
**Recommendation.** Either wire the column in the RPC or drop the pill branch until it lands.

---

## What works well (protections worth preserving — do NOT regress)

1. **`CamlView` underground-viewer early-return (life-safety, model implementation).**
   `src/components/church/CamlView.tsx:200-202` — `if (viewerIsUnderground) return null;` is the **very first statement** in the component body, before `useReducedMotion()`, `useAuth()`, any `useState`/`useEffect`, before `locationManager.start()` (`:422`), before `resolveCity()`'s Mapbox geocode (`:170`, `:248`), and before any `get-nearby-churches` POST (`:488`). The dev even documented hooks-order safety: the component is always-skipped-or-always-run per session (`:190-199`). Three independent layers: parent doesn't mount it for UG, this early-return, and the edge fn returns 403 for UG callers. **Preserve exactly.**

2. **`TheChurchScreen` locks underground viewers to the CAL globe + suppresses CAML/tutorial.**
   `src/screens/main/TheChurchScreen.tsx`: `viewerIsUnderground = viewerChurchType === 'underground'` (`:152`), initial `page` forced to `1` (`:301`), re-forced on tab focus (`:307`) and on data-arrival (`:318`), tutorial suppressed (`:206`), and the CAML header variant is never rendered for UG (`:449`). `viewerChurchType` is called out as the *safe* signal for this gating.

3. **`CommentThread` — the gold-standard surface.** `src/components/home/CommentThread.tsx`. Masking is server-side in `get_comments`; **`author_id` is never sent to the client** (`:16`, `:42-47`). All four `mask_reason` values (`none`/`anon`/`underground`/`no_church`) handled with correct avatar shapes — round + lock for underground/no_church, square "A" for anon, real-initial for named (`:254-267`). Underground wins over anon for the shape signal. This is the template the Home feed should copy.

4. **Prayer Wall masking trusted from the wire, never re-derived.** `src/components/prayer/PrayerWallLogic.ts:26-27`, `:66-68`, `:162-189` — explicit contract that `leader_display_name` is `NULL` for anon and `country`/`church_name`/`rag_status` are `NULL` for underground, and *"FE never re-derives."* `formatLeaderLine` / `getLeaderLine` / `getLocationLine` all short-circuit on null → `"A fellow leader"` / church-name-only. Consumed correctly in `TestimonyCard.tsx:144-148`, `PrayerWallDetailSheet.tsx:252-254`, `PrayerWallLanding.tsx:612-622`.

5. **`ChurchProfileBottomSheet` server-masked identity.** `get_church_profile` is SECURITY DEFINER and returns `name: null` for anonymous leaders (contract `:22-33`); client renders `"A fellow {role}"` (`:438-439`), correctly using the canonical phrase (Founder lock landed) **NOT** "Name withheld". Location renders `city, country` directly (`:448-449`), safe because underground location is NULL-enforced server-side.

6. **Connect resolves all other-leader identity server-side.** `LeadersList` → `get_leader_thread_list` (`:525`, pre-resolves `other_full_name`), `LeaderSearch` → `search_leaders` (comment `:12-15`: *"returns church_name pre-masked… The FE never sees an unmasked underground name"*), `DMThreadView` → `get_leader_thread_list`, `BranchThreadView` → `get_branch_members`. All branch on `anonymous`/`underground` flags for role-label + anon monogram.

7. **`supabase.ts` client hardening.** `src/lib/supabase.ts` — anon key only via `EXPO_PUBLIC_*`; explicit hard-line comment that `SERVICE_ROLE_KEY` must never be client-side (`:26-27`); session storage in an AES-GCM wrap over Expo SecureStore, not plaintext AsyncStorage (`:9-14`, `:69`); PKCE flow (`:79`); 401 interceptor that never logs token material (`:47-51`).

8. **Safe external-URL + deep-link handling.** `ArticleCard`/`LinkCard`/`CallToActionCard` gate every `Linking.openURL` behind a `^https?://` `safeOpen` allow-list (SEC Obs B), rejecting `javascript:`/`data:`/`file:`/`intent:`. `App.tsx:41-52` deep-link handler extracts only `?code=` and hands it to `exchangeCodeForSession` (server-validated) — no arbitrary route navigation, no eval, no other trusted params.

---

## Invariant verification (per dispatch)

| Invariant | Result | Evidence |
|---|---|---|
| Anon → "A fellow {role}", never real name, correct avatar/church | **HOLDS** | All surfaces server-masked; short-circuit on null name. See works-well 3–6. |
| UG anon adds round lock + church-OR-region | **HOLDS** | `CommentThread.tsx:254-267` shape logic; region fallback `:240`. |
| PRAYER_WALL_ROLE_LABELS covers all roles, fallback 'Minister' | **HOLDS** | `displayHelpers.ts:72-95` — 16 roles mapped; `?? 'Minister'` fallback. |
| `useResolvedLeaderAuthor` client-side masking | **CONFIRMED RISK** | See P1-1. Client receives raw name; masks in JS. |
| CamlView UG early-return before any side effect | **HOLDS (model)** | `CamlView.tsx:200-202` first statement. Works-well 1. |
| TheChurchScreen locks UG to CAL, suppresses CAML/tutorial | **HOLDS** | Works-well 2. |
| Manager rename — no stale "Overseer" | **HOLDS** | `grep -rni overseer src/` → 0 hits. |
| Hamburger — Home tab only | **HOLDS** | Only `HomeScreen.tsx` consumes it; Connect/PrayerWall/Persecuted/Church → 0 refs. |
| No `expo-blur` | **HOLDS** | 0 real usages (only comments confirming absence + test guards). |
| `covenant_ack` in SecureStore | **HOLDS** | `ConnectScreen.tsx:269/281` SecureStore get/set; `:20` comment "NOT AsyncStorage". |
| `scriptureItalic` = scripture/editorial/witness only | **HOLDS** | Sampled 3 outliers (LeaderSearch hint, DMThreadView lazyLine, SettingsScreen subline) — all editorial/witness. No button/label/error misuse. |
| No hardcoded secrets (only public pk.*/anon) | **HOLDS** | 0 service_role/sb_secret/JWT/sk./AKIA in `src/`; env all `EXPO_PUBLIC_*`. |
| Deep-link `replant://` trusted safely | **HOLDS** | `App.tsx:41-52` code-only; openURL allow-listed. |

---

## Accessibility (Lens 6)

**Posture: strong for pre-UAT.**
- `accessibilityLabel` ×210, `accessibilityRole` ×245, `accessibilityState` ×35 across `src/`.
- **Zero `allowFontScaling={false}`** — no Dynamic Type suppression anti-pattern; OS text sizing respected app-wide.
- Touch targets: 143 explicit `minHeight:44–52` / `width:44` / `height:44` declarations + 103 `hitSlop` sites. Icon-only controls (Close, retry, chevrons) consistently carry `hitSlop` (`PrayerWallDetailSheet.tsx:296` hitSlop 8 on ✕; `ChurchProfileBottomSheet.tsx:384` hitSlop 12 all edges). Primary CTAs sized `minHeight:52/48` (`PrayerWallDetailSheet.tsx:501/533`).
- Reduced-motion honored via `useReducedMotion()` across animated surfaces (Prayer cards, sheets, CamlView rings, toast).

**Minor gaps (P3-level, not systemic):** a handful of display-only meta groups use `accessible`+`accessibilityLabel` on a `View` rather than grouping semantics; acceptable. No blocker.

---

## Empty / error states

| Surface | Empty | Error/retry | Notes |
|---|---|---|---|
| Home feed (`NetworkFeed.tsx`) | ✅ dashed "The wall is still for now." (`:184-193`) | ✅ same card + "Tap to retry" (`:157-173`) | Loading spinner + "— held in prayer —" footer. Good. |
| Prayer Wall | ✅ | ✅ | Landing branches verified/pending; `ReceiveLockedCard` + coming-soon pattern. |
| Persecuted (`PersecutedScreen.tsx`) | ✅ gated screen 14B (lock glyph + copy `:117-135`) | ✅ `error` shares gated render (`:118`) | `loading` shell + verified TabView. Good. |
| Connect (`ConnectScreen.tsx`) | ✅ unverified/pending gate w/ para copy (`:188-189`) | ✅ toast on unreachable (`:440`) | Thread list child-view empty states; RPC-driven. |

No missing states found on the four primary lists.

---

## Per-surface verdicts

| Surface | Verdict | Rationale |
|---|---|---|
| Onboarding / Auth | **READY** (minor) | supabase.ts hardened, PKCE, SecureStore session, deep-link safe. Strip P2-1 debug logs. |
| Home | **NEEDS-FIX** | P1-1 `useResolvedLeaderAuthor` client-side identity resolution — resolve behind an RPC or confirm RLS as load-bearing in SEC panel before UAT. All other Home cards (Comment/Article/Link/CTA/Encouragement) are clean. |
| Church | **READY** | CamlView + TheChurchScreen UG guards are model implementations; ChurchProfileBottomSheet server-masked. P3-1 website-open nit. |
| Prayer Wall | **READY** | Server-masked wire, never re-derived; anon/UG rendering correct across card + sheet + landing + testimony. |
| Persecuted | **READY** | Gate/loading/error/verified states solid. |
| Connect | **READY** | All other-leader identity resolved server-side via RPC with anon/UG flags. |

**Overall:** the app is UAT-ready on identity safety **except Home**, whose single exception (P1-1) must be either refactored to an RPC or explicitly signed off by the pending SEC panel on `users`/`churches` RLS. Nothing else rises above P2.

---

*Audit performed read-only. No code changed, no app run, no Jira/git/memory writes.*
