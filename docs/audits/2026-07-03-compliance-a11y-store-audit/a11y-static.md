# Replant Mobile — Static Accessibility Audit (WCAG 2.2 AA)

**Date:** 2026-07-03 · **Lane:** static code audit (read-only) · **Epic:** KAN-34 (epic cites 2.1 AA; audited against 2.2 AA, which strictly contains it) · **Branch audited:** `feat/kan-296-mobile-attribution-slot`
**Scope:** `~/replant` Expo React Native app — `src/screens/`, `src/components/`, `src/navigation/`, `src/constants/theme.ts`, `app.json`. No source file was modified.
**Method:** WCAG 2.2 AA checklist built first (35 SCs applicable to a native mobile app), then grep-driven inventory of every touchable vs. its accessibility props, mathematical contrast computation from theme tokens (WCAG relative-luminance formula, alpha composited over the actual surface colors), animation-site vs. reduce-motion-branch diff, modal/overlay containment classification, and targeted file reads for every hotspot. Every finding carries file:line evidence. Contrast figures below are computed, not eyeballed.

---

## 1. Summary counts

1. **P1 (blocks a core flow for AT users / hard store-review risk): 6**
2. **P2 (degrades the AT or low-vision experience): 11**
3. **P3 (polish / judgment): 8**
4. **Total findings: 25** — plus a "what held up" list that is genuinely substantial: this codebase has a real accessibility culture in its newer surfaces (Prayer Wall family, Church map/globe, Settings), and the defect mass is concentrated in the onboarding/registration flows and a handful of older Connect components.

Raw inventory: 91 files contain touchables; 210 `accessibilityLabel` and 9 `accessibilityHint` occurrences; 62 `TextInput`s of which ~5 carry a programmatic label; **zero** `allowFontScaling={false}` (good) and **zero** `maxFontSizeMultiplier` (uncapped scaling — see sim handoff); `useReducedMotion` hook exists (`src/utils/useReducedMotion.ts`) and is wired into 10 files, while ~37 files contain animation sites.

---

## 2. Findings by WCAG success criterion

### SC 1.4.3 Contrast (Minimum) — Level AA

**F1 · `Colors.textMuted` fails 4.5:1 as body text — token-level, ~405 usages · P1**
- Where: `src/constants/theme.ts:26` — `textMuted: 'rgba(240, 237, 230, 0.45)'`.
- Computed (alpha composited): **3.99:1** on `background #080808`, **4.04:1** on `surface #111111` / `cardSurface #111113` / `cardWarm #131110`, **4.02:1** on `surfaceElevated #181818`. All below 4.5:1.
- This would be a P3 if it only touched metadata, but it is used as primary reading copy: `src/components/home/ArticleCard.tsx:193-194` (`standfirst` 16pt italic serif and `body` 15pt DM Sans are both `Colors.textMuted`), `src/components/home/NotificationToast.tsx:99` (12pt sub-line), and ~400 further sites.
- Fix shape: raise the token alpha — computed pass points: offwhite at **0.50 → 4.68–4.73:1**, at 0.55 → 5.36–5.51:1. A one-line token change at `theme.ts:26` (0.45 → 0.52–0.55) clears every derived site at once; body-copy sites (ArticleCard) should arguably use `Colors.text`.

**F2 · Inactive tab-bar labels: ~2.8:1 at 10pt on the app's primary navigation · P1**
- Where: `src/navigation/TabNavigator.tsx:41` — `tabBarInactiveTintColor: "rgba(240, 237, 230, 0.35)"` on bar color `#0E0E0E` (line 33), label `fontSize: 10` (line 44).
- Computed: offwhite@0.35 composites to **2.82:1** on `#080808`-family surfaces — fails 4.5:1 (and even the 3:1 large-text bar; 10pt is emphatically not large text). Four of five tab labels are in this state at all times, on every screen.
- Fix shape: raise inactive tint to ≥0.50 alpha (≥4.68:1) or 0.55; the icon strokes inherit the same tint and are also sub-3:1 against 1.4.11 as the only non-text cue.

**F3 · `Colors.textSubtle` (~2.0:1) is the placeholder color for 54 inputs · P2**
- Where: `src/constants/theme.ts:27` — `textSubtle: 'rgba(240, 237, 230, 0.25)'` — computed **1.97–2.11:1** across surfaces. 185 total usages; 54 are `placeholderTextColor={Colors.textSubtle}` (e.g. `src/screens/onboarding/RegisterChurchPage1Screen.tsx:870`, `src/screens/main/hamburger/FAQScreen.tsx` search field).
- Most fields have a visible `<Text>` label above, which is why this is P2 not P1 — but for search fields the placeholder is the only affordance text, and an older leader in low light effectively sees an empty box. 24 additional hardcoded `rgba(240,237,230,0.2–0.3x)` text colors exist outside the token.
- Fix shape: dedicated placeholder token at ≥0.45 (placeholders may arguably sit at large-text 3:1; 0.35 → 2.82 still fails — use ≥0.50 for safety), keep 0.25 for genuinely decorative text only.

**F4 · White-on-red unread badge text ≈3.2–3.5:1 at 10pt · P3**
- Where: `src/components/connect/ConnectTabIcon.tsx:76,95` — `#FFFFFF` 10pt on `Colors.red #E05555` (computed for `#F0EDE6`: 3.21:1).
- Honest framing: this exactly mirrors the native iOS/Android badge convention (which also fails), and the badge carries a full `accessibilityLabel` with a live region, so AT users are covered. Flag kept for completeness; a darker red disc (`#080808`-on-red computes 5.34:1 inverted) is the fix shape if ever revisited.

### SC 1.4.11 Non-text Contrast — Level AA / SC 1.4.1 Use of Color — Level A

**F5 · RAG status is color-only in the church list rows, and the three RAG hues are mutually indistinguishable · P2**
- Where: `src/components/church/CamlView.tsx:1242` — `CamlListRow` renders `<View style={[styles.listDot, { backgroundColor: ragColor(church.rag_status) }]} />` and the row text (name · leader · RPL · distance) never states the status; the row's `accessibilityLabel` doesn't exist (role only, line 1240).
- Computed pairwise: green↔amber **1.24:1**, green↔red **1.38:1**, amber↔red **1.70:1**. A color-blind or low-vision leader cannot tell an URGENT church from a FREE one in the list, and a screen-reader user is never told at all. Individually the dots pass 1.4.11 against the dark surfaces (5.34–9.09:1) — they are visible, just not differentiable.
- Fix shape: add the status word to the row (text or `accessibilityLabel`: "Grace Church, status urgent, …"); the map filter chips already model the answer (dot + FREE/LIMITS/URGENT text, `CamlView.tsx:918-928`).
- Same pattern anywhere else a bare `ragDot`/`listDot` renders without a status word — e.g. `RegisterChurchPage1Screen.tsx:914` is fine (dot + label text + ✓), which shows the team knows the pattern.

**F6 · Input field boundaries ~1.15–1.34:1 · P3**
- Where: `src/constants/theme.ts:30` — `border: rgba(240,237,230,0.08)` computes 1.15:1 on background, 1.20:1 on surface; even 0.12–0.2 variants compute 1.34–1.65:1. Where a text field's only boundary indicator is this hairline (dark filled input on dark screen), SC 1.4.11 wants 3:1 for the component boundary. Mitigated by filled-surface inputs plus visible labels; judgment: polish. Fix shape: 0.30+ alpha border on interactive field perimeters only.

### SC 4.1.2 Name, Role, Value — Level A (with SC 1.3.1, 3.3.2)

**F7 · Church registration flow: 23 touchables, zero labels, zero roles, zero states · P1**
- Where: `src/screens/onboarding/RegisterChurchPage1Screen.tsx` (14 touchables, 0 `accessibilityLabel`, 0 `accessibilityRole`) and `RegisterChurchPage2Screen.tsx` (9, 0, 0). Concretely:
  1. Type/Country picker buttons (lines 669, 738) — VoiceOver reads only the selected value, no field name, no "button", no popup hint.
  2. "Mark as Headquarters" (716-725) and "Same as my info" (811) checkbox rows — no `accessibilityRole="checkbox"` and no `accessibilityState={{checked}}`; checked state is a purely visual ✓ (722). A blind leader cannot know what they have asserted to the network.
  3. Tooltip reveal buttons (691-697, 760) — "ⓘ What's this?" text gives a de-facto name but no role/hint; the revealed notice is not announced.
  4. RAG selector (898-926) — text label + ✓ are present (good 1.4.1) but `isSelected` is never exposed via `accessibilityState`.
  5. Sheet "Done" closers (1033, 1103) and sheet items (1050, 1069, 1119) — value-selection lists with no `role`/`selected`.
- This is the flow every church — surface and underground — enters the network through. Store reviewers exercising signup with VoiceOver will hit this within a minute.
- Fix shape: mechanical pass adding role/label/state per control class; the sibling screen `NameVisibilityChoiceScreen.tsx:298-306` (radio + selected + disabled) is the in-repo reference implementation.

**F8 · Join-by-code entry: composite code widget with invisible semantics · P1**
- Where: `src/screens/onboarding/JoinByCodeScreen.tsx:253-274` — the RPL–XXXX–XXXXX code entry renders as decorative cells (`Text` per char) over a hidden `TextInput` (`styles.hiddenInput: position absolute, opacity 0, 1x1`, line 585); the tap-to-focus `TouchableOpacity` (253) has no label/role/hint, the hidden input has no `accessibilityLabel`, and the cells are not hidden from AT (opacity-0 elements remain in the a11y tree, so the input and the mirror cells both surface).
- A screen-reader user on the underground join path meets a row of unlabeled single characters and an invisible unnamed text field. This is the entry gate for exactly the leaders the platform exists for.
- Fix shape: `accessibilityLabel="Invite code"` + `accessibilityHint` on the hidden input, `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"` on the visual cell row, role="button" on the focus target. Verify paste works for SC 3.3.8 (see sim handoff).

**F9 · Verification gates are traversable by screen reader — protection layer breach for AT users · P1**
- Where: `src/screens/main/ConnectScreen.tsx:624-626` mounts `ConnectGateView` (163-196) as a plain absolute-fill sibling **over the fully mounted, interactive Connect UI** (header, segmented tabs, list — 585-614); comments call it "NOT dismissible — protection layer". `src/screens/main/TheChurchScreen.tsx:66-77` (`UnverifiedGateView`) documents the same architecture: "Mapbox surfaces below remain mounted."
- Neither gate sets `accessibilityViewIsModal`, and the covered layers never get `importantForAccessibility="no-hide-descendants"`/`accessibilityElementsHidden`. Touch is blocked by the overlay; **sequential VoiceOver/TalkBack traversal is not** — an unverified leader's screen reader can walk into and activate the gated UI behind the scrim. This inverts the gate for AT users specifically (SC 2.4.3 focus order; practically an authorization-UX breach — server-side RLS still holds, per the code comments, so it is a UX/protection-posture defect, not a data leak).
- Positive note: the gate copy itself is real `Text` and does explain *why* access is locked (verification pending, who confirms it, the 24-72h/30-day window) — the epic's "locked-content alternative" requirement is substantively met in copy (`ConnectScreen.tsx:181-193`, `PersecutedScreen.tsx:47,118-133`). The defect is containment, not explanation.
- Fix shape: `accessibilityViewIsModal` on the gate + `importantForAccessibility="no-hide-descendants"` on the covered siblings while gated. Confirm on device (sim handoff #1).

**F10 · TextInputs: 5 of 62 carry a programmatic label · P1**
- Where: repo-wide; auth examples: `RegisterChurchPage1Screen.tsx:865-872` (phone), all name/email/password fields on `AccountSetupPage1Screen.tsx`, search fields on `AccountSetupPage2Screen.tsx:1077`. Visible `<Text>` labels sit above fields but are not programmatically associated (RN has no `for=`); once a value is typed, VoiceOver reads only the value — the field's identity is gone. On a 6-field signup form this makes confident completion genuinely hard (SC 3.3.2 + 4.1.2).
- Fix shape: `accessibilityLabel={fieldName}` on every `TextInput` — mechanical, high-yield.

**F11 · Connect lists: actionable rows and buttons without roles; unread state is visual-only · P2**
- Where: `src/components/connect/MinistriesList.tsx:73` (branch row), 157/164 (Decline / Join the branch), 228, 401; `LeadersList.tsx:180, 341` (thread rows), 315-323 (WITHDRAW), 428-436 (REMOVE); `BranchThreadView.tsx:492-528` (Edit branch / Rename / Leave / Close). All text-bearing (names announce) but none carry `accessibilityRole="button"`, so nothing sounds tappable. Unread state is bold text + a blue rail (`LeadersList.tsx:185-188`) — never exposed via label/state (SC 1.4.1/1.3.1): a blind leader cannot tell which conversations have new messages, in a messaging product.
- Fix shape: role on rows/buttons; fold `unread` into the row label ("…, 3 unread").

**F12 · CompletionFlowOverlay: 9 role-less, label-less controls in the church-profile completion flow · P2**
- Where: `src/components/church/CompletionFlowOverlay.tsx:187-194` (PickerRow announces only the current value + "›"), 220 (Done), 270/288 (Primary/Ghost buttons), 365 (skip link), 604-613 (congregation-size chips with visual-only selected state). Same class as F7; inside an RN `<Modal>` so containment is fine.
- Fix shape: same mechanical pass; chips need `accessibilityState={{selected}}`.

**F13 · Misc unlabeled icon-only controls · P2**
- 1. `src/components/home/CommentThread.tsx:218-222` — collapse-comments control is a rotated chevron with no label.
- 2. `src/components/home/NotificationToast.tsx:72` — toast Pressable has no role; see also F17.
- 3. `src/components/onboarding/ParentChurchPicker.tsx:167-173` — By RPL ID / By name mode segments: no role, no selected state (branch-linking flow); 258 — "Change" no role.
- 4. `src/screens/onboarding/AccountSetupPage2Screen.tsx:1077-1087` (Search), 1343 (church result rows), 1382 (Register-yours card), 1423 (submit) — text-bearing, role-less.
- 5. Unlabeled transparent scrim Pressables: `MinistriesList.tsx:193`, `BranchThreadView.tsx:412-415` — AT focus lands on a nameless full-screen element (contrast with the labeled scrims in `ConnectConfirmModal.tsx:32` and `AttachmentPopover.tsx:89-94`, which got it right).
- Fix shape: label + role per site; hide scrims from AT or label them "Dismiss".

**F14 · KAN-78 residual: no `tabBarAccessibilityLabel` on any tab · P2**
- Where: `src/navigation/TabNavigator.tsx:52-92` — confirmed absent on all five `Tab.Screen`s. React Navigation falls back to announcing the route title with a selected state, so the bar is not silent — but the epic's intended explicit labels ("Home tab, 1 of 5" class) are gone, and the Persecuted tab's red active tint (line 73) plus `ConnectTabIcon`'s custom badge make explicit labels the safer contract. Fix shape: restore `tabBarAccessibilityLabel` per screen in `options`.

### SC 3.3.1 Error Identification / SC 4.1.3 Status Messages — Level A / AA

**F15 · Signup/join error text renders silently — no live region, no announcement · P2**
- Where: `src/screens/onboarding/AccountSetupPage1Screen.tsx:433, 468, 482` (email-check, password, confirm errors — bare `<Text>`); `JoinByCodeScreen.tsx:383-397` (generic/rate/email error blocks). A blind leader submits, hears nothing, and must re-scan the form to discover what failed.
- Counter-example done right in-repo: `LoginScreen.tsx:232-239` — error banner with `accessibilityLiveRegion="polite"` + `accessibilityRole="alert"` (Android announces; iOS behavior of a mounted alert view needs device confirmation — sim handoff #2). `SettingsScreen.tsx` uses `AccessibilityInfo.announceForAccessibility` at 9+ call sites (552-718).
- Fix shape: copy the LoginScreen banner pattern (plus `announceForAccessibility` for iOS determinism) to AccountSetupPage1, JoinByCode, RegisterChurch screens.

**F16 · NotificationToast appears/auto-dismisses with no announcement · P2**
- Where: `src/components/home/NotificationToast.tsx:70-80` — no `accessibilityLiveRegion`/`announceForAccessibility`; a transient status message (SC 4.1.3) that AT users simply never receive. Contrast: the Connect badge does this correctly (`ConnectTabIcon.tsx:38-43`).
- Fix shape: `announceForAccessibility(title + sub)` on show; role="button" when `cfg.chevron`.

### SC 2.5.8 Target Size (Minimum) — Level AA (Apple HIG 44pt as store bar)

**F17 · Small destructive/utility text links: pass 2.5.8's 24px floor, fail the platform's own 44pt bar · P2**
- Where: `LeadersList.tsx:315-323, 428-436` — WITHDRAW / REMOVE are 9pt mono links (`styles` 1222-1261) with `hitSlop {8,8,12,12}` → effective target ≈ 27-29pt high, sitting inside rows that are themselves pressable, so a tremoring thumb aiming at REMOVE most often opens the thread instead. Numerically passes SC 2.5.8 (≥24 CSS px); fails Apple HIG 44pt and this platform's stated bar (older/injured leaders, low light, shaking hands).
- Also: close X's at `PrayerWallDetailSheet.tsx:296-298` and `TestimonyDetailSheet.tsx` (16px icon + hitSlop 8 → ~32pt), `PrayerWallFilterBar.tsx` ClearChip (14px + 6 → ~26pt). All labeled (good), all under 44pt.
- Fix shape: hitSlop to reach 44pt effective (12→14+ on X's; 16+ vertical on the 9pt links), or promote destructive actions out of tightly-packed rows.
- Credit: `hitSlop` appears 103 times across 55 files — the habit exists; the floor just needs raising on these sites. `NameVisibilityChoiceScreen` styles even set `minHeight: 44` on its back button explicitly.

### SC 2.4.3 Focus Order / modal containment (SC 2.1.2 analog)

**F18 · Custom (non-`<Modal>`) sheets lack AT containment · P2**
- Where: `PrayerWallDetailSheet.tsx`, `TestimonyDetailSheet.tsx`, `PrayerWallPullUp.tsx`, `AttachmentPopover.tsx`, `auth/DeactivationModal.tsx` (App.tsx-level sibling overlay, per its own header comment), and `BranchThreadView.tsx:410-530` members sheet — none use RN `<Modal>` (which provides containment natively and is correctly used by ~24 other dialogs) and none set `accessibilityViewIsModal`, so swipe-traversal reaches the covered screen while the sheet is up. All are dismissible via labeled controls (good — no trap), so this degrades rather than blocks.
- Fix shape: `accessibilityViewIsModal` on the sheet container (the five modals that already set it — `VerificationOutcomeModal.tsx:66`, `PreRemovalModal.tsx:35`, `RequestInfoModal.tsx:57`, `VisibilityFlipModal.tsx:47`, `JoinCodeRotationModal.tsx:42` — are the house pattern).

### SC 2.3.3 Animation from Interactions (AAA, epic-named) / SC 2.2.2 Pause, Stop, Hide (A)

**F19 · Animation sites with no reduce-motion branch · P2 (FAQ, epic-named) / P3 (the rest)**
- The hook exists and 10 files use it well. Sites with none:
  1. `FAQScreen.tsx:76` — accordion `LayoutAnimation.configureNext` (the known gap, confirmed).
  2. `SettingsScreen.tsx:459`, `persecuted/scenes/FeedScene.tsx:392` — LayoutAnimation toggles.
  3. Home card expands: `AnnouncementCard.tsx:88,92`, `ArticleCard.tsx:96`, `TogetherCard.tsx:62`, `LeaderWordCard.tsx:47`, `CallToActionCard.tsx:90` (220ms opacity/height eases — small motion, hence P3).
  4. `SplashScreen.tsx:384-392` — infinite `Animated.loop` float (decorative, transient screen; SC 2.2.2 exposure is bounded by splash duration).
  5. `ConnectScreen.tsx` push-layer slide, `HamburgerPanel` slide, misc sheet fades.
- Honest severity: SC 2.3.3 is Level AAA; none of these are vestibular-scale motion. They are epic-scope commitments, not AA failures. Fix shape: thread `useReducedMotion()` through; for LayoutAnimation simply skip `configureNext` when reduced.
- **The epic's named suspect is already fixed:** the pulsing rings and red-dot pulse are gated — `CamlView.tsx:284` (`if (reduced) return;` + static halo per line 221) and `GlobeView.tsx:244` (`if (paused || forcePaused || reduced) return;`), and GlobeView's auto-rotation resume also respects it (line 257).

### SC 1.3.4 Orientation — Level AA

**F20 · Orientation locked to portrait · P2**
- Where: `app.json:6` — `"orientation": "portrait"`. AA requires both orientations unless essential; leaders with mounted devices (wheelchair mounts are the canonical case) may be landscape-fixed. Common mobile-MVP posture, and store reviewers rarely enforce it — but it is a real 1.3.4 fail on paper. Fix shape: decision needed (support landscape at least on readers/forms, or document the "essential" claim consciously).

### SC 1.4.4 Resize Text — Level AA

**F21 · Scaling is fully enabled (credit) but fixed-metric containers are untested under Dynamic Type · P3 (static) — primary sim handoff**
- Zero `allowFontScaling={false}` and zero `maxFontSizeMultiplier` repo-wide: text scales unclamped. Statically, the clipping candidates are: the 84pt fixed tab bar with 10pt labels (`TabNavigator.tsx:36,44`), fixed-height CTAs and pickers across onboarding, `ConnectTabIcon`'s 20×20 wrap + 20pt badge (`ConnectTabIcon.tsx:59-69`), and the 8-10.5pt mono eyebrow register everywhere. Cannot be confirmed statically — handed to the sim lane at XXL/AX sizes.

### SC 3.3.2 / 1.3.5 Identify Input Purpose — Level AA

**F22 · autofill/textContentType present on auth, absent elsewhere · P3**
- `LoginScreen.tsx:260-261, 289-290`, `ForgotPasswordScreen.tsx:172-173`, `SetNewPasswordScreen.tsx:241-242, 286-287` are correct (credit). Name/email/phone fields on `AccountSetupPage1Screen.tsx`, `JoinByCodeScreen.tsx`, `RegisterChurchPage1Screen.tsx` lack `autoComplete`/`textContentType` (13 total occurrences repo-wide). Fix shape: add per-field purpose props.

### SC 4.1.2 state — expand/collapse

**F23 · Expanded state never exposed on accordions/expanding cards · P3**
- `FAQScreen.tsx:115-118` (role+label present, no `accessibilityState={{expanded}}`), `AnnouncementCard.tsx:97` (whole-card toggle, no role/state; its comments toggle at 132-141 is labeled — credit), same class on ArticleCard/TogetherCard/LeaderWordCard/CallToActionCard expands. `HomeTopBar.tsx:32` hardcodes `expanded: false`. Fix shape: `accessibilityState={{expanded}}` wired to the open flag.

### SC 1.1.1 Non-text Content — map surface

**F24 · Mapbox church dots are GL canvas — invisible to AT by nature; a text alternative exists and needs one label pass · P2 (paired with F5)**
- Nearby-church dots are `ShapeSource`/`CircleLayer` (`CamlView.tsx:829-854`) — not reachable by VoiceOver at all (inherent to map GL). The own-church `MarkerView` Pressable is labeled ("Your church", 866-870). The equivalent-facility path is the pull-up, distance-sorted church list (`CamlListRow`, 1227+) — structurally the right answer, but see F5: its rows omit status and an aggregate label. With F5 fixed, the map surface has a legitimate accessible alternative. Verify traversal order on device (sim handoff #4).

### SC 2.5.7 Dragging Movements — Level AA

**F25 · Drag-driven sheets: single-pointer alternatives need device confirmation · P3 (static)**
- `CamlView` sheet (PanResponder, 604-670), `PrayerWallPullUp` (grip drag, labeled dismiss at 261 — has a non-drag dismiss, good), `NotificationToast` swipe-dismiss (auto-hides — acceptable alternative), `BranchThreadView` swipe-back (labeled Back button exists at 1010 — good). The CamlView sheet is the one to confirm: statically I see drag as the primary open/close; if tap-on-grip toggles too, it passes. Handed to sim.

---

## 3. Systemic patterns

1. **Two codebases in one.** Components touched by the recent Church/Prayer-Wall/Settings work carry labels, roles, states, live regions, and reduce-motion branches as a matter of habit. The onboarding/registration flows (RegisterChurch 1/2, AccountSetup 2, JoinByCode) and older Connect list components predate that culture — near-zero coverage. The fix is not archaeology; it is applying the house patterns (which already exist in-repo, file-cited above) to the older surfaces.
2. **Token-level contrast debt.** Both failing text tokens (`textMuted` 0.45, `textSubtle` 0.25) fail everywhere because they were designed against a feel, not a ratio. Two numeric edits in `theme.ts` + a placeholder token clear the majority of the app's 1.4.3 exposure in one commit; the tab bar tint is the third line.
3. **Roles missing on text-bearing buttons.** The single most repeated defect (~60+ sites): visible text gives the *name*, nothing gives the *role*, so nothing sounds actionable. Mechanical fix, high yield.
4. **State is visual-only.** Checked/selected/expanded/unread are conveyed by ✓ glyphs, color, and weight — almost never by `accessibilityState`. (Where the team did wire state — Segmented, FilterChips, PillTabBar, NameVisibility radios, contact-visibility switch — it is exemplary.)
5. **Containment is understood but unevenly applied.** RN `<Modal>` used broadly (native containment), `accessibilityViewIsModal` on five custom overlays — but the two *security-postured* gates and six custom sheets missed it, which is exactly where it matters most.

---

## 4. What held up (genuine credit)

1. **Reduce-motion engineering on the flagship animations** — `useReducedMotion` hook with sane defaults; CamlView sonar rings swap to a static halo; GlobeView stops rotation, pulse, and auto-resume. The epic's named suspect (pulsing dots) is already handled properly.
2. **ChurchProfileBottomSheet** — switch role with checked state (526-527), every icon action labeled (Save/Share/Report/Pray, 565-582). Model file.
3. **Prayer Wall family** — labeled close buttons, "Clear all filters" on an icon-only chip, reduced-motion wired through cards, detail sheets, filter bar, landing.
4. **SettingsScreen** — 9+ `announceForAccessibility` call sites; 24-of-26 touchables labeled.
5. **ConnectTabIcon badge** — live region + pluralized count label; better than the stock badge it replaced.
6. **Selection controls done right where they exist** — `Segmented` (role="tab" + selected), `FilterChips`, `PillTabBar` (role+state+label+hitSlop), `NameVisibilityChoiceScreen` radios (role + selected + disabled), CamlView RAG filter chips (dot + text word — the 1.4.1 answer F5 needs).
7. **Font scaling never disabled** — zero `allowFontScaling={false}`, zero multiplier caps.
8. **DailyScriptureStrip** — offscreen measurement mirror correctly hidden with `accessibilityElementsHidden` + `importantForAccessibility` (186-187). Somebody thought about double-reading.
9. **Gate copy explains why** — all three gates (Persecuted 14B, Church, Connect) state the reason and the timeline in real text; the epic's locked-content-explanation requirement is met in substance (containment aside, F9).
10. **LoginScreen** — live-region error banner + full autofill/textContentType wiring.

---

## 5. Handed to sim lane / handed to Founder

Static analysis cannot confirm the following; the sim lane and the Founder's on-device VoiceOver pass own the verdicts here. Screen-reader UX is never marked "passed" from code in this document.

1. **Gate traversal breach (F9)** — on device, with VoiceOver/TalkBack: from the Connect gate, swipe-next repeatedly; confirm whether focus enters the covered header/tabs/list. Highest-priority confirmation in this audit.
2. **iOS announcement of the Login error banner** — `accessibilityLiveRegion` is Android-only; confirm whether iOS VoiceOver announces the mounted alert view, else add `announceForAccessibility`.
3. **Dynamic Type at AX sizes** — tab bar labels (84pt fixed bar), fixed-height CTAs, 8-10.5pt eyebrow register, ConnectTabIcon badge: clip/overlap audit at the largest two settings.
4. **Map surface with VoiceOver** — traversal order across chips → own-church marker → pull-up list; confirm the list is discoverable as the dots' alternative.
5. **JoinByCode with VoiceOver + paste** — can a blind leader complete code entry end-to-end; does paste land in the hidden field (SC 3.3.8 accessible-auth support).
6. **External keyboard pass (SC 2.1.1/2.4.7)** — RN focus visibility with a hardware keyboard, if in scope for store readiness.
7. **CamlView sheet without dragging (SC 2.5.7)** — confirm a tap alternative opens/closes the peek sheet.
8. **Real spoken order on Home feed cards** — merged Pressable cards with rich children (eyebrow dot, title, body, comments): does the merge read coherently, and does the card's expand behavior make sense by ear? The Founder's ear rules here.

---

## 6. Adjacent notes (one line each, no investigation)

1. `FAQScreen.tsx:~100` — search `TextInput` is `editable={false}`: a focusable dead control (and an AT confusion); either wire it or make it a decorative View.
2. `GlobeView.tsx:242-249` — red-dot pulse drives a React state flip every 700ms (`setPulseOpacity`) → whole-component re-render cadence; perf smell noted in passing.
3. `ConnectScreen.tsx:620-623` — soft-deleted leaders intentionally bypass the gate to read-only threads (RLS write-block server-side) — by design per queue §4, noted so the gate fix (F9) preserves it.
4. `CamlView.tsx:248` / `GlobeView` — `EXPO_PUBLIC_MAPBOX_TOKEN` read at build time is client-exposed by design (`EXPO_PUBLIC_*`); fine for Mapbox, just confirming it is a public-scoped token.
5. `TabNavigator.tsx:33,35` — hardcoded `#0E0E0E` / `rgba(240,237,230,0.06)` bypass the theme's "never hardcode brand values" rule (theme.ts:3).
6. `AccountSetup1PlaceholderScreen.tsx` and `SettingsPlaceholderScreen.tsx` / `ConnectPlaceholderScreen.tsx` — placeholder screens still in tree; dead-code candidates for pre-store cleanup.

---

*Audit performed statically, read-only, on 2026-07-03. Contrast ratios computed with the WCAG relative-luminance formula, alpha-composited over actual surface tokens; script retained in session scratchpad. No source files were modified. The parallel sim lane and the Founder's on-device pass hold final authority on all spoken-experience verdicts.*
