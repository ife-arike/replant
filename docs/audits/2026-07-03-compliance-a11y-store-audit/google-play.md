# Replant — Google Play readiness audit (gap-finding)

**Date:** 2026-07-03 · **Lane:** compliance/a11y/store-readiness audit session · **Epic:** KAN-301
**Auditor posture:** Android release engineering review of config + code + policy. **There is no Android build yet** (Founder-ruled: iOS first, Play soon after). Everything below is auditable from the repo, installed library manifests, live policy text, and the master PII inventory (`data-inventory.md`, same directory — code + live-DB verified, not re-derived here). Items that genuinely require a built AAB are listed honestly in §7.
**Scope:** mobile repo `~/replant` (branch `feat/kan-296-mobile-attribution-slot`), Expo SDK 54 managed workflow, package `org.projectreplant.replant`. Admin dashboard and website are separate surfaces; touched only where Play policy reaches them (web deletion path, privacy policy hosting).

**Policy corpus used (fetched live 2026-07-03):**

1. Data Safety form — https://support.google.com/googleplay/android-developer/answer/10787469
2. Account deletion policy — https://support.google.com/googleplay/android-developer/answer/13327111
3. Target API level — https://support.google.com/googleplay/android-developer/answer/11926878 (+ 2026 deadline confirmation via developer.android.com/google/play/requirements/target-sdk)
4. UGC policy — https://support.google.com/googleplay/android-developer/answer/9876937
5. Content rating / IARC — https://support.google.com/googleplay/android-developer/answer/9859655
6. Location permissions — https://support.google.com/googleplay/android-developer/answer/9799150
7. Privacy policy requirement — https://support.google.com/googleplay/android-developer/answer/9859455
8. Photo & Video permissions — https://support.google.com/googleplay/android-developer/answer/14115180
9. 16 KB page size requirement — https://developer.android.com/guide/practices/page-sizes (Play-enforced from 2025-11-01 for API 35+ submissions)
10. Developer account verification — https://support.google.com/googleplay/android-developer/answer/13628312

---

## 1. Findings, ranked

### STORE BLOCKERS (block Play submission when that phase opens)

1. **BLOCKER — No web account-deletion path exists, and Play requires one.** Play's account-deletion policy (corpus #2) requires developers to "provide a web link resource where users can request app account deletion and associated data deletion," declared in the Data Safety form and surfaced on the store listing. The policy bar is *initiation*, not self-serve completion: users must be "able to request deletion of their account through the pathway," and "additional steps" are permissible. Replant has **no web account surface at all** — `website/` is four static pages (`index.html`, `faq.html`, `volunteer.html`, `next-steps.html`; verified by listing). **A web deletion-request page must be BUILT.** Minimum compliant shape: a page on projectreplant.org that (a) names Replant, (b) loads without error, (c) lets a user submit a deletion request (email-verified form or documented mailto flow with stated process), (d) states what is deleted vs retained (de-identified content, life-safety audit rows — retention for "security, fraud prevention or regulatory compliance" is explicitly permitted if disclosed in the privacy policy). The DB machinery to honor requests is already live (`fn_soft_delete_my_account` → 30-day restore → hard-delete sweeper incl. `auth.users`), so this is a thin web page plus an operational runbook, not new deletion engineering. This is a finding, not a footnote: it is the only Play requirement with **zero** existing surface anywhere in the project.
2. **BLOCKER — In-app account deletion is a ComingSoon stub (KAN-205).** Same policy leg: an in-app path that is "prominent... within the account settings or a similar section." `src/screens/main/SettingsScreen.tsx` `handleDeactivateTap` (line ~783) raises the shared `ComingSoonModal` ("Account deactivation is on the way."). The wiring target exists and is verified live (inventory §4 row 4). Twin of the Apple 5.1.1(v) finding — one wiring job satisfies both stores.
3. **BLOCKER — UGC report + block absent (KAN-261).** Play's UGC policy (corpus #4) is explicit per interaction type: apps with UGC scoped to "a specified set of users... must provide in-app functionality to report content and users"; "UGC features that enable 1:1 user interaction... must provide an in-app functionality for blocking users." Replant has both surfaces — in-network prayer wall/testimonies/comments (closed community → report content **and** users required) and Connect DMs (1:1 → block required) — and neither function exists: zero hits for `blockUser`/`reportContent`/`reportUser` across `src/` (verified). The third leg (moderation) is genuinely present but degraded: server-side FLAG_TAXONOMY scan on DMs/branch messages/connection requests with escalation + pastoral routing (24 codes: 21 auto + 3 manual in `supabase/functions/_shared/taxonomy-codes.ts`), but **11 of the 21 auto codes have empty pattern lists (KAN-291)** — "moderation, as is reasonable and consistent with the type of UGC hosted" is arguable for DMs today, not for a filter advertised as 21-code. Terms-acceptance leg: partially satisfied — Declaration of Faith at onboarding (`DeclarationOfFaithScreen.tsx`) + covenant surfaces on the DM thread (`CovenantStrip/Notice/Footer`), but the readable Terms document is itself a ComingSoon stub and the ToS is blocked on 3 Founder decisions (LEGAL lane). Verdict against Play's text: **non-compliant until report + block ship**; the same build (KAN-261 scope) clears Apple 1.2.
4. **BLOCKER — No published privacy policy URL, and the in-app link slot is a stub.** Play requires apps accessing sensitive permissions/data (location qualifies; so does everything in §3 below) to link a privacy policy **both** on the store listing and **within the app**, "available on an active URL" (corpus #7). No policy page exists on projectreplant.org (verified); the in-app Settings row is a ComingSoon stub (`handlePrivacyTap`, SettingsScreen ~line 771). Dependency: LEGAL policy v0.2→v0.3 in flight. The Data Safety form also cannot be submitted without this URL.
5. **BLOCKER (one-line config fix) — Photos/Videos permissions will ride into the merged manifest via expo-screen-capture.** Verified from the installed library manifest (`node_modules/expo-screen-capture/android/src/main/AndroidManifest.xml`): `READ_EXTERNAL_STORAGE (maxSdk 32)`, `READ_MEDIA_IMAGES (minSdk 33, maxSdk 33)`, `DETECT_SCREEN_CAPTURE (minSdk 34)`. Play's Photo & Video policy (corpus #8, enforced since 2025-05-28): API 33+ apps "may only request READ_MEDIA_IMAGES... if system pickers... are not sufficient for core functionality," else a declaration is required and non-compliant apps are "subject to removal" and must "remove the permissions from the manifest." Replant's use (screenshot *detection* on the join-code reveal screen, Android 13 only) will not pass the core-functionality bar — and doesn't need to: the screen already calls `preventScreenCaptureAsync` (`JoinCodeRevealScreen.tsx:119`), which is `FLAG_SECURE` on Android — screenshots are hard-blocked, making the ≤13 detection listener redundant (and it never requests the runtime permission anyway, so it is non-functional dead weight on ≤13 today). **Fix:** `"android": { "blockedPermissions": ["android.permission.READ_MEDIA_IMAGES", "android.permission.READ_EXTERNAL_STORAGE"] }` in app.json. Keep `DETECT_SCREEN_CAPTURE` (normal permission, no declaration, powers detection on 14+).

### Compliance gaps

6. **Mapbox SDK telemetry default-on breaks the Data Safety math (inventory Gap 7).** `@rnmapbox/maps ^10.3.0` with no opt-out anywhere in code or config (verified; plugin entry is a bare string, no props). Play's Data Safety rules make developers answerable for SDK collection ("Developers must disclose data collection and sharing by included libraries and SDKs" — corpus #1), and telemetry to `events.mapbox.com` serves **Mapbox's own purposes**, so the service-provider carve-out ("processes user data on behalf of the developer and based on the developer's instructions") does **not** cover it. Left on, the form must declare device IDs + location as **collected AND shared** for analytics — which also collides with the app's own "Your position is never shared" posture (iOS string today; any equivalent Android store copy must stay true). **Recommendation: disable telemetry (`setTelemetryEnabled(false)` at app init + config-plugin/manifest opt-out), verify by traffic inspection on the first Android build, and keep the §3 worksheet's clean branch.** Decision needed before the form is filled either way.
7. **The Data Safety form's deletion answers are blocked on findings 1–2.** The form asks whether the app provides a way to request data deletion and now carries the account-deletion URLs. Truthful answers require KAN-205 wired + the web page from finding 1. No independent work beyond those two.
8. **Religious-beliefs data type must be declared — decide the health row deliberately.** See §3 rows 8 and 10. Non-negotiable: Play's taxonomy has "Political or religious beliefs" as a named Personal-info type, and every Replant account structurally discloses religious affiliation (declaration of faith, role, church affiliation — inventory framing fact). Declare collected/required. The genuinely open call is **Health info**: heartcry solicits crisis content with severity + request types, and the taxonomy auto-codes include `self_harm_indicator`, `self_harm`, `pastoral_care_signal` with pastoral routing — the platform deliberately processes mental-health-adjacent signals. Recommend declaring Health info = collected/optional (conservative, defensible); NEEDS-CONFIRM with Founder/LEGAL, noting a yes may pull the listing into Play's health-apps declaration flow.
9. **Android runtime location permission is never requested in code.** No `PermissionsAndroid` / `requestAndroidLocationPermissions` / `requestForegroundPermissionsAsync` anywhere in `src/` (verified). iOS gets its prompt via the plist strings + Mapbox LocationManager; Android will silently never grant `ACCESS_FINE_LOCATION`, so CamlView's RE-CENTER ME (GPS) will be dead on Android as written. Functional gap for the Android build sprint, not a policy breach — but it must land with the correct UX (request in-context on pill tap, degrade gracefully on denial) to keep the Data Safety "optional" claim honest.
10. **`android:allowBackup` will default to true in the generated manifest.** Expo's template default. For the UG threat model, device/cloud backups of app data are gratuitous surface (the AsyncStorage session blob is AES-GCM encrypted and its SecureStore keys are Keystore-bound and non-restorable — so backups leak little, but inviting them serves nothing). Recommend `expo-build-properties` → `android.allowBackup: false`. Security posture, not Play policy.

### Worksheet items (no artifact falsified; do before/at first Android build)

11. **Play Console org account + verification — start early, this is the long-lead item.** Org accounts require a D-U-N-S number ("This process can take up to 30 days so you should plan ahead" — corpus #10), org website, and a public developer email + phone shown on the profile. Personal accounts additionally carry a 20-tester/14-day closed-testing gate before production access (NEEDS-CONFIRM current terms at signup) — the org route avoids it. Founder decision: which legal entity + which public contact email (ties to the accounts@ vs team@ ruling).
12. **Signing/build path:** managed Expo → `eas build -p android --profile production` emits an AAB by default (production profile already has `autoIncrement`); new apps are mandatorily enrolled in **Play App Signing** (Google holds the app signing key; EAS manages the upload key). Nothing blocking. Confirm the Mapbox **download token** (`RNMapboxMapsDownloadToken` / `MAPBOX_DOWNLOADS_TOKEN`) is provisioned in EAS env for Android Gradle maven auth — working iOS builds do not prove the Android credential.
13. **16 KB page size:** required for all new apps/updates targeting API 35+ since 2025-11-01 (corpus #9; Play Console blocks non-compliant releases). Expo SDK 54 / RN 0.81 toolchain (AGP/NDK) is 16 KB-ready; the native `.so` risk is Mapbox — verify the Mapbox Android SDK version `@rnmapbox/maps 10.3` pins is 16 KB-aligned at first build. Self-catching in Console, but check before the phase opens.
14. **App access declaration:** Play review needs working credentials for a login-gated app (sister of Apple's demo account). Provide a non-UG test leader account + written reviewer notes for gated flows; never a real UG account. Which account: ask Founder (never assume Maranatha).
15. **Ads/content declarations:** contains-no-ads; target audience 18+ (leaders) — keeps the app fully out of Families policy; News = no; Financial features = none; Government = no.
16. **Deep links:** `"scheme": "replant"` covers `replant://reset-password` (password-reset email) via the generated intent filter — verify end-to-end on an Android build. If a web deletion/policy page ever links into the app, consider App Links (`assetlinks.json`) then, not now.
17. **expo-location is used for exactly one call** — `Location.geocodeAsync` (forward-geocode of a typed church address, `CompletionFlowOverlay.tsx:882`) — yet its library manifest injects `ACCESS_COARSE_LOCATION` + `ACCESS_FINE_LOCATION` (redundant with @rnmapbox/maps' identical entries). Optional tidy: replace with the Mapbox geocoder already in use and drop the dependency; note `geocodeAsync` on Android routes the typed address through Google Play services' platform geocoder (OS API — not a Data Safety "share," but a fact for the policy's processor narrative).
18. **Website forms are out of the app's Data Safety scope but inside the privacy policy's scope** (Netlify Forms + Google Sheet, inventory Gap 9) — do not let the form-filler conflate the two surfaces.

---

## 2. Account deletion — precise requirement vs precise state

1. **Policy (corpus #2), applies because Replant "allows users to create an account from within the app":**
   1. In-app: "provide users with an in-app path to delete their app accounts and associated data," prominent within account settings.
   2. Web: "provide a web link resource where users can request app account deletion and associated data deletion" — functional URL, references app/developer name, deletion **request** is sufficient; declared in the Data Safety form; surfaced on the listing.
   3. Data: deleting the account "must also delete the user data associated with that app account"; retention "for legitimate reasons such as security, fraud prevention or regulatory compliance" is allowed if disclosed ("for example, within your privacy policy").
2. **State:** in-app = ComingSoon stub (KAN-205; SettingsScreen `handleDeactivateTap`); web = **nothing** (four static pages, no account surface). DB machinery live and verified (inventory §4): soft-delete RPC, 30-day restore, daily hard-delete sweeper that tombstones names/phone/email and deletes the `auth.users` row.
3. **Retention disclosures the deletion surfaces must carry** (all inventory-verified): content survives de-attributed (messages/testimonies/comments — Play's "fully anonymized" and legitimate-retention carve-outs cover this IF the privacy policy says so); life-safety audit rows retained forever (locked ruling); church contact PII currently survives the lifecycle (inventory Gap 2 — fix or disclose); `attribution_display_name` snapshot survives anonymity flips (inventory row 24).
4. **Work list:** (1) build the web deletion-request page on projectreplant.org + operational runbook honoring requests through the live RPC path; (2) wire KAN-205 to `fn_soft_delete_my_account` with the 30-day-restore explanation in SEC-register copy; (3) paste both URLs into the Data Safety form.

---

## 3. Data Safety form — row-by-row draft answers

Definitions applied (corpus #1): **Collected** = "transmitting data from your app off a user's device" (includes SDKs). **Shared** = transfer to a third party, EXCEPT "service providers: an entity that processes user data on behalf of the developer and based on the developer's instructions," legal transfers, user-initiated transfers, fully anonymized data. **Ephemeral** = "stored in memory and retained for no longer than necessary to service the specific request in real-time."

**Processor reasoning (the "shared" column):** Supabase (system of record), Resend (transactional mail carrying recipient email + `firstName`), Upstash (rate-limit keys carrying raw IP + signup email, ≤1h TTL) all process on Replant's documented instructions → service-provider carve-out → **Shared = No** across the form. Netlify/Google Sheets/Google Fonts touch only website data — outside the app form entirely. **Mapbox is split:** geocoding + tiles on Replant's instructions = service provider (not shared); **SDK telemetry is for Mapbox's own purposes = outside the carve-out = would be Collected + Shared** — which is why finding 6 says disable it. The table below is the **telemetry-disabled branch**; the telemetry-on branch adds Device IDs + Location + Diagnostics as collected/shared for Analytics.

| # | Play data type | Collected | Shared | Ephemeral | Opt/Req | Purposes | Basis / notes | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | Location → Approximate | **Yes** | No | No | Optional | App functionality | Church city/country stored (`churches`); UG accounts have neither (CHECK-enforced) → optional. IP is never used to derive location | VERIFIED |
| 2 | Location → Precise | **Yes** | No | No | Optional | App functionality | Church lat/lng map pin stored (optional; never UG). Device GPS transits `get-nearby-churches` + one Mapbox reverse-geocode per CamlView mount — not persisted (genuinely ephemeral flows; Mapbox = service provider) — the stored church pin makes the row Yes regardless | VERIFIED |
| 3 | Personal info → Name | **Yes** | No | No | Required | App functionality, Account management | first/middle/last at signup; honorific/suffix in Settings; `firstName` to Resend = processor | VERIFIED |
| 4 | Personal info → Email | **Yes** | No | No | Required | App functionality, Account management, Developer communications | Signup; welcome/transactional mail via Resend (processor); raw in Upstash key ≤1h (processor) | VERIFIED |
| 5 | Personal info → User IDs | **Yes** | No | No | Required | App functionality, Account management | auth/public UUIDs | VERIFIED |
| 6 | Personal info → Address | **Yes** | No | No | Optional | App functionality | Church street address + contact-person details; frequently the leader's own (church plants); UG never provides → optional framing | NEEDS-CONFIRM (optionality framing with LEGAL) |
| 7 | Personal info → Phone | **Yes** | No | No | Optional | App functionality, Account management | Personal phone optional (KAN-231); church `contact_phone` | VERIFIED |
| 8 | Personal info → **Political or religious beliefs** | **Yes** | No | No | Required | App functionality, Account management | Structural: declaration of faith (`declaration_affirmed`), religious role enum, church affiliation. Every account discloses religious affiliation — declare it; a clean "No" here would be misrepresentation | VERIFIED |
| 9 | Personal info → Race/ethnicity, Sexual orientation, Other | No | — | — | — | — | Not collected | VERIFIED |
| 10 | Health & fitness → Health info | **Recommend Yes** | No | No | Optional | App functionality | Heartcry solicits crisis content (severity, request types); prayer categories; taxonomy auto-codes `self_harm_indicator`/`self_harm`/`pastoral_care_signal` route pastorally — deliberate processing of mental-health-adjacent signals. Overlap rule: "if collecting one data type reveals another, declare both." May trigger health-apps declaration flow | NEEDS-CONFIRM (Founder/LEGAL) |
| 11 | Financial info (all 4) | No | — | — | — | — | No payments/IAP | VERIFIED |
| 12 | Messages → Other in-app messages | **Yes** | No | No | Optional | App functionality; Fraud prevention, security & compliance | DMs, branch messages, connection-request messages; plaintext at rest server-side (TLS in transit; **no E2EE carve-out**); server-side safety scan writes flag metadata (DELIVER-ALWAYS) | VERIFIED |
| 13 | Messages → Emails, SMS/MMS | No | — | — | — | — | Not collected | VERIFIED |
| 14 | Photos & videos | No | — | — | — | — | Nothing collected/transmitted. Manifest permissions from expo-screen-capture do NOT create a disclosure duty ("permissions without collection" rule) but must be stripped per finding 5 | VERIFIED |
| 15 | Audio, Files/docs, Calendar, Contacts | No | — | — | — | — | UG evidence upload is admin-dashboard-side, not this app (inventory row 31) | VERIFIED |
| 16 | App activity → Other user-generated content | **Yes** | No | No | Optional | App functionality | Prayer requests, testimonies, comments, heartcries (pgp_sym-encrypted at rest), church profile text | VERIFIED |
| 17 | App activity → App interactions | **Lean Yes** | No | No | Required | App functionality | Server-stored onboarding/behavior flags (`church_card_flow_seen`, `outcome_modal_acknowledged_at`); `last_seen_at` column exists with **no writer in this repo** — confirm admin-side writer before final answer | NEEDS-CONFIRM |
| 18 | App activity → In-app search history | No (ephemeral) | — | Yes if declared | — | — | Church-search queries transit edge fns, not stored → ephemeral carve-out | NEEDS-CONFIRM (comfort check) |
| 19 | App activity → Installed apps, Other actions | No | — | — | — | — | — | VERIFIED |
| 20 | Web browsing | No | — | — | — | — | No browser/webview surface | VERIFIED |
| 21 | App info & performance (crash, diagnostics) | No | — | — | — | — | No crash/analytics SDK (inventory row 41). Only true if Mapbox telemetry is disabled (finding 6) | VERIFIED (conditional) |
| 22 | Device or other IDs | **Recommend Yes** | No | No | Required | Fraud prevention, security & compliance | Raw IP in Upstash rate-limit keys ≤1h TTL — off-device + retained beyond the single request, so the ephemeral carve-out is shaky; IP maps most honestly here (never used for location). Alternative defensible reading: transient security processing, not declared — pick one with LEGAL and match the privacy policy | NEEDS-CONFIRM (taxonomy mapping) |

**Form-level answers:**

1. **Encrypted in transit:** Yes — all flows TLS (Supabase, edge functions, Mapbox, Resend server-side). VERIFIED.
2. **Deletion mechanism ("provides a way for users to request that their data is deleted"):** cannot truthfully be Yes today — blocked on findings 1–2. After wiring: Yes.
3. **Account-deletion URLs:** the page from finding 1.
4. **Independent security review (MASA):** optional; skip at MVP.

---

## 4. Content rating — IARC questionnaire draft answers

1. Violence (realistic, graphic, fantasy): **No** for app-provided content — with one honest caveat: the Persecuted Church surfaces (`src/screens/main/persecuted/`, plus the post-MVP 365 Witnesses plan) carry textual, non-graphic accounts of real-world persecution. Answer the depiction questions No, but read the "references to violence" sub-questions honestly at submission; a mild-descriptor outcome (e.g., PEGI 7-style "implied/reference" tier) is possible and acceptable. NEEDS-CONFIRM against live questionnaire wording.
2. Sexual content/nudity: **No.**
3. Language/profanity: **No** (editorial content is scripture/prayer register; UGC is covered by Q7, not this).
4. Controlled substances (drugs/alcohol/tobacco): **No.**
5. Gambling (real or simulated): **No.**
6. Fear/horror: **No.**
7. User interaction — "users interact or exchange content": **Yes** (DMs, branch threads, prayer wall, comments, connection requests). Yields the "Users Interact" / "Shares Info" interactive-elements descriptors — these label the listing, they do not by themselves raise the age category for most authorities (USK/social nuance exists; corpus #5 + globalratings.com).
8. Shares the user's **current physical** location with other users: **No** — other leaders see registered church coordinates/city, never live GPS (device GPS is transient, UG users have neither). Document this reasoning with the submission; it is the question most likely to be second-guessed in review.
9. Digital purchases: **No** (no IAP).
10. Unrestricted internet access (in-app browser/open web): **No** (external links open the system browser).
11. Religious references: IARC has no religion question and religious content alone does not affect ratings (hate/discrimination targeting religion would — not applicable). No action.
12. **Expected outcome:** Everyone / PEGI 3–7 / USK 0–6 with "Users Interact" + "Shares Info" descriptors. Re-answer on any content-affecting update (corpus #5).

---

## 5. Store listing checklist

1. **Privacy policy URL** — finding 4. Must also be linked in-app (the Settings stub is the slot).
2. **Account-deletion URL** — finding 1.
3. **Category:** Communication or Social fit the function; Lifestyle is where many faith apps sit. Founder call — one line of guidance: Communication matches "secure communication platform" positioning best.
4. **Developer contact:** public email + phone on the Play profile (org verification, corpus #10) + support email on the listing. Founder decision aligned with the accounts@ ruling.
5. **Graphic assets:** app icon 512×512 32-bit PNG; feature graphic 1024×500; phone screenshots 2–8 (16:9 or 9:16, each side 320–3840 px); 7" and 10" tablet sets recommended; short description ≤80 chars; full description ≤4000 chars. Screenshots must not show UG surfaces — reuse the iOS screenshot discipline.
6. **Declarations:** Data Safety (§3), content rating (§4), ads = none, target audience 18+, App access credentials (worksheet 14), government/news/financial = no.
7. **Countries/availability — Founder/LEGAL decision, callout only:** distributing in hostile jurisdictions makes the app's existence and its install base visible to those states' app-store surveillance, and Play in some of those markets is itself restricted; excluding them cuts verified-leader access to exactly the leaders the platform exists for, pushing them to sideloaded APKs outside Play's update/integrity chain (which may itself be the deliberate channel for UG contexts). Google additionally restricts sanctioned regions regardless of developer choice. This is a distribution-strategy ruling with life-safety texture — it belongs to the Founder and LEGAL, made once, before the phase opens; nothing in the codebase constrains it.

---

## 6. Build/config verdict

1. **Target API — SATISFIED, with headroom (genuine credit).** Expo SDK 54 → RN 0.81 → **targetSdkVersion 36 / Android 16** by default (no `expo-build-properties` override present, verified). Current Play requirement: new apps + updates target **35+** (since 2025-08-31); the **2026-08-31 requirement raises this to 36+** — SDK 54 already clears both. No action; confirm the value in the first built AAB.
2. **Package:** `org.projectreplant.replant` — valid, matches the iOS bundle id. ✓
3. **Edge-to-edge:** `edgeToEdgeEnabled: true` ✓ (mandatory under Android 16 anyway). **Predictive back:** `predictiveBackGestureEnabled: false` — allowed; SDK 55/56 will flip the default (note only).
4. **Predicted merged-manifest permissions** (from installed library manifests in `node_modules/` — the honest pre-build method; final list is §7 item 1):
   1. `INTERNET` — template + @rnmapbox/maps.
   2. `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` — from BOTH expo-location and @rnmapbox/maps (redundant sources; worksheet 17).
   3. `VIBRATE` — expo-haptics.
   4. `READ_EXTERNAL_STORAGE (≤32)`, `READ_MEDIA_IMAGES (=33)` — expo-screen-capture → **strip per finding 5**.
   5. `DETECT_SCREEN_CAPTURE (34+)` — normal permission, keep.
   6. Zero permissions from expo-secure-store/clipboard/crypto/font/splash-screen/dev-client/async-storage (all verified empty).
5. **Background location: NONE — verified three ways.** No `ACCESS_BACKGROUND_LOCATION` anywhere; no `watchPosition`/`getCurrentPositionAsync` usage; GlobeView carries an **invariant test** (`GlobeView.invariants.test.ts`) asserting no live-GPS import. Consequence: **no location Permissions Declaration Form needed** (corpus #6 — only background triggers it at target 29+). Foreground-only is the right minimum-scope posture.
6. **Location UX gap on Android:** finding 9 (no runtime request in code).
7. **`allowBackup`:** finding 10 (set false via expo-build-properties).
8. **Signing/AAB/EAS:** worksheet 12. **16 KB:** worksheet 13. **Mapbox download token:** worksheet 12.
9. **New architecture enabled, RN 0.81:** current and fine.

---

## 7. Cannot be verified without an Android build — honest list

1. The **final merged AndroidManifest** (§6.4 is a prediction from library manifests; `expo prebuild`/EAS may add template entries). Verify with `aapt dump permissions` on the first AAB.
2. Actual `targetSdkVersion`/`compileSdkVersion` baked into the AAB.
3. **Mapbox telemetry runtime behavior** — whether events actually flow to `events.mapbox.com` and whether the chosen opt-out silences them (traffic-inspect on device).
4. Android runtime **permission prompt flow** and RE-CENTER ME functionality (finding 9's fix).
5. `FLAG_SECURE` efficacy on the join-code reveal screen on real devices.
6. `replant://` deep links (reset-password) via the generated intent filter.
7. Edge-to-edge/keyboard/inset rendering on Android 16 hardware, and dark-theme rendering (`userInterfaceStyle: "dark"`).
8. **16 KB page-size compliance** of Mapbox's native libraries (worksheet 13; Play Console will hard-block if wrong).
9. **Play pre-launch report** results (crawler crashes, a11y flags, security warnings) — first submission will generate these.
10. Play Integrity / device-attestation behavior — not configured, not required at MVP; listed for completeness.

---

## 8. What held up (genuine credit)

1. **Target API is already beyond the 2026 requirement** — SDK 54's API 36 clears the 2026-08-31 bar a year of policy ahead; most projects arrive at Play scrambling on exactly this.
2. **Foreground-only location, enforced by a test** — the GlobeView invariant test making live-GPS an automated failure is stronger discipline than most shipped Android apps have; it keeps Replant permanently out of Play's hardest location-review lane.
3. **The client is unusually quiet** — no analytics, crash, push, ad, or device-ID SDKs (inventory row 41): the Data Safety form above is about as small as a messaging app's can honestly be, and there is no third-party-SDK disclosure sprawl to police.
4. **Deletion machinery is real** — both store-blocking deletion findings are wiring/one-web-page jobs on top of a live, verified soft-delete → restore → sweeper pipeline, not new engineering.
5. **Moderation backbone exists** — server-side scanning with tiered routing, escalation, pastoral lanes, covenant acceptance at signup and on the DM surface; the UGC blocker is the two user-facing legs, not the whole policy.
6. **`FLAG_SECURE` on the join-code reveal** — on Android this is a hard screenshot block, materially stronger than the iOS equivalent; the UG crown jewel is better protected on the platform being audited.
7. **Encrypted-in-transit is a clean, unqualified Yes**, and heartcry content is additionally encrypted at rest with audited decrypt-at-read (inventory §7.1).
8. **Android config hygiene already done in passing:** edge-to-edge enabled, predictive-back explicitly set, adaptive icon present, package name correct — the app.json android block is not an afterthought.

---

## 9. Adjacent notes (one line each)

1. expo-location can likely be dropped entirely (single `geocodeAsync` call → Mapbox geocoder), removing two redundant manifest permissions — sister action to finding 5's strip.
2. SettingsScreen's ComingSoon set also stubs Terms, Privacy, and password change — findings 3/4 land in slots that already exist.
3. The volunteer page carries an inline privacy sentence but the join-network form does not (inventory Gap 9) — fix when the policy page ships, same web deploy as finding 1's page.
4. A Yes on the Health-info row may pull the listing into Play's health-apps declaration flow — decide the row and that consequence together with LEGAL.
5. The iOS permission string "Your position is never shared" sets a promise the Android listing must also keep — finding 6's telemetry decision controls whether it stays true verbatim.
6. `messages.attribution_display_name` surviving anonymity flips (inventory row 24) is a privacy-policy disclosure item, not a Play blocker.
7. The mobile repo is public — Android store copy and reviewer notes should assume the client source (including flag-code names) is world-readable (inventory §8.2).
