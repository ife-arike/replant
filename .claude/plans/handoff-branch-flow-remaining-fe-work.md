# Branch flow + para ministry — Remaining FE/Admin/Test work

**Status:** DB + BE shipped and live 2026-06-18. Foundational FE in place. Deeper screen-integration + admin + smoke test ahead.

## What's live in prod

### DB (Supabase project `jiyetphxxvyiicrnwlnx`)

- Migration `branch_flow_schema_v1` — `branch_of_church_id` + `is_headquarters` columns; `pending_parent_claims` table (PK = `branch_church_id`, RLS-protected); BEFORE trigger `trg_enforce_branch_invariants` (with short-circuit); DEFERRABLE CONSTRAINT TRIGGER `trg_branch_must_have_parent_or_claim`; audit_log enum-append (54th=`branch_parent_auto_linked`, 55th=`branch_parent_admin_linked`). 8 test branches backfilled to live main_campus parents; "He's Able Embassy" flipped to `main_campus`.
- Migration `branch_flow_rpcs_v1` — `find_church_by_code(text)` (anon-grantable, type-filtered, normalizes RPL ID), `find_parentable_churches(text)` (min-length 3, ILIKE substring, LIMIT 10, type-filtered), extended `create_account_atomic` (7 params with mutual-exclusion + HQ-type-fence), `auto_link_pending_parents()` (SKIP LOCKED, exact name+city+country match, audit-logged), `admin_link_branch_parent(uuid,uuid)` (super_admin gated). Stale 4-param overload dropped (BE F4).
- Migration `schedule_auto_link_pending_parents_cron` — pg_cron job `auto-link-pending-parents` at 03:00 UTC nightly.

### BE edge functions (deployed)

- **`create-account` v7** — accepts `branchOfChurchId`, `pendingParentClaim`, `isHeadquarters` in payload; full mutual-exclusion validation; passes to extended RPC; **welcome email body conditionally swaps "church" → "organization"** for `type='para_ministry'` (CONTENT F6 BLOCKING). `verify_jwt=false` preserved.
- **`register-church`** — `CHURCH_TYPES` array updated with `para_ministry` (via shared validation update). No v8 contract bump needed — branch fields are passed at `create-account` time, not register-church. `verify_jwt=false` preserved.

### Shared validation (file edits)

- `_shared/church-validation.ts`, `create-account/logic.ts`, `register-church/logic.ts`, `update-church/logic.ts` — `para_ministry` added to `CHURCH_TYPES`. `update-church` stale comment rewritten.
- `register-church/logic.test.ts:266` — `para_ministry` removed from rejection-list fixture.

### FE foundational (file edits in main, not yet committed)

- `src/utils/displayHelpers.ts` — `getChurchTypeLabel` updated with "Church branch" + "Christian Organization (Para-ministry)" labels; `CHURCH_TYPES` array dropdown updated (underground removed, branch label updated, para added); NEW exports: `PARA_MINISTRY_TOOLTIP`, `isParaMinistry`, `orgCopy(type)`, `canMarkHeadquarters(type)`, `viewerOrgCopy(viewerChurchType)`.
- `src/context/OnboardingContext.tsx` — extended with `registrationEntry`, `parentRef`, `pendingParentClaim`, `isHeadquarters` state + setters. Mutual-exclusion enforced in setters (setting one clears the other).
- `src/screens/onboarding/RegisterIntroScreen.tsx` — CD-shipped 3-tile chooser dropped in (Standalone / Church branch / Underground tiles).
- `src/components/onboarding/ParentChurchPicker.tsx` — CD-shipped RPL ID / name segmented picker dropped in. Accepts `lookupByRplId` + `searchByName` props (caller provides via Supabase RPC).

## Remaining work

### Task #16 (final) — Wire RegisterIntroScreen into the navigation flow

- **`src/navigation/OnboardingNavigator.tsx`** — add `RegisterIntro` screen entry to `OnboardingStackParamList` and the navigator. Route key from ASP2 "Register Yours" button changes from `RegisterChurchPage1` → `RegisterIntro`.
- **`src/screens/onboarding/AccountSetupPage2Screen.tsx`** — when leader taps "Register Yours" (currently routes straight to RegCP1), reroute to `RegisterIntro`. The tile chooser then dispatches to RegCP1 with `entry='standalone'`, `entry='branch'`, or `entry='underground'` param.
- **`RegisterIntroScreen.tsx`** — already has `navigation.navigate('RegisterChurchPage1', { entry: mode })` calls; verify the param type matches RegCP1's expected route params.

### Task #17 — RegCP1 branch mode + HQ checkbox + ASP2 branch variant card

- **`src/screens/onboarding/RegisterChurchPage1Screen.tsx`**:
  - Read `entry` from route params: `'standalone' | 'branch' | 'underground'`. Default to `'standalone'` if absent (back-compat).
  - When `entry === 'branch'`:
    - Hide the church-type picker (we know `type = 'branch'`).
    - Set churchType to `'branch'` in OnboardingContext on mount.
    - Render `ParentChurchPicker` (`src/components/onboarding/ParentChurchPicker.tsx`) in place of the type/location fields. Supply `lookupByRplId` and `searchByName` props via Supabase RPC wrappers:
      ```ts
      const lookupByRplId = async (code: string) => {
        const { data } = await supabase.rpc('find_church_by_code', { p_church_code: code });
        return data?.[0] ? mapRow(data[0]) : null;
      };
      const searchByName = async (q: string) => {
        const { data } = await supabase.rpc('find_parentable_churches', { p_query: q });
        return (data ?? []).map(mapRow);
      };
      ```
    - On picker selection: `setParentRef(parent)` or `setPendingParentClaim({...})` if deferred.
    - Eyebrow swap: `'REGISTER CHURCH BRANCH · 1 OF 2'` when in branch mode.
    - Title swap: `'Branch Details'`.
    - Name field label: `'Your Branch Name'`.
    - Address: REQUIRED for branch (per CD note).
  - When `entry === 'underground'`: existing underground UX (RAG auto-Red, city/address hidden).
  - **HQ checkbox** for standalone mode:
    - Render `<Checkbox label="Mark as Headquarters" />` below the type picker.
    - Visible ONLY when `canMarkHeadquarters(churchType)` returns true.
    - On change: `setIsHeadquarters(checked)`.
  - **Para conditional copy** via `orgCopy(churchType)`:
    - Step label, screen title, name label, name placeholder, type label, size label all read from `orgCopy(type)`.
    - When `type === 'para_ministry'`: always include `rag_status: 'green'` in the submitted payload even though RAG UI is hidden (BE-para F10 BLOCKING — BE validator requires it).
    - Hide the RAG section entirely.
    - "Mark as Headquarters" checkbox hidden for para.

- **`src/screens/onboarding/AccountSetupPage2Screen.tsx`** — "Ready to Register" card (lines 1063-1119) needs branch variant:
  - When loopback church is a branch (`OnboardingContext.parentRef !== null` OR `pendingParentClaim !== null`), display parent attribution:
    - "Church branch of {parentRef.name} · {parentRef.city}" eyebrow row
    - Or amber "Parent to be linked" eyebrow for deferred path.
  - Pass new fields to create-account on "Enter Replant":
    ```ts
    await fetch(createAccountUrl, {
      body: JSON.stringify({
        ...existingFields,
        branchOfChurchId: state.parentRef?.id ?? null,
        pendingParentClaim: state.pendingParentClaim,
        isHeadquarters: state.isHeadquarters,
      }),
    });
    ```

### Task #18 — Post-verification copy swap (8 surfaces)

A para-ministry director currently sees "Your church is verified" all over the app. Route each through `viewerOrgCopy(viewerChurchType)` (exported from `displayHelpers.ts`). Files:

- `src/components/home/VerificationBanner.tsx:62,72,76,80`
- `src/components/home/NotificationToast.tsx:26`
- `src/screens/main/ConnectScreen.tsx:178,179`
- `src/screens/main/TheChurchScreen.tsx:91,92`
- `src/screens/main/PersecutedScreen.tsx:44`
- `src/screens/main/SettingsScreen.tsx:793,1069` — RAG row at 1069 must HIDE entirely for para
- `src/components/prayer/PrayerWallLanding.tsx:69,74,76`
- `src/components/prayer/PrayerWallDetailSheet.tsx:253`

Pattern per surface:
```ts
const viewer = viewerOrgCopy(viewerChurchType);
// Replace literal "Your church is verified" with:
<Text>{viewer.yourChurchOrOrgCap} is verified.</Text>
// Or for inline: "...{viewer.yourChurchOrOrg}..."
```

### Task #19 — Admin atomic batch (separate `replant-admin` repo)

Requires edit permission on `/Users/ife/replant-admin/`. Files needing the label sweep + new toggle:

- `src/lib/church-type-filter.js:24` — relabel to `'Christian Organization (Para-ministry)'`
- `src/lib/church-edit.js:22-23` — relabel + update "verified live on 2026-05-13" comment
- `src/screens/Queue.jsx:28` — relabel `TYPE_LABELS.para_ministry`
- `src/components/ChurchProfileCard.jsx:31` — relabel `TYPE_LABELS.para_ministry`; ALSO add `is_headquarters` boolean toggle to edit-mode rendering with type-fence (disabled when current type is branch/para/underground). Use `church_updated` audit action.
- `netlify/functions/church-intake.js:32-38` — relabel `CHURCH_TYPE_LABELS.para_ministry` (also normalize "Para-Ministry" hyphen-case).
- `src/test/filter-options.test.js`, `src/test/church-edit.test.js` — update label assertions.

NEW admin UI for the deferred-parent queue: a screen reading from `public.pending_parent_claims` joined with `public.churches`, allowing super_admin to manually invoke `admin_link_branch_parent(branch_id, parent_id)`.

### Task #20 — Smoke test end-to-end

Founder walks on simulator:

1. **Standalone signup** unchanged — confirm flow still works.
2. **Branch signup via RPL ID**:
   - ASP2 → "Register Yours" → RegisterIntro chooser.
   - Tap "Church branch" tile → RegCP1 branch mode.
   - Type Maranatha's RPL ID `RPL-00001` in picker → resolves Maranatha as parent.
   - Fill rest of form → RegCP2 → ASP2 with branch attribution on Ready-to-Register card.
   - Enter Replant → create-account v7 → new row in `public.churches` with `type='branch'`, `branch_of_church_id = Maranatha.id`.
3. **Branch signup via name search**:
   - Same as above but use name search → pick from results.
4. **Branch signup deferred parent ("Not Sure")**:
   - Tap "Parent church not on Replant yet?" affordance in picker.
   - Submit RegCP2 → create-account v7 with `pendingParentClaim`.
   - Verify a row appears in `public.pending_parent_claims`.
   - Verify branch row has `branch_of_church_id = NULL`.
5. **Para ministry signup**:
   - ASP2 → "Register Yours" → RegisterIntro chooser.
   - Tap "Standalone" tile → RegCP1 standard.
   - Select "Christian Organization (Para-ministry)" from type dropdown.
   - Verify ⓘ tooltip appears with the locked tooltip string.
   - Verify "Mark as Headquarters" checkbox hides.
   - Verify RAG section hides.
   - Fill rest of form (org-copy throughout) → submit.
   - Verify welcome email body says "Your organization is verified" not "Your church is verified" once the test account gets verified.
6. **Underground signup** — RegisterIntro → "Underground church" tile → existing underground RegCP1 UX. Confirm unchanged.

### Verification checks (post-implementation, no probe rows)

```sql
-- All 9 branches have parent FK or pending claim
SELECT COUNT(*) FILTER (WHERE branch_of_church_id IS NULL) AS unmapped_branches FROM churches WHERE type = 'branch';

-- Triggers in place
SELECT tgname FROM pg_trigger WHERE tgname IN ('trg_enforce_branch_invariants','trg_branch_must_have_parent_or_claim');

-- Cron job scheduled
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'auto-link-pending-parents';

-- All 5 new RPCs present
SELECT proname FROM pg_proc WHERE proname IN ('find_church_by_code','find_parentable_churches','create_account_atomic','auto_link_pending_parents','admin_link_branch_parent');
```

### Out of MVP scope (file as follow-up tickets)

- pg_trgm install + fuzzy-match upgrade for auto-link (DBA F10).
- Idempotency key on create-account v7 (BE F1).
- In-memory token-bucket fallback for find_church_by_code + find_parentable_churches (SEC F3 hygiene).
- search_leaders ILIKE → equality on underground church_code (SEC F1 cleanup — separate Connect-RPC ticket).
- Multi-tier church hierarchy (RCCG-style 4+ levels) (BA-branch F1).
- Lift cap-of-2 for para HQ when para-branches arrive (BA-para F4).
- Type-aware admin verification evidence prompts (ADMIN F5).
- Bulk admin verification operations (ADMIN F10).
- Regional label localization overrides for para_ministry (CONTENT F10).
- Verification-rejection + account-suspension email copy swap (CONTENT F11).
- ⓘ tooltips for all church types (CONTENT F8).
- Edit type to/from para in update-church (post-MVP if not in this batch).
- Underground join-code workstream (separate sprint).

In Jesus' name, Amen.
