# Cluster: escalated-pastoral (KAN-292..297)

Attribution baseline: admin deployed truth = `origin/main` @ 1108fe5 (includes PR #71 905a90b "feat(escalated-cases): Phase 3 BE + Phase 4 admin FE (KAN-293/295/296/292)"). Feature branch `feat/flagged-mirror-pastoral` (HEAD 1e9714e) is +3 commits / -1 behind main; its delta touches ONLY `src/screens/Flagged.jsx`, `src/components/flagged/FlaggedCloseCaseModal.jsx` (new), `src/components/TriageTabBar.jsx`. All escalated-cases DB migrations (20260701000001–000011) are mirrored in `/Users/ife/replant/supabase/migrations/` = applied on prod.

## KAN-292 — Escalate: per-tier verb + gate (regulars "Escalate to Manager", Manager+SA "Move to Escalated Inbox")
CURRENT LANE: In Progress
VERDICT: PARTIAL
EVIDENCE:
- `origin/main:src/screens/PastoralQueue.jsx:167-168` — deployed tier-aware verb in TriageDrawer: `isManager = viewerTier === 'top_tier'; escalateLabel = isManager ? 'Move to Escalated' : 'Escalate to Manager'`. NOTE: ticket letter grouped super_admin WITH Manager; deployed code groups SA below Manager (SA sees "Escalate to Manager"). The flip was a deliberate in-PR-71 commit ("fix(pastoral): flip Escalate label — Manager 'Move to Escalated', below-Manager 'Escalate to Manager'"), Founder-smoked + Founder-merged. Two stale comments in the same deployed file (lines ~160-162, ~865-866) still describe the opposite grouping.
- `origin/main:src/screens/Flagged.jsx:234` — Flagged escalate button is STATIC `'Move to Escalated'` for ALL tiers on deployed main. The per-tier verb on Flagged exists only on the feature branch (`HEAD:src/screens/Flagged.jsx:58-60`, new TriageDrawer mirroring Pastoral) = NOT deployed.
- BE accepts escalation from any tier per ticket ruling: `verifyAnyAdmin` in `origin/main:netlify/functions/triage-pastoral-action.js:156` and `escalate-flag.js:43`; both now require category (5-token enum) + ≥30-char context (KAN-293 extension) and INSERT an `escalated_cases` row.
- "Hide from regulars" scope bullet resolved by locked access matrix: `/triage` (Pastoral/Flagged/Team-Inbox) stays all-admin via plain `protect()` (`origin/main:src/App.jsx:164`); only `/triage/escalated` is tier-gated. Regulars keep the escalate affordance by design (locked Escalated Cases workflow: regulars escalate up, locked out post-escalate — escalated rows leave both regular queues via `flag_status IS NULL` filter and moderation_state disposition).
- Optional audit verb distinction NOT built; worse, both endpoints hardcode `escalated_by_tier: 'regular'` (`triage-pastoral-action.js:342`, `escalate-flag.js:151`) — a Manager/SA escalation is recorded as tier 'regular' in escalated_cases (data-accuracy nit, no privilege impact; DDL has no CHECK on the column).
MISSING: Flagged per-tier verb (feature-branch-only, not deployed); optional audit meta verb distinction (`escalate_to_manager` vs `move_to_escalated_inbox`) not written; `escalated_by_tier` hardcoded 'regular' regardless of actual tier.
DEPLOYED: yes (Pastoral half) / feature-branch-only (Flagged half)
NEEDS-LIVE-DB: optional — `SELECT escalated_by_tier, count(*) FROM escalated_cases WHERE auto_routed = false GROUP BY 1;` (confirms the hardcoded-'regular' pattern on prod rows) | otherwise none
NEEDS-SIM: none (label logic is statically readable)
RECOMMENDED LANE: In Progress
COMMENT-FACTS:
- Pastoral drawer per-tier verb DEPLOYED via PR #71: Manager → "Move to Escalated", regular + super_admin → "Escalate to Manager" (PastoralQueue.jsx:167-168).
- Deployed grouping deviates from ticket letter for super_admin (ticket: SA with Manager; shipped: SA below Manager) — deliberate later flip commit inside PR #71, Founder-smoked and Founder-merged.
- Flagged surface on deployed main shows static "Move to Escalated" for all tiers (Flagged.jsx:234); the tier-aware Flagged drawer exists only on in-flight branch feat/flagged-mirror-pastoral.
- BE gate per ticket: any tier may escalate (verifyAnyAdmin), now with required category + ≥30-char context; escalated_cases row inserted on both paths.
- Defect: both escalate endpoints hardcode escalated_by_tier='regular' (triage-pastoral-action.js:342, escalate-flag.js:151); optional per-verb audit meta not implemented.
- Two stale code comments in deployed PastoralQueue.jsx state the pre-flip (opposite) tier grouping.

## KAN-293 — NEW SURFACE: Manager-only "Escalated Inbox" (aggregates flagged + pastoral escalations)
CURRENT LANE: Backlog
VERDICT: BUILT
EVIDENCE:
- Shipped as "Escalated Cases" — 4th tab under the Pastoral Care parent (naming per locked 2026-06-30 workflow). FE: `origin/main:src/screens/EscalatedCases.jsx` (332 lines; From Pastoral section renders first, then From Flagged) + `EscalatedCaseDrawer/ReachOutModal/ProposeActionModal/ApproveProposalModal/CloseCaseModal/EscalateThisCaseModal` under `src/components/escalated/` + `TriageSurface.jsx` + `TriageTabBar.jsx` — all on origin/main (PR #71, merged by Founder after preview smoke).
- Tier gate enforced 3-deep: nav tab hidden for regulars (`TriageTabBar.jsx:29` `requiresTier: 'super_admin'` + `:79-81` `tierAtLeast`), route wrapped (`App.jsx:177` `protectSuperAdmin(<EscalatedCases/>)` → calm TierRestricted), BE `list-escalated-cases.js` `assertAtLeast('super_admin')` + AAL2 browse + 60/min rate limit + audit-first `escalated_inbox_opened` (tier-denied path also audited) + UG dual-source filter with bucketed `omitted_underground_count`.
- Aggregation + UG invariant: reads `v_escalated_inbox` (migrations 20260701000005/000009/000010, enriched view mirrored = prod); UG-touched messages auto-route to escalated_cases at write-time via `fn_auto_route_ug_flagged` + `fn_auto_route_ug_pastoral` triggers (migration 20260701000003 + 3b); `list-pastoral-queue.js:134-141` and `list-flagged-messages.js:222-226` exclude UG rows unconditionally.
- Manager actions wired: Reach out (`reach-out-to-leader-from-case.js` — SA+, 1/24h per leader, UG-target requires UG admin, always attributes "<First> from Replant Team"); Restrict/Revoke via propose→approve ceremony — `propose-escalated-action.js` (SA+, ≥2-Managers hard floor:152-163, 23505 race guard, `escalate_to_manager` branch → `manager_review` state:186-215) and `approve-escalated-proposal.js` (Manager-only `assertAtLeast('top_tier')`:75, AAL2 sensitive + action-bound step-up:92-97, BE self-approve block:122 with DB CHECK `ecp_no_self_approve` + partial-unique `uniq_ecp_one_pending_per_case` as safety nets); `reject-escalated-proposal.js`; `close-escalated-case.js` (8-token disposition + ≥30-char note).
- Destructive execution (revoke/temp-restrict) intentionally returns 501 until the Leader Suspension Lifecycle ticket lands (scope-split 2026-06-30) — approve path humanizes the 501; this is by-design, not a miss.
- Pre-build process satisfied: SME manifest + CD scaffolds referenced throughout code; DBA lane migrations 20260701000001–000011 mirrored (= applied on prod).
MISSING: n/a (destructive execution is deliberately stubbed pending the separate Suspension Lifecycle ticket)
DEPLOYED: yes
NEEDS-LIVE-DB: none (migrations mirrored per brief rule)
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- Shipped in PR #71 (905a90b) as "Escalated Cases", 4th tab under Pastoral Care; deployed on main after Founder preview smoke + self-merge.
- Tier gate 3-deep: tab hidden (tierAtLeast super_admin), route protectSuperAdmin, BE assertAtLeast('super_admin') + AAL2 + 60/min + audit-first escalated_inbox_opened incl. tier-denied writes.
- Aggregates both axes via v_escalated_inbox; UG-touched exchanges auto-route past Pastoral/Flagged via DB triggers (migration 20260701000003) and are unconditionally excluded from the regular queues.
- Full ceremony live: reach out (1/24h, attributed), propose (≥2-Managers floor, race-guarded), approve (Manager-only, step-up-bound, self-approve blocked BE + DB CHECK), reject, close (disposition + ≥30-char note).
- Destructive execution 501-stubbed by design pending the Leader Suspension Lifecycle ticket (scope-split 2026-06-30).
- DB layer (escalated_cases, proposals, view, triggers, audit CHECK extension) mirrored in mobile-repo migrations 20260701000001–000011 = applied on prod.

## KAN-294 — Copy: "Escalate to admin" → per-tier verbs
CURRENT LANE: In Progress
VERDICT: PARTIAL
EVIDENCE:
- `git grep "Escalate to admin"` on origin/main across src + netlify: 0 hits; same on feature-branch HEAD: 0 hits. The ambiguous copy is fully gone from both trees.
- Pastoral per-tier verbs deployed (PastoralQueue.jsx:167-168). "Inbox" suffix dropped intentionally — surface shipped as "Escalated Cases", so Manager copy is "Move to Escalated".
- Flagged deployed button is tier-invariant "Move to Escalated" (Flagged.jsx:234); regulars-see-"Escalate to Manager" on Flagged exists only on the feature branch (HEAD Flagged.jsx:58-60).
- Internal canonical `escalate_to_admin` retained per the ticket's own allowance (`src/lib/admin-form.js:70-75`, BE triage action enum); humanizer entries added in both action-names.js twins (FE `src/lib/action-names.js:140` APPROVE_ESCALATED_PROPOSAL descriptor; BE CJS twin per PR #71).
- Same super_admin grouping deviation as KAN-292 (SA sees "Escalate to Manager", not "Move to Escalated") — deliberate in-PR flip, Founder-merged.
MISSING: Flagged per-tier label (rides the in-flight feat/flagged-mirror-pastoral branch; not deployed).
DEPLOYED: yes (all deployed surfaces clean) / feature-branch-only (Flagged tier verb)
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: In Progress
COMMENT-FACTS:
- Zero "Escalate to admin" strings remain on deployed main or the in-flight branch.
- Pastoral drawer copy is tier-aware and deployed; "Move to Escalated Inbox" shipped as "Move to Escalated" (surface named Escalated Cases).
- Flagged still shows one static "Move to Escalated" for all tiers on prod; the per-tier Flagged drawer is on the Founder's in-flight branch only.
- Canonical action name escalate_to_admin retained internally per ticket; audit humanizers extended for the new escalated actions.
- Ships together with KAN-292 as specced — both complete when feat/flagged-mirror-pastoral merges.

## KAN-295 — Pastoral Dispose/close: confirmation modal with required reason
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- Confirmation modal EXISTS + deployed: `origin/main:src/components/pastoral/PastoralCloseCaseModal.jsx` (PR #71), invoked from the TriageDrawer "Close Case" button (renamed from "Dispose / close"); ceremony body copy ("hold {First} in prayer… Ask the Holy Spirit for guidance") Founder-ratified 2026-07-01 evening per component header.
- Required reason NOT built — by explicit comment in the deployed component: "Note is optional — the pastoral audit records 'closed' disposition without requiring a reason." No structured reason dropdown, no min-length. (Contrast: the Escalated-surface `close-escalated-case.js` DOES enforce an 8-token disposition + ≥30-char note — the ticket's desired pattern exists one surface over.)
- DEFECT — optional note is silently dropped: FE sends `{ note }` (`PastoralCloseCaseModal.jsx` → `triagePastoralAction(row.message_id, 'dispose_close', extras)`; `api.js:273-274` spreads extras into the POST body), but deployed `netlify/functions/triage-pastoral-action.js` contains ZERO occurrences of `note` — the body destructure reads only `{messageId, action, escalationReason, escalationReasonCategory, escalationContext, deferUntilTs}`. The typed note never reaches audit meta or moderation_state.meta, while the success screen tells the admin "Recorded to the audit log."
- Feature branch adds `FlaggedCloseCaseModal.jsx` (mirror ceremony for Flagged; its note field is honestly commented "reserved for BE-side extension; clearFlag currently accepts no note") — branch-only.
MISSING: required structured reason (dropdown + freeform + min length); BE `disposeReason` required field + scrubAndCap + persistence; audit `pastoral_signal_dispositioned` meta extension with `dispose_reason`. Plus fix for the silent note-drop (FE offers a field the BE discards).
DEPLOYED: yes (modal as-shipped is deployed; the unmet items don't exist on any branch)
NEEDS-LIVE-DB: optional — `SELECT meta FROM audit_log WHERE action='pastoral_signal_dispositioned' AND meta->>'triage_action'='dispose_close' ORDER BY created_at DESC LIMIT 5;` (confirms no note key ever persisted) | otherwise none
NEEDS-SIM: none
RECOMMENDED LANE: In Progress
COMMENT-FACTS:
- Confirmation modal shipped + deployed in PR #71 as "Close Case" (PastoralCloseCaseModal) with Founder-ratified prayer-encouragement ceremony copy.
- Reason capture NOT shipped: field is explicitly optional in the deployed component; no dropdown, no min-length — the ticket's required-reason A/C is unmet.
- Live defect: the optional note the FE sends is silently ignored by triage-pastoral-action.js (BE never reads `note`); success copy claims it was recorded.
- The desired pattern already exists on the sibling surface (close-escalated-case.js: 8-token disposition + ≥30-char note) — small lift to port.
- Branch-only FlaggedCloseCaseModal mirrors the ceremony for Flagged (not deployed; clearFlag accepts no note either).

## KAN-296 — Pastoral "Reach out": pick channel + wire
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- Channel DECIDED + WIRED end-to-end: Option B (Connect DM in the Replant Team thread) won over the Founder's email lean, per the locked 2026-06-30 workflow. Deployed on main: `PastoralReachOutModal.jsx` (real composer + "Reply as" segmented toggle: generic "Replant Team" vs personalized "<First> from Replant Team") → `reach-out-to-leader-from-message.js` (any tier, AAL2 regular-destructive, per-leader 1/24h Upstash limit, UG-target requires UG admin, 404 `welcome_dm_missing` when no Replant Team conversation exists, audit-first `pastoral_reach_out_dm_sent`) → on success `PastoralQueue.jsx:1455-1464` fires `triagePastoralAction('reach_out')` to record the disposition and remove the row (partial-failure = signal stays open, re-actionable).
- Escalated-surface sibling deployed: `reach-out-to-leader-from-case.js` (SA+ gate, same 1/24h + UG posture, ALWAYS attributes caller first name per locked "Admin Name from Replant Team" ruling); `send-team-reply.js:73-95` accepts optional `attribution_display_name` (≤64 chars) and writes the column.
- DB: `messages.attribution_display_name` (migration 20260701000007) + leader-reply auto-flip trigger `fn_flip_escalated_case_on_leader_reply` (20260701000011) — mirrored = prod.
- MOBILE slot shipped: `src/components/connect/DMThreadView.tsx:258-266` renders the attribution eyebrow on first-of-cluster inbound Replant Team bubbles; column selected at :587 and plumbed through Realtime at :651. Commits 4438988 + 1a8be6c are on mobile origin/main (`git branch -r --contains` confirms) — reaches devices only after the next Expo build.
- GAP: deployed UI copy promises "auto-email fallback at 7 days if no reply" (`EscalatedCaseDrawer.jsx:101`; `ReachOutModal.jsx:6` comment "fires server-side") — NO such job exists in either repo: only scheduled functions on main are the two UG-evidence scrub daemons (netlify.toml), and no pg_cron/fallback-sender appears in any migration or function. The locked workflow's email-fallback leg is unbuilt; shipped copy overstates.
MISSING: 7-day auto-email fallback (scheduled job + Resend send + audit action) — or strip the claim from ReachOutModal/EscalatedCaseDrawer copy until it ships.
DEPLOYED: yes (admin FE+BE on main; DB on prod) / mobile-tree for the attribution eyebrow (on mobile origin/main — needs Expo rebuild to reach devices)
NEEDS-LIVE-DB: none
NEEDS-SIM: send a personalized team reply from admin (Reply-as "<First> · from Replant Team") to a test leader, then confirm on the mobile app (post-rebuild) the eyebrow renders "<First> from Replant Team" on the first bubble of the cluster
RECOMMENDED LANE: In Progress
COMMENT-FACTS:
- Channel decision resolved: Connect DM (option B) with per-message attribution toggle; email (option A) survives only as the locked workflow's 7-day fallback, which is NOT yet built.
- Pastoral Reach out is a real composer now — sends the DM via reach-out-to-leader-from-message (1/24h per leader, UG-target requires UG admin, welcome-DM required) then records the reach_out disposition; deployed in PR #71.
- Escalated Cases Reach out sibling deployed with mandatory "<First> from Replant Team" attribution per locked ruling.
- Mobile renders the attribution eyebrow in the Replant Team thread (DMThreadView.tsx; commits on mobile main; migration 20260701000007 on prod) — pending Expo rebuild for devices.
- Gap: shipped drawer/modal copy promises a 7-day auto-email fallback that has no scheduled function, cron, or sender anywhere in either repo — build it or pull the copy.

## KAN-297 — Pastoral TriageDrawer: amber active-state on green Mark prayed-over button
CURRENT LANE: In Progress
VERDICT: SUPERSEDED
EVIDENCE:
- The offending pattern no longer exists on deployed main. TriageDrawer was fully rewritten in PR #71 ("2026-07-01 evening rewrite", `origin/main:src/screens/PastoralQueue.jsx:156-225`): direct-click buttons that open modals — there is no pick-and-Submit picker, hence no `isActive` state at all (0 occurrences in the deployed file) and no amber overlay to stack on anything.
- `mark_prayed_over` (the green button the ticket is about) was REMOVED from the drawer entirely per Founder integrity rule: gone from FE `PASTORAL_TRIAGE_ACTIONS` (`origin/main:src/lib/admin-form.js:70-75` — 4 actions: reach_out / escalate_to_admin / defer_until / dispose_close) and from the rendered drawer (4 ghost buttons: Reach out / Escalate-per-tier / Defer disabled "Coming Soon" / Close Case).
- All drawer buttons render `rp-btn-ghost` (Founder's "defuse loud colors" rule from the same PR) — no green `rp-btn-approve` base remains in the drawer.
- Residue (harmless): BE `triage-pastoral-action.js:64` still ACCEPTS `mark_prayed_over` as a valid action — legacy acceptance with no FE caller.
MISSING: n/a
DEPLOYED: yes
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- Fixed by removal, not by re-tinting: PR #71 rewrote the TriageDrawer to direct-click modal buttons — the pick-and-Submit active state (the amber overlay) no longer exists.
- "Mark prayed-over" itself was removed from the pastoral triage set per Founder integrity ruling (redundant with Close Case), eliminating the green-button case entirely.
- Remaining 4 drawer buttons are uniform btn-ghost per the Founder's defused-color register; deployed on main.
- Minor residue: the BE still accepts mark_prayed_over as a valid action string (no FE path sends it).
