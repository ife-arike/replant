# Appendix A — Expected-Behavior Checklist from Lucid System Map (extracted 2026-07-12)

Companion to `2026-07-12-sim-uat-logged-in-visual-pass.md`. Extracted from Lucid folder 445090016 (docs 01, 02, 03, 04, 06.1, 08, 11 + RECONCILIATION 2026-07-02, which overrides 04/08/11 where they conflict). Citations are `[doc, node]`. Known Founder-acknowledged drift marked inline. Where the live app disagrees with an EXPECT below, that IS a finding (unless on the plan §10 do-not-flag list).

## 1. Login / Session

- EXPECT: Login is email + password via `signInWithPassword`; no other sign-in methods offered [01, "LoginScreen"]
- EXPECT: If TOTP MFA is enrolled, a challenge screen follows password (AAL1→AAL2); if not enrolled, straight through [01, "TOTP MFA challenge (if enrolled)"]
- EXPECT: Forgot password sends reset email (`resetPasswordForEmail`); Set-new-password arrives via deep-link and forces re-auth after update [01, "ForgotPasswordScreen"→"SetNewPasswordScreen"]
- EXPECT: Every session boot calls auth-status-check v9 and routes by resolved status: verified→MainTabs (5 tabs); pending_church→verification-wait; pending_leader→30-day-deadline flow; request_info→Home with RequestInfoBanner; soft_deleted→read-only + notice [01, "auth-status-check LOOP" cluster]
- EXPECT: auth-status-check re-fires on app foreground, screen focus, and navigation — status flips are picked up without re-login [11; 02, session providers]
- EXPECT: Rejected / hard-deleted account → signed out to SplashScreen on next status check [01] *(doc 08 disagrees — Ambiguity #1, THIS PASS RESOLVES)*
- EXPECT: Sign Out (hamburger) clears the session, navigates to SplashScreen, and clears cached UG-reveal state [02, "Sign Out"]
- EXPECT (UG account only): forced re-auth after 24h (surface accounts 168h) [04]

## 2. Home Feed + Announcements + Comments

- EXPECT: HomeScreen composition top-to-bottom: ScriptureStrip → VerificationBanner (if unverified) → RequestInfoBanner (if active) → NetworkFeed → overlays (gate / CompletionFlow) [02, blocks 1–6]
- EXPECT: ScriptureStrip shows daily scripture in scriptureItalic voice with reference + translation, renders regardless of verified state [02, block 1 + Invariants]
- EXPECT: NetworkFeed is a mixed feed of network_updates + announcements with pagination and pull-to-refresh [02, block 4]
- EXPECT: Announcement cards render by card_type; tag_type is an orthogonal topical label [02, block 7]
- EXPECT: Tapping an announcement opens detail with CommentThread; posting a comment requires auth (post-comment RPC) [02]
- EXPECT: Comments from UG authors are masked automatically ("A fellow …" + masked region) — no UG church name/city ever renders [02]
- EXPECT: New comments from others appear only after re-opening detail / refetch — comments are NOT live-pushed [11 — known drift in 02]
- EXPECT: Network Update cards tap through to church profile or Prayer Wall / Persecuted routes [02]
- EXPECT: EncouragementCard offers react and reply→Connect DM; flagged encouragements still arrive (DELIVER-ALWAYS) [02]
- EXPECT: Dashed placeholder cards open ComingSoonModal on tap [02]
- EXPECT: CompletionFlowOverlay appears post-verify while `profile_completion_done=false`; edit-mode re-entry pre-fills with "Save Changes" (skipIntro); never for Underground [02, block 6]

## 3. Hamburger Destinations

- EXPECT: Hamburger on Home tab ONLY — other tabs own their chrome [02 + Invariants]
- EXPECT: Menu contains: Account/Settings · Church profile (→TheChurchScreen) · FAQ/Help (Replant ID explainer) · About/Privacy/Terms/Covenant · Sign Out [02]
- EXPECT: "Invite to Replant" and "Address the Network" are post-MVP — absent or placeholder, not functional [02]

## 4. Prayer Wall (+ journal / testimony)

- EXPECT: Verified users get full experience from PrayerWallLanding (hero + entry cards); unverified get landing only [03]
- EXPECT: Hero rotates urgent prayer requests; tap opens PrayerWallDetailSheet; "Pray Now" creates an intercession hold + triggers post-prayer flow [03]
- EXPECT: Post-prayer modal "You've prayed for [request]" offers: write encouragement (→DM) · share testimony (→TestimonySubmissionModal, FK to original request) · continue [03]
- EXPECT: Requester's "+N leaders praying for you" count updates on refetch, not live [03 claims Realtime — known drift; 11 = polling-only]
- EXPECT: Intercession Journal lists own held prayers; "Release" removes hold; journal private to holder [03]
- EXPECT: UG rows in hero/journal masked — macro-region only [03]
- EXPECT: Testimonies carousel links back to original request; Celebrate increments celebrated_count (client-side update); anonymous testimonies mask author [03]
- EXPECT: Prayer requests with anonymous=true hide requester identity [03]
- EXPECT (unverified): landing only — no Pray Now, no post-prayer flow, no journal [03; 02]

## 5. The Church Tab

- EXPECT: Horizon switcher toggles CAML (flat map) / CAL (globe); UG viewers: switcher suppressed, locked to CAL [03]
- EXPECT: CAML = Mapbox + two pills — RE-CENTER ME (GPS) · MY CHURCH LOCATION (registered coords) [03]
- EXPECT: UG dots NEVER on CAML; "+N HIDDEN" tally chip + "UNDERGROUND · NOT PICTURED" honor note [03]
- EXPECT: CAL globe: Regions pull-up panel + Prayer Wall pull-up at bottom [03]
- EXPECT: Map dot / Regions row → ChurchProfileBottomSheet: hero, needs, RAG chip, resources, leader list, language, denomination, size, verified pill; CTAs Send Prayer + Connect (→Connect DM) [03]
- EXPECT: Anon leaders "A fellow [Role]" + church; UG "A fellow [Role]" + round lock + church OR region; hidden-name UG "Underground Church" + region; HQ blue badge [03]
- EXPECT (unverified): full-tab UnverifiedGateView; note LOCKED COPY per 2026-06-22 ruling supersedes the map's older gate phrase: "This process may take up to 30 days, but reviews are typically complete within 24-72 hours."

## 6. Connect

- EXPECT: Two sub-tabs Leaders · Ministries + shared search; DM thread list below [04]
- EXPECT: Leaders name-search = surface leaders only; UG reachable ONLY via exact RPL ID; brave UG → real name + church; safe UG → "A fellow [Role]" + macro-region [04]
- EXPECT: Ministries search never returns UG churches; tap → ChurchProfileBottomSheet [04]
- EXPECT: First-time DM requires connection request — submit → recipient sees → accept creates conversation, decline creates none; expired requests disappear from recipient inbox [04, KAN-69]
- EXPECT: After acceptance, messages flow with no further gate [04]
- EXPECT: Thread rows show last-message preview + unread count; tap opens DirectMessageThread [04]
- EXPECT: CovenantStrip at thread top; CovenantNotice on first message; first-message modal "You're about to reach out" [04]
- EXPECT: Flag-taxonomy content STILL delivers, no sender-visible error (DELIVER-ALWAYS; moderation = invisible shadow copy) [06.1; 04]
- EXPECT: Incoming DMs push LIVE (messages Realtime INSERT) and re-order thread list [11; RECON — conversations NOT published]
- EXPECT: Branch group threads scope to members; invites show consent state; leaving retains history [04, KAN-214]
- EXPECT: Replant Team Inbox thread exists from account creation (welcome DM); ONLY Connect surface pre-verified; admin replies "Admin Name from Replant Team" [04; 01]
- EXPECT: No 7-day fallback reach-out email — NOT BUILT, do not test for it [RECON]
- EXPECT (unverified): ConnectGateView — no DM initiation/requests/branches; Team Inbox visible [02]

## 7. Persecuted Tab

- EXPECT: Four pill pages — Feed · My Heartcries · Bear Witness · Take Heart [03]
- EXPECT: Feed shows only admin-approved heartcries (post_to_feed AND feed_approved), always PII-scrubbed feed_content, never raw [03]
- EXPECT: Own new heartcry NOT on Feed until admin approval — sits in My Heartcries as status=new [03]
- EXPECT: My Heartcries: own raw content + status pill (new / triaged / responded / closed), timestamps, triage lead post-triage, deep-link to Replant Team thread [03]
- EXPECT: Heartcry submission = separate screen (severity, request_type multi, content, post-to-feed toggle); seeds Replant Team thread with system first message [03]
- EXPECT: Bear Witness idempotent — second tap no-op, count doesn't double [03]
- EXPECT: "+N witnesses" client-side for actor; others on refetch [03 Realtime claim = known drift]
- EXPECT: Take Heart = daily 365-Witnesses rotation, read-only [03]
- EXPECT (unverified): landing view only [03; 02]

## 8. Settings / Profile

- EXPECT: Hamburger → Account/Settings → SettingsScreenContainer/SettingsScreen [02]
- EXPECT: NO functional UG visibility-change entry (KAN-274 drawn in 04 but NOT BUILT; live partial UI = finding) [04; RECON]
- NOTE: Map is thin on Settings (no MFA-enrollment/name-change/notification-pref nodes) — findings there log as "unmapped".

## 9. Verification States from Mobile

- EXPECT: Primary machine = pending · verified · rejected · deactivated; claim/request-info/appeal/delete are orthogonal flags [08]
- EXPECT (pending): VerificationBanner "Your church is under review" + per-tab gates; countdown pill ONLY for skip-flow leaders (users.verification_deadline) [08; 02]
- EXPECT (pending + request_info): RequestInfoBanner only when server thread has an admin message; tap → RequestInfoDetailModal → reply [08; 02]
- EXPECT (pending→verified): banner clears · ONE-TIME Verified toast on first sign-in post-verify · 5 tabs unlock · CompletionFlowOverlay if profile incomplete [08]
- EXPECT: RPL ID exists only after verification — pending churches show none anywhere [08; 01]
- EXPECT: Another church's verification appears as "church verified" NetworkFeed event on refetch [08 — push claim = drift candidate #2]
- EXPECT (rejected): "We were unable to verify your church" + appeal via email link (connect@); read-only Home; no 5-tab access [08] *(vs doc 01 sign-out — RESOLVE)*
- EXPECT (deactivated): access lost on NEXT auth-status-check; one-shot outcome modal [08] *(sign-out vs read-only unclear — ambiguity #3)*
- EXPECT (soft_deleted): read-only + notice [01; 02]
- EXPECT: Status flips observed via polling — background+foreground or navigate to trigger; no instant push [11]

## 10. Realtime vs Refetch (continuity calibration)

- LIVE (verified users only): new DM / branch / Team-Inbox messages; branch invite + membership events; connection request new/accepted [11; RECON — leader-facing live tables: messages · branches · branch_members · connection_requests]
- REFETCH-ONLY: announcements · comments · prayer requests · prayed-by counts · testimonies · celebrate counts · heartcries · witness counts · intercession holds [11 — known 00/02/03 drift]
- EXPECT: Thread-list reorder + unread pills ride messages INSERT (not conversations events) [RECON]
- EXPECT: Realtime mounts only for verified users; clears on sign-out; unverified session = zero live updates [11]
- EXPECT: NotificationToast = bottom overlay above ALL tabs, queues sequentially, tap = dismiss + deep-link [11; 02]
- EXPECT toast deep-links: DM → conversation; branch → branch thread; connection request → Requests sub-view; Team-Inbox reply → Team thread [11]
- EXPECT: Home refetches on tab focus; church profile sheet refetches on open [11]
- EXPECT: Missed events NOT replayed after reconnect; messages sent to killed app appear on next open [11]

## Map ambiguities this pass can RESOLVE (deliverable — record observed truth)

1. **Rejected experience:** doc 01 says sign-out→Splash; doc 08 says read-only Home + appeal link. S8 rejected flip answers this.
2. **Doc 08 Realtime overstatement** (churches/users UPDATE broadcasts, self-status toast) — S8 flip observation answers (polling vs push). Additional drift candidate beyond the acknowledged list.
3. **Deactivated: sign-out vs gated read-only shell** — S8 conditional deactivated flip answers (only if trigger inspection shows a clean revert path).
4. Doc 11 internal 7-vs-8-table inconsistency — resolved by RECON (conversations out); no app test needed.
5. **Home full-gate ambiguity** (when, if ever, is Home fully gated vs banner+feed) — S8 pending observation answers.
6. **Unverified Persecuted wording** (pills render? landing only?) — S8 pending observation answers.
7. Doc 06.1 empty sequence group — extraction note only.
8. Settings unmapped — findings logged as "unmapped".
9. RequestInfoBanner clear-condition vocabulary — test only if request_info state is cheaply manufacturable; else note.
10. **Post-MVP hamburger items presentation** (dashed+ComingSoon vs absent) — C2 hamburger walk answers.
