# Connect + Moderation cluster — audit verdicts (2026-07-02)

## KAN-166 — CONTENT+FE: Community covenant notice — Connect tab first-DM gate copy
CURRENT LANE: Backlog
VERDICT: BUILT
EVIDENCE:
- `src/components/connect/CovenantNotice.tsx:1-79` — one-time modal fires on leader's FIRST send attempt EVER (per-account flag, not per-conversation); requires "I understand" tap; Android hardware-back is an explicit no-op (:48-50) — cannot dismiss without acknowledging (AC 1, 2, 5). File header records Founder-ratified C2 device-pass copy replacing prototype lines (AC 3, 4): "Connect is a room of trust." + Colossians 4:6.
- `src/components/connect/DMThreadView.tsx:820-842` — `attemptSend` blocks send until `covenantAcknowledged`, parks the draft, shows the notice; covers both regular DMs and connection requests (Leaders sub-tab only). `BranchThreadView.tsx:1122` has only the persistent `CovenantStrip` — matches BA scope-boundary comment (modal ≠ strip/footer, Ministries not gated).
- `src/screens/main/ConnectScreen.tsx:112,269-286` — `covenant_ack` flag read/written via SecureStore; header (:19-23) documents the SEC rationale (SecureStore not AsyncStorage; plaintext below the persecuted-leader bar). AC 6 storage mechanism resolved as a device-local SecureStore flag (neither of the two options the ticket named); `covenant_ack` is a locked project invariant.
- Deviation (minor): flag is device-local — app reinstall/new device re-prompts once. AC said "never appears again for that user"; actual is per-account-per-device. Fires on first send attempt rather than first compose-open — substantively equivalent (message cannot be sent unacknowledged).
MISSING: n/a (no formal SEC stamp comment exists on the ticket itself; the storage decision is documented in code + invariant memory)
DEPLOYED: mobile-tree (on mobile origin/main; ships with any current Expo build — copy was ratified on-device at C2 pass)
NEEDS-LIVE-DB: none
NEEDS-SIM: fresh account (or wipe SecureStore): first DM send shows notice once, blocks until "I understand", never re-shows; branch composer never shows it
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- One-time Covenant Notice modal shipped in `CovenantNotice.tsx` (KAN-70/HANDOFF §6.4 build); gates first-ever send in DMThreadView (`attemptSend` blocks until acknowledged); hardware-back no-op — acknowledgement mandatory
- Copy Founder-ratified at C2 device pass ("Connect is a room of trust." + Col 4:6 KJV); prototype lines removed
- Flag stored as `covenant_ack` in SecureStore (Keychain/EncryptedSharedPrefs) — SEC rationale documented in ConnectScreen header; device-local, so reinstall re-prompts once
- Scope boundary honored: modal gates Leaders-sub-tab sends only (incl. connection requests); Ministries/branches carry the persistent CovenantStrip instead (KAN-68/70 scope)
- Ticket sits in Backlog but the work is built and on the mobile tree — recommend moving to Testing for a fresh-account device pass

## KAN-215 — [KAN-33] Connect — RPL Network ID search predicate on search_leaders + get_invite_candidates + FE placeholder swap
CURRENT LANE: TESTING
VERDICT: BUILT (AC 3 SUPERSEDED by 2026-06-08 Founder ruling; one live-DB confirm outstanding before Done)
EVIDENCE:
- `supabase/migrations/20260608000001_fix_search_leaders_rpc.sql:115-126` (mirrored = applied on prod) — current `search_leaders`: `c.church_code ILIKE '%' || p_query || '%'` predicate live (AC 1); 2-char floor retained (:76-78, AC 6); ILIKE = case-insensitive (AC 7). Semantics evolved: church-NAME search removed entirely; name-match excludes underground; RPL ID is now the ONLY discovery vector for underground leaders, with church_name masked to macro-region label (:100-107).
- AC 3 as written (exclude underground from church_code match) was implemented in the live-applied `kan215_rpl_search_predicate_v1` (20260529203248, DBA build summary c.15065 + SEC stamp c.15064), then deliberately REVERSED by Founder ruling 2026-06-08: underground is intentionally discoverable by RPL Network ID (masked). SUPERSEDED, not a regression — `.claude/plans/underground-flow.md` panel table confirms "Connect search-by-RPL-ID result: show name (brave) / never name-searchable".
- AC 2: `get_invite_candidates` church_code arm applied live 2026-05-29 via MCP (not mirrored in repo); later live-only migration `underground_safety_hardening_v1` (2026-06-20, also not mirrored — see `.claude/plans/handoff-2026-06-22-morning.md:34`) changed it to hard-exclude underground. Current live predicate shape not verifiable from repo.
- AC 4: `src/components/connect/LeaderSearch.tsx:209` placeholder is "Find a leader"; the RPL semantic ships as hint copy (:226-228) "Search by a leader's name or RPL Network ID." — intent delivered, exact placeholder copy not swapped. AC 5: `src/components/connect/BranchCreate.tsx:312` placeholder "Search by name or RPL Network ID" ("ministry" word dropped vs AC copy). Stale in-code comment (:304-307, dated 2026-05-29 bd68eb3) claims the RPC lacks church_code matching — written pre-apply, superseded.
- Outstanding gate the ticket's own 2026-06-25 comment sets: Founder-ratified 2026-06-22 tightening (underground church_code substring → EXACT equality; drop `underground` boolean from return shape) is NOT in the repo mirror; `handoff-2026-06-22-morning.md:139` still lists it as pending polish. Must be confirmed live before Done.
MISSING: live confirmation of (a) exact-equality tightening on underground church_code in `search_leaders`, (b) `get_invite_candidates` current predicate (underground hard-exclusion + whether church_code arm survived `underground_safety_hardening_v1`)
DEPLOYED: DB = yes (live; 20260608000001 mirrored, kan215/hardening MCP-applied); FE = mobile-tree
NEEDS-LIVE-DB: `SELECT pg_get_functiondef('public.search_leaders(text)'::regprocedure); SELECT pg_get_functiondef('public.get_invite_candidates(text)'::regprocedure);` — check church_code arm shape (ILIKE substring vs `=`), underground handling in both
NEEDS-SIM: Connect search: leader name → no underground rows; full RPL ID of a surface church → returns leaders; full RPL ID of a verified underground → masked row (region label / name per show_church_name); partial code fragment (e.g. "02075") → per whatever the live predicate shape turns out to be
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- `search_leaders` RPL Network ID predicate live via mirrored migration `20260608000001_fix_search_leaders_rpc.sql` (church_code ILIKE; name search excludes underground; underground church_name masked to macro-region label)
- Original AC 3 (exclude underground from church_code match) superseded by Founder ruling 2026-06-08: RPL ID is deliberately the only discovery vector for underground; original exclusion shipped 2026-05-29 then reversed
- `get_invite_candidates` church_code arm applied live 2026-05-29 (`kan215_rpl_search_predicate_v1`), then modified by live-only `underground_safety_hardening_v1` (2026-06-20, hard-excludes underground) — neither mirrored to repo; live body needs one pg_get_functiondef check
- FE: BranchCreate placeholder "Search by name or RPL Network ID" shipped; LeaderSearch keeps "Find a leader" placeholder with hint line "Search by a leader's name or RPL Network ID."
- Blocker to Done (per ticket's own 2026-06-25 comment): confirm the 2026-06-22 exact-equality tightening on underground church_code is actually live — no repo migration carries it and the 2026-06-22 handoff still lists it as pending
- Stale code comment in BranchCreate (:304) claiming the RPC lacks church_code matching predates the 2026-05-29 apply — ignore

## KAN-216 — [KAN-33] Connect — Precise unread counts for Leaders thread list via get_leader_thread_list RPC
CURRENT LANE: TESTING
VERDICT: BUILT
EVIDENCE:
- RPC live and evolved: created 2026-05-29 (`kan216_get_leader_thread_list_v1`, MCP-applied, SEC 5/5 stamps c.15064, smoke-verified in DBA c.15065); current body mirrored in `supabase/migrations/20260609000005_fix_get_leader_thread_list_plpgsql_ambiguity_v1.sql` — server-computed `unread_count` subquery (AC 1), 'Underground Church' masking (:87-88, AC 2), 'Replant Team' literal + LEFT JOIN (:79-80, OQ-2), verified-active caller gate raising `not_authorized`, secure thread pinned first via grp=0 (:181-185, AC 3 — sort evolved: secure 0 → incoming request 1 → unread 2 → read 3 → pending/declined/expired), raw fields for FE displayHelpers (AC 4).
- AC 5 FE consumer swap: `src/components/connect/LeadersList.tsx:525` calls `supabase.rpc('get_leader_thread_list')`; precise badge count rendered (:236-238). `src/hooks/useConnectUnreadBadge.ts:72-89` aggregates unread_count across thread list + branch list for the Connect tab badge.
- AC 6: `src/components/connect/DMThreadView.tsx:618` (`mark_conversation_read` on thread open) + `:668` (on inbound message while viewing); write path unchanged.
- AC 8: composite index `messages_conversation_id_created_at_idx` applied live 2026-05-29 within the kan216 migration (SEC stamp item 5) — not mirrored in any repo migration file (mirror gap only).
MISSING: n/a
DEPLOYED: DB = yes; FE = mobile-tree
NEEDS-LIVE-DB: optional belt-and-suspenders (index was MCP-applied, never mirrored): `SELECT indexname FROM pg_indexes WHERE tablename='messages' AND indexname='messages_conversation_id_created_at_idx';`
NEEDS-SIM: thread with 3 unread → badge "3"; open thread → badge clears on return to list; new inbound on closed thread → badge increments; underground counterpart shows "Underground Church"; Replant Team thread pins to top
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- `get_leader_thread_list()` live since 2026-05-29 (SEC 5/5 stamps, DBA smoke: unread_count=1 server-computed); current body mirrored at `20260609000005` after Connect Day-5 row_kind extension + ambiguity fix
- FE fully swapped: LeadersList renders precise per-thread counts from the RPC; useConnectUnreadBadge sums thread + branch unread for the tab badge; DMThreadView fires mark_conversation_read on open and on inbound-while-viewing
- Underground masking, Replant Team literal, secure-thread pinning, and raw-fields display contract all present in the live body
- AC 8 composite index applied live 2026-05-29 but never mirrored to repo migrations — one optional pg_indexes check if desired
- Remaining gate is the Founder 3-step smoke (3 unread → decrement → clear) from the 2026-06-25 board comment

## KAN-220 — Replant Team Inbox — Admin read & reply interface
CURRENT LANE: TESTING
VERDICT: BUILT
EVIDENCE:
- Admin origin/main (= deployed): `src/screens/PastoralQueue.jsx` — Team Inbox tab (header comment :2, `TeamInboxTab` :295, tab :1302, `sendTeamReply(id, text, attribution)` :370 — attribution param already on main); `src/screens/NetworkOverview.jsx:66,115,176,340` — Needs Attention "Replant Team Inbox" card; `netlify/functions/send-team-reply.js` + `list-team-inbox.js` present on origin/main. PRs #64 (build), #65 (profile-load + styling fixes), #66 (role wire shape + leader-replied-only filter) all merged.
- AC-6 audit action: `replant_team_reply_sent` present in the live `audit_log_action_check` constraint — restated in mirrored migrations up through `20260701000010_manager_review_state_and_columns.sql:75`.
- Mobile delivery of admin replies: `supabase/functions/send-message/index.ts:615-626` /internal boot (KAN-217 SEC posture, X-Internal-Token + X-Replant-Internal, internal-handler.ts); leader receives via DMThreadView Realtime subscription (:632-673); thread list renders 'Replant Team' via RPC literal; Replant Team thread chrome (RpMark head icon, "First · REPLANT TEAM" attribution, Official label) commits d39daf5 + 4438988 on mobile origin/main.
- Feature-branch-only (NOT deployed): `src/components/TriageTabBar.jsx` Team Inbox badge fix on `feat/flagged-mirror-pastoral` — deployed main filters `c?.unread_count > 0` but `list-team-inbox.js` (origin/main) returns no `unread_count` field, so the deployed triage-tab badge count is always 0; the branch derives "awaiting admin reply" from latest-message sender. In-tab unread dots and the page counter use last-sender derivation and work on main.
- AC-5 deviation (documented CC decision, PR #64 comment): no server-side mark-read; unread derived client-side from last sender.
DEPLOYED: yes (all core surfaces on origin/main) — except the TriageTabBar Team Inbox badge-count fix: feature-branch-only
NEEDS-LIVE-DB: none
NEEDS-SIM: admin device pass per 2026-06-25 comment: profiles load in Inbox tab, read + reply, reply lands in leader's Connect thread via Realtime, styling matches the standalone HTML reference
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- All three surfaces deployed on admin origin/main: Pastoral Team Inbox tab, Network Overview stat card, `send-team-reply` + `list-team-inbox` Netlify functions (PRs #64/#65/#66 merged)
- `replant_team_reply_sent` audit action live in `audit_log_action_check` (restated through migration 20260701000010); audit-first write order enforced in send-team-reply
- Mobile side wired end-to-end: /internal route on send-message (KAN-217 auth posture), Realtime delivery into DMThreadView, Replant Team thread pinned + branded (RpMark icon + admin first-name attribution, commits d39daf5/4438988 on mobile main)
- Known deployed defect: triage tab-bar Team Inbox badge always reads 0 (filters on an `unread_count` field list-team-inbox never returns); fix exists only on in-flight branch `feat/flagged-mirror-pastoral` (HEAD 1e9714e) — not deployed
- AC-5 shipped as client-side last-sender unread derivation; server-side mark-read consciously deferred (CC note on PR #64)

## KAN-261 — Connect / moderation — extend FLAG_TAXONOMY to cover financial solicitation
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- `financial_solicitation` string appears NOWHERE in either repo (mobile src/, supabase/, admin src/) — grep clean.
- No leader-facing flag UI exists in mobile at all: no `FlagMessageModal`, no long-press report action in any Connect component — the ticket's premise ("a leader hitting Flag... falls into other") describes a surface not yet built.
- What already exists: taxonomy v1.0.0 has `fundraising` + `financial_exploitation` auto-codes (T3, admin routing) — `flag_taxonomy_secret.json` (both 0 patterns) and `supabase/functions/_shared/taxonomy-codes.ts:24-25`; admin chip labels present (`replant-admin/src/lib/taxonomy.js:79-80` 'Fundraising' / 'Financial Exploitation'), so scope item 3 (admin renders category) is pre-satisfied for those codes.
- KAN-291's SME wordlist draft already authors starter patterns for both codes (`.claude/plans/sme-synthesis-wordlist.md:539` fundraising, `:575` financial_exploitation 419/advance-fee) — the AUTO-detection half of this gap ships with the KAN-291 wordlist; the manual leader-flag-reason half is blocked on a leader flag UI existing.
MISSING: all four scope items as written (financial_solicitation flag reason, leader-facing bucket, Founder copy ratification); scope item 1 (taxonomy audit) has effectively been performed by KAN-291's filing
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- No `financial_solicitation` code or copy exists anywhere in mobile or admin repos
- No leader-facing "Flag message" UI exists in the mobile app — the manual-flag premise of this ticket depends on a surface that is itself unbuilt
- Taxonomy v1.0.0 already carries `fundraising` + `financial_exploitation` auto-codes (0 patterns) with admin chip labels in place; KAN-291's SME wordlist draft includes starter patterns for both
- Recommend re-scoping: fold the auto-detection half into KAN-291's wordlist ship; keep this ticket for the leader-facing manual flag reason once a flag UI ticket exists

## KAN-290 — Mobile DM thread: duplicate-key React warning on double-send (optimistic + Realtime collision)
CURRENT LANE: In Progress
VERDICT: PARTIAL
EVIDENCE:
- Pre-existing mitigations (all landed BEFORE the 2026-06-30 bug report, so they demonstrably do not close it): Realtime INSERT handler dedupes by id against `messagesRef` (`src/components/connect/DMThreadView.tsx:653-657`, commit 931ca3b 2026-05-29); optimistic rows use `opt-` prefixed local ids (:717-719); send reconcile syncs `messagesRef` inside the setState updater so a Realtime echo arriving AFTER the HTTP response dedupes correctly (:764-783, commit 2f9c1e4 2026-06-09).
- Open race (matches the reported repro): when the Realtime INSERT arrives BEFORE the send-message HTTP response resolves, the ref still holds only `opt-` ids → dedupe misses → Realtime appends the UUID row; the reconcile then remaps the optimistic row to the SAME `result.id` with no already-exists guard (:770-780) → two children with one key. Double-send in quick succession makes this ordering likely (second HTTP response delayed behind prompt Realtime broadcasts).
- No fix since the report: the only DMThreadView commits after 2026-06-30 are d39daf5 (KAN-296 attribution) and 4438988 (Replant Team chrome) — neither touches message reconciliation.
MISSING: dedupe guard in the send-reconcile updater — if `prev` already contains `result.id` (Realtime won the race), drop/merge the optimistic row instead of remapping it to a duplicate id
DEPLOYED: mobile-tree (current mitigation only; the outstanding fix is unwritten)
NEEDS-LIVE-DB: none
NEEDS-SIM: throttle network (slow 3G), send two DMs in rapid succession → confirm the duplicate-key warning still fires when Realtime beats the HTTP response; retest after the reconcile guard lands
RECOMMENDED LANE: In Progress
COMMENT-FACTS:
- Realtime-side dedupe + `opt-` ids + ref-sync-inside-updater all predate the 2026-06-30 repro (commits 931ca3b / 2f9c1e4) — the collision the Founder hit is a different ordering
- Root cause isolated: reconcile step (DMThreadView.tsx:770-780) remaps the optimistic row to `result.id` without checking whether Realtime already inserted that UUID → duplicate key when Realtime beats the HTTP response
- One-line class of fix: in the reconcile updater, if `prev.some(m => m.id === result.id)`, remove the optimistic row instead of remapping
- No commit since the report touches this path; In Progress is the correct lane

## KAN-291 — FLAG_TAXONOMY wordlist incomplete — 11 auto-codes empty (incl. safety-critical self_harm + pastoral_care_signal)
CURRENT LANE: Backlog
VERDICT: NOT_BUILT (gap confirmed exactly as filed; SME drafting done, nothing shipped)
EVIDENCE:
- `flag_taxonomy_secret.json` (taxonomy_version 1.0.0, mtime May 11 — untouched): direct count confirms the ticket precisely — 10 T1 auto-codes populated (location_disclosure 20, identity_probe 27, opsec_violation 26, recantation_pressure 27, slander_or_gossip 20, bribery_attempt 22, duress_signal 18, imminent_threat 37, urgent_safety_request 31, self_harm_indicator 30); 11 auto-codes at ZERO patterns (false_teaching, divisive_speech, spiritual_coercion, threats, hate_or_targeting, fundraising, financial_exploitation, external_link, spam_pattern, **self_harm**, **pastoral_care_signal**); 3 manual codes 0 by design. 21 auto + 3 manual = 24 codes total.
- Drift confirmed: BE mirror `supabase/functions/_shared/taxonomy-codes.ts` = TAXONOMY_VERSION "1.0.0"; admin FE mirror `replant-admin/src/lib/taxonomy.js:17` = '1.1.0' on BOTH origin/main and the feature branch.
- SME panel output EXISTS but is unshipped: `.claude/plans/sme-synthesis-wordlist.md` (v0.draft; source-prefix posture LOCKED 2026-06-30) — starter pattern sets drafted for all 11 codes incl. self_harm (:92) and pastoral_care_signal (:143), sourced from C-SSRS/Joiner/QPR + BITE/Lifton + IC3/OWASP etc.; ruling flips only `false_teaching` auto→manual. Its own AC-12 instruction (transfer into the secret JSON, bump to 1.1.0, regenerate taxonomy-codes.ts, delete the draft) has NOT been executed: secret JSON still 1.0.0, taxonomy-codes.ts still 1.0.0 with false_teaching still `auto`, draft file still present.
- No temp debug edge function exists in `supabase/functions/` (fix-path step 1 "confirm live FLAG_TAXONOMY state" not in tree).
- Deliverability unaffected (DELIVER-ALWAYS): `send-message/taxonomy.ts` header — empty pattern sets simply never fire; safety implication stands: standard-tier pastoral language only routes if the more-explicit T1 `self_harm_indicator` (30 patterns) matches.
MISSING: fix-path steps 1 and 3–7 in full — live-state confirm, pattern transfer + version bump (to 1.2.0 per ticket, since admin mirror already claims 1.1.0), regenerate BE mirror + align admin mirror, upload FLAG_TAXONOMY secret, redeploy send-message + send-branch-message, per-category smoke
DEPLOYED: n/a (nothing shipped; live secret presumed 1.0.0 = local JSON, unconfirmed)
NEEDS-LIVE-DB: not SQL-checkable — FLAG_TAXONOMY is an edge-function secret; confirm live version/pattern counts via the one-shot debug edge function the ticket describes (or Supabase Dashboard secret inspection), then delete it
NEEDS-SIM: post-ship only: send test DMs matching one pattern per newly populated code; verify self_harm/pastoral_care_signal route to Pastoral Queue and T3 codes to admin Flagged
RECOMMENDED LANE: To Do
COMMENT-FACTS:
- Ticket's counts verified exact against `flag_taxonomy_secret.json` v1.0.0: 11 of 21 auto-codes have zero patterns, including safety-critical `self_harm` and `pastoral_care_signal`; only the 10 T1 codes are populated
- Version drift confirmed: BE mirror 1.0.0 vs admin FE mirror 1.1.0 (on deployed main and the feature branch alike)
- SME mini-panel (fix-path step 2) is DONE — `sme-synthesis-wordlist.md` drafted starter sets for all 11 codes with locked posture rulings 2026-06-30 (only `false_teaching` flips to manual)
- Nothing shipped: secret JSON untouched since May 11, no version bump, no regenerated mirrors, no redeploy, no live-state debug check in tree
- Safety-critical + pre-launch per G-25 (wordlist required before go-live); with the panel complete this is execution-ready — recommend Backlog → To Do
