# Replant — Branch Flow 1-pager (architecture proposal)

**Status:** Folded with Founder + CD rulings 2026-06-18. Ready for SME panel (SEC + DBA + BA + BE) on schema + RPC mechanics.
**Author:** CC (SM session) — 2026-06-18
**Founder ruling source:** 2026-06-18 sequencing call + CD review session.
**Related:**
- `/Users/ife/replant/.claude/plans/orphan-prevention-architecture.md` (atomic-write pattern)
- `/Users/ife/replant/.claude/plans/para-ministry.md` (sibling workstream)
- `/Users/ife/replant/.claude/plans/handoff-signup-flow-continuation.md` (sprint context)
- `/Users/ife/replant/docs/docs-handoff/design_handoff_branch_para_underground/` (CD output — `RegisterIntroScreen.tsx`, `ParentChurchPicker.tsx`, `displayHelpers.changes.ts`, interactive preview HTML)
- Memory: [[project-underground-join-code]] (separate underground join-code workstream)

**Jira ticket:** TBD — file post-ratify.

---

## 1 · Context

Replant has `church_type = 'branch'` as a `CHURCH_TYPES` enum value (`supabase/functions/_shared/church-validation.ts:21-28`). A leader can register a branch-typed church today, but the system has **no parent-church FK** anywhere in `public.churches` — branches today are disconnected church rows with no parent attribution.

The existing `branches` + `branch_members` tables (migration `20260529000000_kan214_branches_schema_v1.sql`) are unrelated messaging infrastructure (branch CHAT THREADS), NOT a church hierarchy. The nomenclature collision is real but the display ruling defuses it.

### Founder rulings 2026-06-18 (locked — panel-surfaced questions resolved)

- **Parent identification (MVP):** RPL ID lookup OR search-by-name; both surfaced together in a single `ParentChurchPicker` component (CD-shipped). Invite-link mechanism is post-MVP.
- **Three parent-identification paths:** "I know my parent's RPL ID" / "I know my parent's name" / **"Not Sure"** — all routing into the picker. The first two are the segmented modes; **"Not Sure" routes to the deferred-parent path** with the leader-typed name + city stored as a `pending_parent_claims` row. This folds the earlier `signup_login_pending_items.md` Step 1 Yes/No/Not-Sure spec into the picker.
- **Branch leader-cap:** each branch has its own cap-of-2 (NOT counted against parent's cap).
- **Branch parent verification:** branches MAY attach to unverified (pending) parents.
- **30-day verification SLA uniform across all establishment types** — branch, standalone church, para. No type exemption, no establishment exempt. Welcome-email kind reads the branch's own `verification_status` (always `pending` at creation).
- **Display label:** **"Church branch"** everywhere (drop parens; always lead with "Church"). Enum value `'branch'` unchanged — display-only.
- **Entry UX:** new `RegisterIntroScreen` chooser with three mutually-exclusive tiles — Standalone / Church branch / Underground. Underground is REMOVED from the church-type dropdown entirely; its tile routes to the dedicated secure underground flow. Branch tile routes to RegCP1 in `entry='branch'` mode (type picker hidden, parent-picker leads).
- **`is_headquarters` is a flag, not a type, AND not a privileged status.** Leader self-asserts at signup via "Mark as Headquarters" checkbox. Admin confirms during the normal verification workflow (no separate HQ verification step). HQ badge renders on church profile cards. NO HQ verification priority. NO admin "Mark HQ" privileged action. Underground churches cannot pick HQ. A leader in a hostile jurisdiction simply doesn't tick the box — self-selection moots the SEC F8 targeting-signal concern per Founder review.
- **Deferred parent path:** if the parent church isn't on Replant yet (or leader is "Not Sure"), the leader registers the branch NOW; the parent FK auto-fills later when the parent registers and verifies. `branch_of_church_id` is therefore **NULLABLE**; a separate `pending_parent_claims` record holds the leader-typed parent name + city + country until resolution.
- **Para ministries cannot have branches** (MVP). Post-MVP Jira ticket.
- **Underground is a separate workstream** for the brave/safe toggle + join-code reveal UX. This batch only handles the entry-point move (underground out of dropdown, into chooser tile). See [[project-underground-join-code]] for the second-leader join code (separate from `church_code`).

### Naming reconciliation (locked from SME panel)

- The live DB column is `public.churches.church_code text` (not `rpl_id`). Keep `church_code` everywhere in schema, RPCs, and the new RPC names. DBA stamp.
- User-facing copy: **"RPL ID"** in search/signup flow surfaces (per Founder); **"Replant ID"** elsewhere (Settings, FAQ, Church Profile pill — separate CONTENT sweep PR). Pending-state copy: "Replant ID pending."
- Token format: `RPL-NNNNN` (unchanged). 5-digit zero-padded numeric. 6-digit migration deferred to a separate ticket gated at 50K verified churches.

## 2 · Current state (what breaks)

- A leader picks `type=branch` in the current RegCP1 dropdown. The submission creates a `public.churches` row with `type='branch'` and **no parent attribution**. Admin verification surfaces have no way to know which church it's a branch of.
- `register-church` v7 already excludes branch-type churches from `find_similar_churches` (`p_exclude_branches = true`) — this carve-out is correct and holds.
- `create_account_atomic` (v6) accepts `p_new_church jsonb` + `p_existing_church_id uuid` but has no `p_branch_of_church_id` parameter and no `p_is_headquarters` parameter.
- ASP2 "Ready to Register" card eyebrow (`AccountSetupPage2Screen.tsx:1063-1119`) renders the same chrome for branches as for standalone churches — no parent attribution line.
- RegCP1 has no parent-picker UX and no chooser-tile entry.
- `is_headquarters` does not exist as a column. (CD's reading was that headquarters was previously a church type; the live enum has no `'headquarters'` value per the grounding pass — so this is a clean add, no migration off a stale type.)

## 3 · Target architecture

### 3.1 Schema

```sql
-- Branch parent FK — nullable to support the deferred-parent path
ALTER TABLE public.churches
  ADD COLUMN branch_of_church_id uuid NULL REFERENCES public.churches(id) ON DELETE RESTRICT;

CREATE INDEX idx_churches_branch_of ON public.churches(branch_of_church_id)
  WHERE branch_of_church_id IS NOT NULL;

-- Headquarters flag — any non-branch / non-para / non-underground church may be HQ
ALTER TABLE public.churches
  ADD COLUMN is_headquarters boolean NOT NULL DEFAULT false;

-- Deferred parent claim — leader-typed name+city while waiting for the parent to join
-- DBA F7: branch_church_id is the natural PK (one claim per branch ever) — drops the separate
-- id column + partial unique index. Audit history lives in audit_log, not here.
CREATE TABLE public.pending_parent_claims (
  branch_church_id uuid PRIMARY KEY REFERENCES public.churches(id) ON DELETE CASCADE,
  claimed_parent_name text NOT NULL CHECK (char_length(trim(claimed_parent_name)) > 0),
  claimed_parent_city text,
  claimed_parent_country text,
  resolved_at timestamptz NULL,
  resolved_parent_church_id uuid NULL REFERENCES public.churches(id) ON DELETE SET NULL,
  resolved_by_user_id uuid NULL REFERENCES public.users(id),   -- admin manual-link audit
  resolved_method text NULL CHECK (resolved_method IN ('auto','admin_manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resolved_fields_consistent CHECK (
    (resolved_at IS NULL AND resolved_parent_church_id IS NULL AND resolved_method IS NULL)
    OR (resolved_at IS NOT NULL AND resolved_parent_church_id IS NOT NULL AND resolved_method IS NOT NULL)
  )
);
```

#### Invariants — composed via BEFORE trigger + DEFERRABLE CONSTRAINT TRIGGER (DBA F1+F2)

**BEFORE INSERT/UPDATE trigger** enforces:
- `branch_of_church_id` cannot point to a row where `type IN ('branch', 'para_ministry', 'underground')`. Trigger handles all three.
- `is_headquarters` cannot be true when `type IN ('branch', 'para_ministry', 'underground')`. Defense-in-depth on top of FE-side gating.
- **Short-circuit at trigger entry** (DBA F8): non-branch UPDATEs where `type` didn't change skip the parent-eligibility subquery and only do the cheap HQ-fence check. Keeps overhead off RAG/contact/admin edit hot paths at 200K rows. Sketch:
  ```
  IF NEW.type <> 'branch' AND (TG_OP = 'INSERT' OR OLD.type IS NOT DISTINCT FROM NEW.type) THEN
    -- only check HQ-type-fence and return
  END IF;
  ```

**`DEFERRABLE CONSTRAINT TRIGGER` (DEFERRABLE INITIALLY DEFERRED)** enforces:
- `type='branch'` IFF (`branch_of_church_id IS NOT NULL` OR a row in `pending_parent_claims WHERE resolved_at IS NULL`). The deferrable trigger fires at COMMIT, AFTER both the branch row + claim row have landed inside `create_account_atomic`. A non-deferrable trigger would reject every deferred-parent insert because the claim row is INSERTed AFTER the church row in the same txn. Sketch:
  ```
  CREATE CONSTRAINT TRIGGER trg_branch_must_have_parent_or_claim
    AFTER INSERT ON public.churches
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    WHEN (NEW.type = 'branch' AND NEW.branch_of_church_id IS NULL)
    EXECUTE FUNCTION public.assert_pending_claim_exists();
  ```

#### Backfill for 9 existing verified branch rows (DBA F4 — BLOCKING)

Production today has 9 `type='branch'` rows with no parent FK. The migration MUST backfill these BEFORE the new constraint trigger lands, or every subsequent UPDATE on those rows (admin verifications, RAG changes, `is_active` flips) fails.

```sql
-- After ADD COLUMN branch_of_church_id, BEFORE CREATE CONSTRAINT TRIGGER:

-- Auto-match "X — Y Branch" pattern against same-country main_campus
UPDATE public.churches b
SET branch_of_church_id = p.id
FROM public.churches p
WHERE b.type = 'branch'
  AND b.branch_of_church_id IS NULL
  AND p.type = 'main_campus'
  AND p.country = b.country
  AND b.name LIKE p.name || ' — %';

-- For any remaining unmatched branch rows: insert pending claim
INSERT INTO public.pending_parent_claims
  (branch_church_id, claimed_parent_name, claimed_parent_country, created_at)
SELECT
  b.id,
  split_part(b.name, ' — ', 1),
  b.country,
  b.created_at
FROM public.churches b
WHERE b.type = 'branch'
  AND b.branch_of_church_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.pending_parent_claims c WHERE c.branch_church_id = b.id
  );
```

Founder + DBA spot-check the 9 rows BEFORE migration runs. The 9 known rows: Glory of Christ Apostolic Ministries (3 branches), Igreja Pentecostal Renovação (2), Houston Bible Believers (2), Manila Christ the King (1), He's Able Embassy (1). The last one has no "— Branch" suffix — manual review required.

#### Audit log additions (DBA F1 correction)

Live `audit_log_action_check` currently has **53 actions, not 47** (1-pager's earlier "48th action" count was stale). Add BOTH new actions in the same enum-append:
- `branch_parent_auto_linked` (54th)
- `branch_parent_admin_linked` (55th)

Auto-link mechanism (separate from registration write):

- A nightly `auto_link_pending_parents()` SECURITY DEFINER function scans `pending_parent_claims WHERE resolved_at IS NULL`, fuzzy-matches against `churches.name + city` for verified-or-pending rows, and atomically:
  - Sets `branch_church.branch_of_church_id = resolved_parent.id`
  - Sets `pending_parent_claims.resolved_at = now()`, `resolved_parent_church_id = resolved_parent.id`
  - Writes audit_log action `'branch_parent_auto_linked'` (NEW action — 48th)
- Confidence threshold: high-match-only (e.g., name normalized + city exact match). Low-confidence matches surface to admin queue, NOT auto-resolved.
- Manual admin link path: admin can resolve via `admin_link_branch_parent(p_branch_id, p_parent_id)` RPC, also audited.

### 3.2 RPCs

#### `find_church_by_code(p_church_code text)` — parent lookup by RPL ID

```sql
CREATE OR REPLACE FUNCTION public.find_church_by_code(p_church_code text)
RETURNS TABLE(
  id uuid,
  name text,
  city text,
  country text,
  type text,
  verification_status text,
  church_code text,
  is_headquarters boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.city, c.country, c.type::text,
         c.verification_status::text, c.church_code, c.is_headquarters
  FROM public.churches c
  WHERE c.church_code = p_church_code
    AND c.type NOT IN ('branch', 'para_ministry', 'underground')  -- not parentable
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.find_church_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_church_by_code(text) TO anon, authenticated, service_role;
```

#### `find_parentable_churches(p_query text)` — search-by-name (parentable filter)

Same `SECURITY DEFINER` posture. Returns 0..N rows. Routes through the `churches_public` view (which already excludes underground per memory `project_replant_invariants` #2) and additionally filters `type NOT IN ('branch', 'para_ministry')`. ILIKE substring on `name`. LIMIT 10.

#### Rate-limit posture (SEC stamp from this session's panel)

Both `find_church_by_code` and `find_parentable_churches` are pre-auth surfaces (`anon` grant). Rate-limit floor:

- **30 lookups / 5 min per IP**, hard-cap **200 / hour** per IP.
- **Faster trip on misses:** 20 missed lookups in 5 min → 429 + log.
- **Global circuit-breaker** on either RPC's invocation rate exceeding N× baseline (alert-only at MVP).
- **Log every invocation** with `{ip_hash, query/code, found:bool, ts}` for post-hoc enumeration detection.

SEC explicitly noted: random `church_code` generation is at most a ~100× slowdown to enumeration; the rate-limit IS the actual control. Don't drop rate-limiting thinking randomness protects us.

### 3.3 Extend `create_account_atomic`

Add two optional parameters:

```sql
CREATE OR REPLACE FUNCTION public.create_account_atomic(
  p_auth_id uuid,
  p_leader jsonb,
  p_new_church jsonb,
  p_existing_church_id uuid,
  p_branch_of_church_id uuid DEFAULT NULL,    -- NEW
  p_pending_parent_claim jsonb DEFAULT NULL,  -- NEW { name, city, country } for deferred path
  p_is_headquarters boolean DEFAULT false     -- NEW
) RETURNS TABLE(user_id uuid, church_id uuid)
...
```

Function behavior:

- If `p_new_church IS NOT NULL` AND `p_branch_of_church_id IS NOT NULL`:
  - Insert church with `type='branch'`, `branch_of_church_id = p_branch_of_church_id`, `is_headquarters = false`.
  - The CHECK + trigger validates parent eligibility.
- If `p_new_church IS NOT NULL` AND `p_pending_parent_claim IS NOT NULL`:
  - Insert church with `type='branch'`, `branch_of_church_id = NULL`.
  - INSERT into `pending_parent_claims` referencing the new branch row + the claimed parent payload.
  - Same atomic txn — either both rows land or neither does.
- If `p_new_church IS NOT NULL` AND `p_is_headquarters = true`:
  - Validate `type NOT IN ('branch', 'para_ministry', 'underground')` (the trigger also catches this; defense-in-depth at the function boundary).
- Cap check for branches: same logic as standard churches (`SELECT COUNT(*) FROM public.users WHERE church_id = v_church_id AND is_active = true` < 2).
- FK existence on `p_branch_of_church_id` is enforced by the column FK + the parent eligibility trigger.

### 3.4 Edge function contracts

#### `register-church` v8 (validation-only — same posture as v7)

Add three optional payload fields: `branchOfChurchId?: string`, `pendingParentClaim?: { name, city, country }`, `isHeadquarters?: boolean`. Validation rules:

- Exactly one of `branchOfChurchId` or `pendingParentClaim` may be set when `type='branch'`. If both or neither for a branch → 400.
- `branchOfChurchId` resolved via `find_church_by_code` (when leader entered RPL ID) or `find_parentable_churches` (when leader picked from name search) — BE caller passes the resolved UUID.
- **Server-side parent-eligibility check at v8 entry (BE F2):** when `branchOfChurchId` is set, call `find_church_by_code` to confirm parent exists AND `parent.type NOT IN ('branch', 'para_ministry', 'underground')`. Return 400 `parent_not_eligible` at validation time, before the leader reaches ASP2 "Enter Replant." Catches malformed client payloads + gives the friendly error at the right UX moment.
- `isHeadquarters=true` allowed only when type is parentable (i.e., not branch/para/underground). Reject at parsePayload (not just RPC trigger). Otherwise 400 `hq_not_allowed_for_type`.
- Branches and pending-parent claims skip `find_similar_churches` (v7 already does this for branches).
- Return `{ valid: true }` on success. No DB write.

**Rate-limiter fail-closed posture for the lookup RPCs (SEC F3 hygiene fold):** `find_church_by_code` and `find_parentable_churches` are both anon-grantable. The current rate-limiter pattern in `register-church/index.ts:99-107` returns `{ allowed: true }` on Upstash error (fail-open). For these enumeration surfaces, fall back to an in-memory token bucket per worker on Upstash error. Per-worker is degraded but bounded; never fail-open.

#### `create-account` v7 (atomic-with-branch + HQ flag + idempotency)

**Idempotency key (BE F1 — BLOCKING).** Require FE to pass `idempotencyKey: string` (UUID) in the v7 payload. On entry, look up `create-account:idemp:${key}` in Upstash; if cached, return the cached response. Otherwise process normally and cache the response with 1h TTL. Prevents orphan branches from FE retry-after-timeout or double-tap during signup — the deferred-parent claim row would otherwise compound the orphan window.

Passes the three new fields through to `create_account_atomic`. Error code mapping:

| RPC raise (`USING ERRCODE`) | Edge function HTTP response code | User-facing copy (CONTENT stamp pending) |
|---|---|---|
| `parent_not_found` (`P0002`) | 400 `parent_not_found` | "No church matches that RPL ID. Check it with the parent church, or search by name instead." |
| `parent_not_eligible` (custom) | 400 `parent_not_eligible` | "This church can't have branches. Pick a main church or ministry instead." |
| `hq_not_allowed_for_type` (custom) | 400 `hq_not_allowed_for_type` | "Headquarters only applies to main churches and ministries." |
| `LEADER_CAP_EXCEEDED` (`P0001`) | 409 `LEADER_CAP_EXCEEDED` | "This branch already has 2 leaders." |
| (existing codes) | (unchanged) | (unchanged) |

#### Welcome email

Branch leaders ALWAYS flow `pending_church` kind with the branch's own 30-day clock (Founder ruling: 30-day SLA uniform across all establishment types). The kind-switch in `handler.ts:343-395` reads `verification_status` of the just-created branch row (always `pending` at creation), so NO handler change is needed for branches.

**Welcome email body conditional swap (CONTENT F6 — BLOCKING).** `create-account/index.ts:177-195` has hardcoded "church" in 3 kind branches. For para-ministry signups, the body must swap "church" → "organization":
```ts
const churchOrOrg = type === 'para_ministry' ? 'organization' : 'church';
```
Same swap for the admin "New church registered" notification at `:204-210` → "New organization registered" for para. (Cross-references the para-ministry workstream — single welcome-email handler serves both.)

For deferred-parent branches: same `pending_church` kind. Welcome copy references the claimed parent name and explains the auto-link path: "[Claimed Parent Name] isn't on Replant yet. We'll automatically link your branch when they register and verify." (BA F11; CONTENT drafts as part of this batch, not deferred.)

### 3.5 Branch display name

Server-side: leader types the branch's own name in the form (e.g., "First Baptist"). The CHURCHES row stores `name` exactly as typed. Display-layer composes the full label dynamically:

- In search results, profile, CAML rows: `{branch.name} — {branch.city}` if `city` present.
- Parent attribution rendered separately ("Branch of {parent.name}") via `branch_of_church_id` FK join.

This avoids baking the city into `name` (which would duplicate data with the `city` column and create drift on city edits).

### 3.6 FE flow (CD-shipped — see source files in `/Users/ife/replant/docs/docs-handoff/design_handoff_branch_para_underground/source/`)

```
ASP2 "Register Yours"
   │
   ▼
RegisterIntroScreen (NEW, see source/RegisterIntroScreen.tsx)
   ├── Standalone tile  → RegCP1 (entry='standalone'; type picker visible)
   ├── Church branch tile → RegCP1 (entry='branch'; type picker hidden; ParentChurchPicker leads)
   └── Underground tile  → RegCP1 (entry='underground'; existing underground UX)

For entry='branch':
   ▼
RegCP1 branch mode:
   • Eyebrow "Register Church branch · 1 of 2"
   • Title "Branch Details"
   • Field: "Your Branch Name" + helper
   • ParentChurchPicker (see source/ParentChurchPicker.tsx)
       ├── idle / results / empty / rplMiss / selected / deferred states
       ├── Mode toggle: By RPL ID | By name (segmented)
       └── "Parent church not on Replant yet? Register your branch & link later ›" → deferred
   • Mark as Headquarters checkbox: HIDDEN on branch path (HQ excluded for type=branch)
   • Address: REQUIRED for branch (per CD note — folds into the required-fields workstream)
   ▼
RegCP2 → register-church v8 (validation-only)
   ▼
ASP2 "Ready to Register" card (KAN-192 redesign)
   • Branch variant: "Church branch of [Parent] · [City] · RPL ID [code]" attribution row
   • Deferred variant: amber "Parent to be linked" eyebrow
   • Status row: branch's own 30-day clock (unchanged kind switch)
   ▼
Enter Replant → create-account v7 → create_account_atomic (atomic insert)
```

### 3.7 CD source files (binding contract)

The CD handoff at `/Users/ife/replant/docs/docs-handoff/design_handoff_branch_para_underground/source/` is the implementation-ready spec. FE engineer wires these to the existing onboarding pattern:

- `RegisterIntroScreen.tsx` — drop into `src/screens/onboarding/`. Wires `setRegistrationEntry` on `OnboardingContext`.
- `ParentChurchPicker.tsx` — drop into `src/components/onboarding/`. Receives `lookupByRplId` + `searchByName` props bound to the new RPCs.
- `displayHelpers.changes.ts` — focused diff against existing `src/utils/displayHelpers.ts` (CHURCH_TYPES update + `getChurchTypeLabel` map + `orgCopy` helper + `canMarkHeadquarters`).

Note for implementer: `ParentChurchPicker` shows `{p.type}` in the result meta line — should be `getChurchTypeLabel(p.type)` for the rendered label. Minor fix on integration. Also, the RPL ID input normalization (`q.toUpperCase().replace(/[^A-Z0-9]/g, '')`) strips the `RPL-` prefix if the leader includes it — that's fine; the BE `find_church_by_code` accepts either with or without prefix (BE re-prepends as needed).

## 4 · Edge cases

- **Race: parent deleted between RegCP2 validation and Enter Replant.** ON DELETE RESTRICT on `branch_of_church_id` prevents parent deletion while branches exist — the branch insert succeeds.
- **Race: parent verification status changes between RegCP2 and Enter Replant.** Welcome email kind reads branch's OWN status (always pending), so parent-status changes don't affect the branch's onboarding copy.
- **Branch leader tries to attach to a branch (nesting).** `find_parentable_churches` + `find_church_by_code` exclude branch-typed rows; trigger backstops at the DB level.
- **Branch of underground attempt.** Underground filtered from both parent-lookup RPCs (excluded from `churches_public` and from the `NOT IN` filter). Trigger backstop at DB level.
- **Search-by-name multi-match disambiguation.** `ParentChurchPicker` results show: name + HQ badge (if parent.is_headquarters) + verification badge + meta line `(type · city · country · RPL ID)`. Disambiguator order: Type, City, Country, RPL ID, verification.
- **RPL ID typo.** `rplMiss` state renders inline error: "No church matches that RPL ID. Check it with the parent church, or search by name instead."
- **Parent church is pending.** Allowed (Founder ruling). `ParentChurchPicker` shows Pending badge on the selected card.
- **Deferred parent: parent never joins.** Pending claim row stays `resolved_at = NULL` indefinitely. Branch remains operational but unattached. Admin tooling surfaces these rows for manual link or admin reach-out.
- **Deferred parent: name typo collides with another church.** Auto-link uses HIGH confidence only; collisions surface to admin manual-link queue. No false auto-link.
- **Deferred parent: two branches claim the same future parent.** When parent joins + verifies, both pending claims resolve to the same `resolved_parent_church_id`. No race — each is its own pending_parent_claims row.
- **Pending parent gets admin-REJECTED** (BA F7). Branch leader's parent claim points at a row that admin rejects. Branch FLIPS to pending-claim state: `branch_of_church_id` set to NULL, `pending_parent_claims` row inserted with the rejected parent's name + city as the claim payload. Admin flagged for independent review of the branch ("branch was attached to a rejected parent"). Branch leader's onboarding investment preserved; bad-network attempts not rewarded.
- **Deferred-parent post-signup UX** (BA F6). While waiting on link: subtle "Parent church pending link" pill on the leader's own church profile + Home tab — NOT amber/anxious (branch is fully operational). Leader can edit the typed claim until first auto-link attempt fires (then admin-only). When auto-link succeeds: in-app notification + welcome-email update. When 90+ days unresolved: admin reaches out via the admin-tool surface.
- **Auto-link safety against underground** (SEC F6 dismissed at threat level — schema-blocked). Underground rows have city=NULL per `underground_no_location` CHECK; auto-link's name+city match cannot match an underground row, full stop. Defense-in-depth type-filter on candidate pool (`WHERE c.type NOT IN ('branch', 'para_ministry', 'underground')`) ships anyway as belt-and-suspenders.
- **Editing a branch from ASP2 "Ready to Register" card.** Same as standard: Edit nav → RegCP1 branch mode with pre-filled `OnboardingContext.branchOfChurchId` (or pending claim). Switch / Delete → clears the context. No DB write at the ASP2 stage; no orphan.
- **`is_headquarters` toggled on a church that later gains branches.** Allowed — HQ is a flag, branches just attach via FK. The HQ status of the parent has no effect on branch validation.
- **Underground join code interaction (informational — NOT in this batch).** A second leader joining an existing underground church uses the separate underground join code (see [[project-underground-join-code]]) — that's a different code from `church_code` and a different signup path. This batch ships the underground entry tile but the join-code reveal/input is a separate workstream.

## 5 · Deploy order

1. **Migration A — additive schema:**
   - `branch_of_church_id` column (nullable, FK, index)
   - `is_headquarters` column (NOT NULL DEFAULT false)
   - `pending_parent_claims` table (PK = `branch_church_id`; one claim per branch ever — drops the separate id column + redundant partial unique index, per DBA F7)
   - BEFORE INSERT/UPDATE trigger for nesting + para/underground parent + HQ-type-fence (with non-branch UPDATE short-circuit per DBA F8)
   - DEFERRABLE CONSTRAINT TRIGGER for "branch IFF parent OR claim" (fires at COMMIT; DBA F1+F2 — non-deferrable would reject deferred-parent inserts mid-txn)
   - **Backfill the 9 existing verified branch rows** via name-pattern match against same-country main_campus + pending_parent_claims for unmatched (DBA F4 — BLOCKING; must run BEFORE the constraint trigger)
   - `audit_log` actions `'branch_parent_auto_linked'` AND `'branch_parent_admin_linked'` enum-append (54th + 55th actions — DBA F1: live action count is 53, not 47 as earlier drafts said)
2. **Migration B — RPCs:** `find_church_by_code`, `find_parentable_churches`, extend `create_account_atomic`, add `auto_link_pending_parents`, `admin_link_branch_parent`.
3. **Migration C — RLS:** confirm RLS allows authenticated leaders to read parent attribution on their own branch (no parent PII leak); admin role can manage pending claims.
4. **BE: `register-church` v8** — accept new payload fields; resolve parent UUID server-side from RPL-or-name; eligibility checks at parsePayload (not just RPC trigger); defense-in-depth on HQ; **in-memory token-bucket fallback** when Upstash errors (SEC F3 hygiene fold).
5. **BE: `create-account` v7** — pass through; error-code mapping; **idempotency-key check at handler entry** (BE F1 — BLOCKING) via Upstash `create-account:idemp:${key}` with 1h TTL.
6. **FE:**
   - `RegisterIntroScreen` + nav route
   - `ParentChurchPicker` component
   - `displayHelpers.ts` changes (CHURCH_TYPES, label map, `orgCopy`, `canMarkHeadquarters`)
   - RegCP1 branch mode rendering (type picker hidden, ParentChurchPicker leads, HQ checkbox hidden)
   - RegCP1 HQ checkbox on standalone path
   - ASP2 "Ready to Register" card branch variant + deferred-parent amber variant
   - Underground tile route (existing underground RegCP1 reused)
7. **Admin (separate repo) — atomic batch with the enum migration** (ADMIN F1+F2 — BLOCKING ordering). Admin repo carries `para_ministry` in 5+ files already (`replant-admin/src/lib/church-type-filter.js:24`, `church-edit.js:22-23`, `Queue.jsx:28`, `ChurchProfileCard.jsx:31`, `church-intake.js:28-37`) with WRONG label ("Para Ministry" or "Para-Ministry"). The atomic batch must include:
   - Update admin labels to "Christian Organization (Para-ministry)" (Founder-locked label)
   - Update admin tests asserting label value
   - Add `is_headquarters` toggle to `ChurchProfileCard.jsx` edit-mode rendering with type-fence
   - Add `pending_parent_claims` manual-link UI for the admin queue
   - Verification surfaces show "Branch of [Parent]" + HQ badge in network displays
   - NO admin "Mark HQ" privileged action (leader self-asserts at signup; admin confirms during normal verification flow per Founder ruling)
   - **Migration order: para enum ADD ships BEFORE this admin deploy** OR same-window atomic ship to avoid the `22P02 invalid input value` window where admin selects `para_ministry` against an enum that doesn't have it yet (DBA-para F7).
8. **Cron / hook:** schedule `auto_link_pending_parents()` (Supabase pg_cron or scheduled edge function — DBA + OPS decide).

## 6 · Open questions per lane (after fold)

Most original questions resolved by Founder rulings + CD output. Remaining:

### SEC
- **`anon` grant on `find_church_by_code` + `find_parentable_churches`** — SEC has stamped 30/5min per-IP rate-limit as the floor (see §3.2). BE confirms the limiter implementation tier (Supabase edge-function shared limiter? Kong? Custom).
- **Underground side-channel via `search_leaders` differential** — SEC flagged that an attacker could cross-reference `find_church_by_code` (returns "not parentable" for underground) vs `search_leaders` (could match on `church_code` for underground rows). Status: `churches_public` view (per memory `project_replant_invariants` #2) excludes underground, and `search_leaders` masks underground name to literal `'Underground Church'` per invariant #3. Confirm `search_leaders` does NOT match on `church_code` for underground rows OR the masking is sufficient — needs explicit BE audit.
- **Pending-parent claim PII risk** — claimed-parent name + city are leader-typed. If the typed name reveals a real church that's actively hidden (e.g., an underground church with a brave-mode name), the claim row contains identifying data even if the parent never joins. SEC ratifies retention posture for unresolved claims.

### DBA
- **`auto_link_pending_parents` cadence + lock strategy** — nightly? On every new `churches` INSERT via trigger? Locking behavior under load? DBA recommendation expected.
- **Fuzzy match threshold** for auto-link confidence. `pg_trgm` install (already on the post-MVP DBA queue) would help.
- **`pending_parent_claims` retention** — keep forever, or expire after X days unresolved? Founder + BA business call; DBA mechanism.

### BA
- **Welcome email copy** — does the branch leader's welcome email reference the parent name (when attached) or stay generic? Deferred-parent variant: does it mention "we'll link your parent when they join"?
- **Pending-parent-claim deferral UX copy** on the bypass card — current CD draft: amber "Parent to be linked" + "Register your branch now — we'll link it to the parent automatically once they join and verify." Ratify.
- **`is_headquarters` admin-side semantics** — does HQ get verification priority? Is there an HQ-specific badge in network displays? CD shows blue HQ pill; ADMIN panel confirms business intent.

### BE
- **Shared validation drift risk** — `CHURCH_TYPES` exists in `_shared/church-validation.ts` + both function mirrors + `displayHelpers.ts`. Adding `para_ministry` (sibling workstream) + the new HQ rules + new fields adds drift surface. Contract test? Or merge to one shared module?
- **Telemetry** — add `branch_of_church_id`, `is_headquarters`, `was_deferred_parent` to the `account_created` log event.

## 7 · Rollback strategy

If breaks in UAT:

1. Revert edge functions to v7/v6 (MCP deploy).
2. Revert FE commits (RegisterIntroScreen, ParentChurchPicker, RegCP1 branch mode, ASP2 card branch variant).
3. DB columns (`branch_of_church_id`, `is_headquarters`) can stay NULL/false on existing rows (harmless).
4. `pending_parent_claims` table — can stay empty; harmless. Or drop in a rollback migration.
5. Any branches created during UAT with parent attribution get manually NULLed + type flipped to `main_campus` (DBA SQL with Founder approval). Founder noted: do NOT regenerate any RPL IDs that were assigned during failed UAT (live network identifiers).

## 8 · Non-goals

- Invite-link mechanism for branches — Founder ruled post-MVP.
- Para ministries having branches — Founder ruled post-MVP (separate Jira ticket).
- Underground join-code (separate identifier for second-leader join) — separate workstream per [[project-underground-join-code]] memory; this batch ships the underground ENTRY tile only.
- Brave/safe `show_church_name` toggle UX — handled in the dedicated underground signup workstream.
- Admin-side ability to convert a standalone church → branch (or vice versa) post-verification. Admin workaround: delete + re-add.
- `church_code` (RPL ID) generation mechanism — separate workstream tracked in Task #7 of this session; ships independently of branch flow.
- `congregation_size_range` column rename or schema change for para — handled in sibling para-ministry workstream.

---

## SME panel ask

**SEC + DBA + BA + BE:** review only your lane. Return:

> **Verdict:** approve / approve-with-changes / block
> **Findings:** specific issues with file:line refs where applicable
> **Required changes (if any):** ordered list
> **Out of lane (skipped):** what you deliberately did not look at

All Founder rulings folded. No blocking open Founder questions remain for this 1-pager — panel may dispatch in parallel with the para-ministry panel.

In Jesus' name, Amen.
