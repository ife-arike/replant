# Replant Code Health Audit: Spaghetti-Code Pass (2026-08-10)

**Scope:** `~/replant` app (`src/`) and backend (`supabase/functions`, `supabase/migrations`). Website, blog, and design assets out of scope. Admin dashboard repo not covered.
**Method:** Five parallel read-only auditors, one per dimension (architecture and dependencies, god files and complexity, duplication and drift, state and data flow, backend layer), followed by a manual verification pass on the highest-stakes claims. Priority scores use (Impact + Risk) x (6 - Effort), each 1-5.

## Verdict

**Overall: C+. This is not a spaghetti codebase.** The bones are unusually good for a fast-built product: the client cannot touch a table (100% of data access goes through SECURITY DEFINER RPCs), there are no barrel files and effectively no circular imports, layering direction holds, state ownership is clean, and every Realtime channel tears down correctly. The debt has one dominant shape instead: **paste-and-edit growth around a sharing layer that was never finished.** Fixes land in one copy and not its twins. That drift has now shipped real user-facing defects, and those defects matter more than the tidiness debt.

Second headline: **roughly 10,000 lines across ~30 files (about 15% of app source) is dead code**, two abandoned parallel implementations (Prayer Wall v1, Persecuted scenes layer) whose files sit beside their live replacements with near-identical names. This is an active hazard during UAT: an engineer or agent greps, finds the plausible file, edits the dead one, and ships nothing. It happened inside this very audit (see Verification notes).

| Dimension | Grade | One-line |
|---|---|---|
| Architecture + dependencies | B- | Direction correct, cycle risk low; no consistent data-access layer (93 inline `supabase.rpc()` sites, 3 conventions) |
| God files + complexity | C | Most big files are long-but-linear; 3 genuinely tangled (CamlView, ASP2, RegCP1); 15% dead code |
| Duplication + drift | C | Presentation layer is paste-built; at least 3 pastes drifted into user-visible defects |
| State + data flow | C+ | Ownership clean, Realtime lifecycle clean; failure handling diverges per paste, including a publish path that lies |
| Backend (edge fns + SQL) | C+ | Individual functions clean; `_shared/` abandoned, validator drift already bypassed one locked invariant; migrations not replayable |

---

## Part 1: Live defects surfaced by the audit

These are behavior bugs, not style. Ordered by severity. "VERIFIED" = confirmed by direct read during the verification pass; others are agent-reported with file:line evidence.

### D1. Address the Network: publish/submit fabricate success on RPC error (VERIFIED)
`src/screens/main/addressNetwork/addressNetworkApi.ts:214-300`
On ANY RPC error, `submitAddressNetwork` fabricates a Submission object, pushes it into an in-memory stub list, and resolves as success. `publishSubmission` flips the local status to `live`. Only the console log is `__DEV__`-gated; the stub behavior ships in production. A leader "publishes" to the network, sees confirmation, and nothing reached the server. Silent data loss presented as success.
Impact 5, Risk 4, Effort 2. **Priority 36.**

### D2. Branch threads missing two fixes their DM twin already has (VERIFIED)
`src/components/connect/BranchThreadView.tsx:795,813,836` vs `DMThreadView.tsx:629`
DMThreadView gates its Realtime subscribe on `initialFetchComplete` (comment cites "device-pass-fixes-1 Fix 4") and assigns `messagesRef.current` inside the setState updater (comment names the exact stale-ref duplicate bug). BranchThreadView got neither: its subscribe runs on mount unguarded while `get_branch_messages` is in flight, the initial load does a full `setMessages` replace (line 795), and the insert handler builds its next array from `messagesRef.current` (836-840) rather than functional `prev`. Consequences: a message arriving during the initial-load window can be wiped and stays missing until the thread reopens (silent message loss), and the sender-echo dedup can miss after send, showing duplicates. On a secure-comms platform, thread twins drifting on delivery correctness is the single worst place for drift to live.
Related, same file: `loadMembersAndSummary` (~688) checks the member query error but never the branch-list error, so `summary` can stay null with the normal composer rendered and `attemptSend` silently refusing. A healthy-looking send box that can never send.
Impact 5, Risk 3-4, Effort 2. **Priority 32.**

### D3. Settings read failure can render an anonymous leader as non-anonymous
`src/screens/main/SettingsScreenContainer.tsx:123` (and the failure-posture split across 12 viewer-row reads, see S3)
On a failed `users` self-row read, the container falls through to hardcoded defaults including `anonymousMode: false` and `first_name_only`. A transient read failure shows an anonymous leader as non-anonymous, and the screen then allows saving that state. Given the F11 history (184 leaders surnamed against their choice) and the underground threat model, this is a privacy defect, not a UX blemish. Sibling: `useChurchVerifiedStatus.ts:39` returns `false` on error, indistinguishable from genuinely unverified.
Impact 4, Risk 4, Effort 2 for the narrow fix. **Priority 32.**

### D4. Persecuted readers show placeholder editorial content on error or empty
`src/screens/main/persecuted/readers/ArticleReaderScreen.tsx:73-79`, same pattern in `GuidanceReaderScreen.tsx:167`, `StoryArchiveScreen.tsx:59`, `WitnessArchiveScreen.tsx:88`
`if (!error && data && data.length > 0) ... else setX(PLACEHOLDER)`: failures and empty results both render invented content. A leader can read what appears to be a real persecution account that is placeholder copy. `PersecutedScreen.tsx:141-160` already distinguishes error from empty correctly; the app disagrees with itself on its most sensitive content.
Impact 4, Risk 3, Effort 2. **Priority 28.**

### D5. Urgent register silently dropped on three of six feed card types
`src/components/home/LeaderWordCard.tsx:100` and twins (`AnnouncementCard`, `ArticleCard`, `CallToActionCard`, `TogetherCard`, `LinkCard`, `EncouragementCard`)
The eyebrow (dot + label + rule + time) is pasted into six card files with five different behaviors. Announcement/Article/CTA carry the urgent `blinkAnim` pulse; LinkCard has a dot with no pulse; TogetherCard hardcodes a static green dot (green dots were retired on Home eyebrows per the 2026-07-28 ruling); LeaderWordCard and EncouragementCard take no `tag` prop at all, and `NetworkFeed.tsx:403,420,303` never passes one. An urgent post routed to leader_word, encouragement, or together renders with no urgency marker. Direct violation of the locked "white dots + motion urgent-only" ruling, on exactly the highest-stakes message types.
Impact 4, Risk 4, Effort 3. **Priority 24.**

### D6. Anonymous identity composed client-side; F11-shape name rebuild on Church tab
`src/components/church/CamlView.tsx:157-158`, `src/components/church/ChurchProfileBottomSheet.tsx:439`
Both compose "A fellow {Role}" client-side from raw columns, while the server composes it lowercase in `get_comments` v3 SQL, and Prayer Wall helpers return role-less "A fellow leader". Three renderings of one identity string ship simultaneously, violating the server-composed identity invariant. Worse, CamlView's non-anonymous branch rebuilds the display name from `first_name`, ignoring display-name preference, honorific, and name-order columns: the same shape as the F11 bug.
Impact 4, Risk 3, Effort 2. **Priority 28.**

### D7. Connect tab "tap to retry" is a permanent no-op
`src/components/connect/LeadersList.tsx:833`
`<ErrorView onRetry={loadInitial} />` where `loadInitial(silent?: boolean)` receives the press event as its first argument, so `silent` is truthy and every UI state update is skipped. Retry never clears the error card, even on a successful refetch. Sibling `MinistriesList.tsx:398` passes an argless wrapper and works; its `silentRefresh` (295-302) has the cousin bug, loading fresh rows behind a stale error card.
Impact 3, Risk 4, Effort 1. **Priority 35.**

### D8. Debug console.logs shipping on the account-creation path
`src/screens/onboarding/AccountSetupPage2Screen.tsx:1105` (+ 8 more in handleSubmit: 755, 765, 769, 779, 834)
Scroll-event logging and submit-path diagnostics (church selection, personal-details presence flags) left from the phantom-inset investigation. Console opacity is a shipped deterrent per the KAN-289 doctrine; the account-creation path should not narrate composition state to an attached device.
Impact 2, Risk 3, Effort 1. **Priority 25.**

### D9. Backend: church-validation drift already bypassed one locked invariant; address gap still open
`supabase/functions/_shared/church-validation.ts` (0 importers) vs copies in `register-church/logic.ts:174`, `create-account/logic.ts:178`, `update-church/logic.ts:22`
The file whose header says "Single source of truth" is imported by zero functions; four hand-maintained copies have drifted. Migration `20260702023938_enforce_underground_rag_red_trigger.sql` documents that this drift already shipped an invariant bypass (RAG-red enforced only in create-account) and was backstopped by a DB trigger. The parallel gap is still open: create-account nulls `address` for underground; update-church (a live write path for underground rows) passes it through, and `underground_no_location` CHECKs only city/lat/lng. The "MCP deploy model doesn't honor `_shared` imports" justification is contradicted by `create-account/index.ts:53` importing from `_shared/` successfully.
Impact 5, Risk 4, Effort 3. **Priority 27.** Touches underground invariants: SEC eyes on the fix.

### D10. DELIVER-ALWAYS matcher forked byte-identical, untested copy
`supabase/functions/send-branch-message/matcher.ts` + `taxonomy.ts` vs `send-message/` originals
Verified byte-identical today (333 lines), but only send-message's copy has the 341-line test suite. The pastoral-flagging safety net for branch messages will silently stay on old logic the first time the original is fixed.
Impact 3, Risk 3, Effort 1. **Priority 30.**

---

## Part 2: Structural debt (scored)

| # | Item | Where | Impact | Risk | Effort | Priority |
|---|---|---|---|---|---|---|
| S1 | Dead code: Prayer Wall v1 stack (~7,200 lines, 13 files), Persecuted scenes layer (~2,400 lines, 9 files), `getLeaderDisplayName.ts` + test | `src/components/prayer/`, `src/screens/main/persecuted/scenes/`, `src/utils/` | 5 | 4 | 1 | **45** |
| S2 | No data-access layer: 93 inline `supabase.rpc()` sites across 46 UI files, 3 competing conventions; per-site optimistic/rollback logic | app-wide; contrast `src/api/underground.ts` (the intended pattern, 2 functions) | 5 | 3 | 5 | 8 (long-term) |
| S3 | Viewer self-row query hand-rolled 12x with 5 failure postures (`.single()` vs `.maybeSingle()` vs defaults) | `TheChurchScreen.tsx:221`, `ConnectScreen.tsx:211`, `PrayerWallScreen.tsx:383`, `PersecutedScreen.tsx:128`, `HamburgerPanel.tsx:313`, `InviteScreen.tsx:64`, `OutreachMissionsScreen.tsx:100`, `SettingsScreenContainer.tsx:97`, 3 hooks | 4 | 4 | 4 | 16 |
| S4 | Six independent relative-time formatters, four diverged registers ("2h ago" / "730d" / "yesterday" / date fallback) | `PrayerWallLogic.ts:212`, `NetworkFeedLogic.ts:226`, `persecutedLogic.ts:127`, `addressNetwork/format.ts:17`, `CommentThread.tsx:85`, `PrayerWallPullUp.tsx:377` | 3 | 2 | 3 | 15 |
| S5 | CamlView: the one genuinely spaghetti file. 945-line body, 7 responsibilities, 13 effects, 21 refs (7 shadow-mirrors), GPS-triggered refetch with no backoff (retry storm on outage), no cancellation guard | `src/components/church/CamlView.tsx:184-725` | 4 | 5 | 4 | 18 |
| S6 | AccountSetupPage2: 1,340-line body, 259-line handleSubmit, ~18 mutually exclusive render branches, direct auth side-effect | `src/screens/onboarding/AccountSetupPage2Screen.tsx:252` | 5 | 4 | 4 | 18 |
| S7 | RegCP1 mirror-state-to-context pattern, 22 useState, 2 recorded clobber incidents in comments | `src/screens/onboarding/RegisterChurchPage1Screen.tsx:123-178` | 4 | 4 | 3 | 24 |
| S8 | Rate limiting reimplemented 9x in edge functions, 4 incompatible shapes, 8 fail-open / 1 fail-closed (undiscoverable split) | `get-nearby-churches/index.ts:99` + 8 | 3 | 3 | 2 | 24 |
| S9 | `json()` helper defined 16x; 4 error-body families; 3 auth-extraction patterns incl. 2 hand-rolled JWT decoders | all edge functions | 3 | 3 | 3 | 18 |
| S10 | Migrations not replayable: 2 duplicate version prefixes, 8 nonconforming `20260623_000X` names, 1 `...3b` suffix, `audit_log_action_check` rebuilt from LIVE prod 14x | `supabase/migrations/` | 4 | 4 | 4 | 16 |
| S11 | ~4,000 lines of Deno edge-function tests that nothing runs (no CI task); `send-message/handler.ts` (external T1 path) has no test at all while `makeDeps()` holds ~190 lines of unreachable business logic | `.github/workflows/`, `send-message/index.ts:182-369` | 4 | 4 | 2 | 32 |
| S12 | Onboarding navigator 12-node type-only import cycle; none marked `import type`; `navigation/types.ts` routes a full `Submission` object as a route param | `src/navigation/OnboardingNavigator.tsx:85`, `navigation/types.ts:11,48` | 3 | 3 | 1 | 30 |
| S13 | `rpcAppError` (app-wide error-envelope contract) buried in `components/prayer/wallNewLogic.ts:112`, imported upward by 2 unrelated screens | move to `src/lib/` | 3 | 3 | 2 | 24 |
| S14 | `src/context/` vs `src/contexts/` fossil split (1 file vs 3) | merge | 2 | 2 | 1 | 20 |
| S15 | SettingsScreen: 8 near-identical optimistic write handlers (~160 lines, should be one hook); un-cleaned `setTimeout` setState (also `ChurchProfileBottomSheet.tsx:267`) | `SettingsScreen.tsx:544-769` | 2 | 2 | 2 | 16 |
| S16 | Role-label maps drifted client vs SQL (16 keys client incl. 4 not in enum; missing `replant_staff`; no A/An rule); stale `send-message/config.toml` auth description | `displayHelpers.ts:72` vs `..._kan338_0003_frozen_byline_completion.sql:59` | 2 | 3 | 2 | 20 |
| S17 | COUNTRIES array (89 entries) duplicated verbatim; picker bottom-sheet (~200 lines) pasted 4x | `AccountSetupPage1Screen.tsx:86`, `RegisterChurchPage1Screen.tsx:556`, +2 | 2 | 2 | 2 | 16 |

## What is genuinely healthy

Named because it is real, and because remediation should protect it, not churn it.

1. **RPC-only client:** zero `supabase.from()` in `src/`; all 56 data operations through SECURITY DEFINER RPCs. For an RLS-deny-all platform with underground users, client code that structurally cannot touch a table is an achievement.
2. **No barrel files, clean fan-in:** high-fan-in modules are all legitimate (`theme.ts` 140, `lib/supabase.ts` 63, `AuthProvider` 26); no junk-drawer utils. Layering direction holds; website/blog never touch app code.
3. **AuthProvider** (`src/contexts/AuthProvider.tsx`): best-engineered file in the repo. Debounce, per-check AbortController, ordered clear-and-route, 401s decoupled via an event bus, each race documented from an observed failure.
4. **Realtime lifecycle:** all 6 channels have matching teardown, stable deps, zero leaks found.
5. **PageTurnText + useMirrorRearm:** the highest-risk feed logic (read-on cue, three-mechanism event-loss history) is owned by exactly one component and used by all six cards. The contrast with the six-way eyebrow paste (D5) is the whole audit in one directory.
6. **CompletionFlowOverlay:** textbook wizard (one step machine, four extracted steps, one draft reducer). **BranchThreadView's internal factoring** is likewise the best of any large file (18 subcomponents, disciplined memoization); its defects (D2) are twin-drift, not internal tangle.
7. **Container/presenter and tested logic modules:** `SettingsScreenContainer` + presenter split, `PrayerWallLogic`/`wallNewLogic`/`persecutedNewLogic`, 13 RN test files. `orgCopy`/`viewerOrgCopy` centralization is honored app-wide.
8. **Backend split-with-tests where it exists:** `auth-status-check`, `create-account`, `search-churches`, `register-church-delete` have real DI and 600-700-line suites. `send-message/handler.ts` request flow is clean and invariant-commented. `config.toml` files document WHY each `verify_jwt` posture exists.

## Dead code inventory (S1)

Prayer Wall v1 (unreachable from any live screen; `PrayerWallScreen.tsx:17` documents the replacement): `PrayerWallLanding` 1287, `MyOpenPrayersView` 1283, `IntercessionJournalView` 1077, `RevelationView` 628, `PrayerWallDetailSheet` 556, `TestimonyDetailSheet` 481, `TestimonyCard` 438, `TestimoniesView` 392, `PrayerWallFilterBar` 347, `PrayerWallCard` 265, `ScriptureBanner` 158, `PrayerWallPillNav` 158, `LocationsView` 121.
Persecuted scenes layer (live tab renders `HeartcriesView`/`TakeHeartView`/`MyVoiceView`/`WitnessesView` instead): `FeedScene` 833, `TakeHeartScene` 438, `MyHeartcriesScene` 391, `BearWitnessScene` 308, `NotifBar` 105, `StatusTrack` 91, `SeverityTag` 85, `EntryPointBlock` 87, `PillTabBar` 82.
Plus `src/utils/getLeaderDisplayName.ts` (40) and its green test suite: a client-side name composer whose header claims "single source of truth", which ignores every F11 preference column, and which CI keeps asserting even though the resolver it models was deliberately deleted. `PrayerWallPullUp.invariants.test.ts:49` already asserts it must NOT be used.
Deletion note: the live `PrayerWallScreen` imports from both `PrayerWallLogic.ts` and `wallNewLogic.ts`, so the old logic module stays; only the dead views and their exclusive dependencies go. Build the definitive list from an import trace in the deletion PR, then typecheck + test.

## Phased remediation

No timelines attached (per house rule). Phases are ordered by return per unit of risk, and Phase 1 is deliberately safe to run during UAT season.

**Phase 1, mechanical and near-zero risk:**
1. Delete dead code (S1). One commit, import-trace verified. Removes ~15% of the tree and the wrong-file-edit hazard.
2. Fix LeadersList retry arg + MinistriesList stale error card (D7).
3. Port the two documented DM fixes into BranchThreadView (D2): gate subscribe on initial fetch, ref-assign inside updater, merge instead of replace.
4. Strip ASP2 console.logs (D8).
5. De-fork matcher/taxonomy (D10): re-point send-branch-message at one shared module, or add a byte-equality test as interim tripwire.
6. Mark onboarding navigator imports `import type` where types-only; move `SubTab` beside the param lists (S12 partial).

**Phase 2, correctness cluster (small diffs, needs care + smoke):**
1. addressNetworkApi: remove fabricated-success stubs; surface errors honestly (D1).
2. Persecuted readers: distinguish error from empty; never placeholder on error (D4).
3. Settings/viewer failure posture: read failure must render an error state, never default `anonymousMode: false` (D3 narrow fix).
4. Extract one FeedEyebrow component honoring the locked urgent ruling; thread `tag` through the three cards missing it (D5).
5. Remove client-side anon-identity composition; pass server-composed strings through; route CamlView names via the display-name resolver (D6).
6. Branch summary-error surface (D2 related): show the error card the ministries list already has.

**Phase 3, structural (post-UAT sequencing, some need panels):**
1. Backend `_shared/` re-unification: church validator (SEC eyes, underground address backstop decision), rate-limit module, `json()`/error envelope (S8, S9, D9).
2. CI: run the Deno suites; add the missing `send-message/handler.ts` test; extract `makeDeps()` logic to testable modules (S11).
3. Migrations repair: rename nonconforming files, resolve duplicate versions, generate the audit-action constraint from a repo-held registry (S10). Feeds the DR restore-drill launch gate.
4. Viewer-context consolidation: one hook, one failure posture, 12 call sites (S3).
5. One relative-time formatter (needs a Founder register decision first: six registers exist, one must win) (S4).
6. CamlView decomposition (S5) and RegCP1 state-ownership fix (S7). ASP2 (S6) is post-MVP unless it blocks UAT.
7. Data-access layer growth per feature as files are touched, `src/api/` pattern (S2). Not a big-bang rewrite.

## Verification notes and corrections

Hand-verified during synthesis: D1 (read the stub bodies), D2 (read subscribe effect + initial load + insert handler; confirmed `initialFetchComplete` exists only in DMThreadView), S1 reachability (grepped importers; the only live-file mentions of `PrayerWallLanding` and `getLeaderDisplayName` are comments), D10 byte-equality (agent ran `diff`).

Two agent claims corrected during synthesis, both instructive:
1. An auditor reported a live `stand_in_the_gap` error-contract bug at `PrayerWallDetailSheet.tsx:225`. That file is part of the dead v1 stack, so the defect is unreachable. The correction is the point: a skilled reviewer burned effort auditing dead code it had no way to recognize as dead. UAT engineers face the same trap until S1 lands.
2. Initial grep suggested `getLeaderDisplayName` had live importers in DMThreadView/LeadersList; both are comments referencing it. The zero-importers claim stands.

Cross-agent disagreement recorded honestly: the complexity auditor rated BranchThreadView the best-factored large file; the drift and state auditors found its worst defects. Both are true. Internal structure and twin-parity are different axes, and the second one is where the bodies are buried.
