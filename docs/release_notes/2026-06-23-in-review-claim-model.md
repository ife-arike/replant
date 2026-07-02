# Release notes — Underground "Mark as In Review" claim model (2026-06-23)

**Sprint:** in-review
**Manifest:** [docs/build_manifest_in_review.md](../build_manifest_in_review.md)
**Subagent verdicts:** DBA (schema) = shipped-with-deviations · DBA (RPCs) = shipped-with-deviations · BE+FE = shipped-with-deviations · Mobile = skipped (no leader-side touchpoints)

## What shipped (per lane)

### DBA — schema (subagent 1)

- **Migrations applied (10):**
  - `0009_in_review_top_tier_admin_and_claim_columns`
  - `0010_underground_claim_events`
  - `0011_underground_evidence_files`
  - `0012_ug_second_leader`
  - `0013_audit_actions_and_detail_events`
  - `0013_rls_and_grants_in_review`
  - `0013_storage_bucket_underground_evidence`
  - `0013_custom_access_token_hook_top_tier_admin`
  - `0013_grant_supabase_auth_admin_users_read`
  - `0013_table_revoke_then_column_regrant_in_review`
- **Storage:** `underground_evidence` bucket created (private, 25MB cap, 9-MIME allowlist) + deny-all `storage.objects` RLS for authenticated + anon.
- **RLS:** 4 admin-SELECT policies on the new tables (gated by `is_underground_admin` JWT claim).
- **Column GRANTs revoked:** `churches.in_review_*` + `ug_second_leader.*` write columns from authenticated + anon. Postgres semantic gotcha discovered: column-level REVOKE can't strip table-level GRANT — fixed via table REVOKE + column-level GRANT re-issued on the other 57 columns.
- **Cron scheduled:** `underground_orphan_evidence_intent_hourly` (jobid 7).
- **`custom_access_token_hook` updated:** additively mints `is_top_tier_admin` top-level claim from `users.is_top_tier_admin` lookup. Existing `super_admin` + `is_underground_admin` claim paths preserved.
- **Realtime publication:** `underground_detail_events` added. Underlying corpus tables (claim_events, evidence_files, ug_second_leader) stay out (Option A architecture, ruling #2).
- **Action CHECK expansion:** 12 of 13 manifest-proposed actions added (`underground_admin_note_added` already present in live CHECK — skipped).

### DBA — RPCs (subagent 2)

- **Migrations applied (5):**
  - `0014_in_review_claim_lifecycle_rpcs`
  - `0014b_extend_pending_underground_queue_claim_columns`
  - `0014c_in_review_narrative_and_evidence_rpcs`
  - `0014d_ug_second_leader_rpcs`
  - `0014e_fix_ug_second_leader_approve_enum_cast`
- **13 RPCs created** (all `SECURITY DEFINER SET search_path = ''`, JWT preamble, audit + detail-event emit in same transaction):
  - Claim lifecycle: `fn_underground_claim`, `fn_underground_release_claim`, `fn_underground_force_unmark_claim`, `fn_underground_route_to_founder_day_25`, `fn_underground_request_release`
  - Narrative + evidence: `fn_underground_add_narrative_note`, `fn_underground_create_evidence_intent`, `fn_underground_confirm_evidence` (idempotent), `fn_underground_delete_evidence`, `fn_underground_get_evidence_signed_url`
  - Sibling: `fn_ug_second_leader_approve`, `fn_ug_second_leader_reject`, `fn_list_pending_ug_siblings`
- **Queue RPC extended:** `fn_list_pending_underground_queue` now returns 23 cols (was 19) — adds `in_review_claimed_by`, `in_review_claimed_by_name`, `in_review_claimed_at`, `in_review_routed_to_founder_at`.
- **Day-25 cron scheduled:** `underground_day_25_route_daily` at `0 9 * * *` UTC (jobid 8) — gates on `day_of_window >= 25` from the extended queue RPC (window-age, not claim-age, per ruling).
- **Atomic claim primitive race-tested** against a temporary table — held correctly.
- **Helper added:** `fn_assert_underground_admin()` returns `public.users.id` (FK-aligned, since `auth.users.id ≠ public.users.id` in Replant). Used as claim attribution source.

### Admin BE+FE

- **Netlify endpoints added (12):** the 11 manifest-spec'd + `underground-list-siblings` (added because `UndergroundSiblings` screen needs a list source; manifest §3 had `fn_list_pending_ug_siblings` RPC but no endpoint).
- **Force-unmark endpoint:** belt-and-suspenders — Tier-1 AAL2 5-min destructive window + action-bound step-up token + `is_top_tier_admin` claim, all in front of the RPC's same gates.
- **8 new components created:**
  - `src/components/underground/ClaimAffordance.jsx` (+ `InReviewPill`)
  - `src/components/underground/NarrativeComposer.jsx` (+ `AdminNotesThread`)
  - `src/components/underground/EvidenceUpload.jsx`
  - `src/components/underground/ForceUnmarkModal.jsx`
  - `src/components/underground/MarkInReviewSoftModal.jsx`
  - `src/components/underground/ClaimConflictModal.jsx`
  - `src/components/underground/SecondLeaderDetail.jsx`
  - `src/screens/UndergroundSiblings.jsx`
- **7 components edited:**
  - `src/screens/UndergroundDetail.jsx` — ClaimAffordance top-right, NarrativeComposer above admin notes, EvidenceUpload below T1/T2 cards; soft-modal intercept on 3 primary CTAs; CTA-lock + tooltip when `claim && !isClaimer`; Realtime subscription on `underground_detail_events` filtered by `church_id`, re-fetch by ID per contract.
  - `src/screens/UndergroundPending.jsx` — `.sla-agg-blue` → `.sla-agg-neutral`; "My claims" filter chip; `InReviewPill` in place of state chip when claimed.
  - `src/screens/Underground.jsx` — "Second-leader applications" tab navigating to `/underground/siblings`.
  - `src/App.jsx` — routes `/underground/siblings` + `/underground/second-leader/:id`; `body.state-dots-colored` applied at mount with cleanup.
  - `src/styles/globals.css` — merged `.ir-*` / `.claim-*` / `.nc` / `.chan-chip` / `.dropzone` / `.cap` / `.evf-*` / `.link-chip` / `.gate` / `.ev-up` / `.sib-meta` / `.sla-agg-neutral` / `state-dots-colored` / sibling-row inset rules from CD package.
  - `src/lib/api.js` — 12 named exports for the workstream.
  - `src/lib/action-names.js` + `netlify/functions/_lib/action-names.js` — `UNDERGROUND_FORCE_UNMARK` action added to both twins (byte-for-byte parity rule).
- **2 scheduled Netlify functions:**
  - `scheduled-underground-orphan-bytes` (@daily) — sweeps storage objects > 1h old with no `underground_evidence_files` row.
  - `scheduled-underground-evidence-exif-scrub` (@daily) — re-encodes confirmed image rows via `sharp` to strip EXIF (graceful no-op when sharp unavailable in build env).
- **Dependencies:** `sharp ^0.33.5` added to package.json; `external_node_modules` config in `netlify.toml`.
- **Commit:** `9f25a3a..2d2bb6c` on `replant-admin` main (single squashed commit per [[feedback-batch-netlify-pushes]]). Netlify auto-deploy in flight.
- **Build verification:** vite passes; npm test exhibits only 3 pre-existing failures unrelated to this work (verified by git stash + re-run on clean main).

### Mobile

- **Skipped** — no leader-side touchpoints in this workstream.

## Founder-facing acceptance

- Admin can **mark** a pending underground case **as in review** via the top-right checkbox (transforms into `In review by [name] · since [date]` pill) OR via the bottom-left Action Bar CTA.
- Only the **claimer** can: write narrative notes (with required Contact channel), upload evidence (with required Channel + Summary + optional `Link to note`), and initiate the primary proposal CTAs (Verify / Reject / Request info / Visibility override / Rotate).
- **Other admins** see the primary CTAs **disabled** with a tooltip; can ping `Request release`.
- **Founder only** can `Force unmark` another admin's claim — gated by AAL2 freshness (5 min), typed claimer name, structured reason dropdown, ≥30-char audit supplement.
- **Day-25 routing** fires automatically at 09:00 UTC each day; claim attribution unchanged; secondary `→ Routed to Founder` badge appended.
- **Staleness escalation** on the pill: neutral chip (< Day 3) → flag accent amber (Day 3–6) → hairline warm edge (Day 7+). No RAG fills.
- **Second-leader applications** appear as their own queue section under `/underground/siblings` with their own lightweight Detail view (Approve / Reject only, no full-church actions).
- **Realtime** keeps the Detail page fresh — when another admin claims/releases/notes/uploads on the same case, the page refreshes via `underground_detail_events` subscription.
- **Encryption:** files encrypted at rest by Supabase Storage (Posture C); v2 envelope encryption deferred per [[postmvp-envelope-encryption-v2]].

## Smoke-test reproduce path

1. Sign in to `admin.projectreplant.org/underground` as Founder Ruth (`ruth@projectreplant.org`).
2. Navigate to any pending UG church Detail page (e.g., Shine Bright Church Gathering or We Will Abound Ministries from the prior sprint's test set).
3. **Claim flow:** click the top-right `Mark as in review` checkbox. Pill should appear: `In review by Ruth · since {today}`. Action Bar bottom-left becomes `Release claim`. Primary CTAs enabled.
4. **Soft-modal:** sign out + sign in as a different admin (or use a second account if one exists). Visit the same Detail page. Try clicking a primary CTA — soft-modal `Mark as in review first?` should appear.
5. **Narrative note:** as claimer, write a note with channel `Signal` + body. Confirm it appears at top of Admin Notes thread with `Signal` chip + `+ Attach evidence` affordance.
6. **Evidence upload:** drop a small JPG via the widget. Confirm summary + channel fields are required. Upload. Confirm file row appears with size + summary + lock icon + `View` + `Delete`. Storage bar updates.
7. **Force-unmark:** as Founder, on a DIFFERENT claimed case (need 2 admins to test cross-claim), trigger Force unmark. Confirm modal demands AAL2 freshness + typed claimer name + dropdown + ≥30-char supplement.
8. **Sibling queue:** navigate to `/underground/siblings`. Currently expect EMPTY (see "Open follow-ups" below).
9. **Realtime smoke:** open the same Detail page in two browser windows. Claim in one; the other should refresh within ~2 seconds.

## Deviations from manifest

### DBA — schema lane

1. **Day-25 cron deferred to DBA-RPC lane** — depended on the queue extension which is a function-body change.
2. **Column REVOKE Postgres semantics** — column-level REVOKE can't strip table-level GRANT; fixed in-flight via table REVOKE UPDATE + column-level GRANT on the other 57 churches columns. Manifest §2 wording loosened — flagged for future similar work.
3. **`custom_access_token_hook` source-of-truth split** — manifest had `users.is_top_tier_admin` lookup; existing hook reads other claims from `app_metadata`. Followed manifest; two patterns now coexist. Flagged for SEC awareness.

### DBA — RPCs lane

4. **Claim attribution stores `public.users.id`** via `fn_assert_underground_admin()`, not `auth.uid()` directly — preserves FK alignment per Replant's `auth.users.id ≠ public.users.id` schema.
5. **Signed URLs minted BE-side, not in Postgres** — the three evidence RPCs return metadata; Netlify endpoints call `createSignedUploadUrl` / `createSignedUrl`. Standard Supabase pattern.
6. **`fn_underground_confirm_evidence` trusts BE orchestration** — no in-Postgres storage probe; orphan-bytes + orphan-intent crons catch drift.
7. **`fn_ug_second_leader_approve` ships ahead of upstream CREATE** — `redeem_underground_join_code` doesn't yet INSERT into `ug_second_leader`. See "Open follow-ups."

### Admin BE+FE lane

8. **Rate-limit denial audit reuses existing action** — `'underground_oversight_opened'` with `meta.surface = <per-endpoint>` for forensic discrimination, instead of a new per-endpoint action. Reason: AUDIT_ACTIONS Set in supabase-admin.js + DB CHECK both gated; new action would need cross-lane coordination.
9. **`underground-list-siblings` endpoint added** (12 not 11) — needed by `UndergroundSiblings` screen.
10. **EvidenceUpload widget footer text** corrected during wire-up from CD scaffold's "encrypted client-side with per-church envelope keys" (Posture A/B wording) to "Files are encrypted at rest by Supabase Storage." (Posture C wording per manifest §4).
11. **429 custom Retry-After / X-RateLimit-* headers stripped** by aal2-gate's `loadData` error handler. Wire format `{429 + error:'rate_limit_exceeded'}` stands. Future aal2-gate refactor would restore the headers.

## Smoke-fix follow-up (2026-06-23 evening — KAN-265)

After Founder's device pass against the freshly deployed admin app, a unified fix sprint shipped 6 visual fixes + sibling-CREATE wiring in commit `2d2bb6c..9a4ca42` (`replant-admin` main, Netlify auto-deployed):

- **CSS appended to `globals.css`:** `.sla-pill` RAG overrides (CD 271–283 — neutral chip + single muted amber dot at amber/red/past tiers); `.ab-claim` + `.ab-claim-inert` + `.action-bar .ab-claim`; `.btn-tipwrap` + `.btn-tip` + hover state (with `#0c0c0c` tooltip background to match existing `.nc` / `.evf-row` / `.jc-hashed` surface — `--rp-bg-2` not defined); `.ev-enc-foot .lock { 11×11 }`.
- **`NarrativeComposer.jsx`:** binary `isClaimer` branch refactored to three-way — `isClaimer && composer`, `!isClaimer && claimerName && lock-message`, `!isClaimer && !claimerName && "Claim this case to log narrative notes."`
- **`UndergroundPending.jsx`:** EVIDENCE column removed (header + cell + `TierBadge` helper deleted; colSpan 6→5). Per CD: 5 columns (`Ref / Macro-region / Submitted / SLA / State`); "Kind" not needed (single-kind queue post-ruling-#5).
- **DBA migration `0014f_redeem_join_code_creates_sibling_row`** applied to `jiyetphxxvyiicrnwlnx`. `redeem_underground_join_code` now inserts a `ug_second_leader (queue_state='untouched', join_code_used='[redeemed]')` row + emits an `underground_detail_events (kind='sibling_state_changed')` row inside the same transaction. Sibling queue will populate on next leader redemption.

**Process learning logged to spec:** manifest §7 CSS merge instructions should enumerate OVERRIDES of existing classes, not just NEW classes — the build subagent reasonably stopped at the explicit new-class list.

## Deferred to next deploy batch (not pushing for this alone — Netlify build minutes)

- **State pill chips still RAG-filled** — same shape of gap as the SLA pill issue. `body.state-dots-colored` was applied at mount and adds the colored dot, but doesn't strip the existing chip background. `.state-replied` (and presumably `.state-await`, `.state-info`, `.state-locked`) still render as fully colored pills (Founder observation: "the entire leader replied pill is still blue"). Per CD color discipline: chip should be neutral, only the dot carries color. Fix is parallel to the SLA pill override pattern — `body.state-dots-colored .state-replied { background: transparent; border-color: var(--rp-border-strong); color: var(--rp-text); }` etc. Bundle into the next deploy batch.

## Open follow-ups

1. ~~**Sibling-row CREATE path is dormant.**~~ **RESOLVED** in the smoke-fix follow-up (KAN-265) — `redeem_underground_join_code` now inserts the sibling row + emits a Realtime event inside the same transaction. Sibling queue will populate on next leader redemption.
2. **AAL2 sessions empty in live `auth.sessions`** — only `aal1` rows exist. Force-unmark fail-closes with ERRCODE 28000 until an admin actually performs AAL2 step-up. If the step-up flow doesn't trigger naturally on TOTP-protected admin login, that's a separate gap to verify.
3. **Manifest §2 wording** (column-level REVOKE) should be updated to call out the Postgres semantic gotcha for future similar work — but the manifest is now historic; the lesson is in this release note + the DBA deviation memory.
4. **EXIF scrub job** runs daily; gives a 24-hour worst-case GPS-leak window between confirmed upload and scrub. Acceptable for Posture C; revisit when envelope encryption v2 lands.
5. **Realtime subscription pattern** is `postgres_changes` filter on `church_id` against `underground_detail_events`. Confirm under load that this scales; the publication-set-of-one keeps the WAL stream small but Realtime row-level filtering is per-subscriber.

In Jesus' name, Amen.
