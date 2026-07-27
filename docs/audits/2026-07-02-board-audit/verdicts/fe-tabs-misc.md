# fe-tabs-misc cluster — audit verdicts (2026-07-02)

Repo verified: /Users/ife/replant @ feat/kan-296-mobile-attribution-slot (6df2160, tree clean). All evidence from this tree.

## KAN-14 — Register Church Page 2 — map pin location confirmation
CURRENT LANE: In Review
VERDICT: PARTIAL
EVIDENCE:
- `src/screens/onboarding/RegisterChurchPage2Screen.tsx:192-194` — payload comment: "KAN-14: no map-pin step yet; lat/lng pass as null." The ticket's namesake feature was never built.
- `grep -rn "MapPinSelector" src/` → zero hits. The MAP-delivered component referenced in 6 grooming comments does not exist in the tree. `@rnmapbox/maps` (package.json:21) is installed but used only by the Church tab (CamlView/GlobeView), not registration.
- RegisterChurchPage2Screen.tsx:211-229 — flow was redesigned twice since the ticket: screen now carries RAG status + What-we-have/need + emergency-prep fields, and under the orphan-prevention architecture (2026-06-14) `register-church` v7 is validation-only → loopback to AccountSetupPage2 → atomic INSERT in `create-account` v4. The AC success path (return to Local tab + 4s toast + amber pulsing dot) is architecturally obsolete — registration no longer completes on this screen.
- `src/components/church/CompletionFlowOverlay.tsx:873-902` — location capture moved post-signup: church profile setup flow Step 1 silently geocodes the typed address on-device (`Location.geocodeAsync`) → `update_church_profile(p_lat,p_lng)`. Non-blocking, no map render, no pin, no user confirmation.
- CamlView.tsx — no pending-church pulse treatment (amber there = RAG status), confirming the amber-pulsing-dot AC is absent.
MISSING: map confirm step (render/center/auto-drop pin); draggable pin; geocode-at-registration + failure banner; locked toast copy; amber pulsing dot on submission. Founder's last ticket comment (2026-05-23): "This is not completed."
DEPLOYED: mobile-tree (the shipped non-map Page 2)
NEEDS-LIVE-DB: none
NEEDS-SIM: none (absence is provable in code)
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Map-pin confirmation NOT built: RegisterChurchPage2Screen.tsx:192 ships `lat:null,lng:null` with in-code comment "no map-pin step yet"; MapPinSelector absent from the tree.
- Screen named Page 2 exists but carries RAG + has/needs + emergency-prep (KAN-13 finalization + Founder rulings 2026-06-12/18/19) — different content than this ticket's spec.
- Original success-path ACs (Local-tab return, 4s toast, amber pulsing dot) obsoleted by orphan-prevention redesign 2026-06-14: v7 validation-only → ASP2 loopback → atomic create-account v4.
- Location capture partially relocated: church profile setup flow geocodes address silently post-signup (CompletionFlowOverlay.tsx:873-902) — no map, no confirmation UX.
- Decision needed: re-scope a pin-confirm step into the current flow (registration or church profile setup flow) or formally supersede in favor of the silent geocode. In Review is not an accurate lane for unbuilt scope.

## KAN-35 — Verification Countdown Banner
CURRENT LANE: In Review
VERDICT: BUILT
EVIDENCE:
- `src/components/home/VerificationBanner.tsx` — full component: UTC day math (:37-40), states neutral >7 / amber ≤7 / urgent ≤1 / register (null deadline, skip-flow) / leader (:137-142), `days < 0` hidden (:135, deactivation flow owns it), in-memory per-session dismiss (:129), tappable mailto (:35,66-68).
- `src/screens/main/HomeScreen.tsx:298-300` — render gate `{branch === 'pending' && <VerificationBanner variant={churchVerified === true ? 'leader' : 'church'} />}` — the KAN-36 Option-Y override is live: verified-church + pending-leader gets the 'leader' variant with NO countdown (VerificationBanner.tsx:131 forces days=null; :86,:120 leader copy).
- Register state (:85,:118) covers the skip-flow null-deadline case, reading `useAuth().verificationDeadline` (users.verification_deadline).
- Underground override (:78-108, Ask 6 · Ruling #5 2026-06-19): single pastoral line, no countdown, no email — generic chrome.
- Founder hold reason ("should be built in The Church tab as well so not closing," 2026-05-23) — addressed: `src/screens/main/TheChurchScreen.tsx:66-129` UnverifiedGateView covers the whole Church tab for pending leaders (church-pending + leader-pending copy variants, universal 30-day/24-72hr timeline per locked ruling #6 2026-06-21; request_info suppression per Ruling #22 2026-06-22). Deliberately a gate, not a countdown banner — no day-count fingerprint in that surface.
MISSING: n/a (AC copy/email details superseded by later Founder rulings: connect@ → accounts@projectreplant.org; redesigned copy set "Direction 1 · Held field"; neutral state removed 2026-05-22 then restored in redesign)
DEPLOYED: mobile-tree
NEEDS-LIVE-DB: none
NEEDS-SIM: pending-leader account on Home → banner states at >7 / ≤7 / ≤1 days + leader variant on a verified church; Church tab shows UnverifiedGateView
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- Banner built and enriched beyond original AC: 5 states incl. null-deadline register state and church-verified/leader-pending variant (no countdown, per KAN-36 Option-Y).
- Home wiring live at HomeScreen.tsx:298-300, gated to branch==='pending' only; dismiss is in-memory per session per SPEC ratification.
- Contact email is accounts@projectreplant.org (supersedes AC's connect@); copy set superseded by the Direction-1 redesign — AC strings in description are stale.
- Founder hold reason resolved by different mechanism: The Church tab now full-screen UnverifiedGateView for pending leaders (TheChurchScreen.tsx:66-129) — pastoral copy + universal timeline, deliberately no countdown (locked ruling #6, 2026-06-21).
- Underground viewers get a single pastoral line — no countdown/email (Ruling #5, 2026-06-19).
- Remaining: Founder confirms the Church-tab gate satisfies her 2026-05-23 comment → Done.

## KAN-77 — Static Content Screens — Vision · Outreach & Missions · FAQ
CURRENT LANE: Backlog
VERDICT: BUILT
EVIDENCE:
- All three screens exist and are Founder-locked: `src/screens/main/hamburger/TheVisionScreen.tsx`, `OutreachMissionsScreen.tsx`, `FAQScreen.tsx` — each headed "CD v5 final, Founder-locked 2026-06-09" (G-26 copy question effectively closed by that lock).
- Wired end-to-end: HamburgerPanel.tsx:366/373/387 navigate → RootNavigator.tsx:103-119 registers all three (slide_from_right, full-screen push, no tab bar).
- Shared shell: `src/screens/main/hamburger/HamburgerNavBar.tsx` — 48px bar, sky back chevron, centered Cormorant (Typography.display) title.
- FAQ accordion: FAQScreen.tsx:73-78 single-open (`openIndex`, opening one closes the other; tapping open one closes it), LayoutAnimation ~easeInEaseOut, chevron up/down toggle (:125-133 — AC-permitted alternative to +/−), all collapsed on load, 13 flat Q&A items (:42-69).
- Portrait lock: global `app.json:6 "orientation": "portrait"` — per-screen lock moot (stronger guarantee).
- FAQ "Replant Network ID" copy (:59-60) is backed by a shipped feature: `churches_public.network_id` (migrations 20260528000001, 20260528000007), Settings "Network ID" tap-to-copy row (SettingsScreen.tsx:1038-1054), KAN-192 ASP2 ID detection.
MISSING: n/a — deviations below are CD v5 Founder-locked supersessions, not gaps
DEPLOYED: mobile-tree
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- All three screens shipped per CD v5 final (Founder-locked 2026-06-09), wired from hamburger → RootNavigator full-screen pushes; shared HamburgerNavBar shell.
- CD v5 superseded several original ACs: FAQ is a flat numbered 13-item accordion (no 5 category sections), no Psalm 133:1 footer, search bar is a labeled visual stub (post-MVP).
- Original "no mailto at MVP / Reach out via Connect tab" AC superseded: Founder-locked contact card opens mailto:info@projectreplant.org (FAQScreen.tsx:40,147-155).
- FAQ's "unique Replant Network ID" claim is true in prod code: churches_public.network_id + Settings Network ID row + ASP2 RPL-ID search detection.
- Portrait locked app-wide via app.json — satisfies the per-screen AC globally.
- Nit (non-blocking): FAQ LayoutAnimation has no reduced-motion branch.

## KAN-78 — Tab Bar Navigator + Locked Modal — Scaffold + Remaining Build
CURRENT LANE: Backlog
VERDICT: SUPERSEDED
EVIDENCE:
- `MainTabNavigator.tsx` (the ticket's target file) no longer exists — replaced by `src/navigation/TabNavigator.tsx` (KAN-87 foundation): exactly 5 tabs in D-34 order Home / The Church / Persecuted / Prayer Wall / Connect (:52-92), "The Church" param key preserved (types.ts:14), D-35 icons from the TabIcons barrel (4 direct imports; Connect via ConnectTabIcon which wraps ConnectIcon + unread badge — ConnectTabIcon.tsx:18,34), active tint Colors.accent / inactive muted off-white (:40-41).
- Locked-tab modal architecture is gone by design: NO tabPress interception, NO modal, NO "Got it" anywhere. Gating moved in-screen on all three sensitive tabs: PersecutedScreen.tsx:42-97 self-gates on users.verification_status (KAN-65 Screen 14B lock-glyph gate — exactly the Section 2.4 endgame, taken further); ConnectScreen.tsx:152-191 ConnectGateView (HANDOFF §8); TheChurchScreen UnverifiedGateView. Tabs are always routable; the gate view carries pastoral copy with NO day-countdown (aligned with the Church-tab no-countdown lock).
- Section 2.3 (real screens per tab): complete — all 5 tabs mount real screens; Church tab pager is the real CAML/CAL host (Page 0 At My Location / Page 1 At Large — TheChurchScreen.tsx:9,58).
- Persecuted active tint deliberately red (KAN-65 R2 override, TabNavigator.tsx:68-74) — post-ticket design evolution.
- One AC dropped in the rebuild: `tabBarAccessibilityLabel` — zero occurrences in TabNavigator.tsx (Section 2.5 labels never carried over).
MISSING: (carried-over gap within superseded design) tabBarAccessibilityLabel on the 5 Tab.Screens; locked-modal a11y items moot.
DEPLOYED: mobile-tree
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- 5-tab bar shipped and live in TabNavigator.tsx (KAN-87 rebuild of MainTabNavigator): D-34 order + definite article, D-35 icons from TabIcons barrel, brand active/inactive tints.
- Locked-tab MODAL (Section 2.1/2.2) superseded end-to-end: unverified gating is now in-screen full-view gates on Persecuted (KAN-65 Screen 14B), Connect (HANDOFF §8), and The Church — no navigator interception, no countdown copy, no "Got it" modal.
- Section 2.3 closed: all five tabs mount production screens; Section 2.4 exceeded (Persecuted gates in-screen; Connect moved in-screen too by later design).
- KAN-44 hard-block moot: gates read live verification state (useAuth branch / users.verification_status).
- Residual: tabBarAccessibilityLabel from Section 2.5 was not carried into the rebuilt navigator — fold into the accessibility audit ticket (KAN-34) rather than reopening this one.
- Persecuted tab active tint is red per KAN-65 R2 (intentional divergence from the sky-blue AC).

## KAN-254 — Empty-state pass — commit working tree + finish Coming Soon modal sweep + remaining surfaces
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- DoD 1 (commit the 2026-06-10 working tree) DONE: commit `221ae18` (2026-06-14) "feat(5-tab): empty-state polish + Founder device-pass rulings" — 21 files, +992/−421, includes canonical `src/components/common/ComingSoonModal.tsx`; working tree clean today.
- Canonical ComingSoonModal adopted by 3 surfaces only: SettingsScreen, OutreachMissionsScreen, TakeHeartScene (grep -rln).
- The 5 sweep-remainder surfaces all have deliberate treatments, but none uses the canonical modal: LocationsView.tsx:2-51 full dashed-frame COMING SOON card + Job 5:12 (the canonical dashed-card pattern — arguably correct for a full view); HamburgerPanel fallbacks ELIMINATED (Vision/Outreach/FAQ now navigate to real screens :366-387; stale header comment :17-25 still claims "Coming soon" Alerts); AttachmentPopover.tsx:102-104 designed popover copy; MinistriesList.tsx:238 inline ">7 branches" note; ChurchProfileBottomSheet.tsx:330-332 share = bare `showToast('Sharing coming soon')` with TODO — the one true leftover stub.
- DoD 3 (Persecuted reader ratification) OPEN and the ticket's premise is stale: all four readers still carry PLACEHOLDER_* fallback content (ArticleReaderScreen.tsx:39-41, GuidanceReaderScreen.tsx:45-46, StoryArchiveScreen.tsx:42-43, WitnessArchive same pattern) and are now REACHABLE — registered in RootNavigator.tsx:80-91 and pushed from BearWitnessScene.tsx:82-123 / TakeHeartScene.tsx:150. No Founder ratification recorded (ticket has 0 comments).
- Pre-UAT sample-strip flag: main feeds clean (no SAMPLE constants in NetworkFeed/FeedScene); PrayerWallLanding.tsx:9 retains "live counts (hardcoded MVP)"; reader placeholders remain as unseeded-DB fallbacks.
MISSING: ChurchProfileBottomSheet share stub conversion (or explicit accept-as-toast ruling); Founder ratification of reader placeholder treatment (now-reachable, not unreachable as ticket assumed); stale HamburgerPanel header comment cleanup; explicit ruling that dashed-card/popover/inline treatments satisfy "canonical" for the other 4 surfaces.
DEPLOYED: mobile-tree
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: To Do
COMMENT-FACTS:
- Working-tree risk resolved: empty-state pass committed as 221ae18 (2026-06-14); tree clean on the current branch.
- Canonical ComingSoonModal live on 3 surfaces (Settings, Outreach, TakeHeart).
- Of the 5 remainder surfaces: HamburgerPanel is moot (real static screens shipped), LocationsView uses the canonical dashed-card pattern, AttachmentPopover + MinistriesList have designed inline copy, ChurchProfileBottomSheet share is still a bare toast stub with TODO.
- All 4 Persecuted readers are now reachable from the scenes and still ship placeholder editorial fallback content — the ticket's "unreachable from gated nav" note is stale; Founder ratification per DoD never recorded.
- Recommend re-scoping the remainder to: share-stub decision + reader-copy ratification + stale HamburgerPanel comment.

## KAN-255 — Universal style continuity pass — back button / pagination / filter chips / section headers / pill tabs
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE (state of each family today):
- Back button — NOT unified, ≥4 implementations: HamburgerNavBar.tsx SVG sky chevron (no label); persecuted/components/BackRow.tsx; text "‹ Back" across 8 onboarding screens (e.g. RegisterChurchPage2Screen.tsx:439); SettingsScreen rolls its own chevron; ReplyComposer/MyOpenPrayersView variants.
- Pagination — canonical exists but ORPHANED: `src/components/PagedList.tsx` (header: "Extracted from PersecutedScreen feed pagination. Reusable on Prayer Wall.") has ZERO importers; FeedScene.tsx:27,83,149-154,209-220 reimplements round-nav inline. No other surface paginates with it.
- Filter chips — partially shared within Persecuted only: persecuted/components/FilterChips.tsx used by StoryArchiveScreen.tsx:20 + WitnessArchiveScreen.tsx:19; FeedScene rolls its own regionChip styles (:361-363); Prayer Wall has a separate PrayerWallFilterBar.
- Section headers — per-surface: HomeSectionLabel (Home), local SectionHead in OutreachMissionsScreen.tsx:57-67, distinct inline patterns in persecuted scenes and prayer views.
- Scripture footers — inline per-scene (verseRef-style blocks in ≥7 files: DMThreadView, MinistriesList, PrayerWallLanding, 4 persecuted scenes); no shared component.
- Pill tabs — TWO implementations: persecuted/components/PillTabBar.tsx and components/prayer/PrayerWallPillNav.tsx.
- StatusTrack: shipped inline layout present (persecuted/components/StatusTrack.tsx) — direction correctly held open per ticket.
- DoD artifacts absent: no audit doc, no canonical-per-family migration, no Founder visual ratification.
MISSING: the entire pass — audit doc; single canonical implementation + callsite migration for all 6 families (0 of 6 unified app-wide; chips unified within Persecuted archives only; PagedList canonical exists unadopted); Founder ratification.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Pass not started: no audit doc, no unification commits; 0 of the 6 component families are consistent app-wide today.
- Concrete drift counts: back button ≥4 variants; pill tabs 2 implementations (Persecuted PillTabBar vs PrayerWallPillNav); scripture footers inline in ≥7 files; section headers per-surface.
- PagedList.tsx was extracted as the canonical pagination component but has zero importers — even Persecuted Feed reimplements pagination inline; adopting it is the cheapest first win.
- FilterChips.tsx is genuinely shared across the two Persecuted archives — a working seed for the chips family.
- Ticket's own timing gate ("after login/signup flow") is now satisfied — actionable any time before App Store submission.
- StatusTrack inline layout is shipped and its design direction remains open per the Founder's note; nothing to migrate there.
