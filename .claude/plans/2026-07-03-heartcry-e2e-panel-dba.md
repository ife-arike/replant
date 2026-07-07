# Heartcry E2E v2 (KAN-313) — DBA lane design

**Panel:** SEC / DBA / BE — this is the DBA deliverable. 2026-07-03.
**Ticket (live-verified):** [KAN-313](https://projectreplant.atlassian.net/browse/KAN-313) "Heartcry E2E v2 — CRITICAL #1 post-MVP (unified envelope encryption; SEC design panel now)" — In Progress.
**Scope:** schema + migration story for the unified admin-keypair/envelope architecture covering heartcry text AND `underground_evidence` files (absorbs envelope-v2 per Founder ruling). All DDL below is **illustrative — not to apply**. Every current-state claim was read-only-verified against live prod `jiyetphxxvyiicrnwlnx` on 2026-07-03.

**DBA verdict: APPROVE the envelope architecture as designed below — wrapped-key TABLE (not embedded column), one shared keypair registry with per-domain wrapped-key tables and per-domain audit sinks, escrow recipient recommended.**

---

## 1. Verified current state (live introspection, 2026-07-03)

1. `heartcries.content` = pgp_sym ciphertext; `encrypt_heartcry_content` / `decrypt_heartcry_content` / `get_heartcry_encryption_key` are SECURITY DEFINER, EXECUTE **postgres + service_role only** (P0-1 break-glass `20260702021323` revoked anon/authenticated/public and pinned search_path). Key `heartcry_encryption_key` in Supabase Vault (`supabase_vault` 0.3.1).
2. `admin_open_heartcry(p_heartcry_id, p_admin_id, p_operation_id, p_ip, p_user_agent) RETURNS json` — SECURITY DEFINER, service_role-EXECUTE-only. Ceremony: require operation_id → decrypt → **2 audit_log rows (`read_heartcry` + `read_region`) insert before plaintext returns** (single transaction: audit failure aborts, plaintext never leaves) → status flip `received→seen` + `triage_lead_id` → return plaintext + church metadata. TOTP/AAL2 gate lives in the `admin-open-heartcry` edge function (JWT claims: `super_admin === true`, `aal2`, amr totp freshness — constant currently `300_000` ms; the locked 4-tier MFA ruling names life-safety **90 s** — alignment flagged to SEC lane, not a DBA call).
3. `get_my_heartcries()` returns id, severity, created_at, feed_content, status, responded_at, thread_id — **never `content`**. Authors do not re-read their plaintext today. Load-bearing simplification for E2E (§15 D4).
4. RLS on `heartcries`: admin SELECT via JWT `super_admin` claim; own-row SELECT (ciphertext only reachable); INSERT gated to verified active self. `heartcry_holds` unaffected by this design.
5. `underground_evidence_files` already carries `envelope_key_id text` + `encryption_iv text` (nullable, v2-deferred precedent), deny-all RLS except one SELECT policy for `is_underground_admin` JWT; metadata-immutability trigger `trg_underground_evidence_files_metadata_immutable`; single SELECT-policy audit sink is **`audit_log_underground`** (separate table, own action CHECK — verified).
6. Both audit tables have action CHECK constraints that must be extended (verified live: `audit_log_action_check`, `audit_log_underground_action_check`). `audit_log` is append-only — never probed; constraints read via `pg_get_constraintdef`.
7. Admin population + tier truth: `public.users.is_top_tier_admin` (column-authoritative per locked ruling), `is_underground_admin` (column + JWT dual-source — column is what `fn_assert_underground_admin` reads); super_admin tier minted into JWT by `custom_access_token_hook` from `auth.users.raw_app_meta_data`. **Live drift found:** 2 auth rows have `admin_tier='super_admin'` + `role='super_admin'`, 2 have `role='super_admin'` with `admin_tier` NULL, 1 has `admin_tier='regular'` — the eligibility predicate (§6.3) must read the same field the auth hook reads; handed to BE lane (§14.1).
8. Corpus: **4 heartcries (2 feed_approved), 5 evidence files, 2 top-tier admins, ~4 super-admin-tier auth rows.** Migration is cheap now, exactly as the ruling anticipated.
9. Extensions: pgcrypto 1.3, supabase_vault, pg_cron, pg_net. **No pgsodium.** All heartcry FKs are ON DELETE NO ACTION; hard-delete sweeper handles user deletion out-of-band.

---

## 2. Architecture summary (what "unified" means at the schema layer)

1. **One keypair per admin, one shared registry** (`admin_encryption_keys`). Custody burden (device key + ceremony) is per-admin and singular; scopes are NOT stored on the key — eligibility is derived at wrap/release time from the tier columns (heartcry scope = super_admin tier OR `is_top_tier_admin`; evidence scope = that AND `is_underground_admin` column). One registry, one custody ceremony — the unification the Founder ruled.
2. **Per-domain wrapped-key tables** (`heartcry_wrapped_keys`, `underground_evidence_wrapped_keys`) sharing one shape. Rejected alternatives: (a) one polymorphic table (`subject_type` + `subject_id`) — loses native FK integrity + CASCADE; (b) a first-class `envelopes` table both domains FK into — clean but adds a join + insert to every path for zero access-model benefit, because the two domains have **different recipient sets and different audit sinks** (`audit_log` vs `audit_log_underground`) and must stay separately gated anyway. Two thin tables + one registry is the honest minimum.
3. **DB stores opaque blobs only.** Content is AES-256-GCM ciphertext encrypted client-side (mobile for heartcries; admin dashboard for evidence upload); the per-message content key (CEK) is wrapped client-side to each recipient public key (exact primitive — X25519 sealed box vs WebCrypto-native ECDH-P256/RSA-OAEP — is SEC lane's; DBA stores `key_alg`/`wrap_alg` tags for agility). **No new extensions required; the DB never performs v2 crypto.** pgcrypto remains only for the legacy pgp_sym path until retirement (§9).
4. **Fetch-audit is enforced where the DB can enforce it:** wrapped-key rows are reachable through exactly one SECURITY DEFINER release RPC per domain, which inserts audit rows in the same transaction before the wrapped key is returned. Post-release client-side decryption is not server-auditable — that trade is Founder-acknowledged in the KAN-313 ruling; the DB's job is to make key *release* non-bypassable and fully attributed, and this design does.

---

## 3. DDL sketches — registry + roster

```sql
-- 3.1 Admin keypair registry (shared by heartcry + UG evidence)
CREATE TABLE public.admin_encryption_keys (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type   text NOT NULL DEFAULT 'admin'
                     CHECK (recipient_type IN ('admin','escrow')),
  admin_user_id    uuid REFERENCES public.users(id),      -- public.users.id (audit FK convention)
  public_key       text NOT NULL,                          -- base64 SPKI / raw pubkey per key_alg
  key_alg          text NOT NULL,                          -- SEC lane picks suite; versioned tag
  key_fingerprint  text NOT NULL,                          -- SHA-256 of public_key; ceremony-verifiable
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','active','revoked')),
  enrolled_at      timestamptz NOT NULL DEFAULT now(),
  enrolled_by      uuid REFERENCES public.users(id),       -- ceremony witness / BE actor
  activated_at     timestamptz,
  activated_by     uuid REFERENCES public.users(id),       -- authorizing key-holder (re-wrap ceremony)
  revoked_at       timestamptz,
  revoked_by       uuid REFERENCES public.users(id),
  revoke_reason    text,
  CHECK ((recipient_type = 'admin') = (admin_user_id IS NOT NULL)),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),
  CHECK ((status <> 'active') OR (activated_at IS NOT NULL))
);
CREATE UNIQUE INDEX admin_encryption_keys_one_active_per_admin
  ON public.admin_encryption_keys (admin_user_id)
  WHERE status = 'active' AND recipient_type = 'admin';
CREATE UNIQUE INDEX admin_encryption_keys_one_active_escrow
  ON public.admin_encryption_keys (recipient_type)
  WHERE status = 'active' AND recipient_type = 'escrow';
CREATE UNIQUE INDEX admin_encryption_keys_fingerprint_uq
  ON public.admin_encryption_keys (key_fingerprint);
```

```sql
-- 3.2 Signed roster documents (anti key-substitution; mobile verifies against pinned verify-key)
-- Append-only. SEC lane owns the signing scheme; DB stores + serves.
CREATE TABLE public.envelope_roster_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_version integer NOT NULL UNIQUE,
  scope          text NOT NULL CHECK (scope IN ('heartcry','ug_evidence')),
  roster         jsonb NOT NULL,      -- [{key_id, key_fingerprint, key_alg}] — NO admin identities
  signature      text NOT NULL,       -- offline signing key; pinned verify-key in app build
  signed_at      timestamptz NOT NULL DEFAULT now(),
  published_by   uuid REFERENCES public.users(id)
);
```

The mobile client wraps only to keys present in the latest **signature-valid** roster; a compromised server cannot inject an attacker key without the offline signing key. Registry row changes (activate/revoke) are only *effective for new submissions* once a new signed roster is published — the publish step is part of the enroll/offboard ceremonies (§7).

---

## 4. DDL sketches — per-message wrapped keys + content columns

```sql
-- 4.1 Heartcry wrapped keys (CEK × recipient key)
CREATE TABLE public.heartcry_wrapped_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heartcry_id   uuid NOT NULL REFERENCES public.heartcries(id) ON DELETE CASCADE,
  admin_key_id  uuid NOT NULL REFERENCES public.admin_encryption_keys(id),  -- NO ACTION: registry rows never deleted
  wrapped_key   text NOT NULL,        -- opaque base64
  wrap_alg      text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_via   text NOT NULL CHECK (created_via IN ('submit','rewrap','migration')),
  rewrapped_by  uuid REFERENCES public.users(id),   -- authorizer when created_via='rewrap'
  CHECK ((created_via = 'rewrap') = (rewrapped_by IS NOT NULL)),
  UNIQUE (heartcry_id, admin_key_id)
);
CREATE INDEX heartcry_wrapped_keys_admin_key_idx
  ON public.heartcry_wrapped_keys (admin_key_id);   -- revoke sweeps + per-admin coverage

-- 4.2 Evidence wrapped keys — identical shape
CREATE TABLE public.underground_evidence_wrapped_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id   uuid NOT NULL REFERENCES public.underground_evidence_files(id) ON DELETE CASCADE,
  admin_key_id  uuid NOT NULL REFERENCES public.admin_encryption_keys(id),
  wrapped_key   text NOT NULL,
  wrap_alg      text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_via   text NOT NULL CHECK (created_via IN ('upload','rewrap','migration')),
  rewrapped_by  uuid REFERENCES public.users(id),
  CHECK ((created_via = 'rewrap') = (rewrapped_by IS NOT NULL)),
  UNIQUE (evidence_id, admin_key_id)
);
CREATE INDEX ug_evidence_wrapped_keys_admin_key_idx
  ON public.underground_evidence_wrapped_keys (admin_key_id);
```

```sql
-- 4.3 heartcries: format discriminator + GCM IV (dual-format during migration window only)
ALTER TABLE public.heartcries
  ADD COLUMN content_format   text NOT NULL DEFAULT 'pgp_sym'
             CHECK (content_format IN ('pgp_sym','envelope_v2')),
  ADD COLUMN content_iv       text,
  ADD COLUMN envelope_version smallint,
  ADD CONSTRAINT heartcries_envelope_fields_ck
    CHECK ((content_format = 'envelope_v2') = (content_iv IS NOT NULL AND envelope_version IS NOT NULL));
```

**4.4 Evidence column reuse (the precedent, honored):** `underground_evidence_files.encryption_iv` carries the file's AES-GCM IV exactly as intended. `envelope_key_id` is repurposed by COMMENT as the **envelope suite tag** (e.g. `'v2:<suite-id>'`) — non-NULL means v2-encrypted object, NULL means Posture C legacy (Supabase-storage-encrypted only). No new columns needed on the evidence table; per-recipient keys live in 4.2. The metadata-immutability trigger gets a scoped exemption for the one-way NULL→v2 transition of these two columns during migration (§9.6).

**4.5 Wrapped-key TABLE vs embedded-envelope column (the required trade):** an embedded `jsonb` array of wraps on the message row gives single-row atomic insert and no join — and loses FK integrity to the registry, makes revoke/re-wrap jsonb surgery inside an UPDATE (colliding with immutability posture), can't index by `admin_key_id` (offboard sweep = full scan + jsonb explode), can't express `UNIQUE (message, key)`, and hides partial-wrap states from constraints. Submit-path atomicity is recovered with a single RPC transaction + deferred trigger (§11.1). **Table wins; embedded rejected.**

---

## 5. RLS matrix (default-deny; every new table has RLS ENABLED)

| Table | anon | authenticated (leader) | authenticated (admin JWT) | Writes |
|---|---|---|---|---|
| `admin_encryption_keys` | — | — (pubkeys only via §6.1 RPC, identity-free) | SELECT (policy: `super_admin` claim = true) for key-mgmt UI | none — RPCs only (service_role EXECUTE) |
| `envelope_roster_documents` | — | SELECT (signature makes it tamper-evident; contains no identities) | SELECT | none — publish RPC only |
| `heartcry_wrapped_keys` | — | — | — **(deny-all: no SELECT policy even for admins)** | none — release/rewrap/submit RPCs only |
| `underground_evidence_wrapped_keys` | — | — | — (deny-all) | none — RPCs only |
| `heartcries` (existing) | unchanged | unchanged (own-row SELECT sees ciphertext; INSERT unchanged until v2 submit RPC lands, then revoke direct INSERT — §14.2) | unchanged (`super_admin` SELECT sees ciphertext + metadata) | v2 columns written by RPCs only |

The deny-all on wrapped-key tables is the enforcement core: **the only path to a wrapped key is the release RPC, and the release RPC writes audit before it returns.** No PostgREST path, no direct-SELECT path, no dashboard shortcut. Grants on every new RPC mirror `admin_open_heartcry`: `REVOKE ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role;` — except `get_active_envelope_recipients` and roster SELECT (authenticated). All SECURITY DEFINER functions pin `SET search_path = pg_catalog, public` (P0-1 discipline).

---

## 6. Release RPCs — where fetch-audit is enforced

**6.1 Recipient discovery (mobile, at submit):**
```sql
get_active_envelope_recipients(p_scope text)
  RETURNS TABLE (key_id uuid, public_key text, key_alg text, roster_version int)
-- SECURITY DEFINER; EXECUTE: authenticated. Active keys for scope, eligibility-filtered
-- via §6.3 predicate + escrow key. NO admin_user_id, NO identities, NO counts beyond rows.
-- Client cross-checks against latest signature-valid roster document before wrapping.
```

**6.2 Heartcry key release — mirrors `admin_open_heartcry` ceremony exactly:**
```sql
admin_fetch_heartcry_key(
  p_heartcry_id uuid, p_admin_id uuid,          -- public.users.id, edge-resolved
  p_operation_id uuid, p_ip text, p_user_agent text,
  p_aal2_verified_at timestamptz                 -- edge attestation, recorded + sanity-bounded
) RETURNS json
-- SECURITY DEFINER; EXECUTE service_role only. Edge function keeps the JWT super_admin
-- + AAL2/TOTP life-safety freshness gate (enforcement lives there, as today).
```
Transaction order (each step aborts everything after it):
1. `p_operation_id` required; `p_aal2_verified_at` required and within the life-safety window (`now() - p_aal2_verified_at` bounded — this is attestation-with-teeth, not primary enforcement; forces the edge to assert and creates a forensic record).
2. Load heartcry; `content_format = 'envelope_v2'` required (legacy rows route to `admin_open_heartcry` until retirement).
3. Re-verify eligibility from **column truth** (§6.3) — defense-in-depth under the JWT gate.
4. Resolve caller's ACTIVE registry key; error `no_active_key` if none.
5. Fetch wrapped row `(heartcry_id, admin_key_id)`; error `not_wrapped_for_you` if absent — distinct code so the dashboard can surface "re-wrap required" instead of a generic 500 (partial-wrap UX, §10.3).
6. **INSERT 2 `audit_log` rows before any key material returns** — `heartcry_key_released` + `read_region` (same companion-row pattern as today), meta: heartcry_id, operation_id, admin_key_id, key_fingerprint, ip, ua (500-cap), aal2_verified_at, surface.
7. Status flip `received→seen` + `triage_lead_id` (same semantics: "seen" = an admin actually fetched the key).
8. RETURN one payload: `wrapped_key, wrap_alg, content_ciphertext, content_iv, envelope_version` + the same church/leader metadata `admin_open_heartcry` returns today (church_name, region_macro, church_type, leader_display_name honoring `anonymous`, contact_email, severity, request_type, status, seen_at, responded_at). One audited call = everything the dashboard needs; decrypt happens in the admin's browser.

**6.3 Eligibility predicates (helpers, SECURITY DEFINER, not client-callable):**
```sql
fn_is_heartcry_envelope_eligible(p_user_id uuid) RETURNS boolean
-- users.is_active AND soft_deleted_at IS NULL AND
-- (users.is_top_tier_admin OR <super_admin tier from the SAME auth.users field
--   custom_access_token_hook mints from — BE lane resolves role-vs-admin_tier drift, §14.1>)
fn_is_evidence_envelope_eligible(p_user_id uuid) RETURNS boolean
-- fn_is_heartcry_envelope_eligible AND users.is_underground_admin  (COLUMN — dual-source doctrine)
```

**6.4 Evidence key release — same skeleton, UG audit sink:**
```sql
fn_underground_fetch_evidence_key(p_evidence_id uuid, p_admin_id uuid,
                                  p_operation_id uuid, p_ip text, p_user_agent text,
                                  p_aal2_verified_at timestamptz) RETURNS json
```
Eligibility via `fn_is_evidence_envelope_eligible`; audit row `underground_evidence_key_released` into **`audit_log_underground`** before release; recommend the BE endpoint folds this into the signed-URL mint flow so one admin action = one ceremony yielding signed URL + wrapped key (two audit rows: existing `underground_evidence_signed_url_minted` + new key-released row). Confirmed/undeleted rows only. No status side effects.

---

## 7. Roster-change data flows

**7.1 Enroll (new admin):**
```sql
fn_enroll_admin_envelope_key(p_admin_user_id uuid, p_public_key text, p_key_alg text,
                             p_key_fingerprint text, p_enrolled_by uuid,
                             p_operation_id uuid, p_ip text, p_user_agent text) RETURNS uuid
```
New admin generates keypair client-side (private key never leaves the device — SEC lane owns local custody); BE calls after its gates (admin-tier action class → sensitive 5-min MFA tier). Inserts `status='pending'`; rejects if an active key exists (rotation path instead, 7.4); enforces eligibility. Audit `admin_envelope_key_enrolled` (fingerprint in meta). **A pending key grants NOTHING:** zero wrapped rows exist for it, release RPC only honors active keys, `get_active_envelope_recipients` excludes it. **No retroactive access is structural, not procedural.**

**7.2 Re-wrap ceremony (existing key-holder grants corpus access):**
```sql
-- Step 1: bulk export to the AUTHORIZER (highest-privilege read in the system)
admin_export_keys_for_rewrap(p_admin_id uuid, p_scope text, p_operation_id uuid,
                             p_ip text, p_user_agent text, p_aal2_verified_at timestamptz)
  RETURNS TABLE (subject_id uuid, wrapped_key text, wrap_alg text, content_iv text, envelope_version smallint)
-- Returns ALL wrapped rows for the authorizer's active key in scope. ONE audit row
-- ('heartcry_rewrap_export' / 'underground_evidence_rewrap_export' in the domain sink)
-- BEFORE returning, meta: subject_ids array + count + target-ceremony operation_id.
-- Deliberately NOT the per-message release RPC: no N×2 audit spam, NO status flips
-- (a re-wrap must not mark heartcries 'seen'). SEC lane rules the gate (recommend
-- manager-only + fresh TOTP; DBA enforces whatever tier SEC sets via the predicate).

-- Step 2: authorizer unwraps CEKs locally, wraps each to the target pubkey, submits
fn_submit_rewrap_batch(p_authorizer_id uuid, p_target_key_id uuid, p_scope text,
                       p_items jsonb,             -- [{subject_id, wrapped_key, wrap_alg}]
                       p_activate_target boolean, -- pending→active when coverage lands
                       p_retire_key_id uuid,      -- non-NULL only for self-rotation (7.4)
                       p_operation_id uuid, p_ip text, p_user_agent text) RETURNS json
-- Verifies: authorizer holds an active key + eligibility; target is pending|active and
-- eligible for scope; every item subject exists. Inserts wrapped rows created_via='rewrap',
-- rewrapped_by=authorizer (UNIQUE constraint makes replays idempotent-or-error).
-- If p_activate_target: flips target to active (activated_by = authorizer).
-- If p_retire_key_id: revokes it in the same transaction (unique-active index forces this
-- ordering for rotation). ONE audit row per batch with subject_ids + counts + both fingerprints.
```

**7.3 Offboard (revoke):**
```sql
fn_revoke_admin_envelope_key(p_target_key_id uuid, p_revoked_by uuid, p_reason text,
                             p_operation_id uuid, p_ip text, p_user_agent text) RETURNS json
```
Sets `status='revoked'` + revoked_at/by/reason, then **hard-DELETEs all wrapped rows for that key (both domains), counts recorded in the audit row** (`admin_envelope_key_revoked`, meta: deleted_heartcry_wraps, deleted_evidence_wraps, fingerprint, reason). Delete vs tombstone (the prompt's question): "who could read what, when" is already fully answerable from the registry's enrolled/activated/revoked window plus the per-release audit rows — keeping dead wrapped rows preserves nothing forensic and leaves a decryption surface if the revoked admin's private key was exfiltrated and the DB later leaks. **DELETE. (D2.)** Rides with a new signed roster publish. Sister action honored: revoking admin TIER (`admin_revoke` / `admin_demote` BE flows) must also revoke the envelope key — BE lane wires the call (§14.3).

**7.4 Rotation (same admin, new key):** enroll new key (pending) → self-authorized 7.2 ceremony (old active key exports, wraps to new, `p_activate_target=true, p_retire_key_id=old`) — atomic swap, zero coverage gap. **Lost key:** admin cannot self-recover (that's E2E); any other active key-holder runs 7.2 for their replacement key; if ALL admin keys are lost, the escrow recipient (D1) is the recovery of last resort via the same ceremony run against the escrow key — an offline, Founder-witnessed event per the backup-DR custody ceremony.

**7.5 Submit path v2 (mobile):**
```sql
submit_heartcry_envelope(p_user_id uuid, p_church_id uuid, p_severity severity_level,
                         p_request_type text[], p_post_to_feed boolean,
                         p_ciphertext text, p_iv text, p_envelope_version smallint,
                         p_wrapped jsonb)   -- [{admin_key_id, wrapped_key, wrap_alg}]
  RETURNS uuid
-- SECURITY DEFINER, service_role only (submit-heartcry edge fn calls after its existing
-- JWT/verified-leader gates). One transaction: INSERT heartcry (content_format='envelope_v2')
-- + wrapped rows. Wraps addressed to revoked/unknown keys are DROPPED (not fatal) so a
-- stale client roster cannot brick the channel; minimum-coverage trigger (§11.1) is the floor.
-- Preserves the v2.2 ruling: NO audit_log write on submission (admin reads are the audit surface).
```
Plaintext no longer touches the edge function; its Vault boot-cache drops `encryptionKey` at retirement (triage email path — already zero-PII — unchanged). `feed_content` story: stays a plaintext column by design (it is public-feed, continent-anonymized, consent-gated, retractable via `retract_heartcry_feed_consent`); generation moves fully client-side to the **admin dashboard at approval time** (admin has just decrypted in-browser; dashboard writes feed_content through the existing approval flow). Existing 2 approved rows keep their feed_content — **no backfill needed**. `get_heartcry_feed` untouched.

---

## 8. Audit action additions (both CHECKs extended by migration)

1. `audit_log_action_check` += `heartcry_key_released`, `admin_envelope_key_enrolled`, `admin_envelope_key_activated`, `admin_envelope_key_revoked`, `heartcry_rewrap_export`, `heartcry_rewrap_committed`, `heartcry_migrated_to_envelope`, `envelope_roster_published`, `envelope_wrap_gap_detected` (cron, `triggered_by='cron'`), `envelope_revoked_key_sweep` (cron).
2. `audit_log_underground_action_check` += `underground_evidence_key_released`, `underground_evidence_rewrap_export`, `underground_evidence_rewrap_committed`, `underground_evidence_migrated_to_envelope`.
3. Existing `read_heartcry` stays valid for the legacy RPC until retirement; never removed from the CHECK (append-only history must keep validating).

---

## 9. Migration sequence (repo `supabase/migrations`, mirror-on-apply discipline)

1. **M1 — foundations:** `admin_encryption_keys`, `envelope_roster_documents`, RLS + grants, eligibility helpers, enroll/revoke/roster RPCs, audit action additions (§8). No behavior change to live paths.
2. **Key ceremony (not a migration):** both managers + eligible super_admins enroll keys via dashboard; **escrow keypair generated OFFLINE in the backup-DR escrow ceremony** (same sealed custody — one ceremony, per ruling), escrow pubkey enrolled `recipient_type='escrow'` and activated; first signed roster published. Fingerprints verified out-of-band, witnessed.
3. **M2 — envelope plumbing:** wrapped-key tables, `heartcries` columns (4.3), evidence column comments + trigger exemption (4.4), release RPCs (§6), rewrap RPCs (7.2), `submit_heartcry_envelope`, backstop triggers (§11), cron sweeps. Legacy path still live; dual-format window opens.
4. **Clients ship:** mobile (client-side encrypt + roster verify + new submit payload) and dashboard (WebCrypto decrypt, key-mgmt UI, migration ceremony page). Edge fn accepts both formats during the window; `content_format` discriminates.
5. **Legacy re-encryption — the honest options for 4 rows:**
   1. **(Recommended) Admin-ceremony client-side re-encryption:** manager opens each legacy row through the EXISTING `admin_open_heartcry` (its full 2-row audit ceremony fires per row — the migration's read trail is the production read trail, nothing bespoke); browser generates CEK, AES-GCM-encrypts, wraps to all active keys + escrow, calls `fn_store_envelope_migration(p_heartcry_id, p_ciphertext, p_iv, p_envelope_version, p_wrapped jsonb, p_admin_id, p_operation_id, ...)` — one-way `pgp_sym→envelope_v2` guard, replaces content/iv/format, inserts wraps `created_via='migration'`, audit `heartcry_migrated_to_envelope`. Plaintext transits one TOTP-gated admin browser — the same exposure class as any legitimate read, fully attributed.
   2. **(Rejected) One-shot server-side re-encryption:** decrypt via Vault key and re-wrap in a trusted DB/edge context. Honest assessment: server already holds the Vault key so this adds no *new* trust, and keeps plaintext out of any browser — but in-DB AES-GCM needs pgsodium (not installed) or non-standard pgcrypto contortions, builds throwaway server crypto that production will never use again, and produces a weaker trail (a system actor "read" 4 heartcries with no human ceremony). Wrong trade at corpus = 4; would reconsider only if migration were deferred until the corpus is large (which is exactly what the ruling forbids).
   3. Evidence (5 files): same ceremony shape — signed-URL download (existing audited mint), client-side encrypt, re-upload object, `envelope_key_id`/`encryption_iv` set via the scoped trigger exemption, wraps inserted, `underground_evidence_migrated_to_envelope` audit row.
6. **Verification gate:** `SELECT count(*) FROM heartcries WHERE content_format='pgp_sym'` = 0 (and evidence equivalent) — recorded in the Jira trail.
7. **M3 — retirement:** replace `admin_open_heartcry` body with `RAISE 'legacy_retired'` (signature kept; history in audit_log stays interpretable), DROP `encrypt_heartcry_content`/`decrypt_heartcry_content`/`get_heartcry_encryption_key`, delete `heartcry_encryption_key` from Vault, strip the edge-fn boot-cache. **DR subtlety, named:** pre-migration backups still contain pgp_sym ciphertext — the legacy Vault key must be **retained in the sealed escrow for as long as any pre-migration backup is retained, then destroyed with them** (D5). Immediate destruction would silently lobotomize every existing backup.

---

## 10. Failure / recovery surfaces (backup-DR contract)

1. **What a restored DB has:** ciphertext, IVs, the full registry, all wrapped rows, both audit trails — wrapped keys are IN the DB, so a restore (same or different Supabase project) needs **no Vault contents for heartcries post-M3**. This design *resolves* the backup-DR brief's central Vault nuance for the heartcry plane.
2. **What a restored DB does NOT have — the named dependency:** admin **private** keys. They exist only on admin devices + the sealed escrow. **Restore runbook line item: a restored database is readable iff at least one enrolled recipient's private key survives; the escrow recipient (D1) is what makes DB-backup + sealed-escrow a sufficient pair.** This is the backup-DR escrow ceremony's second artifact (alongside the retained legacy Vault key, §9.7).
3. **Partial-wrap states:** first-class, not an error: `heartcry_wrap_gaps` view (active eligible admin keys × envelope rows lacking a wrap) + weekly pg_cron sweep writing `envelope_wrap_gap_detected` on nonzero (dashboard chip + digest). Gaps close at the next re-wrap ceremony; release RPC's `not_wrapped_for_you` gives the affected admin an actionable state meanwhile.
4. **Point-in-time restore skew:** revocations executed after the backup point resurrect as live wrapped rows on restore. Runbook step: re-apply registry revocations from the out-of-band ceremony record, then run the revoked-key sweep (10.5) before the restored DB serves traffic.
5. **Revoked-key sweep (backstop):** weekly pg_cron deletes any wrapped rows referencing revoked keys (normally zero — 7.3 deletes inline), audit `envelope_revoked_key_sweep` on nonzero. Idempotent; doubles as the post-restore hygiene command.

---

## 11. Constraint + trigger backstops

1. **Minimum coverage (the "no unreadable heartcry" guarantee):** DEFERRABLE INITIALLY DEFERRED constraint trigger on `heartcries` INSERT (envelope rows only): at commit, require ≥1 wrapped row targeting an **active admin** key AND (if D1 ratified) 1 targeting the active escrow key. Same for evidence confirm. Verdict vs allow-and-alert: **enforce at commit** — a visible submit failure the client retries (with a refreshed roster) is acceptable; a heartcry nobody can ever read is not. The gap sweep (10.3) covers drift *after* insert (roster growth), which constraints cannot.
2. **Wrapped-row immutability:** BEFORE UPDATE trigger raises always (INSERT/DELETE-only table — evidence-metadata-trigger precedent); BEFORE INSERT trigger rejects rows targeting `revoked` keys and rejects scope-ineligible recipients (re-checks §6.3 for the key's admin at wrap time).
3. **Registry lifecycle:** BEFORE UPDATE trigger permits only `pending→active`, `pending→revoked`, `active→revoked`; key material columns (public_key, key_alg, key_fingerprint, admin_user_id, recipient_type) immutable after insert.
4. **One-way format:** BEFORE UPDATE on `heartcries` rejects `envelope_v2→pgp_sym` and any `content/content_iv` mutation except via the migration RPC's guarded path.

## 12. Indexes (complete list, scale-honest)

1. All PKs + the two UNIQUE composites (4.1/4.2) — the release RPC's lookup `(subject_id, admin_key_id)` is the UNIQUE index itself.
2. `*_wrapped_keys (admin_key_id)` — offboard deletes + coverage queries.
3. Registry partial uniques (3.1) — they ARE the lifecycle constraints.
4. Deliberately none else: corpus is single-digit rows and gap/sweep queries are tiny scans; heartcries' existing indexes (severity, church_id, partial status) are untouched. Revisit only if the corpus is large by build time — do not pre-index speculatively.

## 13. UG invariants check

1. No location columns anywhere new; roster + recipient RPC expose zero admin identities and zero church data; wrap rows carry only uuids + blobs.
2. Evidence stays inside its own audit sink (`audit_log_underground`) and behind `is_underground_admin` COLUMN checks (dual-source doctrine respected in §6.3).
3. Existing UG CHECK constraints, deny-all storage RLS, and the UG pending-queue separation are untouched by every DDL above.
4. `audit_log` append-only honored: constraint changes only ever ADD action values; no probing.

## 14. Handoffs to sister lanes (findings, one line each)

1. **BE/SEC:** `auth.users` tier-field drift verified live (`role='super_admin'` with `admin_tier` NULL on 2 rows) — canonicalize which field `custom_access_token_hook` + §6.3 read before M1.
2. **BE:** once `submit_heartcry_envelope` is live, drop the direct-INSERT RLS policy on `heartcries` (edge fn is the only writer) — sister-action check on any other INSERT path first.
3. **BE:** `admin_revoke`/`admin_demote`/UG-flag-revoke flows must call `fn_revoke_admin_envelope_key` (sister-action rule) + trigger roster re-publish.
4. **SEC:** live `admin-open-heartcry` freshness constant is 300 s while the locked life-safety tier says 90 s — align in v2 edge fn regardless of this design.
5. **SEC:** suite selection (X25519 sealed-box vs WebCrypto-native), device-side private-key custody, roster signing key ceremony, and the export-for-rewrap gate tier — schema above is agnostic to all four.

## 15. Open Founder decisions (≤5, with recommendations)

1. **D1 — Escrow recipient:** wrap every heartcry + evidence CEK to one offline sealed escrow key (backup-DR ceremony custody)? **Recommend YES** — without it, loss of every admin device = permanent loss of the corpus; cost: the sealed key can decrypt everything, so its custody ceremony must be real (it already must be, for backups).
2. **D2 — Revoked-key wrapped rows:** hard-delete (recommended — removes a decryption surface; forensics fully preserved by registry windows + release audit rows) vs tombstone.
3. **D3 — Submit coverage floor:** require wrap to ALL currently-active keys (strict; stale client rosters can block submits) vs **≥1 active admin + escrow, gaps swept into the next re-wrap ceremony (recommended — heartcry channel availability outranks wrap completeness)**.
4. **D4 — Author re-read stays off:** verified live that leaders never re-read plaintext (`get_my_heartcries` excludes content); wrapping to author device keys would put key-custody burden on persecuted users. **Recommend keep off**; any future "view my heartcry" feature is a separate SEC panel.
5. **D5 — Legacy Vault key afterlife:** retain `heartcry_encryption_key` in sealed escrow until every pre-migration backup ages out, then destroy (**recommended**) vs destroy at M3 (cleaner, but silently makes old backups partially unreadable).
