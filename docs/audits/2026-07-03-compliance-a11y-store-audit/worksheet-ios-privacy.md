# Replant — iOS privacy-declaration worksheet (FINAL submission answers)

- **Date:** 2026-07-03 · **Lane:** compliance/a11y/store-readiness (epic KAN-301) — reconciliation deliverable
- **Inputs reconciled:** `data-inventory.md` (master PII inventory, code + live-DB verified — GROUND TRUTH for collection) and `ios-app-review.md` (App Review lane, preliminary labels + manifest analysis). Repo spot-checks read-only where the lanes conflicted; no source edits made.
- **Bar:** exactly-true. Over-declaring erodes the trust story for persecuted-context leaders; under-declaring is dishonest and a rejection/removal vector. Every row below traces to an inventory row or a quoted manifest.
- **Terminology:** the brief's paths "(a)/(b)" are numbered here as Path 1/Path 2 per the enumeration ruling. Path 1 = the brief's (a) in both sections.

---

## 0. Reconciliation verdicts (the four briefed points)

1. **App's own `PrivacyInfo.xcprivacy` — the two lanes agree on the facts and the inventory's framing wins.** The file (local prebuild output at `ios/replant/PrivacyInfo.xcprivacy`; `/ios` is gitignored — `.gitignore:40`) declares `NSPrivacyCollectedDataTypes` as an **empty array** with `NSPrivacyTracking=false` and four correct accessed-API entries. The App Review lane's "PASS/clean" was scoped to required-reason API coverage, the tracking flag, and SDK-manifest presence — all correct. The inventory's Gap 6 ("declares zero collected data types — contradicts reality") is correct about the collected-types array: the app collects name, email, phone, addresses, church coordinates, messages, and religious-belief data, and the manifest says it collects nothing. Apple's binding declaration is the ASC nutrition label, and reviewer tooling does not today reject an empty app-level collected-types array — but the manifest is a signed statement shipped in the bundle, and the exactly-true bar plus a one-block Expo fix says rebuild it. Corrected content and its durable home: section 2.
2. **Mapbox:** its bundled manifests declare seven collected data types with an Analytics purpose, telemetry defaults ON at the code level (verified in the pinned pod source), and no opt-out exists anywhere in app code (verified: zero hits for `setTelemetryEnabled`/`MGLMapboxMetricsEnabled` in `src/`, `App.tsx`, `app.json`). **Recommendation: Path 1 — disable telemetry via `Mapbox.setTelemetryEnabled(false)`** (exact mechanism verified end-to-end, section 3). Needs a build-change ticket + SEC eyes per the App Review lane.
3. **Heartcry/pastoral content:** declare as **User Content → Other User Content**, with the religious dimension carried by a separately declared **Sensitive Info** category (which this app must declare regardless). **Health is not declared** — defense in section 1.4.
4. **Export compliance:** `ITSAppUsesNonExemptEncryption=false` (currently set in `app.json` → `ios.infoPlist`) is not honest as-is. **Recommendation: Path 1 — flip to `true`** and answer the ASC questionnaire as standard-algorithms mass-market. Full worksheet in section 4.

---

## 1. Nutrition labels — FINAL row-by-row App Store Connect answers

Apple's definition of "collect" (fetched live by the App Review lane): data transmitted off-device and stored longer than needed to service the request in real time. All first-party purposes are **App Functionality**; there is no advertising, no tracking, no analytics SDK (inventory row 41).

### 1.1 Data Used to Track You

1. **None.** No ATT prompt required. No ads, no data brokers, no cross-app identifiers; `NSPrivacyTracking=false` is true in the app manifest and in all three Mapbox manifests (every Mapbox type carries `NSPrivacyCollectedDataTypeTracking=false`). Identical in both variants.

### 1.2 Data Linked to You — identical in BOTH Mapbox variants except where marked

| # | ASC data type | Collected | Linked | Tracking | Purposes | Derives from (inventory row) |
|---|---|---|---|---|---|---|
| 1 | Contact Info → Name | Yes | Yes | No | App Functionality | Rows 1–2 (first/middle/last/full + honorific/suffix at signup/Settings; row 24 attribution snapshot) |
| 2 | Contact Info → Email Address | Yes | Yes | No | App Functionality | Row 3 (signup, auth identity); row 16 (church contact_email, often the leader's own) |
| 3 | Contact Info → Phone Number | Yes (optional) | Yes | No | App Functionality | Row 4 (optional personal phone, KAN-231); row 16 (church contact_phone) |
| 4 | Contact Info → Physical Address | Yes | Yes | No | App Functionality | Rows 14, 16 (church street address + contact person; entered by the leader, linked to the account; UG accounts: forced NULL by validator + edge-fn strip + DB CHECK) |
| 5 | Location → Precise Location | Yes | Yes | No | App Functionality *(Variant 2 adds: Analytics)* | Row 15 (church lat/lng map pin — full-resolution coordinates, stored for the life of the church, linked via leadership; optional, never for UG). Device GPS itself is NOT collected — row 38: serviced real-time, never stored server-side |
| 6 | Location → Coarse Location | Yes | Yes | No | App Functionality *(Variant 2 adds: Analytics)* | Row 14 (church city/country on the profile; UG excluded) |
| 7 | Identifiers → User ID | Yes | Yes | No | App Functionality *(Variant 2 adds: Analytics)* | Rows 13, 42 (auth.users.id / public.users.id, JWT claims). Variant 1 note: the Mapbox billing turnstile ping carries a not-linked pseudonymous SDK-instance ID (`TelemetryUtils.getUserID`, quoted section 3.4) that rides under this same ASC type; the type-level "linked" answer stays Yes because the first-party ID is linked |
| 8 | User Content → Emails or Text Messages | Yes | Yes | No | App Functionality | Rows 22–25 (Connect DMs, branch messages, connection-request messages — content + sender/recipients; server-side flag-scan processes content; plaintext at rest, retained indefinitely per Gap 8) |
| 9 | User Content → Other User Content | Yes | Yes | No | App Functionality | Rows 26–29 (prayer requests, testimonies, comments, heartcry submissions — heartcries encrypted at rest, row 29); rows 14, 17–18, 20–21 (church profile content: needs, resources, RAG status, denomination, website); row 33 (UG vouch text) |
| 10 | Sensitive Info | Yes | Yes | No | App Functionality | Rows 6, 8 + the inventory's framing fact: role (religious office), church affiliation, and the Declaration of Faith affirmation are structured religious-belief data linked to identity; every Replant account inherently discloses religious affiliation |

### 1.3 Data Not Linked to You — where the variants diverge

**Variant 1 — Mapbox telemetry DISABLED (Path 1, recommended):**

1. **None declared.** No first-party analytics/crash/usage collection exists (row 41). Residual Mapbox traffic after opt-out is real-time servicing (tiles, one-shot reverse geocode) and the pseudonymous turnstile billing ID already covered under row 7 above — see section 3.5.

**Variant 2 — Mapbox telemetry LEFT ON (Path 2):**

1. **Location → Precise Location + Coarse Location** — also collected not-linked by Mapbox (device GPS + viewport), purposes App Functionality + Analytics. At the ASC type level these merge with rows 5–6 above: the answer remains "linked" (first-party church coordinates are linked) and the purpose set becomes App Functionality + Analytics.
2. **Usage Data → Product Interaction** — not linked, App Functionality + Analytics (Mapbox manifest, quoted section 3.2).
3. **Usage Data → Other Usage Data** — not linked, App Functionality + Analytics (same source).
4. **Diagnostics → Performance Data** — not linked, App Functionality + Analytics (same source).
5. **Diagnostics → Other Diagnostic Data** — not linked, App Functionality + Analytics (same source).
6. **Identifiers → User ID** — Mapbox device-scoped ID (its map.load event sends `identifierForVendor` — `EventsManager.swift:111`), not linked, App Functionality + Analytics; merges into row 7.
7. **Consequence:** the store page would show Location + Usage Data + Diagnostics with an Analytics purpose on an app whose permission copy says "Your position is never shared." This is why Variant 2 is not recommended (section 3.6).

### 1.4 Deliberately NOT declared — reasoned zero-rows (traceable, not silent)

1. **Health & Fitness — not declared.** Defense: Apple's Sensitive Info definition verbatim includes "religious or philosophical beliefs"; its Health definition covers health and medical data (clinical records, HealthKit, health research, user-provided medical data). Heartcry submissions (row 29) are free-text pastoral distress messages collected as encrypted user content — there are no diagnosis fields, no health-record ingestion, and `severity`/`request_type[]` are triage-routing metadata about a message, not medical attributes of a person. A DM that mentions a medication does not convert Messages into Health data; a heartcry that voices despair does not convert pastoral correspondence into medical records. Declaring Health would over-claim (implying medical-data handling that does not exist) and mislead the store reader. The honest mapping is: message body = Other User Content; the religious dimension = the declared Sensitive Info category; and on the "is account data itself Sensitive Info" question — yes, ruled and declared: because membership itself asserts religious belief (signup requires a declaration of faith), the account's role/church/declaration fields are religious-belief data and Sensitive Info is declared as collected-and-linked. That single category, declared once, is the exactly-true posture: honest about what the whole platform reveals, without inflating into categories (Health) whose Apple definitions it does not meet.
2. **Usage Data (first-party) — not declared.** Row 9 flags (`display_name_preference`, `preferred_radius`, `church_card_flow_seen`, `outcome_modal_acknowledged_at`) are server-stored UX state, not interaction telemetry: no event streams, no timelines, no behavioral analytics (row 41: no analytics SDK exists). Declaring "Usage Data — linked" would tell store readers we run behavioral analytics, which is false. Documented here for Founder/LEGAL sign-off (Open decision 3).
3. **Diagnostics — not declared (Variant 1).** No crash reporter, no performance SDK (row 41). If one is ever added, labels must be revised first (carried from App Review lane).
4. **Search History — not declared.** Church search queries hit `search-churches` in real time and are not retained (no query log in the inventory) — under Apple's definition, not collected.
5. **IP address — not a label row, but a policy row.** iOS-app-originated IPs live only in Upstash rate-limit key names with TTL ≤1h and hashed log lines (row 34); admin IP/user-agent captured forever in `audit_log` (row 35) originates from the admin dashboard, not this app. Disclose IP processing for security/rate-limiting in the privacy policy (inventory worksheet item 10); it does not map to an ASC collected-data type for this app.
6. **Contacts, Photos/Videos, Financial Info, Purchases, Browsing History, Surroundings, Body — none** (row 41: no contacts access, no image picker, no uploads, no payments).
7. **Passwords and UG join codes — no ASC category exists for authentication credentials** (rows 5, 19); they are handled by GoTrue/bcrypt and belong to the policy, not the labels.
8. **Website forms (rows 44–46) — out of scope for iOS labels** (not collected via the app); they belong to the privacy policy and Netlify/Google processor disclosures.

---

## 2. PrivacyInfo.xcprivacy — current state + corrected content

### 2.1 Current state (quoted; both lanes agree on these facts)

File: `ios/replant/PrivacyInfo.xcprivacy` (Expo-prebuild-generated; **`/ios` is gitignored — `.gitignore:40` — so this file is a local build artifact, not checked-in source**). Load-bearing lines, verbatim:

```xml
<key>NSPrivacyCollectedDataTypes</key>
<array/>
<key>NSPrivacyTracking</key>
<false/>
```

Accessed-API declarations (lines 5–42) are correct and should not change: UserDefaults `CA92.1`; FileTimestamp `0A2A.1`, `3B52.1`, `C617.1`; DiskSpace `E174.1`, `85F4.1`; SystemBootTime `35F9.1` — matching the AsyncStorage/SecureStore/Expo API surface actually in use (App Review lane row 8).

### 2.2 Where the correction goes — Expo mechanics (verified in the installed SDK)

1. Because `/ios` is untracked and regenerated by prebuild, hand-editing the file is futile. The durable home is **`app.json` → `expo.ios.privacyManifests`**, supported by the installed `@expo/config-plugins` (Expo SDK ~54.0.33): `withPrivacyInfo` reads `config.ios?.privacyManifests` and merges it into `ios/replant/PrivacyInfo.xcprivacy` at prebuild (`node_modules/@expo/config-plugins/build/ios/PrivacyInfo.js:46-65`). EAS production builds run prebuild, so this block is what ships.
2. The merge is additive (`mergePrivacyInfo`, lines 93–110): existing accessed-API defaults are preserved, so the block below declares only the collected-data types.
3. The manifest must mirror the ASC nutrition labels (section 1.2). The block below is the Variant 1 (recommended) mirror — first-party collection only; Mapbox's own bundled manifests self-declare its SDK collection and Xcode aggregates them.

### 2.3 Corrected content — ready-to-apply block for `app.json` (inside `"expo": { "ios": { … } }`)

```json
"privacyManifests": {
  "NSPrivacyTracking": false,
  "NSPrivacyCollectedDataTypes": [
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeName",
      "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress",
      "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhoneNumber",
      "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhysicalAddress",
      "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePreciseLocation",
      "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeCoarseLocation",
      "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeUserID",
      "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailsOrTextMessages",
      "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherUserContent",
      "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeSensitiveInfo",
      "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] }
  ]
}
```

Apply-time verifications for the build-change ticket: (1) constant strings for the seven types not present in the Mapbox manifests (Name, EmailAddress, PhoneNumber, PhysicalAddress, EmailsOrTextMessages, OtherUserContent, SensitiveInfo) follow Apple's documented naming pattern — confirm each against Xcode's PrivacyInfo plist-editor picker or Apple's data-use table when applying (Apple's docs page did not render to fetch this session; the other six constants are verbatim-confirmed from the Mapbox manifests in this repo). (2) After `npx expo prebuild`, diff the generated `ios/replant/PrivacyInfo.xcprivacy` against this block. (3) If the labels sign-off (Open decision 3) changes any row in section 1.2, change it here in the same stroke — the two must never diverge.

### 2.4 Third-party SDK manifests (for completeness; no action)

All present and none on Apple's mandatory-SDK list (App Review lane row 9, verified against the live list): Mapbox (three manifests, quoted section 3.2), RN core bundles, AsyncStorage, expo-file-system, expo-constants.

---

## 3. Mapbox — both paths with exact label consequences

### 3.1 The contradiction (both lanes agree)

The app's location purpose string (`app.json` `ios.infoPlist`, mirrored at `ios/replant/Info.plist:58-63`): "Replant uses your location to show verified churches nearby. **Your position is never shared.**" Meanwhile the bundled Mapbox SDK declares location + identifier + usage + diagnostics collection with an Analytics purpose, and its telemetry is default-ON with no opt-out anywhere in the app (verified: zero hits in `src/`, `App.tsx`, `app.json`; inventory row 39 / Gap 7; App Review lane row 10).

### 3.2 What the Mapbox manifests actually declare (quoted; pinned pods)

1. **MapboxCommon 24.18.3** (`ios/Pods/MapboxCommon/MapboxCommon.xcframework/ios-arm64/MapboxCommon.framework/PrivacyInfo.xcprivacy`, binary plist decoded with `plutil`): **seven** collected data types — `CoarseLocation`, `PreciseLocation`, `UserID`, `ProductInteraction`, `OtherUsageData`, `PerformanceData`, `OtherDiagnosticData` — every one `Linked=false`, `Tracking=false`, purposes `AppFunctionality` + `Analytics`; `NSPrivacyTracking=false`, no tracking domains.
2. **MapboxMaps 11.18.3** (`ios/Pods/MapboxMaps/Sources/MapboxMaps/PrivacyInfo.xcprivacy`): `UserID`, `PreciseLocation`, `CoarseLocation` — same flags and purposes.
3. **MapboxCoreMaps 11.18.3**: accessed-API reasons only, no collected types.

### 3.3 Telemetry default-ON — verified at code level, not presumed

`MapboxMaps/Foundation/Events/EventsManager.swift:46-48` registers the UserDefaults default:

```swift
UserDefaults.standard.register(defaults: [
    #keyPath(UserDefaults.MGLMapboxMetricsEnabled): true
])
```

This upgrades the inventory's "presumed ACTIVE" (row 39) to **confirmed default-active** unless opted out.

### 3.4 The current opt-out mechanism for @rnmapbox/maps 10.3.0 (verified end-to-end in the installed SDK)

1. **JS API:** `setTelemetryEnabled(telemetryEnabled: boolean)` — `node_modules/@rnmapbox/maps/src/RNMBXModule.ts:40,87`; upstream docs confirm the signature ("If mapbox' telemetry should be enabled or not").
2. **iOS native:** writes the UserDefaults key — `node_modules/@rnmapbox/maps/ios/RNMBX/RNMBXModule.swift:119-120`: `UserDefaults.standard.set(telemetryEnabled, forKey: "MGLMapboxMetricsEnabled")`.
3. **SDK consumption:** `EventsManager.swift:50-54` KVO-observes the key with `[.initial, .new]` and calls `TelemetryUtils.setEventsCollectionStateForEnableCollection(metricsEnabled)` — the global events-collection switch in MapboxCommon (`PrivateHeaders/MBXTelemetryUtils_Internal.h`).
4. **User-facing toggle stays consistent:** the attribution-menu telemetry toggle reads/writes the same key (`MapboxMaps/Attribution/AttributionMenu.swift:31-32`), so a programmatic opt-out shows as "off" in the map's (i) menu. Do not hide attribution — it carries Mapbox's required opt-out affordance.
5. **Legacy keys:** `MGLMapboxMetricsEnabledSettingShownInApp` is a GL-era Info.plist key and is **not part of the v11 pods** (grep of MapboxMaps sources finds only `MGLMapboxMetricsEnabled`). Do not use it; the UserDefaults key via `setTelemetryEnabled` is the current mechanism.
6. **Android sister action (one call covers both):** the same JS call on Android sets `telemetry.userTelemetryRequestState` (`node_modules/@rnmapbox/maps/android/.../RNMBXModule.kt:133-137`) — the Play Data Safety worksheet must mirror whichever path is chosen here.

Exact change for the ticket (module scope, before any MapView mounts — today `Mapbox.setAccessToken` is called at `src/components/church/GlobeView.tsx:71` and `src/components/church/CamlView.tsx:1275`; hoist a single init alongside or above these):

```ts
import Mapbox from "@rnmapbox/maps";
Mapbox.setTelemetryEnabled(false);
```

UserDefaults persists across launches, but call it on every launch — cheap and deterministic.

### 3.5 Path 1 — disable telemetry (RECOMMENDED) — label consequences

1. **Labels:** section 1.2 exactly as written; "Data Not Linked to You" stays empty. No Analytics purpose appears anywhere on the store page.
2. **Honest residuals after opt-out (declare-nothing rationale, stated not hidden):** (i) tile/style/glyph requests to `api.mapbox.com` carry IP + implicit viewport — real-time map serving, not "collected" under Apple's definition; (ii) the one-shot reverse geocode on CamlView mount sends exact device GPS in the URL (row 38) — real-time, not retained by Replant, Mapbox-as-processor disclosed in the privacy policy; (iii) the **turnstile billing event** (`EventsManager.swift:142-145`, `sendTurnstile` via `eventsService`) rides a separate service from gated telemetry and per Mapbox's billing model fires regardless of opt-out, carrying a pseudonymous SDK-instance ID (`TelemetryUtils.getUserID`). That ID rides under the already-declared Identifiers → User ID row; no extra label row needed. **Verify at the ticket:** run the app through a proxy (mitmproxy/Charles) and confirm zero event POSTs to `events.mapbox.com` after map use except at most the turnstile ping; capture goes to the SEC panel as evidence.
3. **Why Path 1 for the persecuted-context posture:** the SDK's telemetry is precise-location event collection off the devices of leaders whose threat model is location/identity/data-exfil — the exact axis the Underground protections guard (UG signup forbids city/lat/lng at three enforcement layers, and the UG 403 in `get-nearby-churches` fires before body parse precisely so UG GPS never enters any pipeline — inventory rows 14, 38). Shipping a default-ON location-events stream to a third party alongside that architecture is incoherent, and it forces Analytics-purpose location rows onto the store page under a permission string that says "never shared." Disabling costs two lines of code. This is also an SEC data-exfil item independent of store concerns (App Review lane adjacent note 2).
4. **Purpose-string precision (same ticket):** even with telemetry off, the one-shot reverse geocode means exact coordinates transit to Mapbox as a processor serving the app's own request. "Your position is never shared" is defensible with the policy's processor disclosure, but the exactly-true wording is "Your position is never shared **with other members**" (or route the geocode through an own edge function later). Give LEGAL the one-line choice at the labels sign-off.

### 3.6 Path 2 — leave telemetry on — label consequences

1. **Labels:** section 1.3 Variant 2 — Location (precise + coarse) gains an Analytics purpose; Usage Data (Product Interaction, Other Usage Data) and Diagnostics (Performance, Other Diagnostic) appear as collected-not-linked with App Functionality + Analytics; User ID gains Analytics and covers the IDFV-based map.load `userId` (`EventsManager.swift:111`).
2. **Consequences:** the store privacy card shows Location + Usage Data + Diagnostics with Analytics on a platform for persecuted leaders; the purpose string "Your position is never shared" becomes indefensible and must be rewritten; the trust story and the UG threat model both take the hit. Honest, but wrong for this app.
3. **Verdict:** rejected. Adopt Path 1.

---

## 4. Export compliance worksheet — `ITSAppUsesNonExemptEncryption`

### 4.1 The facts (App Review lane row 13, spot-verified this session)

1. `app.json` → `ios.infoPlist` currently sets `"ITSAppUsesNonExemptEncryption": false`.
2. The client bundles a third-party AES-256-GCM implementation and encrypts data at rest with it: `src/lib/secure-storage.ts:28` (`import { gcm } from "@noble/ciphers/aes.js"`), `:88` decrypt, `:103` encrypt — the Supabase session blob in AsyncStorage, keys held in Keychain via expo-secure-store, random bytes via expo-crypto (OS RNG). This is not OS-provided crypto and not authentication-only, so the `false` declaration is not honest. Everything else is exempt (TLS; SecureStore = OS Keychain; heartcry crypto is server-side only — the client sends plaintext over TLS and `pgp_sym_encrypt` runs in the edge function).
3. The architecture is deliberate: KAN-87 SEC rework #2 (ruling 11015). The file header states the threat model (device seizure, hostile forensics) and why key-wrap exists: "if Supabase's session shape grows past the iOS keychain item-size ceiling (~4KB), the encryption key is small enough to always fit; the bigger ciphertext lives in AsyncStorage" (`secure-storage.ts:15-17`).
4. Because the plist key suppresses the ASC questionnaire, the current `false` means the encryption questions have never been surfaced — a wrong key silently propagates through every TestFlight and production upload (carried from App Review lane).

### 4.2 Path 1 — flip to `true` and declare honestly (RECOMMENDED)

1. **Code change:** one line — `app.json` `ios.infoPlist.ITSAppUsesNonExemptEncryption: true`.
2. **App Store Connect encryption questions and answers** (wording per the standard ASC flow; Apple's two encryption doc pages did not render to fetch in either session — verify question text live at first submission):
   1. "Does your app use encryption?" — **Yes.**
   2. "Does your app implement any encryption algorithms that are proprietary or not accepted as standards by international standard bodies (IEEE, IETF, ITU, etc.)?" — **No** (AES-256-GCM is a standard algorithm; @noble/ciphers is an audited implementation of standard primitives).
   3. "Does your app implement any standard encryption algorithms instead of, or in addition to, using or accessing the encryption within Apple's operating system?" — **Yes** (the bundled @noble AES-GCM, in addition to OS Keychain/TLS).
   4. Exemption question — **No, not exempt** (it is non-exempt, standard-algorithm, mass-market encryption).
3. **Resulting classification and obligations:**
   1. Mass-market encryption, EAR Category 5 Part 2, ECCN **5D992.c** — no CCATS/classification request required.
   2. **Annual BIS self-classification report** (EAR §742.15(b) + Supplement No. 8 to Part 742): one CSV line — product "Replant (iOS)", ECCN 5D992.c, authorization "MMKT" — emailed to crypt@bis.doc.gov and enc@nsa.gov by February 1 for the prior calendar year. Owner: LEGAL, recurring.
   3. **France:** if the availability decision (Open decision 5) includes France, a one-time import/supply declaration to ANSSI for mass-market cryptology applies. Owner: LEGAL; fold into the availability-by-country ruling.
   4. Optionally set `ITSEncryptionExportComplianceCode` once ASC issues a code, to keep uploads non-interactive.
4. **Why Path 1:** the OS Keychain does **not** already cover the need — the session blob exceeds the ~4KB Keychain item ceiling, which is the documented reason the key-wrap pattern exists (4.1.3); SEC ruling 11015 chose this at-rest posture deliberately for seized-device forensics, and unwinding a life-safety design to avoid one plist flip, four questionnaire answers, and an annual email is the wrong trade. A platform whose covenant is protecting persecuted leaders does not ship a false encryption declaration when the true one costs this little.

### 4.3 Path 2 — refactor to OS-provided crypto and legitimately keep `false`

1. **What code moves:** `src/lib/secure-storage.ts` drops `@noble/ciphers` (import line 28, decrypt line 88, encrypt line 103; remove the dependency from `package.json`). Two sub-shapes:
   1. Store the session blob directly in expo-secure-store (Keychain) — **blocked in practice** by the same ~4KB item ceiling the file header documents; Supabase session JSON routinely exceeds it. This sub-shape re-litigates the exact problem ruling 11015 solved.
   2. A custom native module using OS CryptoKit `AES.GCM` (iOS) — new native code plus an Android counterpart (Keystore-backed cipher), Expo prebuild/config-plugin work, and a mandatory SEC re-panel (crypto/auth panel rule).
2. **Result:** `ITSAppUsesNonExemptEncryption=false` becomes legitimately true-as-declared (only OS-provided crypto + TLS + OS RNG remain).
3. **Verdict:** rejected for MVP — materially more work, new native attack surface, SEC re-panel, and zero user benefit over Path 1; the only saving is an annual compliance email. Revisit only if a future SEC panel independently wants OS-crypto consolidation.

---

## 5. App Store Connect submission checklist — FINAL

Merged from the App Review lane skeleton; additions marked NEW. The five STORE BLOCKERS from that lane (in-app account deletion 5.1.1(v), UGC report 1.2(b), block users 1.2(c), privacy policy 5.1.1(i), placeholder density 2.1) gate submission regardless of this worksheet — nothing here unblocks them.

1. **App record metadata:** name ≤30 chars (decide casing — `CFBundleDisplayName` is currently lowercase "replant"), subtitle, keywords, description, promotional text.
2. **Privacy policy URL — hard dependency (STORE BLOCKER #4):** LEGAL publishes policy v0.3 (drafting at `~/Documents/Claude/Projects/Replant/`, informed by the data inventory); enter the URL in ASC; wire the in-app Settings row to it in the same stroke. NEW dependency note: the policy must state the label-relevant facts this worksheet relies on — Mapbox/Resend/Upstash/Supabase processor list, IP-for-rate-limiting processing, message/content retention ("retained while the account is active and thereafter in de-identified form"), heartcry encryption and audited admin access, and audit-log retention (inventory Gaps 5, 8, and §2).
3. **Support URL:** create the website contact page (doubles as the 1.2(d) website leg — `website/` currently has zero contact info).
4. **Screenshots + iPad decision:** 6.9" set required, 6.5"/6.7" recommended; `supportsTablet: true` currently obligates 13" iPad screenshots and iPad-quality review — either QA iPad properly or set `supportsTablet: false` for MVP (Founder decision; propagate to the Android tablet posture as the sister action).
5. **Age rating (carried verbatim from the App Review lane draft):** UGC = yes; user-to-user communication (chat) = yes; unrestricted web access = no; realistic violence = none-or-infrequent/mild (historical martyrdom descriptions in Witnesses); sexual content/profanity/horror/gambling/drugs = none; expected outcome ≈ 13+. Confirm in the live questionnaire; do not guess it into metadata.
6. **Demo accounts:** working credentials for a pre-verified leader on a seeded church, plus a second credentialed account so the reviewer can exercise Connect DMs both ways. Ask the Founder which accounts — never assume Maranatha.
7. **Review notes:** explain the verification model (why fresh signups are gated), covenant + flag-review moderation, DELIVER-ALWAYS rationale, demo-account instructions, contact info. UG-feature disclosure depth = Founder/LEGAL ruling BEFORE drafting (Open decision 4).
8. **Export compliance:** resolve per section 4 — recommended: flip `ITSAppUsesNonExemptEncryption` to `true` in `app.json`, answer the four ASC questions as written, put the annual BIS self-classification line on LEGAL's recurring calendar, fold the France/ANSSI declaration into the availability decision.
9. **Nutrition labels:** enter section 1.2 (and 1.3 Variant 1) exactly, after the Founder/LEGAL sign-off (Open decision 3). Sensitive Info is declared — do not let the ASC form's defaults drop it.
10. **NEW — Privacy manifest correction:** apply the section 2.3 block to `app.json` `expo.ios.privacyManifests`; verify the generated file post-prebuild; keep it mirrored to the labels forever after.
11. **NEW — Mapbox telemetry build change:** `Mapbox.setTelemetryEnabled(false)` at startup per section 3.4–3.5; proxy-capture verification; SEC panel eyes on the change and the capture evidence; same ticket carries the purpose-string cleanup: remove `NSLocationAlwaysAndWhenInUseUsageDescription` from `app.json` `ios.infoPlist` (keep only WhenInUse), confirm the template `NSLocationAlwaysUsageDescription` and boilerplate `NSFaceIDUsageDescription` are absent from the regenerated Info.plist, and apply the LEGAL wording choice on "never shared" (section 3.5.4).
12. **Build pipeline:** `eas.json` production profile exists; populate `submit.production` (ascAppId/team) when the ASC record exists. External TestFlight passes through Beta App Review — the same blockers apply there; fix before external beta.
13. **Localization:** declare English (U.S.) only — accurate as-built, no action.
14. **Availability by country (Founder/LEGAL, carried):** default-all-countries is not obviously right — store presence in hostile jurisdictions makes installation forensically legible on seized devices, yet exclusion denies the very leaders served; China requires ICP filing and has removed religious apps; Iran/North Korea have no App Store. Decide deliberately as a protection decision; the France choice also triggers the ANSSI leg of section 4.2 if Path 1 is adopted.

---

## 6. Open decisions

1. **Mapbox telemetry path.** Options: Path 1 disable at startup + declare only residuals; Path 2 leave on + declare Location/Usage/Diagnostics with Analytics. Recommendation: **Path 1.** Owner: Founder ratifies; SEC panel reviews the build change + proxy-capture evidence (data-exfil surface on the UG-guarded axis).
2. **Export compliance path.** Options: Path 1 flip `ITSAppUsesNonExemptEncryption` to `true` + ASC answers + annual BIS report (+ France/ANSSI if applicable); Path 2 refactor `secure-storage.ts` to OS crypto and keep `false`. Recommendation: **Path 1** — preserves the SEC-ruled (11015) seized-device posture; OS Keychain alone cannot hold the session blob (~4KB ceiling). Owner: Founder + SEC to ratify; LEGAL owns the recurring BIS filing.
3. **Nutrition-labels final sign-off (one bundled decision).** Contents: (i) Sensitive Info declared as collected-and-linked (whole-account religious affiliation — a public store statement about the user base); (ii) Precise Location + Physical Address declared for church pin/address — an upgrade from the App Review lane's coarse-only preliminary draft, per inventory rows 14–16; (iii) first-party Usage Data deliberately not declared (section 1.4.2); (iv) Health deliberately not declared (section 1.4.1); (v) the "never shared with other members" purpose-string wording. Recommendation: adopt as written. Owner: Founder + LEGAL.
4. **UG-feature disclosure depth in Apple review notes** (guideline 2.3.1 tension, carried unresolved from the App Review lane): under-disclosure risks rejection; full disclosure documents the mechanism with a third party. Owner: Founder + LEGAL, before review notes are drafted.
5. **Availability by country, including the France/ANSSI interaction** (checklist item 14). Owner: Founder + LEGAL.
6. **iPad support** (`supportsTablet` — checklist item 4; sister action: Android tablet posture). Owner: Founder.
7. **Turnstile residual verification:** proxy-capture whether the Mapbox billing ping fires with telemetry disabled and what identifier it carries; if it deviates from the section 3.5.2 assumption, adjust the User ID row note (not expected to change any ASC answer). Owner: SEC/BE at the telemetry ticket.

---

*Traceability: sections 1–2 derive from data-inventory.md rows cited inline and the manifests quoted in sections 2.1/3.2; section 3 mechanisms are quoted from the pinned pods and installed @rnmapbox/maps 10.3.0 source; section 4 facts from src/lib/secure-storage.ts and app.json as read this session; section 5 merges the ios-app-review.md skeleton without re-derivation. Jira cites are working anchors — spot-check against live Jira before ratifying downstream.*
