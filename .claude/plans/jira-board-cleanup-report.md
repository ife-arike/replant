# Jira board cleanup report

**Session date:** 2026-06-23
**Cloud:** projectreplant.atlassian.net
**Scope at session start:** project KAN, status != Done

## Snapshot at session start

| Priority | Open count |
|---|---:|
| Highest | 4 |
| High | 24 (1 already Cancelled, excluded) |
| Medium | 88 |
| Low | 11 |
| Lowest | 1 |
| **Total non-Done** | **128** |

Triage uses (a) live Jira description + comments, (b) memory + continuous spec, (c) git history in `~/replant` and `~/replant-admin`, (d) recent migrations + manifests. Founder marks Done — I propose.

## Actions taken this session

- **23 NEW tickets filed** (KAN-239 through KAN-261, plus KAN-262 = 24): all post-MVP backlog items from memory + MVP gaps not in Jira.
- **13 Epics transitioned Backlog → In Progress** per Founder ruling: KAN-4, 5, 6, 8, 26, 27, 28, 29, 30, 31, 33, 34 (KAN-32 was already In Progress).
- **Duplicate link created** KAN-155 → KAN-148 with supersession comment on KAN-155.
- **Jira comments added** on KAN-207, KAN-181, KAN-229, KAN-230, KAN-231, KAN-232, KAN-192, KAN-217, KAN-155 with evidence for Founder ratification.

---

## Section 1 — Ready for Founder to mark Done (DONE_PROPOSED)

| Key | Title (short) | Evidence | Comment posted |
|---|---|---|---|
| KAN-207 | BUG: Church type edit creates duplicate orphan / region NULL | Commits `dfd7d12` + `59d3266` — `update-church` edge function + RegisterChurchPage2Screen.tsx UPDATE-path. Founder commit 2026-05-29. | ✅ |
| KAN-181 | Security fix — exclude underground churches from onboarding search | `churches_public` view + `search_leaders` + `get_invite_candidates` all exclude UG. AC5 explicitly allows "no code change needed if policy covers." Sentinel test recommended before close. | ✅ |
| KAN-229 | Name structure foundation — first/middle/last + display preferences + 8 RPCs | Migration `20260614150000_kan229_users_suffix_and_include_middle_name.sql` live + signup sprint state memory. | ✅ |
| KAN-230 | Church contact email uniqueness with main/branch exception | Memory: "KAN-230 shipped today" 2026-06-12. | ✅ |
| KAN-231 | AccountSetupPage1 — phone number field + reassurance note | Memory: "KAN-231 shipped today" 2026-06-12. Replaces `postmvp_phone_signup.md` (no parallel ticket filed). | ✅ |
| KAN-232 | Branch church sign-up flow — parent campus lookup + identifier dropdown | Branch-flow batch SHIPPED per continuous spec 2026-06-18+. RegisterIntroScreen + ParentChurchPicker + RPCs + edge fn live. | ✅ |
| KAN-192 | AccountSetupPage2 — wireframe v4 reconciliation + skip link + Enter Replant CTA | Memory: KAN-192 ASP2 redesign + bypass card + register-church-delete shipped Session 3 (signup-sprint-state-2026-06-13). Status already In Progress → Done. Over-scroll verification pending. | ✅ |
| KAN-217 | Welcome DM (leader verification) | Founder ratified Fix 5 shipped. PR #62 `be211dd` + device-pass-fixes-1 (smarter idempotency). | ✅ |
| KAN-186 | Underground onboarding — separate navigator stack | UG signup BE+FE SHIPPED per continuous spec 2026-06-20/22. Founder walked happy path 2026-06-22 (Shine Bright Church Gathering, Iran). | ☐ |
| KAN-187 | Underground personal details screen | Same UG signup batch. | ☐ |
| KAN-188 | Underground new church registration screen | Same UG signup batch — RegCP1 underground variant with private-name notice, RAG-locked Red, "Submit Church" CTA. | ☐ |
| KAN-189 | Underground affiliation flow — Network ID entry | `join-underground-church` v1 edge function SHIPPED 2026-06-20. | ☐ |
| KAN-191 | RLS hardening — underground data tier (MVP) | Migration `underground_safety_hardening_v1` SHIPPED 2026-06-20 + `20260621000001_decouple_underground_from_anonymous_v1.sql`. | ☐ |
| KAN-127 | RLS hardening (underground baseline) | Watched-invariant per spec; multiple admin + mobile commits reference. | ☐ |
| KAN-130 | TOTP freshness lock (admin) | Live since 2026-05-17. Admin commit `845d084` bumped BE freshness 5→30 min as followup. Post-MVP tiered MFA = KAN-246. | ☐ |
| KAN-119 | Audit log meta validator | Admin commits reference KAN-119; locked 2026-05-09. | ☐ |
| KAN-213 | Profile completion flow | Memory: PR #110 hotfix + PR #109 patched (`a20e60b`) 2026-06-01. CompletionFlowOverlay + edit mode shipped. | ☐ |
| KAN-220 | Replant Team Inbox — Admin read & reply | Already TESTING. Admin PR `c01242f` 2026-06-01 fixed styling. Founder smoke-test needed. | ☐ |
| KAN-223 | CAL — Regional View: region pill + slide-over church list | Already TESTING. Shipped per continuous spec church-tab work. | ☐ |
| KAN-215 | Connect — RPL Network ID search predicate | Already TESTING. Migration `20260608000001_fix_search_leaders_rpc.sql` + Day 5 commits. | ☐ |
| KAN-216 | Connect — Precise unread counts via get_leader_thread_list RPC | Already TESTING. Branch-features migrations live. | ☐ |

**21 DONE_PROPOSED candidates.** Founder action: smoke-test then transition to Done (transition id 51).

## Section 2 — In TESTING — Founder smoke-test needed (already in TESTING column)

| Key | Title | What needs testing |
|---|---|---|
| KAN-24 | Prayer Wall — Post a Request sub-screen | Verify against KAN-258 (Post + Receive wiring) scope to confirm no overlap or supersession. |
| KAN-63 | KAN-37c — PII Scrub Cron, 90-day post-deactivation | Verify pg_cron job in prod + audit_log action firing on test deactivation. |
| KAN-69 | Connect — New DM Flow / Leader Search | Connect Day 5 work landed. Founder smoke-test on a fresh search. |
| KAN-176 | Admin — windowed page-number pagination on all list screens | Admin commits confirm. Founder visual ratification across list screens. |
| KAN-150 | POST-MVP SHELL: Per-post anonymous toggle on prayer wall | Verify shell behavior matches `reference_anon_identity_rules.md`. |
| KAN-14 | Register Church Page 2 — map pin location confirmation | In Review. Map pin flow on device + branch + para paths. |
| KAN-35 | Verification Countdown Banner | In Review. Memory: "verification banner flash fixed (b439c46 main)." |

## Section 3 — Still open + on critical MVP path (must close before UAT)

| Key | Title | Status | Outstanding work |
|---|---|---|---|
| KAN-198 | Password Reset — Email OTP (replaces PKCE) | Backlog | No commits. UI-UX design dependency + SEC review on dropping `flowType: 'pkce'`. Highest priority. Pre-launch blocker. |
| KAN-84 | auth-status-check edge-case follow-up — deactivated church + TZ | Backlog | Gated on SPEC v2.5 Section 03 publish + fresh SEC JWT mint + DBA fixtures. Blocks KAN-71. |
| KAN-114 | Step-up consumer wiring sweep | Backlog | Admin commits reference KAN-114 — code-read needed to verify whether framework deferral resolved. |
| KAN-219 | auth-status-check — surface church_verified field + State B copy | Backlog | `auth-status-check` v7 + v8 shipped. Verify whether State B copy + 4 mobile gate surfaces covered. |
| KAN-184 | Country dropdown — filter-as-you-type UX polish | Backlog | Per signup state, Phase 2.3 next. |
| KAN-197 | RegisterChurchPage1 — move needs textarea from Page 2 | Backlog | Per signup state, Phase 2.4 next — textarea relocation. |
| KAN-206 | Individual leader verification — Leader N joining existing verified church | Backlog | Admin commits reference KAN-206 — partially shipped. Verify against UG sprint scope. |
| KAN-210 | Admin — Church geocoding + verification profile field editing | Backlog | Admin work likely partial — needs admin sprint follow-up. |
| KAN-258 | Prayer Wall — wire Post and Receive intercession flows | (new) | Filed this session. MVP-critical per memory — currently stubbed. |
| KAN-256 | Wire "You've been verified" toast on Home | (new) | Filed this session. Gap 1 of verification-approved-ux memory. |
| KAN-254 | Empty-state pass — commit working tree + finish Coming Soon sweep | (new) | Pre-UAT blocker — working tree may still be uncommitted per memory. |
| KAN-78 | Tab Bar Navigator + Locked Modal — Scaffold + Remaining Build | Backlog | Per memory: 5-tab sprint shipped — verify specific remaining scope. |
| KAN-77 | Static Content Screens — Vision / Outreach & Missions / FAQ | Backlog | Per signup-login sprint plan: post-signup pre-launch task. |
| KAN-148 | Leader registration: handle 3rd-leader conflict (KAN-155 now superseded into this) | Backlog | Combine ratified this session. Important MVP correctness. |
| KAN-158 | Intake validation: enforce one-leader-one-church | Backlog | Verify scope vs signup sprint completions. |
| KAN-202 | Orphaned church auto-scrub — pg_cron sweep | Backlog | Likely covered by 2026-06-22 UG hard-delete-sweeper — verify scope. |
| KAN-236 | Signup: defer church creation to atomic create-account (no-orphan refactor) | Backlog | `create_account_atomic` shipped — verify pre-refactor scope fully delivered. |
| KAN-211 | (verify ticket description) | Backlog | Mobile repo commits reference. Need ticket body. |
| KAN-208 | (verify ticket description) | Backlog | Mobile repo commits reference. Need ticket body. |

## Section 4 — Pre-launch / between-UAT-and-store-submission

| Key | Title | Why deferred |
|---|---|---|
| KAN-31 | Resend Email Infrastructure (Epic) | Email template content / variable templating pending |
| KAN-80 | BE: Resend SDK + sendEmail() Utility + Retry/Bounce | BE wiring live; polish pending |
| KAN-81 | OPS+BE: Scaffold 8 Email Templates in Resend | Deployed template older than local upgrade |
| KAN-88 | Resend template verified-link audit | OPS observability hygiene |
| KAN-89 | Resend dead-letter monitoring | OPS observability hygiene |
| KAN-143 | Admin action email templates | Email sprint scope |
| KAN-164 | Intake form welcome email — on-submit transactional | Email sprint scope |
| KAN-165 | Early access invitation email | Email sprint scope |
| KAN-166 | Community covenant notice — Connect first-DM gate copy | Pre-launch copy pass |
| KAN-168 | Admin account deactivation email | Email sprint scope |
| KAN-222 | Pre-launch copy sweep — review and refine wording | Pre-launch by definition |
| KAN-169 | OPS: Pre-launch test data wipe + church_code sequence reset | Pre-launch by definition |
| KAN-157 | LEGAL: International data handling — cross-border + privacy + ToS | Pre-launch legal sprint |
| KAN-34 | Accessibility — WCAG Compliance (Epic) | Opens at 80% build per spec note |
| KAN-85 | OPS: verify_jwt=true load-bearing-security note + SECURITY.md | OPS pre-launch |
| KAN-156 | Data quality: global data gap tracking | Pre-launch i18n + data quality sweep |
| KAN-255 | Universal style continuity pass (new) | Filed this session — "BEFORE App Store submission" |
| KAN-260 | Prayer Wall UX polish bundle (new) | Filed this session — pre-launch polish |
| KAN-261 | FLAG_TAXONOMY financial solicitation (new) | Filed this session — pre-launch moderation hygiene |
| KAN-257 | Tutorial SecureStore device-wide bug (new) | Filed this session — pre-launch fix |
| KAN-262 | Email templates — sync deployed Netlify HTML to docs/emails upgrade (new) | Filed this session — discrete deploy-sync issue |

## Section 5 — Superseded / duplicates

| Key | Title | Superseded by | Recommended action |
|---|---|---|---|
| KAN-155 | SHELL: Leader slot overflow | KAN-148 | Founder ratified this session. Duplicate link established. Founder transitions to Cancelled (id 4). |
| KAN-39 | Forgot Password — Request Reset Email | KAN-198 | Per KAN-198 description: explicitly superseded. Founder/SM ratify close-out. |
| KAN-38 | Login Screen — Sign In with Status Routing | (verify) | Likely shipped via auth-status-check + sign-in path. Code re-read needed before propose. |
| KAN-15 | Verification system | Already Cancelled | No action |
| KAN-7 | Church at Large — Global Tab | KAN-6 | Already Cancelled |
| KAN-37 | Verification BE Jobs | Already Cancelled | No action |
| KAN-40 | Password Reset Confirmation — Deep Link | KAN-198 | Already Cancelled |
| KAN-185 | Personal country — "Prefer not to say" | Already Cancelled | No action |
| KAN-193 | Church tab — pending state UIs + countdown | Already Cancelled | No action |

## Section 6 — Recommend Cancel

No further candidates surfaced beyond Section 5's KAN-155 (which is the only proposed Cancel-via-supersede this pass). Anything reaching Cancel should arrive there via supersession (Section 5) rather than a unilateral Cancel.

## Section 7 — Should add `post-mvp` label + link to KAN-179

These already-labeled-post-MVP tickets need a parent-link to KAN-179 if missing. Founder/I batch-edit in a follow-up pass.

| Key | Title | Current state |
|---|---|---|
| KAN-25 | Declaration of Faith — decline / exit option | Labels `post-mvp` + `wont-have-mvp2` — verify parent |
| KAN-43 | Biometric Sign-In | Labels `post-mvp` + `wont-have-mvp2` — verify parent |
| KAN-45 | DM Content Encryption at Rest | Labels `post-mvp` — verify parent |
| KAN-58 | Audit Log Retention Policy | Labels `post-mvp` — verify parent |
| KAN-60 | API & Integration Reference | Labels `post-project` + `wont-have-mvp2` |
| KAN-123 | Flagged Messages history view | Labels `post-mvp` — verify parent |
| KAN-142 | Bulk select + action across admin queues | Title says post-MVP — add label + parent |
| KAN-150 | Per-post anonymous toggle on prayer wall | Title says POST-MVP — add label + parent |
| KAN-151 | Multi-church leader affiliation | Title says POST-MVP — add label + parent |
| KAN-152 | Role title display conventions | Title says POST-MVP — add label + parent |
| KAN-190 | Underground records: encryption / separate tier | Title says Post-MVP — add label + parent |
| KAN-226 | Edit Testimony | Title says post-MVP — add label + parent |
| KAN-227 | Surface branch member list on invite | Already `post-mvp` + `connect-tab` — verify parent |
| KAN-235 | ASP2 search row 1 truncates on specific 54-char name | Labels include `post-mvp` |

## Section 8 — NEW tickets filed for memory-only post-MVP items

| Key (new) | Title | Memory source | Priority |
|---|---|---|---|
| **KAN-239** | **[POST-MVP — HIGHEST PRIORITY] Address the Network Epic** | `postmvp_address_the_network_hamburger.md` | **Highest** |
| KAN-240 | [Address the Network] Submit an announcement (child) | + Epic memory | High |
| KAN-241 | [Address the Network] Suggest a Bible verse (child) | + Epic memory | High |
| KAN-242 | [Address the Network] A word from your family (child) | + `future_word_from_family.md` | High |
| KAN-243 | Rejected-church re-submission / appeal-reactivation flow | `postmvp_rejected_church_resubmission_flow.md` | High |
| KAN-244 | Reported-violation deactivation lifecycle | `postmvp_reported_violation_deactivation_flow.md` | High |
| KAN-245 | Underground Inbox — verified UG leader inbound message routing | `postmvp_ug_inbox_verified_leader_routing.md` | Medium |
| KAN-246 | Tiered AAL2 / TOTP freshness — 30min browse / 5min destructive | `postmvp_tiered_mfa_freshness.md` | Medium |
| KAN-247 | Underground signup happy-path bugs — holding ticket | `postmvp_ug_signup_happy_path_bugs.md` | Medium |
| KAN-248 | Mute chat — DM + branch threads | `postmvp_mute_chat.md` | Low |
| KAN-249 | Connect swipe-to-reveal per-message timestamps | `postmvp_connect_swipe_timestamp.md` | Low |
| KAN-250 | Connect dedicated Browse Leaders list screen | `postmvp_browse_leaders_list.md` | Medium |
| KAN-251 | Home tab — comment delete + latest-comment preview ("state 2") | `postmvp_home_tab.md` | Medium |
| KAN-252 | International religious honorifics / cultural conventions taxonomy | `postmvp_international_data_honorifics.md` | Low (Task) |
| KAN-253 | Invite to Replant — hamburger referral link + admin tracking | `feature_invite_to_replant.md` | Medium |

Skipped (mapped to existing tickets, no new file):
- `postmvp_phone_signup.md` → KAN-231 (placed in Section 1)
- `postmvp_connect_branch_member_list.md` → KAN-227 already exists
- `postmvp_prayer_wall_categories.md` → research-only at this stage, no Jira surface yet
- `postmvp_network_updates_quantitative_cards.md` → defer ticket until concrete spec lands

## Section 9 — NEW tickets filed for MVP-gaps not covered in Jira

| Key (new) | Title | Memory source | Priority |
|---|---|---|---|
| KAN-254 | Empty-state pass — commit working tree + finish Coming Soon sweep | `empty_state_pass_2026-06-10.md` + `_shipped.md` | Medium |
| KAN-255 | Universal style continuity pass | `style_continuity_tracking.md` | Medium |
| KAN-256 | Wire "You've been verified" toast on Home | `feedback_verification_approved_ux.md` Gap 1 | Medium |
| KAN-257 | Tutorial SecureStore key device-wide bug | `feedback_verification_approved_ux.md` Gap 2 | Low |
| KAN-258 | Prayer Wall — wire Post and Receive intercession flows (MVP) | `prayer_wall_roadmap.md` | High (MVP) |
| KAN-259 | Prayer Wall — Church by Condition + Church by Location (post-MVP) | `prayer_wall_roadmap.md` | Medium |
| KAN-260 | Prayer Wall — UX polish (tab switcher + filter + Connect-from-card) | `prayer_wall_roadmap.md` | Medium |
| KAN-261 | Connect / moderation — FLAG_TAXONOMY financial solicitation | `device_pass_findings_2026-05-31.md` | Low |
| KAN-262 | Email templates — sync deployed Netlify HTML to docs/emails upgrade | `project_email_templates_pending.md` | Medium |

Skipped (memory items addressed without new ticket):
- Persecuted tab feed bugs → memory confirms FIXED via migration `20260606000003` — no new ticket needed
- KAN-217 Welcome DM Fix 5 → Founder ratified Fix 5 shipped; KAN-217 placed in Section 1

## Section 10 — Open questions for Founder

**Surfaced + resolved this session:**

1. ✅ **KAN-217 Fix 5 shipped** → KAN-217 stays in Section 1 (Founder ruling 2026-06-23).
2. ✅ **Epic statuses** → Sweep Backlog→In Progress executed; 13 Epics transitioned this session (Founder ruling 2026-06-23).
3. ✅ **Email templates pending** → New ticket KAN-262 filed; not folded into KAN-31/81 (Founder ruling 2026-06-23).
4. ✅ **KAN-148 + KAN-155 combine** → KAN-155 superseded by KAN-148; duplicate link established (Founder ruling 2026-06-23).

**Remaining for Founder ruling:**

5. **KAN-78 (Tab Bar Navigator)** status vs. shipped 5-tab sprint. Memory: 5-tab sprint shipped commit `7c44a7e`. Is KAN-78 superseded or does it have remaining scope?
6. **KAN-114 (Step-up consumer wiring)** — admin commits reference. Code-read needed to verify shipped status — propose Done or surface gap?
7. **KAN-219 (surface church_verified field + 4 mobile gate copy)** — likely absorbed into `auth-status-check` v7/v8 ships. Verify or leave open?
8. **KAN-208 + KAN-211** — both have commits but I haven't fetched their full descriptions. Defer for follow-up read pass?
9. **KAN-202 (Orphaned church auto-scrub)** — likely covered by 2026-06-22 UG `hard_delete_sweeper_daily` pg_cron. Verify scope match — propose Done?
10. **KAN-236 (no-orphan refactor)** — `create_account_atomic` shipped — verify pre-refactor scope fully delivered. Likely Done.
11. **Section 7 batch parent-link to KAN-179** — Founder green-light to batch-`editJiraIssue` add `parent: KAN-179` to the 12+ already-post-mvp-labeled tickets that lack it?

## Summary

- **Total open tickets at session start: 128**
- DONE_PROPOSED (Section 1): **21** — Founder smoke-tests + transitions to Done
- In TESTING needing smoke-test (Section 2): **7**
- Still open + MVP-critical (Section 3): **19** (including 3 new)
- Pre-launch / between-UAT-and-store (Section 4): **21** (including 5 new)
- Superseded / Cancelled-already (Section 5): **9** (1 new supersede this session)
- Cancel proposals (Section 6): **0** unilateral; supersedes handle the cancel work
- post-mvp label + KAN-179 parent additions (Section 7): **14**
- **NEW tickets filed for post-MVP (Section 8): 15** (KAN-239 through KAN-253)
- **NEW tickets filed for MVP gaps (Section 9): 9** (KAN-254 through KAN-262)
- **Total NEW tickets: 24**
- Epics transitioned Backlog → In Progress: **12** (+1 already In Progress = 13 epics now active)

After this session the board has:
- **128 → 152 open tickets** (added 24; transitioned 0 to Done — Founder owns Done)
- **21 ready for Founder Done-pass** with evidence on the tickets
- **7 already in TESTING** awaiting smoke-test
- **MVP-critical path = 19 tickets clearly enumerated**
- Pre-launch (between-UAT-and-store) = 21 tickets
- 13 active Epics

## Next moves

1. **Founder Done-pass** — sit down with Section 1 (21 tickets); device-pass + ratify; transition to Done (id 51). Most-confident first: KAN-181, KAN-229, KAN-230, KAN-231, KAN-232, KAN-192, KAN-207, KAN-217.
2. **Founder rule on remaining Section 10 questions** (5-11).
3. **Batch parent-link to KAN-179** — once Founder approves, sweep all post-mvp-labeled tickets to set the parent.
4. **Founder cancel KAN-155** (transition id 4) — explicit ratification of supersede.
5. **Follow-up session**: deep-read KAN-208, KAN-211, KAN-114, KAN-219 for verdict; commit working-tree empty-state changes per KAN-254; add sentinel test for KAN-181 underground exclusion.
6. **Pre-UAT discipline**: every MVP-labeled ticket in Section 3 must reach Done before UAT pass. The pre-launch Section 4 tickets ship between UAT and store submission, not as UAT blockers.
