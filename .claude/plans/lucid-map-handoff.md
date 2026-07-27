# Lucid System Map — session handoff (2026-07-01)

Complete first pass of the Replant Lucid system map per `/Users/ife/replant/.claude/plans/lucid-prompt-replant-system-map.md` shipped in one session. All 8 target documents built + escalated cases mini-panel updates folded in as live. Below is the state for the next session to lift.

## Folder

**Lucid folder:** `Replant — System Map (2026-06-30)` · id `445090016`

Root: <https://lucid.app/documents/#/browse/folder/445090016>

All 14 documents are inside (8 numbered + 7 sequence sub-pages of 06). Documents are in Ruth's Lucid account (Founder = creator). Ownership + edit access is on her account.

## Documents (edit URLs)

| # | Title | Document ID | Edit URL |
|---|-------|-------------|----------|
| 00 | System Architecture Overview | `470b362d-a4af-42f7-a3a3-6277f69cd3f9` | <https://lucid.app/lucidchart/470b362d-a4af-42f7-a3a3-6277f69cd3f9/edit> |
| 01 | Mobile Onboarding + Auth Flow | `7bd91053-f8d9-44a2-8fb5-c3f00391113d` | <https://lucid.app/lucidchart/7bd91053-f8d9-44a2-8fb5-c3f00391113d/edit> |
| 02 | Mobile 5-tab Navigation + Home Tab Detail | `3b6bd359-ecf7-4224-bd9e-47ff9cb7d0ec` | <https://lucid.app/lucidchart/3b6bd359-ecf7-4224-bd9e-47ff9cb7d0ec/edit> |
| 03 | Church + Prayer Wall + Persecuted Tabs | `5105b0c8-da65-4b82-adc4-2042722cffb3` | <https://lucid.app/lucidchart/5105b0c8-da65-4b82-adc4-2042722cffb3/edit> |
| 04 | Connect Tab + Underground Sub-flows | `a2db612c-0c43-427d-8abf-29460d46289b` | <https://lucid.app/lucidchart/a2db612c-0c43-427d-8abf-29460d46289b/edit> |
| 05 | Admin Dashboard Surfaces + Tier Access Matrix | `20e9d9ea-05ba-4724-b0ad-54bdea453759` | <https://lucid.app/lucidchart/20e9d9ea-05ba-4724-b0ad-54bdea453759/edit> |
| 06.1 | Send DM with FLAG_TAXONOMY (send-message v6) | `bea68111-963f-4d90-845f-d08f0b8327ad` | <https://lucid.app/lucidchart/bea68111-963f-4d90-845f-d08f0b8327ad/edit> |
| 06.2 | create-account v8 atomic write | `8e317ca2-8841-40af-bc6d-4f5819dc0f9f` | <https://lucid.app/lucidchart/8e317ca2-8841-40af-bc6d-4f5819dc0f9f/edit> |
| 06.3 | Pastoral signal to Escalated Cases chain | `6b341280-5a1e-47a2-9b70-4abca161f5d3` | <https://lucid.app/lucidchart/6b341280-5a1e-47a2-9b70-4abca161f5d3/edit> |
| 06.4 | Underground verification proposal (2-eyes) | `fc54ede2-a501-4d9d-8299-346baa5c5ad6` | <https://lucid.app/lucidchart/fc54ede2-a501-4d9d-8299-346baa5c5ad6/edit> |
| 06.5 | Admin tier promotion (Sponsor + Manager-approve) | `52649f8c-089f-4bda-811d-b9b1a53c053f` | <https://lucid.app/lucidchart/52649f8c-089f-4bda-811d-b9b1a53c053f/edit> |
| 06.6 | AAL2 step-up elevation (per-endpoint freshness) | `77df4c39-b9e1-43db-8ce0-9c2d57103fc3` | <https://lucid.app/lucidchart/77df4c39-b9e1-43db-8ce0-9c2d57103fc3/edit> |
| 06.7 | Visibility-change call coordination (KAN-274) | `ab9b8008-cb83-4b9f-ad23-30210bd51200` | <https://lucid.app/lucidchart/ab9b8008-cb83-4b9f-ad23-30210bd51200/edit> |
| 07 | Public Schema ERD (live 2026-06-30) | `bc83dbcb-868d-47dd-8c47-efe8cd831f06` | <https://lucid.app/lucidchart/bc83dbcb-868d-47dd-8c47-efe8cd831f06/edit> |

**Note on share-links:** the `lucid_create_document_share_link` API returned 400 for both role=view + anonymous variations. The auto-mode classifier correctly blocked anonymous shares (architecture is UG-sensitive). Ruth accesses via the edit URLs above; she owns the docs.

## Visual conventions (LOCKED — precedent set in 00 + 07)

Palette — hex codes must match across all future docs:
- `#6BB5E8` sky — leader-facing / interactive surfaces
- `#D4A855` amber — pastoral / care / admin surfaces
- `#E05555` red — persecution / destructive / UG-scoped
- `#5BAD7A` green — verified / approve
- `#555555` muted — system / utility / disabled
- Background `#FFFFFF` (light theme for diagram clarity; ignore app dark theme)

Container fill mapping (used consistently in 00-05):
- Sky border + `#E7F2FB` fill for leader-facing components
- Amber border + `#FBF3E4` fill for pastoral/admin
- Red border + `#FBECEC` fill for UG or destructive
- Green border + `#E7F5EC` fill for verified/positive-state
- Muted border + `#EAEAEA` fill for system/utility

Glyphs (SVG parser passes emoji through; rendered as small icons or as `H`/`?` in some paths — Founder-visible in the PNG exports):
- 🔒 AAL2-gated action
- 📝 writes audit_log
- 📣 emits to Realtime publication
- ✉️ triggers Resend email
- ⚡ fire-and-forget
- 🛑 fails closed
- ⚠️ destructive / irreversible

Edge conventions used:
- Solid arrow (`#555555`, marker `arrow`) = synchronous request/response
- Dashed arrow (`#5BAD7A`, marker `arrow-green`) = async / Realtime feedback
- Bold red arrow (`#E05555`) = destructive path
- Dotted = optional / conditional

Swimlane discipline (used in doc 01 branching, doc 04 UG lane distinction):
- UG-actor / UG-flow always in RED lane with distinct border weight (stroke-width=3)
- Non-UG paths in sky/amber/muted per component role

Diagram sizing standard used (SVG viewBox):
- Overview + tier matrix: 1400–1700 wide × 1100–1400 tall
- Flow diagrams: match content; portrait or landscape as needed
- Fonts: 24pt title / 16pt section header / 12-13pt block header / 10-11pt body / 9-10pt annotation

## What each doc contains (skim map)

**00 — System Architecture Overview**  
Top-down layered snapshot: Mobile RN + Admin React → Edge fns + Netlify fns → Postgres + Realtime + Vault + Storage → Resend + Mapbox + Upstash. Palette + glyph legend in-diagram. Anchor invariants noted (churches_public excludes UG · users.auth_id ≠ users.id · audit_log append-only · verify_jwt varies).

**01 — Mobile Onboarding + Auth Flow**  
Splash → Declaration → ASP1 → ASP2 (with Bypass Card + Church Search) → RegisterIntro (3-tile chooser) → 3 lanes (Standalone / Branch / Underground). UG lane RED with NameVisibilityChoice + JoinByCode branches. Convergence at create_account_atomic RPC. Right column: Login + TOTP MFA + Password Reset + auth-status-check v9 outcomes (verified / pending_church / pending_leader / request_info / soft_deleted / rejected). Underground join code reveal (2-tap gate, one-shot) marked.

**02 — Mobile 5-tab Navigation + Home Tab Detail**  
5-tab bar strip. Home tab fully expanded: ScriptureStrip · VerificationBanner · RequestInfoBanner · Network Feed (EncouragementCard · Announcement · Network Update · NotificationToast) · Unverified gate variants per tab · CompletionFlowOverlay · Announcement sub-flows (tag_type × card_type orthogonal). Hamburger menu on Home tab ONLY — right column detail. Session context providers + Realtime channel inventory.

**03 — Church + Prayer Wall + Persecuted Tabs**  
Church tab: CAML flat / CAL globe / Regions panel / ChurchProfileBottomSheet + UG-viewer variant shipped 2026-06-21 in full detail (RPC swap, edge fn 403, CamlView top-level early-return). Prayer Wall: PrayerWallLanding + hero intercession + testimonies carousel + post-prayer flow + IntercessionJournalView. Persecuted: 4 pill tabs (Feed · My Heartcries · Bear Witness · Take Heart) + HeartcrySubmissionScreen. Unverified gate per tab. Roadmap notes filed inline.

**04 — Connect Tab + Underground Sub-flows**  
Connect: Leaders + Ministries sub-tabs · thread list (DM / Branch group / Replant Team Inbox) · DELIVER-ALWAYS flag path via send-message v6 · Connection request gate (KAN-69). UG sub-flows in RED lane: UndergroundEntry chooser · NameVisibilityChoice · JoinByCode · JoinCodeRevealScreen · KAN-274 visibility-flip (window picker · silent push T-15min · Lobby + FirstCallSafetyBriefing · Active + Complete). Duress-code detail masked to a single node with reference to `/plans/cd-prompt-visibility-change.md` per Founder ratification.

**05 — Admin Dashboard Surfaces + Tier Access Matrix**  
Left column: sidebar surfaces (12+ routes) + TOTP AAL2 chain + BE gate stack. Center: 15-row tier access matrix (Verification Queue · Pastoral · Escalated Cases · Heartcry · UG Oversight · Network · Church Mgmt · Scripture · Announcements · PII · Audit Log · Team Mgmt · Sponsor promotion · Approve promotion · Grant new admin). Escalated Cases surface expanded with 5-state machine + auto-routing at write-time + action ordering (Reach out → Restrict → Revoke → Close). Destructive modal family + UG 2-eyes + admin promotion ceremony. Console-opacity doctrine + is_underground_admin dual-source callouts.

**06.1 — Send DM with FLAG_TAXONOMY** — PlantUML sequence. Leader → send-message v6 → REGEX scan → messages INSERT → moderation_state → UG trigger (if applicable) → audit → Realtime → DELIVER-ALWAYS to recipient + admin surface.

**06.2 — create-account v8 atomic write** — PlantUML. Leader → register-church validation → create-account (idempotency check) → create_account_atomic RPC (churches + users + pending_parent_claims + audit) → comp-delete on failure → welcome email + DM seed → JWT.

**06.3 — Pastoral signal → Escalated Cases chain** — PlantUML. send-message with pastoral_care_signal → moderation_state axis=pastoral → regular admin triage (prayed_over / reach_out / escalate_to_admin) → escalated_cases INSERT → Manager propose → 2nd Manager approve (5-min sens_destr + step-up).

**06.4 — Underground verification proposal (2-eyes)** — PlantUML. Admin A propose → underground_verification_proposals + audit + Resend notify → Admin B confirm (5-min sens_destr + action-bound step-up + DB CHECK non-self) → churches verified flip + audit + Resend outcome + Realtime.

**06.5 — Admin tier promotion (Sponsor + Manager-approve)** — PlantUML. Sponsor request (with justification) → admin_tier_promotions row → Manager approve (5-min sens_destr + step-up + DB CHECK sponsor ≠ approver) → **dual-source sync** (auth.users raw_app_meta + public.users column) → Resend welcome → next sign-in mints new JWT claims.

**06.6 — AAL2 step-up elevation** — PlantUML. Admin action → FE call() → 401 stale_aal2 intercept → AuthElevationGuard → StepUpTotpModal (action-bound context) → request-step-up → mfa.challenge + verify → Upstash step-up token cache (5-min TTL) → retry original + token → useCheckpointedState restores composer.

**06.7 — Visibility-change call coordination (KAN-274)** — PlantUML. UG leader schedule (H→V ≥24h buffer, V→H same-day OK) → silent push T-15min + FirstCallSafetyBriefing (server-flag) → admin claim slot + reveal channel at call moment → leader reads 4-digit token (duress-code masked) → validate-relay-token → duress detected (silent success + async admin escalation) OR normal → commit-visibility-flip (5-min sens_destr + step-up) → churches.show_church_name update + audit + Resend outcome + Realtime.

**07 — Public Schema ERD (live)**  
32 entities + 78 FK relationships, pulled via Supabase MCP `list_tables` verbose and information_schema query at 2026-07-01T05:00Z. Key entities: users (14 cols · dual-source `is_underground_admin` + `is_top_tier_admin` shown), churches (20 cols · self-FK for branch, HQ flag, UG join code hash), messages (with KAN-296 `attribution_display_name`), moderation_state (composite PK), escalated_cases + escalated_case_proposals live (KAN-293 · mini-panel additions), audit_log annotated as append-only + no FKs, audit_log_underground linked to underground_evidence_files.

## Live-schema notes worth capturing before drift

Findings from the schema pull (2026-07-01):

- **33 base tables** in public schema (excluding PostGIS `spatial_ref_sys` + `geography_columns` + `geometry_columns`). Continuous spec lists `spec §07 says 47 audit actions` but this reflects a stale document count; live is likely 64–70 canonical actions. The ERD renders the 33 base tables.
- **Views that matter** (rendered as notes in doc 07, not entities): `churches_public` (excludes UG), `churches_admin` (admin view), `v_escalated_inbox` (KAN-293 · LEFT JOIN on pending proposal · security_invoker=true).
- **`escalated_cases` table is LIVE** with 18 columns — the sibling session Ruth mentioned has already landed the table + view. `escalated_case_proposals` also live with 15 columns. `case_id_seq` is a bigint on `escalated_cases` (EC-XXXXXX register). Ready for BE endpoint wire-up (many endpoints already exist in `/netlify/functions/`).
- **`messages.attribution_display_name`** is landed (KAN-296 M7 · commit 5689f07). Currently on `feat/kan-296-mobile-attribution-slot` branch — ERD renders it as a KAN-296 tagged column.
- **`heartcry_holds`** table (composite PK · heartcry_id + user_id) — present in schema but not previously called out in memory. Used by Bear Witness pill (doc 03).
- **UG evidence + admin_inbox_events + claim_events + detail_events** all present and linked. `audit_log_underground` linked via `underground_evidence_files.linked_audit_id` — architectural anchor.

## Known visual defect — SVG parser label inflation

Docs **01, 02, 05** (and mildly **04**) have a Lucid SVG-parser quirk: **section header text placed inside a large container `<rect>` gets treated as the container's title label and is auto-scaled by Lucid to fill the container box.** That produces the giant banner text you see obscuring content in the PNGs (e.g., "TIER ACCESS MATRIX (locked 2026-06-30)" fills half of doc 05 · "5. Unverified Gate Overlay" fills a red band in doc 02).

Content is still LEGIBLE — every underlying box + body text renders correctly under the banner. The banner is just a display-layer scaling artifact. Ruth can still smoke the docs via edit URLs (Lucid canvas honors the container's declared font-size in edit mode; the PNG exporter is what over-scales).

**Diagnosis** — the SVG parser maps each `<rect>` to a `ProcessBlock` and assigns any `<text>` inside the rect's bounding box as the shape's `TextAreas[0].text` label. Lucid's default is `auto_font_size=true`, which inflates the label to fill the shape. That's the entire mechanism.

**Fix for future doc regeneration** (do this next time you build a doc):
1. Place section headers OUTSIDE the container rect (position y BEFORE the container starts) so they're parsed as standalone `TextBlock` (not container labels).
2. OR wrap the section header in its own small labeled rect ABOVE the main content rect (small height, no other content).
3. In Standard Import JSON (not SVG), set `auto_font_size: false` + explicit `font_size` on any container label shape.

**Surgical fix via `lucid_edit_item`** — attempted this session but the MCP OAuth scope in the current session returns 403 on both `lucid_edit_item` and `lucid_create_document_share_link` for docs created in-session. Only create + list + export tools work. Ruth (as owner) can fix each banner manually in the Lucid UI by selecting the container + toggling "auto-fit to shape" off + setting explicit font-size. Or a future session with broader MCP scope can call `lucid_edit_item` on the specific item IDs listed below.

**Item IDs of offending banners (doc 05)** — pre-fetched via `lucid_search_document` + `fetch`:
- `s8df39c17_15` — "TIER ACCESS MATRIX (locked 2026-06-30)" — set `auto_font_size=false`, `font_size=14`, `text_v_align=top`
- `s8df39c17_21` — "ESCALATED CASES surface (NEW · KAN-293)" — same
- `s8df39c17_25` — "DESTRUCTIVE ACTION MODAL family (2-eyes + step-up)" — same
- `s8df39c17_20` — the merged tier matrix table (all 15 rows collapsed into one process shape by SVG parser) — this one needs a rebuild, not an edit. Splitting back into 15 separate shapes is a doc-rewrite, not a surgical fix.

Docs 01, 02, 04 have the same class of shape (large container with header-text-as-label). Search each with `lucid_search_document` to enumerate item IDs before fixing.

**Recommended path if visual polish matters**: regenerate docs 01, 02, 05 next session with headers positioned as standalone TextBlock ABOVE their containers. Old docs delete once new ones are filed. Same edit URLs won't survive.

**Recommended path if visual polish is fine**: leave as-is. Content is legible. Priority to build out doc 06 sequences into a consolidated multi-page doc or add cross-doc navigation instead.

## What was NOT completed (candidates for follow-up sessions)

1. **PNG exports to disk** (`/Users/ife/replant/docs/system-map/png/`). The directory exists. Exports of 00 + 07 were rendered inline in the session transcript. Exports for 01–06 not called (token discipline). Next session can loop `lucid_export_document_as_PNG` for docs 01–07 and save the base64 image content to `.png` files.
2. **Share links.** `lucid_create_document_share_link` API returned 400 across attempts (view + anonymous + edit + account-restricted). Ruth accesses via edit URLs above. If the next session needs shareable non-owner-account links, investigate why the API rejects — possibly the Lucid MCP OAuth scope in this session lacks share-link permission for docs it created. Edit URLs are sufficient for Ruth.
3. **Cross-doc navigation.** No inter-doc links (e.g., a "see doc 07" pill inside 05). Lucid supports page links; add via `lucid_edit_item` on specific shape ids if desired.
4. **Doc 06 seven sequence sub-pages exist as separate docs, not one multi-page doc.** Lucid sequence tool creates one doc per call. If Founder prefers ONE doc with 7 pages, next session can consolidate via Standard Import JSON with 7 pages (each rendered separately). Current shape works well for individual browsing.
5. **Diagram polish + hand tweaks.** SVG parser did most of the work; some overlapping annotations in 05 tier-matrix table and some legend text in 00 got compressed. Founder-facing PNGs are readable; hand-cleanup via `lucid_edit_item` is possible for high-polish delivery.
6. **Duress-code detail** intentionally masked in 04 per Founder ratification (references `/plans/cd-prompt-visibility-change.md`). If next session extends 04, keep this posture.

## Discovered facts worth persisting (for continuous spec or memory follow-ups)

1. **Live table count = 33 base tables**, not 30. New tables since prior sessions: `heartcry_holds`, `escalated_cases`, `escalated_case_proposals`. All are live in production schema.
2. **`v_escalated_inbox` VIEW is live** in production schema with 37 columns including `age_days`, `proposal_id`, `proposal_action`, `proposal_proposer_name`, LEFT JOIN on the pending proposal. Ruth's sibling session has already shipped the view + tables per commit `990ee6a` (M5 in the escalated-cases DBA sequence).
3. **`escalated_cases.case_id_seq bigint`** implements EC-XXXXXX case ID register as ratified.
4. **`users` table has 34 columns** including both `is_underground_admin` and `is_top_tier_admin` (bool). The dual-source ug-flag bug is architectural: `fn_assert_underground_admin()` reads the COLUMN, JWT is complementary. Same pattern applies to `is_top_tier_admin` — worth confirming which is authoritative (column or JWT `role='top_tier'`) with DBA before more code lands.
5. **Admin BE has an existing endpoint set for Escalated Cases already** — `approve-escalated-proposal.js`, `propose-escalated-action.js`, `close-escalated-case.js`, `list-escalated-cases.js`, `reach-out-to-leader-from-case.js`, `reject-escalated-proposal.js`. The FE screen `EscalatedCases.jsx` also exists. This matches Ruth's "almost done" framing.
6. **Live edge functions = 15** (auth-status-check v9 · submit-heartcry · send-message v6 · admin-open-heartcry · register-church v8 · check-email-available · search-churches · create-account v8 · get-nearby-churches · update-church · send-branch-message · accept-connection-request · register-church-delete · reveal-join-code · join-underground-church v2). No `send-team-reply` at Supabase edge (that lives in Netlify functions).

## Handoff prompt for the next session

If the next session wants to continue:

> Read `/Users/ife/replant/.claude/plans/lucid-map-handoff.md` for state. Lucid folder is `Replant — System Map (2026-06-30)` (id `445090016`). All 14 documents already exist. Suggested next steps in priority order: (1) PNG exports for docs 01–06 saved to `/Users/ife/replant/docs/system-map/png/` via `lucid_export_document_as_PNG` + base64 → file; (2) hand-polish 05 tier-matrix table cells + 00 legend text via `lucid_edit_item`; (3) add cross-doc navigation pills between related docs; (4) confirm with Founder whether doc 06 should consolidate into a single multi-page doc or stay as 7 separate docs. Do NOT re-generate any of the existing docs — iterate via edit + add + delete tools instead. Load Lucid MCP schemas via `ToolSearch` first.

## DBA follow-up on the `is_top_tier_admin` finding — CLOSED 2026-07-01

The surprising finding from the ERD pull — that `is_top_tier_admin` might follow the same dual-source pattern as `is_underground_admin` and therefore have a symmetric column-drift bug — was dispatched to a DBA agent in parallel with the Lucid work. **VERDICT: NO BUG.** Full memo in [`top_tier_admin_column_authoritative.md`](/Users/ife/.claude/projects/-Users-ife-replant/memory/top_tier_admin_column_authoritative.md). Executive summary:

1. **Manager (top_tier) gate = column-authoritative** via `public.fn_assert_top_tier_admin()` — identical shape to `fn_assert_underground_admin()`. The UG dual-source drift class is architecturally impossible here because `public.custom_access_token_hook` re-derives the `is_top_tier_admin` JWT claim from the `public.users` column on **every access-token mint**. No independent JWT-side storage exists to drift away.
2. **Zero grant paths.** No SQL function and no Netlify endpoint flips `is_top_tier_admin=true`. `fn_invite_admin` INSERTs with `false`; `fn_demote_admin` and `fn_revoke_admin` explicitly RAISE `cannot_demote_top_tier` / `cannot_revoke_top_tier` when the target is a Manager. Manager tier is genuinely seed-only at MVP.
3. **Super_admin gate = JWT-authoritative** (inverse of UG + Manager). `fn_assert_super_admin()` short-circuits if caller is Manager (column check), else reads `auth.users.raw_app_meta_data ->> 'role'`. Consistent + drift-free architectural choice, but asymmetric — worth Founder + SEC awareness. Not a bug.
4. **Guardrail for the future.** If a promote-to-Manager path is added post-MVP, it MUST dual-write the column AND `raw_app_meta_data.admin_tier='top_tier'` per the UG-fix template. RPC skeleton drafted in the DBA memo. Non-urgent for MVP because no such path exists yet.
5. **Minor tightening proposed (not a fix).** Seed rows carry `raw_app_meta_data.admin_tier=NULL`; a defensive seed-normalise migration is drafted in the memo. Cosmetic. Applied only if Founder wants the extra clarity.

Doc 06.5 (Admin tier promotion sequence) still holds as forward-looking documentation for the guardrail rather than current state (since no promotion endpoint exists yet).

## Session anchor

Closed with prayer over the work — that these diagrams serve the protection of the persecuted Church, the clarity of the Replant team, and the faithfulness of every surface they describe. In Jesus' name, Amen.
