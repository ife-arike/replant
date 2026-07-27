# Replant — Para Ministry 1-pager (architecture proposal)

**Status:** Folded with Founder + CD rulings 2026-06-18. Ready for SME panel (DBA + BE + BA + ADMIN + CONTENT).
**Author:** CC (SM session) — 2026-06-18
**Founder ruling source:** 2026-06-18 sequencing call + CD review session.
**Related:**
- `/Users/ife/replant/.claude/plans/branch-flow.md` (sibling workstream — `is_headquarters` flag, `RegisterIntroScreen`)
- `/Users/ife/replant/.claude/plans/orphan-prevention-architecture.md` (atomic-write pattern)
- `/Users/ife/replant/docs/docs-handoff/design_handoff_branch_para_underground/` (CD output — see `displayHelpers.changes.ts` §1, §3 for the locked label + `orgCopy` helper)

**Jira ticket:** TBD — file post-ratify.

---

## 1 · Context

Replant's church-type enum (`CHURCH_TYPES` in `supabase/functions/_shared/church-validation.ts:21-28`) currently covers six values: `main_campus`, `branch`, `house_church`, `ministry`, `without_walls`, `underground`. There is no representation for **Christian organizations that aren't local churches** — missions agencies (IMB, Wycliffe, Frontier), training schools (seminaries, Bible colleges), Christian media (radio/TV/publishing), campus ministries (Cru, IVCF), Christian counseling, relief & development (Samaritan's Purse), and advocacy organizations.

### Founder rulings 2026-06-18 (locked — panel-surfaced questions resolved)

- Add `para_ministry` as a single bucket for all of the above.
- **Display label: "Christian Organization (Para-ministry)"** (LOCKED after CONTENT F1 challenge to the slash form). The earlier "Para-ministry / Organization" is superseded. Tap-reveal ⓘ pill on that dropdown row toggles the tooltip — hidden by default, not always-on. CONTENT F8 recommends ⓘ on all type rows for consistency; deferred to a follow-up unless cheap to ship in this batch.
- **Tooltip rewrite (CONTENT F2)** — leads with affirmation, not exclusion. Locked string: *"Christian organizations serving the wider Body — missions, training, media, campus, counseling, relief & development, advocacy. Choose this if your work isn't centered on a local congregation."*
- Duplicate-similar rules match standard (name+city OR contact_email OR contact_phone — no carve-out).
- Welcome email kind matches standard skip / pending_church / verified_church paths — no new variant. **Body conditionally swaps "church" → "organization"** (CONTENT F6 — BLOCKING). See §3.6.
- Para ministries cannot have branches at MVP (post-MVP Jira ticket).
- **30-day verification SLA uniform across all establishment types** (Founder ruling — no para-specific SLA, no type exemption). Admin evidence rubric for para differs (missions vs. seminary vs. media vs. campus etc.) but SLA is uniform — file ADMIN follow-up for type-aware evidence prompts BEFORE first UAT para signup.
- UI swaps "church" → **"Organization"** (FULL word, NOT abbreviated "Org") conditionally when para is selected. Eyebrow "REGISTER ORGANIZATION · 1 OF 2", "Organization Name", "Organization Type", "Organization Size."
- **`is_headquarters` excluded for para** — the "Mark as Headquarters" checkbox is hidden entirely on the para path. See §3.4 below. (HQ is not a type — Founder ruling at branch-flow level — and is not available to para or branch or underground.)
- **Organization Size — KEEP the field on para path** (Founder ruling). Same column (`congregation_size_range`), same enum buckets. CONTENT to draft a helper hint clarifying what to count (staff vs. congregation).
- CD ships `orgCopy(type)` helper as the single source for the conditional copy swap. Use it everywhere — no per-screen string forking. **Extend with 5 more keys** per CONTENT F7: `contactNamePlaceholder`, `contactValidationNote`, `emergencyPlanLabel`, `collaborationLabel`, `submitButtonLabel`. See §3.3.

The displayHelpers TS file has a stale comment referencing `para_ministry` (`src/utils/displayHelpers.ts:8-10`) but the value is NOT in the enum nor the validation arrays — confirmed in the grounding pass. Clean addition with no rename collisions.

## 2 · Current state (what breaks)

- A leader from a missions agency, seminary, etc., today picks the closest fit (often `ministry` or `main_campus`), creating data ambiguity. Admin verification has no signal to distinguish "para-ministry-like" from "actual local church."
- Demographic fields like `congregation_size_range` don't fit a missions agency that doesn't gather a Sunday congregation. The leader either leaves it blank (poor data) or makes up a number (worse data).
- FE copy throughout RegCP1/RegCP2/ASP2 says "church" / "Church Name" / "Search by church name" — semantically wrong for a para ministry leader.
- Admin verification surfaces (separate repo) can't filter or group para ministries differently from standard churches.
- Future post-MVP feature surfaces (Connect, Prayer Wall, regional view) all assume "church" framing — out of scope for THIS workstream but worth noting as downstream technical debt the panel may flag.

## 3 · Target architecture

### 3.1 Schema

Add `para_ministry` to the `church_type` enum:

```sql
ALTER TYPE public.church_type ADD VALUE IF NOT EXISTS 'para_ministry';
```

Same enum, no rename. Enum-add migrations are safe under live load (Postgres handles atomically).

Confirm no downstream CHECK constraints hardcode the type list (e.g., `type IN ('main_campus', ...)` style). DBA panel sweeps for this. The `underground_no_location` CHECK from memory `feedback_underground_no_location_constraint` does not need a para variant (Founder ruled para ministries have normal city/lat/lng).

The branch-flow's planned `branch_type_has_parent` CHECK (see `/Users/ife/replant/.claude/plans/branch-flow.md`) also needs to ensure `branch_of_church_id` is NULL when `type='para_ministry'` — already covered by the trigger guard there. Cross-reference noted.

### 3.2 Edge function contracts

**`_shared/church-validation.ts`** — update `CHURCH_TYPES` array:

```ts
export const CHURCH_TYPES = [
  "main_campus",
  "branch",
  "house_church",
  "ministry",
  "without_walls",
  "underground",
  "para_ministry",  // NEW
] as const;
```

Mirror identically in:
- `supabase/functions/create-account/logic.ts:18-25`
- `supabase/functions/register-church/logic.ts:16-23`

**Test fixture updates (BE-para F1 — BLOCKING for CI green).** `create-account/logic.test.ts:211` and `register-church/logic.test.ts:266` currently use `para_ministry` in their "reject these values" tests. Adding `para_ministry` to `CHURCH_TYPES` silently flips those negative cases to should-accept. Update the test fixtures in the SAME PR as the enum-add.

**`update-church/logic.ts:18-20` stale comment (BE-para F2).** Currently declares `para_ministry` "out of scope at this surface." Either patch `update-church/logic.ts` in this PR to accept para edits OR file a post-MVP "edit type to/from para" ticket explicitly in §8 Non-goals. A leader who registers as para and needs an admin to fix their type cannot do it until this resolves.

**`register-church` v8 (subsumes the branch-flow bump):**

- parsePayload accepts `type='para_ministry'`.
- Duplicate-similar via `find_similar_churches` runs same as standard (no carve-out). Founder ruling.
- **Reject** `branchOfChurchId` when `type='para_ministry'` — 400 `para_no_branch_attach` (BE-para F4: shortened from `para_ministry_no_branch_attach` to match sibling brevity `hq_not_allowed_for_type`). This depends on branch-flow v8 introducing the `branchOfChurchId` payload field — branch-flow ships first or same-window.
- City/lat/lng accepted as normal (no underground-style stripping).
- All other fields treated as standard.
- **`rag_status` always required by parsePayload** — FE must send `rag_status: 'green'` (or another valid default) for para even though the RAG UI is hidden via `orgCopy.showRag = false`. Without this, para signup 400s on submit (BE-para F10 — BLOCKING).

**`create-account` v7 (subsumes branch-flow bump):**

- Accepts `type='para_ministry'` in `newChurch` payload.
- Passes through to `create_account_atomic` unchanged. The RPC inserts into `churches.type` — enum already covers it post-migration.
- Welcome email kind switch (`handler.ts:343-395`) is unchanged — para ministries follow the standard skip / pending_church / verified_church paths. **Body conditional swap** "church" → "organization" — see §3.6.

### 3.3 FE flow

**`displayHelpers.ts`** — CD-shipped contract (see `/Users/ife/replant/docs/docs-handoff/design_handoff_branch_para_underground/source/displayHelpers.changes.ts`). Drop into `src/utils/displayHelpers.ts` as a focused diff. Changes:

```ts
export const CHURCH_TYPES = [
  { label: 'Main Campus',                       value: 'main_campus' },
  { label: 'Church branch',                     value: 'branch' },          // was "Church (Branch)"
  { label: 'House Church',                      value: 'house_church' },
  { label: 'Ministry',                          value: 'ministry' },
  { label: 'Church Without Walls',              value: 'without_walls' },
  { label: 'Christian Organization (Para-ministry)', value: 'para_ministry' }, // LOCKED 2026-06-18 (CONTENT F1)
  // 'underground' REMOVED from dropdown — surfaced via the RegisterIntroScreen chooser tile
  //   (sibling branch-flow batch — see /Users/ife/replant/.claude/plans/branch-flow.md §1)
] as const;

export const PARA_MINISTRY_TOOLTIP =
  "Christian organizations serving the wider Body — missions, training, media, " +
  "campus, counseling, relief & development, advocacy. " +
  "Choose this if your work isn't centered on a local congregation.";
```

Tooltip is a **tap-reveal ⓘ pill on the para-ministry row only — hidden by default, NOT always-on** (CD ruling).

Also remove the stale `para_ministry` comment at `displayHelpers.ts:8-10` (or update it to reflect actual enum state).

**`RegisterChurchPage1Screen.tsx`** — when `type='para_ministry'` selected, swap "Church" → "Organization" (FULL word, not abbreviated "Org" — CD-locked). Use CD's `orgCopy(type)` helper:

```ts
export function orgCopy(type: string) {
  const para = isParaMinistry(type);
  return {
    stepLabel:               para ? 'REGISTER ORGANIZATION · 1 OF 2' : 'REGISTER CHURCH · 1 OF 2',
    screenTitle:             para ? 'Organization Details' : 'Church Details',
    nameLabel:               para ? 'Organization Name' : 'Church Name',
    namePlaceholder:         para ? 'Enter organization name' : 'Enter church name',
    typeLabel:               para ? 'Organization Type' : 'Church Type',
    sizeLabel:               para ? 'Organization Size' : 'Congregation Size',
    // CONTENT F7 extension keys:
    contactNamePlaceholder:  para ? 'Primary contact for this organization' : 'Primary contact for this church',
    contactValidationNote:   para ? 'We will reach out to this email and/or phone to validate your organization.'
                                  : 'We will reach out to this email address and/or phone number to validate your church.',
    emergencyPlanLabel:      para ? 'Does your organization have an emergency action plan…'
                                  : 'Does your church have an emergency action plan…',
    collaborationLabel:      para ? 'Would you be willing to strategize with nearby ministries on emergency preparedness?'
                                  : 'Would you be willing to strategize with nearby churches on emergency preparedness?',
    submitButtonLabel:       para ? 'Register Organization' : 'Register Church',
    showRag:                 !para,            // RAG hidden in UI; FE MUST still send rag_status:'green' for BE validator (BE-para F10)
    allowBranchAttach:       !para,            // para cannot be a branch
  };
}
```

**Org Size helper hint (CONTENT-to-draft).** Per Founder ruling, the field stays on para path with the same buckets (`under_50`, `50_to_200`, `200_to_500`, `over_500`). CONTENT drafts a one-liner under the picker on para that specifies what to count — e.g., *"Approximate staff or active members."* Same column, same enum, label-only adjustment via `orgCopy.sizeLabel = 'Organization Size'`.

Surface-level swap inventory:

| Surface | Standard | Christian Organization (Para-ministry) |
|---|---|---|
| Step label | `REGISTER CHURCH · 1 OF 2` | `REGISTER ORGANIZATION · 1 OF 2` |
| Screen title | `Church Details` | `Organization Details` |
| Name field | `Church Name` / `Enter church name` | `Organization Name` / `Enter organization name` |
| Type picker | `Church Type` | `Organization Type` |
| `congregation_size_range` label | `Congregation Size` | `Organization Size` |
| RAG status section | shown | NOT shown (but `rag_status: 'green'` still sent to BE — BE-para F10) |
| Underground notice | (path-irrelevant for para) | NOT shown |
| Mark as Headquarters checkbox (NEW) | shown (non-branch, non-underground) | **HIDDEN** — para cannot be HQ |

**`RegisterChurchPage2Screen.tsx`** — same `orgCopy(type)` helper. Touches `emergencyPlanLabel`, `collaborationLabel`, `submitButtonLabel`.

**`AccountSetupPage2Screen.tsx`** — "Ready to Register" card (`AccountSetupPage2Screen.tsx:1063-1119`): church type label renders via `getChurchTypeLabel(selectedChurch.type)` which now returns `"Christian Organization (Para-ministry)"`. Any "church" wording on that card swaps to "organization" via `orgCopy`. Search-by copy on ASP2 (lines 1212, 1225) — pre-type-selection so the leader doesn't know they're para yet. Generic-ify: "Search by name or Replant ID" / "register your church or organization below."

**Post-verification surfaces (BA-para #1 — copy-swap inventory expansion).** Once verified, a para director still sees "your church" across many surfaces — must route through `orgCopy` or generic phrasing:
- `src/components/home/VerificationBanner.tsx:62,72,76,80` ("Your church will be deactivated soon" / "Your church is verified")
- `src/components/home/NotificationToast.tsx:26` ("Your church has been verified")
- `src/screens/main/ConnectScreen.tsx:178,179` ("Once your church is confirmed…")
- `src/screens/main/TheChurchScreen.tsx:91,92`
- `src/screens/main/PersecutedScreen.tsx:44`
- `src/screens/main/SettingsScreen.tsx:793,1069` (epigraph + RAG row — **the RAG row at 1069 must HIDE entirely for para** per `orgCopy.showRag = false`)
- `src/components/prayer/PrayerWallLanding.tsx:69,74,76`
- `src/components/prayer/PrayerWallDetailSheet.tsx:253`
Either route each through a `viewerOrgCopy(viewerChurchType)` helper, OR commit to generic phrasing ("Your account is verified" / "Your organization is verified" branched on type). Pick one approach and apply uniformly.

**`getChurchTypeLabel`** in `displayHelpers.ts` already renders correctly post-array-update — no change needed beyond the array entry.

### 3.4 `is_headquarters` exclusion for para ministry

Cross-reference with the sibling branch-flow workstream (see `/Users/ife/replant/.claude/plans/branch-flow.md` §3.1): `is_headquarters` is a NEW boolean column on `public.churches`. Leader self-asserts at signup via "Mark as Headquarters" checkbox; admin confirms during normal verification flow (no separate HQ verification ceremony). The BEFORE INSERT/UPDATE trigger from branch-flow explicitly rejects `is_headquarters = true` when `type = 'para_ministry'`. FE-side, `canMarkHeadquarters(type)` (CD-shipped in `displayHelpers.changes.ts`) returns false for para — the "Mark as Headquarters" checkbox is hidden entirely on the para path. Defense-in-depth: BE + FE + DB trigger all enforce.

Rationale (Founder ruling 2026-06-18): HQ semantics are church-network specific (a main campus is the HQ of its branches). A para-ministry org may have its own internal HQ vs. regional offices, but Replant's HQ semantics specifically denote church-network leadership — a different concept. If a para-ministry-HQ flag becomes needed post-MVP, scope it as a separate column with its own semantics.

### 3.5 Validation: no branches for para ministry

BE-side enforcement (matches Founder ruling):

- `register-church` v8 rejects `branchOfChurchId` when `type='para_ministry'`.
- `create_account_atomic` BEFORE INSERT trigger (from branch-flow 1-pager) rejects `type='para_ministry' AND branch_of_church_id IS NOT NULL`. Defense-in-depth.

Post-MVP Jira ticket: "Allow branches for para ministries (e.g., regional offices of a missions agency)." File at workstream close.

### 3.5 Admin

Separate repo (admin dashboard). Panel deliverable:

- Verification surface displays para_ministry as a distinct type (filter chip, sort column).
- Any hardcoded type lists in admin queries get the new value.
- Copy: admin views may want "Org" framing for para_ministry rows for consistency.

### 3.6 Welcome email (CONTENT F6 — BLOCKING body swap)

Same KIND switch — para leaders flow `skip` / `pending_church` / `verified_church` based on `verification_status` + `verification_deadline`. No new kind, no new template.

**Body MUST conditionally swap "church" → "organization" for para** (CONTENT F6). `create-account/index.ts:177-195` has hardcoded "church" in 3 places:
- skip kind: `"7 days to register your church or join an existing one"` → `"7 days to register your church or organization, or join an existing one"` (generic; works for both — recommended over conditional)
- pending kind: `"as your church is in the process of verification"` → `"as your ${churchOrOrg} is in the process of verification"`
- verified kind: `"Your church is verified."` → `"Your ${churchOrOrg} is verified."`

Where `churchOrOrg = type === 'para_ministry' ? 'organization' : 'church'`. Two-line change. **`sendWelcomeEmail` Deps signature** at `handler.ts:63-68` must add `churchType` (or similar) so the template can branch — currently passes only `firstName`, `kind`, `daysRemaining`.

Same swap for admin "New church registered" notification at `create-account/index.ts:204-210` → "New organization registered" for para.

Future-proofing: when the HTML welcome email lands (per `project_email_templates_pending`), mirror the same swap.

## 4 · Edge cases

- **Existing leader on type='ministry' wants to migrate to 'para_ministry'.** Out of scope for this workstream — pre-launch UAT, no real users. Admin-side migration if needed.
- **Para ministry "registered before" — duplicate-similar collision.** Same rules as standard (name+city OR contact_email OR contact_phone). RegCP2 modal handles it identically.
- **Para ministry attempting to register as a branch.** Rejected at BE + trigger (defense-in-depth). FE: when `type='para_ministry'` is selected, hide / disable any branch-attachment UI surfaces.
- **Para ministry with no fixed city** (e.g., a global missions agency with HQ rotating, or a media ministry that broadcasts globally). RegCP1 currently has a "Online ministries and churches without walls can enter their HQ or broadcast city" hint (line 441). CONTENT panel: extend that hint to cover para ministries.
- **Para ministry leader role.** The leader's `role` enum (per memory `reference_role_humanisation`) covers ministry_leader, pastor, etc. A missions agency director may pick "ministry_leader" — fits. A seminary president may not have an obvious fit. BA flag for whether the role enum needs a `director` or `executive_leader` value — likely OUT of scope here, file as separate ticket.
- **Switching church type away from para_ministry mid-flow.** Test scenario per `feedback_dont_skip_test_scenarios`. State that should clear: the "org" copy reverts to "church," congregation_size_range label reverts, any para-only fields hide. RegCP1 type-change handler must cover this — currently handles underground type changes only (`ragStatus` clearing is a known gap from the polish queue).
- **Para ministry in admin filter for "needs verification."** Should it sort/group separately, or interleave with standard churches? ADMIN panel.

## 5 · Deploy order

1. **DB migration:** `ALTER TYPE` adding `para_ministry`. Safe under live load. **MUST ship in atomic batch with admin label sweep below** to avoid `22P02 invalid input value` window where admin can already pick `para_ministry` from the dropdown but the enum doesn't have it yet (ADMIN F1 — BLOCKING ordering).
2. **BE: `_shared/church-validation.ts` + both function mirrors** — add `para_ministry` to `CHURCH_TYPES`. Update `create-account/logic.test.ts:211` + `register-church/logic.test.ts:266` negative-case fixtures in the SAME PR (BE-para F1). Patch `update-church/logic.ts:18-20` stale comment OR file post-MVP "edit type to/from para" ticket (BE-para F2). Deploy `register-church` v8 + `create-account` v7 patches with new payload fields per branch-flow workstream.
3. **FE: `displayHelpers.ts` CHURCH_TYPES entry** with NEW label "Christian Organization (Para-ministry)" + stale-comment cleanup at `displayHelpers.ts:8-10`. RegCP1 conditional "organization" copy via `orgCopy(type)` helper. RegCP1 must always send `rag_status: 'green'` for para even though RAG UI is hidden (BE-para F10 — BLOCKING). RegCP2 minor copy via same helper. ASP2 "Ready to Register" card copy.
4. **FE post-verification copy swap (BA-para #1) — same PR or follow-up PR.** Route `VerificationBanner`, `NotificationToast`, `ConnectScreen` gate, `TheChurchScreen`, `PersecutedScreen`, `SettingsScreen` (RAG row hides for para), `PrayerWallLanding`, `PrayerWallDetailSheet` through a `viewerOrgCopy(viewerChurchType)` helper. Don't ship para to UAT without this — a para director sees "Your church has been verified" otherwise.
5. **Admin (separate repo) — ATOMIC with #1** (ADMIN F1+F2 — BLOCKING). Update labels to "Christian Organization (Para-ministry)" in `replant-admin/src/lib/church-type-filter.js:24`, `church-edit.js:22-23`, `Queue.jsx:28`, `ChurchProfileCard.jsx:31`, `church-intake.js:32-38`. Update test fixtures asserting label values. Add `is_headquarters` toggle to `ChurchProfileCard.jsx` edit-mode (type-fenced).
6. **Email handler — CONTENT F6 (BLOCKING).** Update `create-account/index.ts:177-195` + `:204-210` body copy to conditional swap. Add `churchType` param to `sendWelcomeEmail` Deps signature at `handler.ts:63-68`.
7. **Smoke test end-to-end:** Founder walks a para ministry signup → submit succeeds (no 400 on `rag_status`) → admin verifies → welcome email body says "Your organization is verified" not "church" → no admin queue chokes on the new type.

## 6 · Open questions per lane (after panel fold)

Most resolved by Founder rulings + panel synthesis. Remaining:

### DBA (resolved)
- ~~CHECK constraints, triggers, views hardcoding church_type list~~ — RESOLVED: DBA-para panel confirmed only `churches_public` (`type <> 'underground'`) and `underground_no_location` CHECK touch type; neither needs updating for para. No other hits.
- ~~`congregation_size_range` nullability~~ — RESOLVED: column is NOT NULL DEFAULT `'not_specified'`. Per Founder ruling, KEEP field on para path with same buckets; CONTENT drafts a what-to-count hint.
- ~~Branch-flow trigger rejection of para parent~~ — RESOLVED: branch-flow.md §3.1 trigger explicitly rejects.

### BE (resolved + follow-up)
- **Drift mitigation recommendation:** ship a CONTRACT TEST (Option B from BE-para F6) that imports CHURCH_TYPES from `_shared/`, `create-account/logic.ts`, and `register-church/logic.ts` and asserts referential identity. CI failure on drift. File follow-up "Consolidate validator modules under MCP deploy" ticket for the bigger fix.
- Error code naming: locked as `para_no_branch_attach` (shortened from `para_ministry_no_branch_attach` to match `hq_not_allowed_for_type` brevity).
- Telemetry: no separate `is_para_ministry` flag — type is queryable from row.

### BA (resolved)
- ~~Copy-swap scope~~ — covered in §3.3 inventory + post-verification surfaces list.
- ~~Org Size~~ — RESOLVED: keep field, CONTENT drafts hint.
- ~~30-day SLA~~ — RESOLVED: uniform across all establishments per Founder.
- ~~Para-no-branch UX~~ — RESOLVED: silent block at FE (chooser tile makes paths mutually exclusive), 400 at BE as defense-in-depth, no user-facing copy needed.

### ADMIN (resolved)
- Main queue, not separate sub-queue (ADMIN F4). Filter chip handles segmentation.
- Type display label = same Founder-locked label "Christian Organization (Para-ministry)" across admin surfaces (ADMIN F2).
- Type-aware verification evidence prompts: file follow-up ticket (ADMIN F5) — 7-type matrix, owner ADMIN + BA. Block at scale, not at launch.
- Bulk verification operations: file follow-up ticket (ADMIN F10).
- HQ admin-edit field: add `is_headquarters` toggle to `ChurchProfileCard.jsx` edit-mode with same type-fence (ADMIN F6).

### CONTENT (resolved + follow-up)
- Canonical label LOCKED: "Christian Organization (Para-ministry)".
- Tooltip rewrite LOCKED to affirmation-first string per CONTENT F2.
- "Organization" full word everywhere (no abbreviation).
- Welcome email body conditional swap LOCKED — CONTENT F6 (BLOCKING).
- ⓘ tooltips for all church types (CONTENT F8): defer to post-MVP follow-up unless cheap to ship in this batch.
- Regional label localization overrides (CONTENT F10): file post-MVP follow-up.
- Verification-rejection + account-suspension email copy sweep (CONTENT F11): out of scope this batch, required for email sprint.

## 7 · Rollback strategy

If para ministry breaks in UAT:

1. Revert `create-account` + `register-church` to previous versions (MCP deploy).
2. Revert FE commits.
3. DB enum value `para_ministry` cannot be removed via `ALTER TYPE DROP VALUE` in standard Postgres. It stays. New signups won't see it (BE rejects). Any para_ministry rows created during the failed window get admin-converted (UPDATE to `ministry` or similar) with Founder approval.

## 8 · Non-goals

- Para ministry branches — Founder ruled post-MVP; file Jira ticket on workstream close.
- Sub-categorizing para ministries (missions vs training vs media) — single bucket per Founder ruling. Future enhancement only if data quality demands it. BA-para notes downstream `para_subtype` column (not enum split) as the right shape if it ever comes back.
- Renaming `congregation_size_range` column at the DB level — label-only swap on FE.
- Connect / Prayer Wall / Regional view treatment of para ministries — downstream tabs, separate workstream.
- Lift cap-of-2 leader-per-establishment for para (BA-para F4) — same post-MVP ticket as "Allow branches for para ministries."

## 9 · Follow-up tickets to file at workstream close

- Allow branches for para ministries + lift cap-of-2 for para HQ (per Founder MVP rulings).
- Type-aware admin verification evidence prompts (7-type matrix) — ADMIN F5 + BA-para #3.
- Bulk admin verification operations — ADMIN F10.
- Shared validation module consolidation under MCP deploy story — BE-para F6.
- Regional label localization overrides for `para_ministry` — CONTENT F10.
- Verification-rejection + account-suspension email copy sweep — CONTENT F11.
- Role-enum gap for para-ministry-specific leader titles (Director, President, Executive Director, Field Director) — BA-para F4.
- ⓘ tooltips for all church types (CONTENT F8) — if not shipped in this batch.
- Edit type to/from para in `update-church/logic.ts` (BE-para F2) — if not shipped in this batch.
- Update-church stale-comment cleanup — BE-para F2.

---

## SME panel ask — STATUS: panel COMPLETE 2026-06-18

DBA + BE + BA + ADMIN + CONTENT all returned **approve-with-changes**. Findings folded above. No remaining blocking Founder questions. Ready for implementation per §5 deploy order.

In Jesus' name, Amen.
