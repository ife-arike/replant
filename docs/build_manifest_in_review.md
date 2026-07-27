# Build Manifest — Underground "Mark as In Review" workstream

**Status:** Locked 2026-06-23 (v2 — revised after BE + DBA mini-panel + 6 Founder rulings). All naming below is the contract surface across 2 build subagents (DBA / Admin BE+FE). Mobile lane: SKIPPED (no leader-side touchpoints in this workstream). Do NOT deviate from this manifest unless you HALT_REQUEST first and get approval.

Source docs (REQUIRED reading before writing code):
- `/Users/ife/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md` — all locked Founder rulings (2026-06-22 In Review entry + 2026-06-23 visual + process rulings + 2026-06-23 mini-panel ratifications).
- `/Users/ife/replant/docs/design_handoff_in_review/README.md` + `preview/index.html` + `source/*.jsx` — admin CD scaffolds (10 surfaces).
- `/Users/ife/replant/docs/build_manifest_underground_queue.md` — prior sprint's manifest; this one extends + composes with it (do NOT re-implement what's already shipped there).

This sprint LAYERS on the underground verification queue that shipped 2026-06-22. It adds: per-row CLAIM (one admin "owns" the case while working it), CLAIMER-ONLY narrative notes + evidence uploads, CLAIMER-ONLY proposal initiation (other admins can still confirm), Founder-only force-unmark with 3 gates, second-leader sibling rows in a separate queue section.

**Locked ratifications (2026-06-23 evening mini-panel):**
1. Envelope encryption: **Posture C** at MVP (signed-URL-only + private bucket + audit-on-mint). v2 deferred to soonest post-MVP per [[postmvp-envelope-encryption-v2]].
2. Realtime: **Option A** — separate event-only table in publication; underlying tables stay OUT.
3. Highest-tier admin gate: **JWT claim only** (`users.is_top_tier_admin` + `is_top_tier_admin` top-level JWT claim). No hard-coded UUID list in the RPC.
4. Rate-limit: **fail-OPEN-on-Upstash-degraded** + launch-readiness env-var check.
5. Sibling rows: **separate RPC + own queue section** (NOT mixed with churches).
6. Signed-URL GET TTL: **5 min**.

---

## 1 · Database schema additions

All migrations are additive — no destructive changes to shipped objects. Migration ordering matters; ship 0009 → 0013 sequentially. **Migration 0014 STRICKEN** — live introspection 2026-06-23 confirmed `audit_log_underground` already has both `trg_audit_log_underground_no_update` + `trg_audit_log_underground_no_delete` on `prevent_audit_log_underground_mutation`. No action needed.

### Migration 0009 — Columns on `public.users` + `public.churches`

```sql
-- Highest-tier admin flag (ruling #3 — claim-only top-tier gate)
ALTER TABLE public.users
  ADD COLUMN is_top_tier_admin boolean NOT NULL DEFAULT false;

-- Seed the two known top-tier admins per [[reference-highest-tier-admins]]
UPDATE public.users SET is_top_tier_admin = true
  WHERE id IN (
    'bb6c6385-236a-402a-9a6c-66ca3468fdf5',  -- Founder Ruth
    '19bf5467-...-...'                        -- accounts@projectreplant.org (replace with actual UUID at apply time; pull from live)
  );

-- Update custom_access_token_hook to mint the top-level claim (function body edit, not a new migration row):
-- Inside custom_access_token_hook, add:
--   claims := claims || jsonb_build_object('is_top_tier_admin', COALESCE(v_user.is_top_tier_admin, false));

-- Claim attribution columns on churches
ALTER TABLE public.churches
  ADD COLUMN in_review_claimed_by uuid REFERENCES public.users(id) ON DELETE NO ACTION,
  ADD COLUMN in_review_claimed_at timestamptz,
  ADD COLUMN in_review_routed_to_founder_at timestamptz;

-- Helpful for "My claims" filter chip (post-MVP top-button); fine to ship now.
CREATE INDEX churches_claimed_by_idx
  ON public.churches (in_review_claimed_by)
  WHERE in_review_claimed_by IS NOT NULL;
```

**NO partial unique index on `churches(id) WHERE in_review_claimed_by IS NOT NULL`** — `id` is already PRIMARY KEY (globally unique); the partial index would be a semantic no-op (DBA D01). Race protection comes from the atomic claim primitive instead — see §3.

### Migration 0010 — `public.underground_claim_events` (append-only audit of claim state changes)

```sql
CREATE TABLE public.underground_claim_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE NO ACTION,
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE NO ACTION,
  event text NOT NULL CHECK (event IN (
    'claimed',
    'released_by_claimer',
    'force_unmarked_by_founder',
    'auto_routed_to_founder_day_25',
    'request_release_pinged'
  )),
  prev_claimed_by uuid REFERENCES public.users(id),
  reason_code text CHECK (reason_code IN (
    'admin_off_7d', 'admin_offboarded', 'case_re_routed', 'other'
  )),
  reason_supplement text,            -- required ≥30 chars for force-unmark + day-25 events
  aal2_fresh_at timestamptz,         -- SERVER-OBSERVED freshness at force-unmark (NOT client-supplied)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX underground_claim_events_church_idx
  ON public.underground_claim_events (church_id, created_at DESC);

-- Actor index deferred to post-MVP per DBA D13 — defensible but no live caller this sprint.

-- Append-only trigger (mirrors audit_log_underground pattern)
CREATE OR REPLACE FUNCTION prevent_underground_claim_events_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'underground_claim_events is append-only';
END;
$$;

CREATE TRIGGER trg_underground_claim_events_no_update
  BEFORE UPDATE ON public.underground_claim_events
  FOR EACH ROW EXECUTE FUNCTION prevent_underground_claim_events_mutation();

CREATE TRIGGER trg_underground_claim_events_no_delete
  BEFORE DELETE ON public.underground_claim_events
  FOR EACH ROW EXECUTE FUNCTION prevent_underground_claim_events_mutation();
```

### Migration 0011 — `public.underground_evidence_files`

```sql
CREATE TABLE public.underground_evidence_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE NO ACTION,
  uploader_id uuid NOT NULL REFERENCES public.users(id) ON DELETE NO ACTION,
  linked_audit_id uuid REFERENCES public.audit_log_underground(id) ON DELETE NO ACTION,  -- ruling #5; NULL = unlinked

  -- Storage pointer (signed-URL only; never public)
  storage_path text NOT NULL,           -- "{church_id}/{file_uuid}.{ext}"
  storage_bucket text NOT NULL DEFAULT 'underground_evidence',

  -- File metadata
  filename text NOT NULL,               -- sanitized
  mime_type text NOT NULL CHECK (mime_type IN (
    'image/jpeg', 'image/png', 'image/heic', 'image/webp',
    'application/pdf', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  size_bytes bigint NOT NULL CHECK (size_bytes <= 26214400),  -- 25 MB hard cap per file

  -- Required uploader-supplied context
  contact_channel text NOT NULL CHECK (contact_channel IN (
    'signal', 'wire', 'email', 'phone_rare', 'in_person', 'other'
  )),
  summary text NOT NULL CHECK (length(summary) BETWEEN 1 AND 500),

  -- Envelope encryption columns — POSTURE C: not in use at MVP. Kept nullable for v2 (per [[postmvp-envelope-encryption-v2]]).
  envelope_key_id text,                 -- nullable; populated by v2
  encryption_iv text,                   -- nullable; populated by v2

  -- Lifecycle
  intent_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,             -- NULL = orphan intent (swept hourly)
  deleted_at timestamptz,               -- soft-delete; hard-deleted by Day-30 cron
  deleted_by uuid REFERENCES public.users(id)
);

CREATE INDEX underground_evidence_files_church_idx
  ON public.underground_evidence_files (church_id, intent_at DESC)
  WHERE confirmed_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX underground_evidence_files_linked_audit_idx
  ON public.underground_evidence_files (linked_audit_id)
  WHERE linked_audit_id IS NOT NULL;

CREATE INDEX underground_evidence_files_intent_orphans
  ON public.underground_evidence_files (intent_at)
  WHERE confirmed_at IS NULL AND deleted_at IS NULL;

-- Metadata-immutability trigger — only confirmed_at / deleted_at / deleted_by are mutable
CREATE OR REPLACE FUNCTION prevent_underground_evidence_files_metadata_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.church_id        IS DISTINCT FROM OLD.church_id        THEN RAISE EXCEPTION 'metadata immutable: church_id';        END IF;
  IF NEW.uploader_id      IS DISTINCT FROM OLD.uploader_id      THEN RAISE EXCEPTION 'metadata immutable: uploader_id';      END IF;
  IF NEW.linked_audit_id  IS DISTINCT FROM OLD.linked_audit_id  THEN RAISE EXCEPTION 'metadata immutable: linked_audit_id';  END IF;
  IF NEW.storage_path     IS DISTINCT FROM OLD.storage_path     THEN RAISE EXCEPTION 'metadata immutable: storage_path';     END IF;
  IF NEW.storage_bucket   IS DISTINCT FROM OLD.storage_bucket   THEN RAISE EXCEPTION 'metadata immutable: storage_bucket';   END IF;
  IF NEW.filename         IS DISTINCT FROM OLD.filename         THEN RAISE EXCEPTION 'metadata immutable: filename';         END IF;
  IF NEW.mime_type        IS DISTINCT FROM OLD.mime_type        THEN RAISE EXCEPTION 'metadata immutable: mime_type';        END IF;
  IF NEW.size_bytes       IS DISTINCT FROM OLD.size_bytes       THEN RAISE EXCEPTION 'metadata immutable: size_bytes';       END IF;
  IF NEW.contact_channel  IS DISTINCT FROM OLD.contact_channel  THEN RAISE EXCEPTION 'metadata immutable: contact_channel';  END IF;
  IF NEW.summary          IS DISTINCT FROM OLD.summary          THEN RAISE EXCEPTION 'metadata immutable: summary';          END IF;
  IF NEW.envelope_key_id  IS DISTINCT FROM OLD.envelope_key_id  THEN RAISE EXCEPTION 'metadata immutable: envelope_key_id';  END IF;
  IF NEW.encryption_iv    IS DISTINCT FROM OLD.encryption_iv    THEN RAISE EXCEPTION 'metadata immutable: encryption_iv';    END IF;
  IF NEW.intent_at        IS DISTINCT FROM OLD.intent_at        THEN RAISE EXCEPTION 'metadata immutable: intent_at';        END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_underground_evidence_files_metadata_immutable
  BEFORE UPDATE ON public.underground_evidence_files
  FOR EACH ROW EXECUTE FUNCTION prevent_underground_evidence_files_metadata_mutation();
```

### Migration 0012 — `public.ug_second_leader`

```sql
CREATE TABLE public.ug_second_leader (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE NO ACTION,
  applicant_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE NO ACTION,
  join_code_used text NOT NULL,

  queue_state text NOT NULL DEFAULT 'untouched' CHECK (queue_state IN (
    'untouched', 'in_review', 'leader_replied', 'info_requested', 'approved', 'rejected'
  )),

  -- Claim attribution (mirrors churches)
  in_review_claimed_by uuid REFERENCES public.users(id),
  in_review_claimed_at timestamptz,

  -- Vouch + lifecycle
  founding_leader_vouch text,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.users(id),
  rejected_at timestamptz,
  rejected_by uuid REFERENCES public.users(id),
  rejection_note text,

  last_state_change_at timestamptz NOT NULL DEFAULT now(),  -- per DBA D14; updated by RPCs
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ug_second_leader_parent_idx
  ON public.ug_second_leader (parent_church_id, created_at DESC);

CREATE INDEX ug_second_leader_claimed_by_idx
  ON public.ug_second_leader (in_review_claimed_by)
  WHERE in_review_claimed_by IS NOT NULL;
```

**NO partial unique index on `id WHERE in_review_claimed_by IS NOT NULL`** — same semantic no-op as the churches version. Race protection via atomic UPDATE primitive (see §3).

### Migration 0013 — Audit action additions + `underground_detail_events` for Realtime

**`audit_log_underground` action CHECK expansion.** Single `ALTER TABLE` with both DROP and ADD as comma-separated subcommands — atomic inside the ACCESS EXCLUSIVE lock; no window where the constraint is absent. DBA: dedupe against the live CHECK (4 of the 11 manifest-proposed actions are ALREADY present per live introspection — verify per-action via `pg_get_constraintdef`).

New actions to ADD (after dedupe):
```
'underground_claim_marked'
'underground_claim_released'
'underground_claim_force_unmarked'
'underground_claim_routed_day_25'
'underground_request_release_pinged'
'underground_admin_note_added'            -- VERIFY: may already exist; dedupe
'underground_evidence_intent'
'underground_evidence_confirmed'
'underground_evidence_deleted'
'underground_evidence_signed_url_minted'  -- NEW per BE B02
'ug_second_leader_submitted'
'ug_second_leader_approved'
'ug_second_leader_rejected'
```

Meta column usage pattern: narrative notes write `{ "contact_channel": "signal" }`; evidence rows write `{ "evidence_file_id": "...", "linked_audit_id": "..." }`; signed-URL mint rows write `{ "evidence_file_id": "...", "ttl_seconds": 300 }`.

**Realtime event-only table (ruling #2 — Option A):**

```sql
CREATE TABLE public.underground_detail_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE NO ACTION,
  kind text NOT NULL CHECK (kind IN (
    'claim_changed', 'note_added', 'evidence_added', 'evidence_deleted',
    'evidence_signed_url_minted', 'proposal_created', 'proposal_confirmed',
    'force_unmarked', 'routed_to_founder',
    'sibling_state_changed'
  )),
  ref_id uuid,                       -- audit/proposal/evidence/sibling row id
  emitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX underground_detail_events_church_idx
  ON public.underground_detail_events (church_id, emitted_at DESC);

-- Add ONLY this table to the supabase_realtime publication (NOT the underlying corpus tables)
ALTER PUBLICATION supabase_realtime ADD TABLE public.underground_detail_events;
```

NO PII columns on this table. The IDs-only contract is enforced at the schema level — even if a misconfigured RLS lets a non-admin subscribe, all they see is church_id + kind + ref_id + emitted_at. They cannot reach the actual note body / evidence summary / vouch text without going through an admin-gated RPC.

---

## 2 · RLS write-policy hardening (REVISED — column-level GRANT, not RLS)

**DBA D02 — the manifest v1 RLS approach was wrong.** Postgres has no column-level UPDATE RLS. The right tool is column-level GRANT revocation. SECURITY DEFINER RPCs (owned by `postgres`) bypass.

```sql
-- Block direct UPDATEs to in_review_* columns on churches from authenticated/anon roles.
-- SECURITY DEFINER RPCs bypass because they execute as the function owner role.
REVOKE UPDATE (in_review_claimed_by, in_review_claimed_at, in_review_routed_to_founder_at)
  ON public.churches FROM authenticated, anon;

REVOKE UPDATE (in_review_claimed_by, in_review_claimed_at, queue_state, founding_leader_vouch,
               approved_at, approved_by, rejected_at, rejected_by, rejection_note, last_state_change_at)
  ON public.ug_second_leader FROM authenticated, anon;

-- underground_claim_events: append-only via trigger AND no INSERT grant to authenticated.
REVOKE ALL ON public.underground_claim_events FROM authenticated, anon;
-- (SECURITY DEFINER RPCs INSERT.)

-- underground_evidence_files: append-only on metadata via trigger AND no direct grants.
REVOKE ALL ON public.underground_evidence_files FROM authenticated, anon;

-- underground_detail_events: append-only by RPC; no direct grants.
REVOKE ALL ON public.underground_detail_events FROM authenticated, anon;
```

**Read access for `underground_claim_events`, `underground_evidence_files`, `ug_second_leader`** is gated on `is_underground_admin = true` (JWT claim from `custom_access_token_hook`). Anonymous + non-admin authenticated users get zero rows. Spec the SELECT policy per table:

```sql
ALTER TABLE public.underground_claim_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY underground_claim_events_admin_select
  ON public.underground_claim_events FOR SELECT TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_underground_admin')::boolean, false) = true);

ALTER TABLE public.underground_evidence_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY underground_evidence_files_admin_select
  ON public.underground_evidence_files FOR SELECT TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_underground_admin')::boolean, false) = true);

ALTER TABLE public.ug_second_leader ENABLE ROW LEVEL SECURITY;
CREATE POLICY ug_second_leader_admin_select
  ON public.ug_second_leader FOR SELECT TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_underground_admin')::boolean, false) = true);

ALTER TABLE public.underground_detail_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY underground_detail_events_admin_select
  ON public.underground_detail_events FOR SELECT TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_underground_admin')::boolean, false) = true);
```

**DBA D06 — verify `audit_log_underground` RLS posture.** Live: RLS enabled AND FORCED (`relforcerowsecurity = true`). Confirm the existing SECURITY DEFINER write path still works (DEFINER RPCs writing to `audit_log_underground` must have an INSERT policy that lets them through OR be owned by a role with BYPASSRLS). Spec a HALT if this is not in order.

---

## 3 · RPC names + signatures (REVISED)

All SECURITY DEFINER with `SET search_path = ''`. All include the verbatim JWT preamble:

```sql
-- Gate preamble — first statement of every RPC body
IF NOT COALESCE((auth.jwt() ->> 'is_underground_admin')::boolean, false) THEN
  RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
END IF;
```

All write to `audit_log_underground` + `underground_claim_events` as appropriate AND emit an `underground_detail_events` row inside the same transaction (so Realtime subscribers see the change).

### Atomic claim primitive (race-free, deadlock-free)

The claim mutation is a single statement — no `SELECT FOR UPDATE`, no partial unique index needed:

```sql
UPDATE public.churches
   SET in_review_claimed_by = auth.uid(),
       in_review_claimed_at = now()
 WHERE id = p_entity_id
   AND in_review_claimed_by IS NULL
RETURNING id, in_review_claimed_by, in_review_claimed_at;
```

If 0 rows return ⇒ another admin won the race ⇒ read the current claimer in a follow-up SELECT and return `{conflict_with_user_id: <current claimer>}`. Race resolution is deterministic via Postgres row-level locking on UPDATE. Same primitive for `ug_second_leader` claim.

### Claim lifecycle

```sql
fn_underground_claim(
  p_entity_kind text,        -- 'church' | 'ug_second_leader'
  p_entity_id uuid
) RETURNS jsonb;  -- { claimed_by, claimed_at, conflict_with_user_id? }

fn_underground_release_claim(
  p_entity_kind text,
  p_entity_id uuid
) RETURNS jsonb;  -- asserts caller = current claimer

-- Force-unmark (top-tier admin only — JWT claim path, ruling #3).
-- AAL2 freshness is SERVER-SIDE ONLY: queries auth.sessions; client-supplied
-- timestamp is NOT a parameter (was `p_aal2_fresh_at`, REMOVED).
fn_underground_force_unmark_claim(
  p_entity_kind text,
  p_entity_id uuid,
  p_reason_code text,            -- 'admin_off_7d' | 'admin_offboarded' | 'case_re_routed' | 'other'
  p_reason_supplement text,      -- length ≥ 30
  p_typed_claimer_name text      -- must equal current claimer's display name
) RETURNS jsonb;
```

**Top-tier admin assertion inside force-unmark RPC:**

```sql
-- Gate preamble (standard)
IF NOT COALESCE((auth.jwt() ->> 'is_underground_admin')::boolean, false) THEN
  RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
END IF;

-- Top-tier assertion (force-unmark only)
IF NOT COALESCE((auth.jwt() ->> 'is_top_tier_admin')::boolean, false) THEN
  RAISE EXCEPTION 'forbidden: top-tier admin required' USING ERRCODE = '42501';
END IF;

-- AAL2 freshness (5 min, SERVER-SIDE)
IF NOT EXISTS (
  SELECT 1 FROM auth.sessions s
   WHERE s.user_id = auth.uid()
     AND s.aal = 'aal2'
     AND s.updated_at >= now() - interval '5 min'
) THEN
  RAISE EXCEPTION 'aal2 freshness required' USING ERRCODE = '28000';
END IF;

-- Reason supplement length gate
IF length(coalesce(p_reason_supplement, '')) < 30 THEN
  RAISE EXCEPTION 'reason supplement must be ≥ 30 chars';
END IF;

-- Typed-claimer-name gate (after fetching current claimer's display name)
-- ...
```

**Persist the server-observed AAL2 freshness timestamp** into `underground_claim_events.aal2_fresh_at` (NOT the client-supplied value, which doesn't exist anyway since `p_aal2_fresh_at` was removed).

**Day-25 auto-route race semantics (per BE B10):**
- Auto-route never blocks on claim attribution. If claim is released or force-unmarked concurrently with auto-route, both rows succeed; the audit trail records both events with their server-observed timestamps.
- The Founder routing semantic is set-or-noop on `in_review_routed_to_founder_at` — already-routed rows are no-op (UPDATE WHERE in_review_routed_to_founder_at IS NULL).

```sql
fn_underground_route_to_founder_day_25(
  p_entity_kind text,
  p_entity_id uuid
) RETURNS jsonb;

fn_underground_request_release(
  p_entity_kind text,
  p_entity_id uuid,
  p_message text                 -- optional, ≤ 500 chars
) RETURNS jsonb;
```

### Narrative notes (claimer-only)

```sql
fn_underground_add_narrative_note(
  p_church_id uuid,
  p_contact_channel text,
  p_body text                    -- length ≥ 1, ≤ 5000
) RETURNS uuid;  -- the new audit_log_underground row id (becomes linked_audit_id for evidence)
```

**`fn_get_admin_notes_thread` extension** — preserve existing call surface; ADD `contact_channel` + `linked_audit_id` columns to the returned shape. Per DBA D11/B11: the change is additive (new keys, no removals). Update any snapshot test in `replant-admin/src/test/` that captures the notes-thread shape.

### Evidence (claimer-only) — audit-before-content split

```sql
-- Step 1: claimer announces upload intent. Returns intent_id + signed PUT URL (TTL 5 min).
fn_underground_create_evidence_intent(
  p_church_id uuid,
  p_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_contact_channel text,
  p_summary text,
  p_linked_audit_id uuid          -- optional; ruling #5
) RETURNS jsonb;  -- { intent_id, signed_put_url, storage_path, expires_at }

-- Step 2: claimer confirms upload landed. IDEMPOTENT on intent_id (already-confirmed = no-op
-- returning prior confirmed_at). Verifies storage object exists + size_bytes matches intent;
-- size mismatch → soft-delete the row, leave bytes for orphan-bytes cleanup cron.
fn_underground_confirm_evidence(
  p_intent_id uuid
) RETURNS jsonb;

-- Soft-delete. Claimer-only. Hard-deleted at Day-30 hard-delete cron (per ruling #12).
fn_underground_delete_evidence(
  p_evidence_id uuid
) RETURNS jsonb;

-- Generate 5-min signed GET URL for viewing (ruling #6).
-- Writes 'underground_evidence_signed_url_minted' audit row (BE B02).
fn_underground_get_evidence_signed_url(
  p_evidence_id uuid
) RETURNS jsonb;  -- { signed_url, expires_at }
```

### Second-leader sibling — separate queue surface (ruling #5)

```sql
-- New RPC just for sibling rows. Returns rows ordered by created_at DESC.
fn_list_pending_ug_siblings() RETURNS TABLE (
  sibling_id uuid,
  parent_church_id uuid,
  parent_church_name text,                -- masked per parent's visibility
  parent_church_visibility text,          -- 'visible' | 'hidden'
  applicant_user_id uuid,
  applicant_claimed_name text,
  applicant_claimed_role text,
  queue_state text,
  in_review_claimed_by uuid,
  in_review_claimed_by_name text,
  in_review_claimed_at timestamptz,
  last_state_change_at timestamptz,
  created_at timestamptz
);

fn_ug_second_leader_approve(
  p_sibling_id uuid,
  p_founding_leader_vouch text   -- optional
) RETURNS jsonb;

fn_ug_second_leader_reject(
  p_sibling_id uuid,
  p_rejection_note text          -- ≥ 10 chars
) RETURNS jsonb;
```

**`fn_list_pending_underground_queue` extension** — adds claim attribution columns ONLY. Sibling rows are NOT mixed in (ruling #5). New columns:
- `in_review_claimed_by` (uuid|null)
- `in_review_claimed_by_name` (text|null)
- `in_review_claimed_at` (timestamptz|null)
- `in_review_routed_to_founder_at` (timestamptz|null)

Inbox surfacing rule (ruling #4 from 2026-06-22): an `in_review` row appears in Inbox IF `leader_reply_pending = true`. The existing Inbox query gets a JOIN + filter to surface the claim badge inline.

---

## 4 · Storage bucket — `underground_evidence` (NEW SECTION per DBA D10)

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'underground_evidence',
  'underground_evidence',
  false,
  26214400,  -- 25 MB per file
  ARRAY[
    'image/jpeg','image/png','image/heic','image/webp',
    'application/pdf',
    'audio/mpeg','audio/mp4','audio/x-m4a',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
);

-- Deny-all RLS on storage.objects for this bucket from authenticated/anon roles.
-- Only service-role-signed URLs (minted by SECURITY DEFINER RPCs) work.
CREATE POLICY underground_evidence_deny_authenticated
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id <> 'underground_evidence')
  WITH CHECK (bucket_id <> 'underground_evidence');

CREATE POLICY underground_evidence_deny_anon
  ON storage.objects FOR ALL TO anon
  USING (bucket_id <> 'underground_evidence')
  WITH CHECK (bucket_id <> 'underground_evidence');
```

**Posture C posture (ruling #1):**
- **Private bucket.** No public reads.
- **Path convention:** `{church_id}/{file_uuid}.{ext}` (NEVER use filename in path).
- **Per-file cap:** 25 MB (storage policy + RPC CHECK on `size_bytes`).
- **Per-church soft cap:** 200 MB (RPC `fn_underground_create_evidence_intent` rejects with warning at 200 MB; hard rejects at 250 MB).
- **Signed URL TTL:** PUT = 5 min (upload window), GET = 5 min (view window, ruling #6).
- **MIME enforcement:** storage policy whitelists + RPC CHECK. Note (BE B08): both walls operate on client-supplied Content-Type; byte sniffing not performed. Cross-MIME-exec attacks on viewers mitigated by Content-Type stickiness on signed-URL responses.
- **Client-side prep (admin FE responsibility):**
  - EXIF strip on images BEFORE upload (use `piexifjs` or equivalent).
  - Filename sanitization (strip path separators, control chars, normalize unicode).
- **Server-side EXIF scrub (HARD REQUIREMENT per BE B09):** post-confirm, a daemon or pg_cron-scheduled job sweeps newly-confirmed image rows in the last hour, downloads bytes, strips EXIF via `sharp` / `exifr`, re-uploads with metadata cleared. Belt-and-suspenders against compromised admin clients.
- **Encryption at rest:** Supabase Storage default (AES-256). Posture C does NOT add client-side envelope encryption — v2 deferred per [[postmvp-envelope-encryption-v2]].

**Encryption claim in admin UI:** widget shows lock icon + footer text *"Files are encrypted at rest by Supabase Storage."* (factual). DO NOT claim client-side or envelope encryption.

---

## 5 · pg_cron jobs

Naming convention: snake_case, descriptive, schedule-suffixed (matches existing live convention).

```sql
-- Orphan intent ROW cleanup — hourly. Deletes intent rows never confirmed.
SELECT cron.schedule('underground_orphan_evidence_intent_hourly', '0 * * * *', $$
  DELETE FROM public.underground_evidence_files
  WHERE confirmed_at IS NULL AND intent_at < now() - interval '1 hour';
$$);

-- Orphan BYTES cleanup — daily (BE B03). Bytes uploaded but confirm never called,
-- OR rows soft-deleted with bytes still in bucket.
-- Implementation note: this is a Netlify scheduled function, NOT pg_cron, because
-- it needs Supabase Storage list API access. Schedule via Netlify scheduled-functions
-- daily at 03:00 UTC; spec the function path in §6.
-- DBA reports orphan byte paths; Netlify function deletes via service-role storage API.

-- Day-25 auto-route — daily 09:00 UTC. Gates on day_of_window (ruling: window-age, not claim age).
SELECT cron.schedule('underground_day_25_route_daily', '0 9 * * *', $$
  SELECT fn_underground_route_to_founder_day_25('church', q.church_id)
  FROM fn_list_pending_underground_queue() q
  WHERE q.day_of_window >= 25
    AND q.in_review_claimed_by IS NOT NULL
    AND q.in_review_routed_to_founder_at IS NULL;
$$);
```

---

## 6 · Netlify functions (admin BE) — 11 endpoints

All endpoints sit behind the existing `_lib/underground-admin-gate.js` factory (defense-in-depth gate from 2026-06-22 panel). All call the RPCs above (no direct SQL). All use **POST** (matches existing platform convention — `call()` helper in `src/lib/api.js` hardcodes `method: 'POST'`).

| # | Endpoint                                          | Method | RPC backing                                  | Rate limit (keyPrefix)            |
|---|---------------------------------------------------|--------|----------------------------------------------|-----------------------------------|
| 1 | `/underground/claim`                              | POST   | `fn_underground_claim`                       | `ug:claim` (30/min/admin)         |
| 2 | `/underground/release-claim`                      | POST   | `fn_underground_release_claim`               | `ug:release` (30/min/admin)       |
| 3 | `/underground/force-unmark-claim`                 | POST   | `fn_underground_force_unmark_claim`          | `ug:force-unmark` (10/min/admin)  |
| 4 | `/underground/request-release`                    | POST   | `fn_underground_request_release`             | `ug:request-release` (30/min)     |
| 5 | `/underground/narrative-note`                     | POST   | `fn_underground_add_narrative_note`          | `ug:narrative` (10/min/admin)     |
| 6 | `/underground/evidence/create-intent`             | POST   | `fn_underground_create_evidence_intent`      | `ug:evidence-intent` (20/min)     |
| 7 | `/underground/evidence/confirm`                   | POST   | `fn_underground_confirm_evidence`            | `ug:evidence-confirm` (20/min)    |
| 8 | `/underground/evidence/delete`                    | POST   | `fn_underground_delete_evidence`             | `ug:evidence-delete` (10/min)     |
| 9 | `/underground/evidence/signed-url`                | POST   | `fn_underground_get_evidence_signed_url`     | `ug:evidence-signed-url` (60/min) |
| 10 | `/underground/sibling/approve`                   | POST   | `fn_ug_second_leader_approve`                | `ug:sibling-approve` (10/min)     |
| 11 | `/underground/sibling/reject`                    | POST   | `fn_ug_second_leader_reject`                 | `ug:sibling-reject` (10/min)      |

**Rate-limit posture (ruling #4):** fail-OPEN-on-Upstash-degraded (matches existing platform convention; existing `_lib/rate-limit.js` returns `{allowed: true, degraded: true}` on Upstash unreachable). Each endpoint passes its `keyPrefix` explicitly. **Launch-readiness check:** verify `UPSTASH_REDIS_REST_URL` is set in admin Netlify env BEFORE go-live; document in deploy checklist.

**`src/lib/api.js` exports (corrected path per BE B01).** Add named exports for each endpoint. Use the existing `call(path, body, { stepUpToken })` helper at the top of `src/lib/api.js` — do NOT raw-fetch. The `stepUpToken` plumbing handles AAL2 step-up modal retry; new endpoints inherit it for free.

```js
export const claim = (entity_kind, entity_id) =>
  call('underground-claim', { entity_kind, entity_id });

export const releaseClaim = (entity_kind, entity_id) =>
  call('underground-release-claim', { entity_kind, entity_id });

export const forceUnmarkClaim = (args, stepUpToken) =>
  call('underground-force-unmark-claim', args, { stepUpToken });

// ... etc for the remaining 8 endpoints
```

**Orphan-bytes Netlify scheduled function (per BE B03).** New file `replant-admin/netlify/functions/scheduled-underground-orphan-bytes.js`. Schedule via `netlify.toml` `[functions."scheduled-underground-orphan-bytes"]` at `@daily`. Logic: list objects in `underground_evidence` bucket older than 1h; for each, check `underground_evidence_files.storage_path`; if no matching row, delete the object via service-role storage API.

---

## 7 · React (admin FE) deliverables

Per CD scaffolds at `/Users/ife/replant/docs/design_handoff_in_review/source/`. **Lift the rest from `preview/index.html` markup** (class-based against live `globals.css`).

### New components

| File path                                                              | Source scaffold reference            |
|------------------------------------------------------------------------|--------------------------------------|
| `replant-admin/src/components/underground/ClaimAffordance.jsx`         | source/ClaimAffordance.jsx           |
| `replant-admin/src/components/underground/NarrativeComposer.jsx`       | source/NarrativeComposer.jsx         |
| `replant-admin/src/components/underground/EvidenceUpload.jsx`          | source/EvidenceUpload.jsx            |
| `replant-admin/src/components/underground/ForceUnmarkModal.jsx`        | source/ForceUnmarkModal.jsx          |
| `replant-admin/src/components/underground/MarkInReviewSoftModal.jsx`   | preview §a8 markup                   |
| `replant-admin/src/components/underground/ClaimConflictModal.jsx`      | preview §a9 markup                   |
| `replant-admin/src/components/underground/SecondLeaderDetail.jsx`      | preview §a10 lightweight detail      |
| `replant-admin/src/screens/UndergroundSiblings.jsx`                    | NEW — own queue section for sibling rows (ruling #5) |

### Edited components

| File path                                                | Edits                                                                                                                                                                                                  |
|----------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `replant-admin/src/screens/UndergroundDetail.jsx`        | Mount ClaimAffordance top-right of header strip; mount NarrativeComposer above admin notes panel; mount EvidenceUpload below T1/T2 cards; disable primary CTAs in Action Bar when `claim && !isClaimer`. Subscribe to `underground_detail_events` Realtime channel; re-fetch on event.  |
| `replant-admin/src/screens/UndergroundPending.jsx`       | Render InReviewPill when `row.in_review_claimed_by IS NOT NULL`; add "My claims" filter chip + `body.state-dots-colored` body class on app mount; `.sla-agg-blue` → `.sla-agg-neutral`. Does NOT render sibling rows. |
| `replant-admin/src/screens/UndergroundInbox.jsx`         | Surface in_review rows with active leader-reply convo (ruling #4 from 2026-06-22); render the claim badge inline.                                                                                       |
| `replant-admin/src/components/StatePill.jsx`             | Extend with `in_review` family (`.ir-active` / `.ir-stale` / `.ir-vstale` per CD).                                                                                                                       |
| `replant-admin/src/lib/api.js`                           | Named exports for the 11 endpoints (use existing `call(...)` helper).                                                                                                                                   |
| `replant-admin/src/styles/globals.css`                   | Merge the new `.ir-pill`, `.ir-active`, `.ir-stale`, `.ir-vstale`, `.claim-cluster`, `.claim-check`, `.claim-link`, `.nc`, `.chan-chip`, `.dropzone`, `.cap`, `.evf-row`, `.link-chip`, `.gate` rules from `preview/in-review-cd.css`. |
| `replant-admin/src/App.jsx` (router)                     | Add route `/underground/second-leader/:id` → `<SecondLeaderDetail />`. Add route `/underground/siblings` → `<UndergroundSiblings />`.                                                                    |
| `replant-admin/src/screens/UndergroundNav.jsx` (or equivalent nav)  | Add nav entry "Second-leader applications" linking to `/underground/siblings`. Sibling queue is a peer section under the Underground area.            |

### `body.state-dots-colored` (2026-06-23)

Apply `state-dots-colored` to `document.body` at app boot via small `useEffect` in `<App>`. Active states get left dots: Leader replied · blue, Awaiting confirm · blue, Info requested · amber, Locked · white. Untouched + In Review unchanged.

### Realtime subscription pattern

On `UndergroundDetail.jsx` mount, subscribe to `underground_detail_events` filtered by `church_id`. On every event received:
- `claim_changed` → re-fetch row + claim state.
- `note_added` → re-fetch notes thread.
- `evidence_added` / `evidence_deleted` → re-fetch evidence file list.
- `evidence_signed_url_minted` → no UI action (audit-only event for cross-admin visibility post-MVP).
- `proposal_created` / `proposal_confirmed` → re-fetch proposal state.
- `force_unmarked` / `routed_to_founder` → re-fetch row + claim state.
- `sibling_state_changed` → no action on Detail page (relevant only on sibling queue / sibling detail).

NEVER trust the event payload as authoritative state — re-fetch by ID is the contract.

---

## 8 · Cross-lane dependency graph

```
DBA lane (0009 → 0010 → 0011 → 0012 → 0013 — 0014 STRICKEN)
   │
   ├─→ Storage bucket creation (Migration 0013 — bucket exists before RPCs reference it)
   │
   ├─→ Cron jobs (after RPCs exist)
   │
   └─→ blocks BE lane (RPCs must exist before Netlify endpoints can wire)
                │
                ├─→ blocks FE lane API exports
                │
                └─→ blocks Realtime subscription (underground_detail_events table)

BE lane (gate → 11 endpoints → rate limits → orphan-bytes scheduled function)
   │
   └─→ blocks FE component wiring

FE lane (components → screens → router → globals.css merge → nav)
   │
   └─→ blocks Founder smoke-test
```

**Suggested subagent split:**
- **DBA subagent:** owns migrations 0009–0013, RLS hardening + column-level GRANTs, append-only triggers + metadata-immutability trigger, storage bucket creation + storage.objects RLS, pg_cron jobs (intent + day-25 route), `custom_access_token_hook` update to mint `is_top_tier_admin` claim, Realtime publication addition for `underground_detail_events` only.
- **Admin BE+FE subagent:** owns the 11 Netlify endpoints, `src/lib/api.js` exports, the orphan-bytes scheduled Netlify function, all 8 new components + edits to UndergroundDetail/Pending/Inbox/Nav/StatePill/globals.css + router routes, Realtime subscription pattern on UndergroundDetail, server-side EXIF scrub job (Netlify scheduled OR pg_cron — subagent picks).

Mobile lane: SKIPPED.

---

## 9 · HALT-IF protocol (both subagents)

Stop and HALT_REQUEST (do NOT continue without Founder/orchestrator approval) when ANY of:

1. A spec-locked Founder ruling appears to conflict with the manifest as written.
2. An existing shipped function/migration/component cannot be cleanly extended and would need destructive replacement.
3. The atomic claim primitive (`UPDATE WHERE ... IS NULL RETURNING`) doesn't behave as expected under concurrent load (write a contained test, NOT against `audit_log_underground` rows).
4. Append-only trigger verification ambiguity — confirm via `pg_get_triggerdef` and surface the verdict before applying.
5. Day-25 auto-route would race with a concurrent claim release / force-unmark in a way the manifest didn't cover.
6. Storage bucket creation requires an org-level permission you don't have.
7. `custom_access_token_hook` update breaks an existing JWT claim consumed by shipped code (audit existing hook claims before editing).
8. `auth.sessions` schema / AAL2 query returns no rows for known top-tier admins (suggests aal column semantics differ from what the manifest assumes).

DO NOT write `audit_log_underground` or `audit_log` probe rows for verification (per [[feedback-audit-log-append-only]]). Use `pg_get_constraintdef` / `pg_get_triggerdef` instead.

---

## 10 · Output format (each subagent's final response)

```
VERDICT: shipped | shipped-with-deviations | halted
MIGRATIONS APPLIED: [0009, 0010, 0011, 0012, 0013]
RPCS CREATED: [...]
NETLIFY ENDPOINTS ADDED: [...]
COMPONENTS CREATED: [...]
COMPONENTS EDITED: [...]
STORAGE BUCKET POLICY: <verbatim policy text or "applied — see Migration 0013">
CRON JOBS SCHEDULED: [...]
RLS POLICIES TOUCHED: [...]
COLUMN GRANTS REVOKED: [...]
custom_access_token_hook UPDATED: yes | no | unchanged
REALTIME PUBLICATION ADDITIONS: [underground_detail_events]
DEVIATIONS FROM MANIFEST: <list each + reason>
HALT_REQUESTS: <list each + context>
FILES TOUCHED: <full path list, for the release notes>
COMMIT SHA RANGE: <first..last on the lane's branch>
```

The orchestrator uses this to compose the release notes per `docs/release_notes/2026-MM-DD-in-review-claim-model.md` (template at `docs/release_notes/TEMPLATE.md`).

In Jesus' name, Amen.
