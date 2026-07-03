# Replant mobile — runtime accessibility audit (iOS Simulator), 2026-07-03

**Scope ruling:** sim-based visual tests + runtime accessibility tree as the automated proxy for VoiceOver. Nothing here is "VoiceOver-passed" — the real VoiceOver walk belongs to the Founder on device. Findings feed her device scripts.

Screenshots: `docs/audits/2026-07-03-compliance-a11y-store-audit/sim-screens/` (43 files, `-standard` = default Large text, `-a11y-xxxl` = AX5 accessibility size).

---

## 1. Build / run record

1. Fresh Debug build from current HEAD (`feat/kan-296-mobile-attribution-slot` @ 360bf9e) via XcodeBuildMCP `build_run_sim` — **SUCCEEDED** (~620s), workspace `ios/replant.xcworkspace`, scheme `replant`.
2. Simulator: **iPhone 17 Pro Max** (E2F42583-2C90-48B8-A849-D1058D35125E), iOS 26.3, 440×956pt.
3. Metro: a pre-existing `expo start` on :8081 (pid 11550, same project) was reused — my background `npx expo start` exited because the port was already serving this project. Debug JS is therefore always current HEAD (Metro serves from disk). Connected via dev-client deep link.
4. `get_open_prayers` regression check: **My Prayers** ("Your church has no open prayer requests yet") and **Intercession Journal** (0 HOLDING) both load clean on this fresh build — the stale-build RPC error did not reproduce.
5. Harness notes (not app bugs): (a) two booted sims break AXe's accessibility translation — shut down the extra iPhone 17 Pro; (b) iOS "Suggest Strong Passwords" cover views intercept the signup secure fields — disabled AutoFill in sim Settings to type passwords; (c) `simctl pbcopy` mangles non-ASCII (MacRoman read) — used host `pbcopy` + `simctl pbsync` for the native-script test; (d) a blue "Refreshing…" Metro banner appears in a few standard screenshots (welcome, forgot-password, ug-display-choice) — dev-only artifact, not app UI.

---

## 2. Systemic accessibility-tree findings (cross-screen)

1. **CRITICAL — Custom option controls are invisible to the accessibility tree.** Affected: role-picker rows + its Done button (`signup-role-picker-standard.png`); country rows in both country sheets; church-type rows + para-ministry ⓘ (`regcp1-churchtype-sheet-standard.png`); RAG status cards on RegCP2 (`regcp2-top-standard.png`) and the UG locked-status cards (`ug-regcp1-status-locked-standard.png`); emergency-plan and collaboration chips (`regcp2-bottom-standard.png`); UG display-choice radios (`ug-display-choice-standard.png`); ASP2 blue **Search** button, **Register yours →**, **Skip for now** (`signup-asp2-noresults-standard.png`); CITY ⓘ info icon, "Same as my account info" and "Mark as Headquarters" checkboxes (`regcp1-top-standard.png`). A VoiceOver user **cannot complete signup**: role selection and church registration are hard-blocked at several steps. WCAG 4.1.2, 1.3.1.
2. **CRITICAL — Sticky bottom CTAs never enter the tree, even when enabled.** "Next" (ASP1), "Next — Confirm Status" (RegCP1), "Register Church" (RegCP2), "Enter Replant" (ASP2), "Submit Church" (UG ×2) are absent in every snapshot, enabled or not. Related: on login/forgot-password the primary button is **removed from the tree while disabled** ("Sign in" appears only once both fields are filled — verified live) so a VO user first hears no submit control at all. WCAG 4.1.2.
3. **HIGH — Unlabeled text fields (placeholder-only, empty accessibilityLabel):** all 7 ASP1 fields ("First", "Last", "you@example.com", …), ASP2 church search, RegCP1's four fields, UG form fields, both country filter fields ("Type to filter…", "Search countries..."). Once filled, even the placeholder disappears from what VO can use as a name. Inconsistent: the **login** screen's fields are properly labeled ("Email address", "Password"). WCAG 4.1.2, 3.3.2.
4. **HIGH — Every static text is duplicated in the tree** (two identical nodes per string, e.g. e29/e30 "REPLANT"). VO users would swipe through everything twice. Systemic across all screens.
5. **HIGH — Home's daily scripture is completely missing from the tree** while visibly rendered ("Beloved, let us love one another…" 1 John 4:7, `home-pending-standard.png`). The Prayer Wall scripture IS exposed, so this is screen-specific. WCAG 1.3.1.
6. **MED — Inline validation errors are bare text nodes** (email-already-exists, "Password must be at least 8 characters", "Passwords do not match"), not associated with their (unlabeled) fields and with no announcement mechanism visible in the tree. Red-on-black error color is borderline for 1.4.3 at its small size. WCAG 3.3.1.
7. **MED — No accessibility focus containment anywhere:** sheets, the hamburger drawer, prayer detail modal, and the locked-tab overlays all leave the background screen fully present in the tree. Worst on locked tabs: The Church pending shows the verification overlay AND the location-required layer AND a live "Switch to At Large" control simultaneously (`church-pending-standard.png`); Connect pending shows overlay + active unlabeled search field + "Couldn't load your conversations." error (`connect-pending-standard.png`).
8. **MED — State/labels gaps:** ANONYMOUS MODE switch has no label (tree shows a bare switch, value 0 — `signup-asp1-bottom-standard.png`); Prayer Wall segments (Feed/Testimonies/My Prayers/Revelation/Locations) don't convey selected state; FAQ accordion buttons don't convey expanded/collapsed (Settings accordions DO — inconsistent); FAQ search glyph "⌕" is exposed as literal text, not a labeled button (`faq-expanded-standard.png`); RegisterIntro tile descriptions (incl. the safety-critical UG description) are not exposed at all — labels are titles only (`register-intro-chooser-standard.png`); RegisterIntro's visible "‹ Back" is not in the tree.
9. **LOW — "·" separator dots** on login exposed as text nodes (VO noise).

## 3. Per-screen notes — standard size (Large)

1. **Welcome** (`welcome-standard.png`): clean render, high contrast; Create Account/Sign In labeled. Defects: duplicate text nodes (finding 4).
2. **Login** (`login-standard.png`): fields + "Show password" labeled; Back labeled. Defects: findings 2 (hidden disabled Sign In), 9; footer "BY SIGNING IN…" small/dim but passes at its weight.
3. **Forgot password** (`forgot-password-standard.png`): field labeled; two "Back to sign in" controls both labeled. Defect: "Send Reset Link" hidden while disabled (finding 2).
4. **Declaration of Faith** (`declaration-of-faith-standard.png`): fully exposed, correct scriptureItalic usage, "I Affirm This" + "Back to start" labeled. Clean.
5. **ASP1** (`signup-asp1-top/bottom-standard.png`): findings 1, 2, 3, 8; role/country selectors when CLOSED are good ("Role: Pastor", "Country: United States" value-bearing labels); "HOW YOU'LL APPEAR" preview exposed. Visual: role/country rows sit half-hidden under the sticky Next bar until scrolled (low).
6. **Role picker sheet** (`signup-role-picker-standard.png`): 12 options + Done visible, none in tree (finding 1).
7. **ASP2** (`signup-asp2-standard.png`, `-noresults`, `-ready`): search field unlabeled; Search/Register-yours/Skip not in tree (finding 1); good empty-state copy; READY TO REGISTER card + "Edit church"/"Switch to a different church" buttons properly labeled; serif "Enter Replant" CTA hidden from tree (finding 2). Live email-exists check works (verified against prod: +t1/+t2 correctly flagged as taken).
8. **RegCP1** (`regcp1-top-standard.png`, `regcp1-churchtype-sheet-standard.png`): findings 1, 2, 3; church-type/country selectors not in tree even closed (worse than ASP1's); excellent privacy copy exposed ("Seen only by the Replant verification team…").
9. **RegCP2** (`regcp2-top/bottom-standard.png`): RAG cards visible (green/amber/red with descriptions) but not in tree (finding 1); the two textareas expose placeholder-as-label until filled; optional EAP/collaboration chips not in tree.
10. **Home pending** (`home-pending-standard.png`): tab bar exemplary ("Home, tab, 1 of 5" … "Connect, tab, 5 of 5"); "Open menu"/"Dismiss banner" labeled; banner copy explains limitation + 29-days + accounts@ contact. Defect: finding 5 (scripture missing from tree).
11. **The Church pending** (`church-pending-standard.png`): wait-time expectation copy is excellent and exposed. Defects: finding 7 double-layer bleed-through (visual + tree); location purpose string is good ("…never shared").
12. **Persecuted locked** (`persecuted-locked-standard.png`): clean lock explanation, fully exposed. Credit.
13. **Prayer Wall hub/feed/detail** (`prayerwall-hub-pending-standard.png`, `prayerwall-feed-standard.png`, `prayerwall-detail-modal-standard.png`): the strongest surfaces in the app. Cards labeled with grouped content ("…, ÉGLISE DU SALUT EN CHRIST — BENI MISSION · DR CONGO · 3W AGO"); filters labeled by purpose ("Filter urgent only"); detail modal complete (author, chips, Stand in the gap → label flips to "You're standing in the gap", Connect, Close); gating explained ("AVAILABLE ON VERIFICATION"). Defects: finding 8 (segment selected-state), finding 7 (no focus trap).
14. **Intercession Journal / My Prayers** (`intercession-journal-empty-standard.png`): empty states exposed with guidance; no RPC errors.
15. **Hamburger menu** (`hamburger-menu-standard.png`): all items + Close menu + Log out labeled; profile chip exposed. Native sign-out confirm alert fully accessible.
16. **Settings** (`settings-standard.png`, `settings-account-expanded-standard.png`): best-practice accordions ("Account, collapsed/expanded"), value-bearing rows ("Honorific, currently Not set"), action hints ("Reach the team. Tap to copy email and open mail composer."). Credit.
17. **FAQ** (`faq-expanded-standard.png`): all questions labeled buttons; answers exposed when open. Defects: finding 8 (no expanded state, "⌕" glyph).
18. **Connect pending** (`connect-pending-standard.png`): finding 7 (overlay + live search + error simultaneously); locked copy itself is good.

## 4. Dynamic Type — AX5 (accessibility-extra-extra-extra-large)

1. **CRITICAL — Hamburger drawer unusable at AX5** (`hamburger-menu-a11y-xxxl.png`): menu items overlap each other ("Log out" renders on top of "Language"; "Outreach & Missions" collides with the profile chip), the drawer does **not** scroll, and Settings/FAQ/Invite disappear from both the screen and the tree — unreachable. WCAG 1.4.4.
2. **HIGH — Prayer feed filter chips vertically clipped** (fixed-height row): "Urgent"/"Healing" cut in half, unreadable (`prayerwall-feed-a11y-xxxl.png`). WCAG 1.4.4.
3. **MED — Prayer detail header truncates** to "ÉGLISE DU SALUT EN CHRI…", losing the country (`prayerwall-detail-modal-a11y-xxxl.png`).
4. **LOW — Mid-word wraps without hyphenation:** "Repla/nt" wordmark on login + drawer (`login-a11y-xxxl.png`), "Make intercessi/on" (`prayerwall-hub-a11y-xxxl.png`); login back-chevron stays tiny/clipped; welcome footer's last line clips (`welcome-a11y-xxxl.png`).
5. **CREDIT — The core scales beautifully:** Home banner wraps and scrolls with no overlap (`home-pending-a11y-xxxl.png`); prayer request body text is glorious at AX5; welcome/login forms grow without breakage; segment row horizontally scrolls so all five segments (incl. Locations) stay reachable; tab bar stays fixed per iOS convention.

## 5. UG-flow incident log (KAN-247 — recorded, not chased)

1. **Literal `{region}` template token shown to users** on the display-choice screen: «Other leaders see "Underground Church · {region}" instead of your name.» — the variable is not interpolated (`ug-display-choice-standard.png`).
2. **CTA/step mismatch:** UG form page says "REGISTER CHURCH · 1 OF 2" with CTA **"Submit Church"**, but tapping it advances to a second screen (display choice) whose CTA is also "Submit Church". Standard flow's page-1 CTA correctly reads "Next — Confirm Status" (`ug-regcp1-status-locked-standard.png`, `ug-display-choice-standard.png`).
3. **The immutable display choice is invisible to VO:** the Show-our-name / Keep-our-name-hidden radios are not in the accessibility tree (systemic finding 1, but highest-stakes instance — this choice is one-shot per spec).
4. No crashes or dead-ends: UG happy path completed end-to-end. DB verification (read-only): `type=underground, country=Nigeria, city=NULL, address=NULL, lat=NULL, lng=NULL, rag_status=red, show_church_name=false, verification_status=pending` — **UG invariants held** (no location ever collected; RAG locked Red with exposed explanation "This is set for underground churches and can't be changed in the app."; name hidden by default).
5. Credit: UG-specific copy is exceptional and exposed — "This stays between you and Replant…", "Share as much or as little as feels safe.", post-submit privacy note, and the UG Home banner "The Replant team is praying with you and reviewing carefully." (`ug-start-or-join-standard.png`, `ug-regcp1-top-standard.png`, `ug-asp2-ready-standard.png`, `ug-home-pending-standard.png`).

## 6. Native-script render verdict (international readiness)

1. **PASS for text input at standard size.** In the ASP1 first-name field: Amharic **አበበ ከበደ** renders in proper Ethiopic (no tofu, baseline/weight consistent — `native-script-amharic-firstname.png`); Arabic **عبدالله** renders shaped and RTL-correct incl. the Allah ligature, field flips to right-alignment (`native-script-arabic-firstname.png`); CJK **王伟** renders clean PingFang fallback (`native-script-cjk-firstname.png`). System font fallback from DM Sans works; no clipping.
2. Caveats: input fields only — serif (CormorantGaramond) display contexts (menu profile chip, Home greeting, church-name headers) were not exercised with a non-Latin account name; fallback there will be system fonts visually mismatched with the serif brand but should stay legible. Recommend one device check with a non-Latin display name.
3. The a11y tree carries the correct Unicode value (VoiceOver would read the real name, not garbage).

## 7. Coverage gaps — for the Founder's device scripts

1. Real VoiceOver walk of everything above (this audit is tree-based; nothing is VoiceOver-passed). Priorities: signup end-to-end (expect blockers at role picker + sticky CTAs), UG display choice, locked-tab overlays.
2. Verified-account surfaces: unlocked Connect (conversations/DM), Prayer Wall posting + Receive intercession, Church tab CamlView map + RE-CENTER ME / MY CHURCH LOCATION pills, Persecuted unlocked content, NetworkFeed.
3. Email-confirmation loop (mailbox links not clickable from the sim harness).
4. UG "Join an existing fellowship with a code" branch (needs a live code).
5. Standard "Register a church branch" branch (parent-church picker).
6. Hamburger destinations not walked: The Vision, Outreach & Missions, Language, Invite to Replant; FAQ search behavior; Settings sub-sections beyond Account (Privacy/Church/Language/Notifications, Change password).
7. Sheets/pickers at AX5 beyond the prayer modal (role/country sheets at accessibility sizes).
8. Reduce Motion, Increase Contrast, Bold Text, and VO rotor/escape-gesture behaviors (device settings).
9. Save-password and strong-password system interactions on device (sim had AutoFill disabled after it hijacked the secure fields).

## 8. Security bonus check

1. Scanned `qa/` and `docs/` for committed test-account credentials: **CLEAN** — no test-account emails, no email+password pairs; the only "password" matches are UI copy strings in `docs/build_manifest_admin_tier_bundle.md`.

## 9. Disposable accounts created (prod, emails only — passwords in local scratchpad only)

1. The `+t16` disposable (Founder's tag convention; full address with the Founder) — A11y Audit Test Church T16 (house church, Testville, US, green) — pending verification. (+t1…+t5, +t7, +t11…+t15 already existed on prod; DB-checked before use.)
2. The `+ugt1` disposable — A11y Audit UG Church T1 (underground, Nigeria, name hidden, red-locked) — pending verification.
3. Cleanup suggestion for admin dashboard: both churches are obviously-disposable by name and safe to reject/remove after the device pass.

## 10. What held up (genuine credit)

1. Tab bar accessibility is exemplary (name + role + position on every tab).
2. Prayer Wall is the model surface: grouped card labels, purpose-labeled filters, complete detail modal, state-reflecting "Stand in the gap".
3. Settings accordions and value-bearing rows are best-practice; the contact row's action hint is the best label in the app.
4. Every locked/pending state explains itself in plain, pastoral language — and that copy is exposed to the tree.
5. UG flow honors its spec end-to-end (no location fields exist at all; RAG locked Red with explanation; name hidden by default) with the most careful copy in the product.
6. Dynamic Type support is genuinely strong on content screens — the failures are concentrated in fixed-height chrome (drawer, chip rows), not the reading surfaces.
7. Non-Latin input renders correctly on first try in all three tested scripts.
