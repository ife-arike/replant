# Compliance · Accessibility · Store-Readiness Audit — Ranked Synthesis (2026-07-03)

**What this is.** The synthesis deliverable of the Founder-scoped compliance/a11y/store-readiness audit (brief: `.claude/plans/2026-07-02-compliance-a11y-store-readiness-audit-brief.md`; epic [KAN-301](https://projectreplant.atlassian.net/browse/KAN-301), a11y under [KAN-34](https://projectreplant.atlassian.net/browse/KAN-34)). Gap-finding, pre-UAT-signoff: the formal compliance/legal phase stays post-UAT-signoff per the locked release pipeline; this audit exists so long-lead remediation (legal drafting, the deletion chain, the publication chain) starts moving now.

**Method.** Eight read-only lane agents (code + live-DB verified; checklist corpora built from the live standards — App Review Guidelines, Play policy pages, WCAG 2.2 AA — before auditing), one fresh sim build walked at two text sizes, two paste-ready cowork LEGAL briefs, reconciliation worksheets, and this ranked synthesis. Every Jira key cited below was re-verified against live Jira on 2026-07-03 (statuses in parentheses are live). Zero writes to code, DB, or Jira; two disposable accounts created via prod signup under the Founder-ruled `+tag` convention (emails redacted here to tag shorthand — the repo is public; full addresses with the Founder).

**Lane verdict files** (this directory): `a11y-static.md` · `a11y-sim.md` (+ `sim-screens/`, kept local-only, see §9) · `data-inventory.md` · `ios-app-review.md` · `google-play.md` · `privacy-gap-map.md` · `tos-lane.md` · `worksheet-ios-privacy.md` · `founder-device-scripts.md`. Cowork LEGAL briefs: `.claude/plans/2026-07-03-cowork-legal-tos-drafting-brief.md` + `.claude/plans/2026-07-03-cowork-legal-privacy-v0_3-brief.md`.

---

## 1. Executive verdict

**Not submittable to either store today — and every blocker is bounded, enumerable, and mostly small.** Seven consolidated STORE BLOCKERS (§2), none of them architecture: the deletion chain is wiring plus one web page on top of live DB machinery; report/block are the two missing UGC legs; the policy/ToS chain is drafting-and-publishing work whose briefs are now written; the placeholder-density fix is wire-or-hide; the Play permission strip is one config line. Underneath, the foundations verified stronger than the tickets predicted: the client ships zero analytics/tracking/push surface, the UG invariants held end-to-end under a live signup walk, target API clears the 2026 Play bar with headroom, and the deletion/scrub machinery is real.

The accessibility picture is two codebases in one: newer surfaces (Prayer Wall, Settings, tab bar, Church map) are genuinely exemplary; the onboarding/registration flows are near-zero — **a VoiceOver user cannot complete signup today** (§4). The fix patterns already exist in-repo.

Counts: **7 STORE BLOCKERS · 16 compliance gaps · 39 a11y defects (6 P1 static + 9 runtime-critical/high tree + 5 Dynamic Type; overlaps noted in §4) · ~20 worksheet items.** Two audit-brief expectations were corrected by evidence: the Persecuted readers' "placeholder" editorial is finished production-quality content (content ops, not a rejection vector), and KAN-261 was a miscite — the leader-facing report UI has no ticket at all (§2.2).

---

## 2. STORE BLOCKERS (ranked, cross-store consolidated)

### 1. Account deletion — Apple 5.1.1(v) + Play, three legs
In-app: Settings "DEACTIVATE ACCOUNT" opens a ComingSoonModal (`SettingsScreen.tsx:1258-1265`); no deletion-initiation path exists. Apple rules verbatim that deactivation-only is insufficient — the flow must offer **full deletion**. Play requires the same in-app path AND a **web deletion-request page**; Replant has no web account surface at all (`website/` = four static pages). The DB machinery is live and verified (`fn_soft_delete_my_account` → 30-day restore → Day-30 tombstone sweeper incl. `auth.users`), so this is wiring + one thin web page + an ops runbook, not new engineering. Anchor: KAN-205 (Backlog) — **needs re-scope from "deactivation" to full deletion**; web page needs a new ticket. Evidence: `ios-app-review.md` row 1, `google-play.md` findings 1–2 + §2, `data-inventory.md` §4.

### 2. UGC report mechanism — Apple 1.2(b) + Play, absent on every surface
No report affordance on DMs, branch messages, prayers, testimonies, or comments. The sole stub is worse than absence: the church-profile flag icon toasts "Report received" while wired to nothing (`ChurchProfileBottomSheet.tsx:334-336`). **Jira anchor correction:** the brief/epic cite KAN-261 for this; live KAN-261 (Backlog) is a FLAG_TAXONOMY financial-solicitation extension whose description *presumes* a leader-facing Flag modal that does not exist. The report-UI build has **no existing ticket**. Evidence: `ios-app-review.md` row 2, `google-play.md` finding 3.

### 3. Block user — Apple 1.2(c) + Play 1:1 requirement, absent entirely
Zero block/mute/hide UI; the `blocked_users` table exists DB-side, unwired. Apple's leg is verbatim "block abusive users"; Play requires blocking for 1:1 interaction. The post-MVP mute ruling does not survive store review for a chat app. Needs its own SEC/DBA-panelled ticket (suspension-lifecycle precedent). Evidence: `ios-app-review.md` row 3, `google-play.md` finding 3.

### 4. No published privacy policy — both stores' hard submission field
No policy page exists anywhere public; the in-app Settings row is a ComingSoon stub; ASC and the Play Data Safety form both hard-require the URL. The v0.2 draft was never published, is scoped to the website interest list, and contains a false UG claim (§3.3). **The publication chain gates every store lane:** decisions → v0.3 text (brief ready) → published URL → in-app wiring → store forms. Evidence: `privacy-gap-map.md` blockers 1–2, `ios-app-review.md` row 4.

### 5. ToS acceptance event + hosted Terms — the scoping note's own premise
No ToS acceptance mechanism, column, or hosted document exists (signup writes only `declaration_affirmed`; Settings Terms row is a stub). The 2026-05-13 scoping note's premise stands: neither store submission proceeds without a Terms acceptance event. Drafting is unblocked TODAY (brief ready, entity facts pinned: Replant Initiative, Inc., GA nonprofit, EIN 42-3033485, **Form 1023 unfiled — no 501(c)(3) representation permitted in any published document**); acceptance-flow build waits on deferred Founder decision 2. Evidence: `tos-lane.md` G-1.

### 6. Placeholder density on the reviewer's path — Apple 2.1 (aggregate)
Settings stacks five ComingSoon stubs (password KAN-74 (To Do), deactivation KAN-205, Terms, Privacy, Covenant) plus the language row; main surfaces add Revelation's disabled compose (KAN-224, Backlog), the inert "Connect to this church" CTA (KAN-260, Backlog), the permanently-disabled My Prayers Edit (KAN-225, Backlog), the attachments popover, and the Locations full-screen "COMING SOON" card. Any one survives; the aggregate reads as beta. **Fix the load-bearing (deletion, policy links); hide the rest until wired.** KAN-254 (In Progress) is now the empty-state/ComingSoon sweep ticket and is the natural home. **Downgrade:** the four Persecuted readers ship *finished, production-quality* editorial as hardcoded fallbacks — content-inventory hygiene, not a rejection vector. Evidence: `ios-app-review.md` rows 5 + 20.

### 7. Play manifest permissions — one-line config fix
`expo-screen-capture` injects `READ_MEDIA_IMAGES` + `READ_EXTERNAL_STORAGE` into the merged Android manifest; Play's Photos/Videos policy subjects the listing to removal for it, and Replant's use (screenshot *detection*, ≤Android 13, never even requested at runtime) cannot pass the core-functionality bar — nor needs to: `FLAG_SECURE` already hard-blocks screenshots on the join-code screen. Fix: `android.blockedPermissions` in app.json (keep `DETECT_SCREEN_CAPTURE`). Evidence: `google-play.md` finding 5.

---

## 3. Compliance gaps (ranked)

1. **Mapbox telemetry is default-ON — confirmed at code level, cross-store label damage, UG-axis data-exfil.** The bundled SDK declares 7 collected data types incl. precise location with an Analytics purpose; telemetry defaults on (`EventsManager.swift` `registerDefaults` verified in the pinned pods); no opt-out exists anywhere in the app; Play's service-provider carve-out does NOT cover it (Mapbox's own purposes → "collected AND shared"). It sits beside the shipped promise "Your position is never shared" and beside a UG architecture that three-layers location out of existence. **Fix verified end-to-end:** `Mapbox.setTelemetryEnabled(false)` at startup; proxy-capture verification; SEC panel on the change. `worksheet-ios-privacy.md` §3 carries both paths; Path 1 (disable) recommended.
2. **`ITSAppUsesNonExemptEncryption=false` is not honest.** The client bundles `@noble/ciphers` AES-256-GCM for session-at-rest encryption (`secure-storage.ts:28,88,103`) — non-exempt standard crypto. Recommended: flip to `true` + four ASC answers (mass-market 5D992.c; annual BIS self-classification email; France/ANSSI leg only if France availability is chosen). The refactor alternative would unwind SEC ruling 11015's seized-device posture to save one annual email — rejected. `worksheet-ios-privacy.md` §4.
3. **The v0.2 privacy draft's UG claim is false on "country."** "Not country, not city, not address, not coordinates" — verified reality: all 38 live UG churches store country (required by the validator; admin-only macro-region display); the DB CHECK forbids exactly city/lat/lng, which held under a live UG signup this session. **The DB invariant is intact; the policy sentence is the defect.** The honest claim (no city/coordinates/address ever; country + admin-only macro-region) is still strong and is what the LEGAL brief carries. Ruling lineage: KAN-13 (Done) comments, 2026-05-19/20.
4. **Heartcry is described as "end-to-end encrypted" on KAN-157 — it is not.** Verified: client sends plaintext over TLS; the edge function encrypts server-side (pgp_sym, Vault key); admin decrypt is deliberate, audited (two audit rows commit BEFORE plaintext returns), TOTP-gated. The true model is *stronger* for pastoral care and must be stated truthfully everywhere; an E2E overclaim to persecuted users is a material misrepresentation. Correct KAN-157's description in the filing batch. **RULED 2026-07-03: heartcry gets TRUE E2E — post-MVP but CRITICAL, the #1 post-MVP priority before anything else. Public docs state the current model truthfully + a good-faith forward commitment (cowork LEGAL drafts the wording). SEC design panel, unified with UG-evidence envelope v2; key custody coordinated with the backup-DR escrow ceremony.**
5. **`PrivacyInfo.xcprivacy` declares zero collected data types** against real collection of ~10 categories. Both lanes agree on the facts (accessed-API entries are correct; the collected-types array is the falsehood). Because `ios/` is gitignored, the durable fix is the ready-to-apply `expo.ios.privacyManifests` block in `worksheet-ios-privacy.md` §2.3, mirrored forever to the nutrition labels.
6. **The PII scrub misses the post-KAN-63 columns.** `scrub_user_pii` scrubs `email` + `full_name` only — `first/middle/last_name`, `honorific`, `suffix`, `phone` (KAN-229/231-era columns) survive the 90-day post-deactivation scrub. One-migration fix; land before the policy publishes so the 90-day claim is simply true.
7. **Church PII survives the completed deletion lifecycle.** Self-delete never flips `verification_status`, so `scrub_church_pii` can never fire on that path; hard-delete stamps `churches.hard_deleted_at` without nulling contact/address/lat-lng; `contact_name` is never scrubbed anywhere. A deleted leader's own contact details can persist forever on the church row. DBA-panelled migration.
8. **No data-subject access/export path exists** — no function, endpoint, or runbook. Policy must not promise portability; a manual admin runbook is the minimum behind any access promise.
9. **Audit-log 30-day age-out: ruled 2026-06-30, unbuilt** (no cron, no function — verified live). **RESOLVED 2026-07-03 (Founder): NO age-out — indefinite retention for ALL classes, disclosed plainly in v0.3.** The 30-day element of the 2026-06-30 framework is superseded; nothing gets built here except the disclosure and the audit-UX replacement ticket (§10.13).
10. **Content-plane forever-retention is an unstated policy choice.** Messages/testimonies/comments/connection requests: no retention machinery; survive account deletion de-attributed; `messages.attribution_display_name` snapshots survive later anonymity toggles. Defensible ministry choice — v0.3 must state it.
11. **Website lead data has no lifecycle, and Google is an undisclosed processor.** Join-network leads land in Netlify Forms AND a Google Sheet; volunteer submissions in Netlify Forms; no retention rule anywhere; the join-network form (unlike volunteer) carries no privacy notice; Google Fonts sends visitor IPs on all pages. v0.2's "we will delete the interest list" is backed by no machinery.
12. **Covenant/consent narrative drift, three ways.** Public FAQ says covenant-informed-at-signup; the 2026-06-08 ruling made the Covenant expressly not a click-through; the shipped reality is a first-DM notice acknowledged by a device-local flag never persisted server-side. The ToS becomes the first binding place users learn of safety review — drafted accordingly; FAQ copy fix + covenant surfaces + a SEC/BE look at server-side ack persistence.
13. **No minimum age exists anywhere** — no DOB, no assertion, no gate; only the unposted v0.2 mentions 18/13. Both stores need an age rating; ToS §2 needs a ruled number (18 is the natural fit; bracketed in the draft until ruled).
14. **Location purpose strings over-declared + strays.** Two Always-location strings on a foreground-only app (delete both; keep WhenInUse), a boilerplate FaceID string with no LocalAuthentication usage, and the "never shared" wording needs the LEGAL-ruled precision ("never shared **with other members**") since exact GPS transits Replant's server and Mapbox's geocoder as processors.
15. **Filter thinness behind the 1.2(a) "filtering ✓" claim.** Reconciled count: 21 auto codes, 10 populated (all tier-1 persecution-safety codes, 18–37 patterns each), **11 empty — including `threats`, `hate_or_targeting`, `spam_pattern`, `self_harm` (T2)** — the classic-abuse categories stores care about; 3 manual codes pattern-less by design. KAN-291 (To Do) is the correct, execution-ready anchor (panel output exists). Defensible as "a method for filtering" only alongside working report + block + human moderation.
16. **Android functional gaps for the Play phase:** runtime location permission never requested (RE-CENTER ME dead on Android as written); `android:allowBackup` defaults true (set false via expo-build-properties — UG posture, not policy).

---

## 4. Accessibility defects (→ KAN-34; WCAG 2.2 AA; static + runtime merged)

Full registries: `a11y-static.md` (25 findings: 6 P1 · 11 P2 · 8 P3, computed contrast math) and `a11y-sim.md` (9 systemic tree + 5 Dynamic Type findings, 22 surfaces, 43 screenshots at two text sizes). The Founder's on-device VoiceOver pass (`founder-device-scripts.md`) holds final authority on every spoken-experience verdict — nothing below is "VoiceOver-passed."

**The headline: a VoiceOver user cannot complete signup today.** Static and runtime converged independently:

1. **Custom option controls are invisible to the accessibility tree** across signup — role picker, country sheets, church-type rows, RAG cards, emergency/collaboration chips, checkboxes, and the UG display-choice radios (the one-shot, immutable safety choice — highest-stakes instance). Runtime finding 1 + static F7 (SC 4.1.2/1.3.1, P1).
2. **Sticky primary CTAs never enter the tree** (Next / Register Church / Enter Replant / Submit Church), and login's submit is removed from the tree while disabled. Runtime finding 2 (SC 4.1.2, P1-class).
3. **57 of 62 TextInputs lack programmatic labels** (placeholder-only); once filled, the field's identity is gone. Static F10 + runtime finding 3 (SC 4.1.2/3.3.2, P1). Login's fields are correctly labeled — the in-repo reference.
4. **Verification gates are traversable by screen reader** — the Connect/Church "NOT dismissible protection layer" overlays lack `accessibilityViewIsModal`, so sequential VoiceOver traversal walks into the gated UI behind the scrim (server-side RLS holds; this is a protection-posture/UX breach, not a data leak). Static F9 + runtime finding 7 (SC 2.4.3, P1). Six custom sheets share the containment gap (F18). Gate *copy* explaining why access is locked is genuinely good and exposed — the epic's requirement is met in substance; containment is the defect.
5. **Token-level contrast debt, three numeric edits:** `textMuted` 0.45 alpha → 3.99–4.04:1 across ~405 usages incl. primary body copy (raise to ≥0.52 → ≥4.68:1); inactive tab labels 2.82:1 at 10pt on every screen; `textSubtle` 1.97–2.11:1 as the placeholder color on 54 inputs. Static F1–F3 (SC 1.4.3, P1/P1/P2).
6. **Underground join-by-code entry is a semantics black hole** — decorative cells over an unlabeled opacity-0 input, on the entry path for exactly the leaders the platform exists for. Static F8 (SC 4.1.2/3.3.2, P1).
7. **Dynamic Type at AX5: the hamburger drawer is unusable** (items overlap, no scroll — Settings/FAQ/Invite unreachable) and prayer filter chips clip in a fixed-height row. Runtime DT 1–2 (SC 1.4.4). Content screens scale beautifully — failures concentrate in fixed-height chrome.
8. **Announcement/state gaps:** signup errors render silently (no live region — LoginScreen's banner is the house pattern); NotificationToast never announces; unread state in Connect is visual-only in a messaging product; expanded/selected states missing on accordions/segments/cards; RAG status is color-only in church list rows with hues mutually indistinguishable (1.24–1.70:1 pairwise); every static text is duplicated in the runtime tree (VO reads everything twice); Home's daily scripture is missing from the tree entirely; KAN-78's `tabBarAccessibilityLabel` residual confirmed absent (the tab bar still announces adequately via React Navigation fallback — and is otherwise exemplary).
9. **Target sizes + misc:** WITHDRAW/REMOVE 9pt links at ~27–29pt effective inside pressable rows (platform bar is 44pt; this user base has trembling hands); close X's ~32pt; portrait-only orientation (SC 1.3.4 — decision needed); autofill purpose props missing outside auth; drag-driven CamlView sheet needs a tap alternative confirmed.

**Native-script render test: PASS** — Amharic, shaped RTL Arabic, and CJK all render cleanly via system fallback in input fields at standard size; the tree carries correct Unicode. Caveat: serif display contexts (profile chip, greetings, church-name headers) untested with a non-Latin account name — one device check recommended (§11.2).

**Genuinely strong (protect it):** tab bar name/role/position on every tab; Prayer Wall's grouped card labels and purpose-labeled filters; Settings' announce discipline and value-bearing accordion rows; reduce-motion correctly gating the epic's named pulsing dots (CamlView/GlobeView — already fixed); zero `allowFontScaling={false}` repo-wide; locked states that explain themselves in pastoral language, exposed to the tree; UG copy that is the most careful in the product.

---

## 5. Worksheet items (built, awaiting decisions/sign-off)

1. **iOS privacy declarations** — `worksheet-ios-privacy.md`: FINAL nutrition-label rows (Sensitive Info declared — religious-belief data is structural to the platform; Health deliberately NOT declared with defense; precise-location/address upgrades), corrected `PrivacyInfo` block, export-compliance answers, merged ASC submission checklist (demo accounts — ask which, never assume Maranatha; review-notes UG-disclosure-depth decision; iPad `supportsTablet` decision; availability-by-country protection decision incl. China ICP/religious-app-removal reality).
2. **Play Data Safety + IARC** — `google-play.md` §3–5: row-by-row draft answers (telemetry-disabled branch primary; "Political or religious beliefs" declared collected/required — a clean No would be misrepresentation; Health row = deliberate Founder/LEGAL call), IARC draft (expected Everyone/PEGI-3–7 with Users-Interact descriptors), listing checklist. **D-U-N-S org verification is the ~30-day long-lead item — start it well before the Play phase opens.**
3. **Founder device scripts** — `founder-device-scripts.md` (VoiceOver walkthroughs with manufactured states; TalkBack deferred until an Android build exists).
4. **Cowork LEGAL briefs** — both paste-ready: ToS (16 sections + recommended §17 for store-required platform terms incl. the US-embargo representation question — uniquely fraught for this audience; 3 deferred decisions carried as decision blocks) and privacy v0.3 (7 KEEP · 9 CORRECT · 6 EXTEND · 9 ADD; retention + processors tables pre-built; 13 policy choices with recommendations).

---

## 6. Decision register (consolidated from all lanes, grouped by owner)

**Founder:**
1. iPad support: `supportsTablet` currently true → obligates 13" screenshots + iPad-quality review. QA it or set false for MVP (sister action: Android tablet posture).
2. Play store category (guidance: Communication) + app-name casing in ASC.
3. Greenlight the proposed ticket set (§10) after reviewing this doc — filing is HELD per your ruling.

**Founder + SEC:**
4. Mapbox telemetry Path 1 (disable at startup; proxy-capture evidence to the panel). Recommended: adopt. **RATIFIED 2026-07-03** (Founder confirmed on the zero-UX-change basis; billing and tile caching verified unaffected — MAU/turnstile is separate from telemetry).
5. Export compliance Path 1 (flip to `true`; preserves ruling 11015's seized-device posture). Recommended: adopt.
6. Block-user design (blocked_users wiring; SEC/DBA panel per suspension-lifecycle precedent).
7. Covenant first-DM acknowledgment: server-side persistence if it will ever be leaned on as consent evidence.

**Founder + LEGAL:**
8. Nutrition-labels sign-off bundle (Sensitive Info declared; no-Health with defense; purpose-string wording "never shared with other members").
9. UG-feature disclosure depth in Apple review notes (2.3.1 tension — under-disclosure risks rejection; full disclosure documents the mechanism with a third party).
10. Availability-by-country, both stores (protection decision, not distribution default; China ICP; France choice triggers the ANSSI leg).
11. Minimum age number (18 is the natural fit; ToS §2 + age ratings hang on it).
12. Content-plane retention wording; ~~audit-log age-out build-or-disclose~~ **audit retention RESOLVED 2026-07-03: indefinite, all classes — disclose**; Play Health-info row.
13. The 3 deferred ToS decisions (naming · acceptance-flow · scripture anchors) + privacy v0.3's 13 policy choices — all carried with recommendations in the two briefs; drafting is unblocked without them, finalization is not.
14. Demo/review accounts for both stores (which accounts — never assumed).

**Founder action (not a ticket):** start Play Console org verification (D-U-N-S, ~30 days) early.

---

## 7. What held up (verified, not vibes)

1. **The client is unusually quiet:** zero analytics/crash/ad/push SDKs, no device IDs, no contacts/photos access — the store privacy forms are about as small as a messaging app's can honestly be, and `NSPrivacyTracking=false` is simply true.
2. **UG invariants held under live fire:** a real UG signup this session produced city/lat/lng NULL (CHECK-enforced), RAG locked red with honest in-UI explanation, name hidden by default, deliberately information-free UG welcome path; the UG 403 in `get-nearby-churches` fires before body parse so UG GPS never enters any pipeline; join codes are bcrypt-10, single-use, one-shot-revealed.
3. **The heartcry envelope matches its data class:** Vault key, pgp_sym at rest, plaintext never in the row, decrypt only through an audited RPC that commits two audit rows before releasing content, 5-min TOTP freshness, zero-PII ops emails.
4. **Deletion machinery is real:** soft-delete → 30-day restore → daily sweeper that tombstones every name field + phone + email and deletes the auth row. The store blockers are entry-point wiring, not engineering.
5. **Play readiness has headroom:** SDK 54 targets API 36 (clears the 2026-08-31 bar); foreground-only location is enforced by an invariant test; FLAG_SECURE hard-blocks join-code screenshots on Android.
6. **A11y culture exists where the recent work happened** — the house patterns (labeled scrims, announce discipline, reduce-motion gating, role+state selection controls) are all in-repo; remediation is application, not invention.
7. **Persecuted readers' fallback editorial is finished, dignified work** — the audit expected placeholders and found production content.

---

## 8. KAN-247 — UG happy-path incidents recorded this session (sim; recorded, not chased)

1. Literal un-interpolated `{region}` template token on the display-choice screen: «Other leaders see "Underground Church · {region}" instead of your name.»
2. CTA/step mismatch: UG page 1 says "REGISTER CHURCH · 1 OF 2" with CTA "Submit Church," but tapping advances to a second screen whose CTA is also "Submit Church" (standard flow's page-1 CTA correctly reads "Next — Confirm Status").
3. The immutable Show-name/Keep-hidden display choice is invisible to the accessibility tree (systemic finding, highest-stakes instance).
No crashes or dead-ends; the UG happy path completed end-to-end and DB state verified correct. Proposed: comment these onto KAN-247 (Backlog) in the filing batch so the Founder's enumeration walk starts from them.

---

## 9. Founder device pass + artifacts kept local

1. **Device scripts:** `founder-device-scripts.md` — per-flow VoiceOver walkthroughs with state manufacturing (incl. the one-shot join-code reveal ceremony, boldly warned), Dynamic Type sweeps, and the verified-surface walks the sim could not reach. TalkBack scripts wait for an Android build.
2. **Sim screenshots (43) are kept LOCAL-ONLY** (`sim-screens/` gitignored): the repo is public, and the captures include disposable-account states and the Founder's tag-space; the a11y-sim verdict cites each by filename for her review on this machine.
3. **Disposable accounts created:** `+t16` (standard, "A11y Audit Test Church T16," pending) and `+ugt1` (underground, "A11y Audit UG Church T1," pending) — both obviously-disposable by name, safe to reject/remove from the admin queue after the device pass; credentials in the session scratchpad only.

---

## 10. Proposed ticket set — HELD for Founder review (nothing filed)

Under **KAN-301** (existing tickets re-scoped where named):
1. KAN-205 re-scope → full in-app account **deletion** (Apple's deactivation-insufficient ruling verbatim) wiring `fn_soft_delete_my_account` + 30-day-restore copy in SEC register.
2. NEW — Web deletion-request page on projectreplant.org + ops runbook (Play leg).
3. NEW — Leader-facing report mechanism on every UGC surface, wired to the moderation queue; fix-or-remove the church-profile toast stub in the same stroke; carries the KAN-261 premise correction.
4. NEW — Block user (1:1 DMs minimum; `blocked_users` wiring; SEC/DBA panel first).
5. NEW — Publication chain: privacy v0.3 + ToS hosted on the website, in-app Settings rows wired (Terms/Privacy/Covenant), store URL fields; includes join-network form privacy notice + website contact/support page.
6. NEW — ToS acceptance event (post-decision-2; server-side record with version snapshot — G-9 pattern).
7. NEW — Mapbox telemetry disable + purpose-string cleanup (drop Always keys + FaceID stray; "never shared with other members" wording) + proxy-capture verification (SEC panel).
8. NEW — Export compliance flip (`ITSAppUsesNonExemptEncryption: true`) + ASC answers + BIS annual line on LEGAL's calendar.
9. NEW — `expo.ios.privacyManifests` correction block + post-prebuild diff (worksheet §2.3).
10. NEW — PII-scrub completion migration (structured names/honorific/suffix/phone; church contact_name/address/coords; self-delete church-scrub reachability) — DBA panel.
11. NEW — Play config batch: `blockedPermissions` strip + `allowBackup:false` + Android runtime location request (gated to the Android sprint).
12. NEW — Data-access/export admin runbook (or explicit don't-promise in v0.3 — LEGAL fork).
13. ~~NEW — Audit-log 30-day age-out cron~~ **RESOLVED 2026-07-03: NO age-out — v0.3 discloses indefinite retention, all classes.** Replacement: NEW — Audit Log admin UX at scale — filter/facet surface (actor · action class · target · date range) + scoped CSV/JSON export for review windows; paging is not a review strategy.
14. NEW — Website lead lifecycle (Netlify Forms + Google Sheet retention/deletion story).
15. KAN-157 — correct the "end-to-end encrypted" description (comment). **Companion (ruled 2026-07-03): NEW — Heartcry E2E v2, CRITICAL #1 post-MVP — SEC design panel (unified with UG-evidence envelope v2; key custody coordinated with the backup-DR escrow ceremony); public docs carry the good-faith E2E forward-commitment line.**
16. KAN-247 — comment the three enumerated sim incidents (§8).
17. KAN-291 — stands as-is (To Do; correct anchor, execution-ready).

Under **KAN-34** (six grouped tickets):
18. Token contrast batch — three numeric theme edits (+ hardcoded strays) clearing F1/F2/F3 at ~460 sites.
19. Onboarding/registration semantics pass — option-control tree exposure, sticky CTAs, TextInput labels, error live regions, JoinByCode widget, CompletionFlowOverlay (static F7/F8/F10/F12/F15 + runtime 1/2/3/6; `NameVisibilityChoiceScreen` + LoginScreen are the in-repo reference implementations).
20. Gate + sheet containment — `accessibilityViewIsModal` + `no-hide-descendants` on both verification gates and six custom sheets, preserving the soft-deleted read-only bypass (F9/F18 + runtime 7).
21. Roles/state/announcement pass — Connect rows + unread state, tab `tabBarAccessibilityLabel` (KAN-78 residual), expanded/selected states, toast + scripture tree exposure, static-text duplication root-cause (F11/F13/F14/F16/F23 + runtime 4/5/8).
22. Dynamic Type fixes — hamburger drawer scroll/overlap, filter-chip row height, detail-header truncation, wordmark wrap (runtime DT 1–4).
23. Target size + misc — 44pt effective floors on WITHDRAW/REMOVE/close-X's, RAG status word in list rows (F5), drag alternatives, autofill props, orientation decision (F17/F5/F25/F22/F20).

---

## 11. International readiness callouts (cross-lane; findings → KAN-156 / KAN-301; nothing here blocks the English-first MVP)

1. **RTL posture.** The app is LTR-only: `I18nManager` untouched, no RTL-aware styles; chevrons, back affordances, and the drawer slide all assume LTR. Arabic/Farsi/Urdu contexts are core to the audience. What RTL support would touch: RN `I18nManager.allowRTL/forceRTL` + a layout pass over directional assumptions (chevron glyphs, absolute-positioned affordances, text alignment), and the sim showed the *system* already flips field-level alignment for Arabic input — the app chrome around it does not follow.
2. **Non-Latin script rendering: input-field fallback PASSES** (Amharic/Arabic-shaped/CJK render clean, correct Unicode in the a11y tree — KAN-156 gap 3 partially de-risked this session). Remaining: serif (CormorantGaramond) display contexts — profile chip, greetings, church-name headers — will fall back to system fonts, visually mismatched with the brand; render one non-Latin *display name* on device as the residual test.
3. **i18n absence.** No framework; ~490 hardcoded English strings (KAN-156/KAN-222). The locked sequencing stands: string freeze (copy sweep) before any `t()` wrapping — approved copy lands once.
4. **Formats.** Phone is free-text (no E.164 normalization); dates render en-US; country is a full-name string against an ~88-entry dropdown (no ISO codes); no locale-aware number/date layer. These become data-quality debt the moment non-English leaders arrive — tracked on KAN-156.
5. **Already-built foundations (credit):** structured names with `last_name_first` + `include_middle_name` (CJK/Hungarian ordering ready), honorific/suffix system, role humanisation table, macro-region maps + `country_continent_map`, and system-fallback rendering that already works for input.
6. **Store-listing locales.** Declare English (U.S.) only at launch — accurate as-built, no action; both stores accept single-locale listings. Localized listings become a Play/ASC worksheet item only when i18n lands. The availability-by-country decision (§6.10) is the internationally-consequential store choice at MVP, not listing locales.

---

*Sources: the eight lane verdict files + worksheet + device scripts in `docs/audits/2026-07-03-compliance-a11y-store-audit/`; two cowork LEGAL briefs in `.claude/plans/`; live-Jira verification of all 21 cited keys on 2026-07-03 (two miscites caught and corrected: KAN-261 report-UI anchor, KAN-254 evolved scope); live Supabase `jiyetphxxvyiicrnwlnx` read-only introspection; fresh sim build @ 360bf9e on iPhone 17 Pro Max, iOS 26.3. Read-only throughout: zero code edits, zero DB writes, zero Jira writes; ticket filing HELD for Founder review per the 2026-07-03 ruling. The gates to the stores are enumerable and the platform's foundations held — to God be the glory. In Jesus' name.*
