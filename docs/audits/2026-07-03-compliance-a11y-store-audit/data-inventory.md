# Replant — Master PII / Personal-Data Inventory

**Date:** 2026-07-03 · **Author:** Data-protection engineering pass (compliance/a11y/store-readiness audit session)
**Scope:** Mobile repo `~/replant` (branch `feat/kan-296-mobile-attribution-slot`) + live Supabase project `jiyetphxxvyiicrnwlnx` (read-only introspection: schema, functions, cron, extensions, vault secret *names* only — zero data rows read, zero writes).
**Feeds:** privacy-policy v0.3 refresh · Apple privacy nutrition labels + `PrivacyInfo.xcprivacy` · Google Play Data Safety form.
**Admin dashboard** is a separate repo not checked out here; admin-side behavior is inferred from DB truth and marked "admin-side, verify in admin repo" where it matters.

**Framing fact for counsel (not analysis):** every Replant account inherently discloses religious affiliation (the platform is exclusively for Christian leaders; signup requires a declaration of faith). Under GDPR Art. 9 and analogues, effectively **all** user records on this platform are special-category-adjacent, regardless of field-level sensitivity below.

**Sensitivity tiers used:**

1. **T0 — life-safety:** heartcry content, underground (UG) anything, escalated cases, join codes, UG evidence.
2. **T1 — high:** identity (names, email, phone), precise location (lat/lng, device GPS), role + church affiliation (religious-affiliation-revealing), flag reasons.
3. **T2 — standard:** user content, church profile, preferences, RAG status.
4. **T3 — operational:** counts, timestamps, resend ids, hashed logs.

---

## 1. Master inventory table

Legend: **DSR-R** = self-serve rectification exists · **DSR-D** = covered by the deletion lifecycle (soft-delete → 30-day restore → hard-delete tombstone) · **✗** = no path.

### 1a. Identity & account (public.users + auth.users)

| # | Field | Collected where | Stored where | Flows to | Retention | DSR | Tier |
|---|---|---|---|---|---|---|---|
| 1 | `first_name`, `middle_name`, `last_name`, `full_name` | Signup Page 1 (all flows incl. UG join-by-code); payload `firstName/middleName/lastName` → `create-account` / `join-underground-church` edge fns → `create_account_atomic` RPC | `public.users` | Resend welcome email carries `firstName` (NOT for UG variants); `connect@` new-church notification carries leader full name | Active life of account; hard-delete tombstones to `[redacted]`; **90-day deactivation scrub misses structured columns (Gap 1)** | R ✗ (names not self-editable) · D ✓ | T1 |
| 2 | `honorific`, `suffix`, `last_name_first`, `include_middle_name` | Settings (post-signup only; not collected at signup) | `public.users` | — | Hard-delete nulls honorific/suffix; **deactivation scrub misses them (Gap 1)** | R ✓ (Settings, direct RLS-gated update) · D ✓ | T1 |
| 3 | `email` | Signup Page 1; `check-email-available` pre-checks | `public.users.email` + `auth.users.email` (Supabase-managed, with `encrypted_password`, confirmation/recovery tokens, `last_sign_in_at`) | Resend (welcome/UG-pending emails to this address); `connect@` notification (leader email, non-UG); Upstash rate-limit key `create-account:ratelimit:{ip}:{email}` raw, ≤1h TTL | Hard-delete: tombstone `deleted+<id>@projectreplant.org` **and `auth.users` row deleted**; 90-day deactivation scrub covers email ✓; UG hard-delete audits sha256(email) hash only | R ✗ (no in-app email change) · D ✓ | T1 |
| 4 | `phone` (personal, optional, KAN-231) | Signup Page 1 (optional fallback contact) | `public.users.phone` (auth.users.phone unused) | — (never emailed, never in keys) | Hard-delete nulls ✓; **deactivation scrub misses it (Gap 1)** | R ✗ · D ✓ | T1 |
| 5 | `password` | Signup Page 1 | `auth.users.encrypted_password` (bcrypt, GoTrue-managed) | Transits `create-account`/`join-underground-church` edge fn request body (TLS) → `auth.admin.createUser` | Deleted with `auth.users` row at hard-delete | R: reset via email deep link `replant://reset-password` (PKCE) ✓; in-app change = ComingSoon stub | T1 |
| 6 | `role` (12-value enum or free-text other) | Signup Page 1 | `public.users.role` | Displayed per humanisation table; anon display shows "A fellow [Role]" | Life of account; not scrubbed (enum, low identifiability) | R ✗ · D (row tombstoned, role survives) | T1 (religious role) |
| 7 | `anonymous` flag | Signup Page 1 (default false) + Settings toggle | `public.users.anonymous` | Controls *display* masking only (server still stores authorship links; heartcry admin-open returns NULL display name when anonymous) | Life of account | R ✓ (Settings) | T2 |
| 8 | `declaration_affirmed` + `declaration_date`; church `state_declaration` text | Declaration of Faith screen; `state_declaration` locked copy in church payload | `public.users`, `public.churches` | — | Life of account/church | R ✗ (by design — covenant record) | T1 (explicit religious confession) |
| 9 | `display_name_preference`, `preferred_radius`, `church_card_flow_seen`, `outcome_modal_acknowledged_at` | Settings / in-app behavior | `public.users` | — | Life of account | R ✓ (display pref) | T3 |
| 10 | Country (user-level) | Signup Page 1 UI (searchable picker; KAN-187) | **Not persisted to `users`** (no column). Used client-side to prefill church country / `pending_parent_claims.claimed_parent_country` | — | n/a | n/a | T2 |
| 11 | `contact_method` | **Does not exist as a field.** The concept is embodied as church-level "≥1 of contact_email / contact_phone required" | n/a | n/a | n/a | n/a | — |
| 12 | `last_seen_at` | **No writer found in this repo** — admin-side or unwired; verify in admin repo | `public.users.last_seen_at` | — | No retention story | ✗ | T3 |
| 13 | `is_underground_admin`, `is_top_tier_admin`, `verification_status`, lifecycle timestamps | System/admin-set (client-write-revoked per P0-2) | `public.users` | JWT claims via auth hook | Life of account | n/a (system) | T2 |

### 1b. Church & location (public.churches + related)

| # | Field | Collected where | Stored where | Flows to | Retention | DSR | Tier |
|---|---|---|---|---|---|---|---|
| 14 | Church `name`, `type`, `country`, `city`, `address` | Church registration (Page 2 / RegCP1); canonical validator `_shared/church-validation.ts`; **UG: city/lat/lng forced NULL at validation + `create-account` strip + DB CHECK** | `public.churches` | Church name/city/country visible in-network per visibility rules; `search-churches`/`find_similar_churches` (UG excluded) | Life of church; **no scrub of name/address ever (Gap 2)** | R: partial ✓ via `update-church` edge fn (onboarding edit) + `update_church_profile` RPC (completion flow edit mode: city/country/address/lat/lng/website/language/denomination/size) | T1 (address = precise location) |
| 15 | Church `lat`, `lng` (map pin) | RegCP1 map pin (optional; never for UG) | `public.churches` (PostGIS 3.3.7 available) | Rendered to other verified leaders via CamlView/`get-nearby-churches`; GlobeView uses registered coords only | Life of church; **survives deletion lifecycle (Gap 2)** | R ✓ (completion flow) | T1 |
| 16 | Church contact person: `contact_name`, `contact_email`, `contact_phone`, `contact_role` | RegCP1 (required: name + ≥1 channel). Often the leader's own PII | `public.churches` | Admin verification workflow (admin-side); `show_contact_on_profile` gates in-network display | `scrub_church_pii` (cron, live): deactivated+90d or rejected+7d → nulls email/phone (+audit row). **Never fires for self-service deletions (Gap 2); `contact_name` never scrubbed anywhere** | R: partial · D ✗ (see Gap 2) | T1 |
| 17 | `rag_status` (+ override fields) | RegCP1 (UG forced red server-side + `enforce_underground_rag_red` trigger) | `public.churches` | Displayed in-network | Life of church | R ✓ (Settings RAG picker, direct update) | T2 (persecution-risk signal) |
| 18 | `needs[]`, `resources[]`, `has_emergency_plan`, `open_to_collaboration`, `website_url`, `primary_language`, `denomination_affiliation`, `congregation_size_range` | RegCP1/RegCP2 + completion flow | `public.churches` | In-network profile | Life of church | R ✓ (completion flow) | T2 |
| 19 | `underground_join_code_hash` (+ issued/revealed/rotated timestamps) | Generated on founding-leader "reveal" tap (lazy; NULL until then) | `public.churches` — **bcrypt cost-10 at rest (`hash_join_code` = `crypt(gen_salt('bf',10))`)**; plaintext returned once via `reveal-join-code`; hash change blocked by trigger | Redeem via `redeem_underground_join_code` (bcrypt compare, single-use — redeem NULLs hash); `ug_second_leader.join_code_used` stores the code *as entered by the joiner* | Hash nulled on redeem/rotate | n/a | T0 |
| 20 | `pending_parent_claims` (claimed parent name/city/country) | Branch signup deferred parent picker | `public.pending_parent_claims` | `auto_link_pending_parents` cron (daily 03:00) resolves | No scrub story (church-level, low PII) | ✗ | T2 |
| 21 | Branch/HQ structure (`branch_of_church_id`, `is_headquarters`) | Branch signup | `public.churches` | — | Life of church | ✗ | T2 |

### 1c. User content

| # | Field | Collected where | Stored where | Flows to | Retention | DSR | Tier |
|---|---|---|---|---|---|---|---|
| 22 | Connect DM content | DMThreadView → `send-message` edge fn (`text`, `recipient_id`, `conversation_id`) | `public.messages.content` — **plaintext in DB** (not encrypted at column level) + `conversations` pair rows | Server-side keyword scan vs FLAG_TAXONOMY env secret writes `flagged`/`flag_reason` only (DELIVER-ALWAYS — never gates insert); content NEVER logged | **Forever — no retention/deletion machinery for messages (Gap 8)**; survives sender account deletion (de-attributed via tombstone) | ✗ (no edit/delete of sent DMs) | T2 (content) / T1 (`flag_reason`) |
| 23 | Branch messages | BranchThreadView → `send-branch-message` (`text`, `branch_id`) | `public.messages` (branch_id set) + `branches`, `branch_members` (consent_status, timestamps) | Same scan pipeline | Forever (same as DMs) | ✗ | T2 |
| 24 | `messages.attribution_display_name` (KAN-293/296) | Snapshot of sender display name at send | `public.messages` | Display | Forever — **snapshot survives later anonymity toggle/name change** (disclosure-relevant) | ✗ | T1 |
| 25 | Connection request message | `send_connection_request` RPC (`recipient_id`, `message`) | `public.connection_requests` | `accept-connection-request` edge fn re-scans then seeds into `messages` attributed to requester | Pending expires at 30 days (status only); declined tracked 30 days; **rows retained indefinitely** | ✗ | T2 |
| 26 | Prayer requests (`content`, `category`, `urgent`, `anonymous`) | Prayer Wall composer | `public.prayer_requests` (author `user_id` always stored; `anonymous` masks display only — wall RPCs mask author + UG church_id/role) | In-network wall | `soft_delete_prayer_request` RPC exists (status flip); no hard purge; survives account deletion de-attributed | D: partial (soft-delete own request) | T2 |
| 27 | Testimonies (`content`, `anonymous`, `original_request_id`) | Testimony composer | `public.testimony` (+ `testimony_celebrated_by`) | In-network | No deletion machinery | ✗ | T2 |
| 28 | Comments (`body`, `masked_region`, `mask_reason`, `is_masked`) | Home-tab announcement comments | `public.comments` (author FK → public.users) | In-network; region-masking columns for UG protection | No deletion machinery (comment delete confirmed post-MVP) | ✗ | T2 |
| 29 | **Heartcry submissions** (`content`, `severity`, `request_type[]`, `post_to_feed`) | HeartcrySubmissionScreen → `submit-heartcry` (verify_jwt=true) | `public.heartcries.content` = **pgp_sym ciphertext only** (`encrypt_heartcry_content` = `pgp_sym_encrypt` base64; key = Vault `heartcry_encryption_key`; plaintext never touches the row). `feed_content` (continent-anonymized) + `feed_approved` admin-gated | Decrypt-at-read ONLY via `admin_open_heartcry` RPC: **audit rows (`read_heartcry` + `read_region`, incl. admin IP + user-agent + operation_id) commit before plaintext returns**; TOTP 5-min freshness; triage Resend email is a static zero-PII body | Forever (encrypted); no purge machinery; survives account deletion de-attributed | ✗ | **T0** |
| 30 | UG verification proposals (`admin_notes`, `counter_notes`, `contact_channel`, `evidence_tier`, `relay_token_hash`, rejection reasons) | Admin-side (verify in admin repo); stale proposals expired hourly by cron | `public.underground_verification_proposals` | UG admin queue | Hourly `fn_expire_stale_proposals` (status); rows retained | ✗ | **T0** |
| 31 | UG evidence files (`filename`, `mime_type`, `contact_channel`, `summary`, `envelope_key_id`, `encryption_iv`) | Admin-side upload | Storage bucket `underground_evidence` (**private**, only bucket in project) + `underground_evidence_files` metadata — envelope-encryption columns present | — | **Unconfirmed uploads deleted after 1h** (cron `underground_orphan_evidence_intent_hourly`, verified live); confirmed files: no expiry | ✗ | **T0** |
| 32 | Escalated cases (`escalation_reason`, `escalation_context`, manager review reasoning, closed_note, reach-out message link) | Auto-route trigger on UG flagged messages + admin-side | `public.escalated_cases`, `escalated_case_proposals` | Reach Out via Connect DM (message row) | Retained forever (life-safety class per locked ruling) | ✗ | **T0** |
| 33 | `ug_second_leader` (join_code_used, vouch text, rejection_note) | UG join-by-code flow + admin review | `public.ug_second_leader` | UG queue | No scrub story | ✗ | **T0** |

### 1d. Technical, derived & platform data

| # | Field | Collected where | Stored where | Flows to | Retention | DSR | Tier |
|---|---|---|---|---|---|---|---|
| 34 | IP address | Edge fns from `x-forwarded-for` (`create-account`, `join-underground-church`, `check-email-available`, `register-church`) | **Raw IP in Upstash rate-limit key names**: `create-account:ratelimit:{ip}:{email}`, `create-account:ratelimit-ip:{ip}`, `join-underground:ratelimit-ip:{ip}`, `check-email-available:ratelimit:{ip}`, `register-church:ratelimit:{ip}` | Upstash Redis (REST) | TTL 1h (3600s verified for create-account/join-UG; same INCR+EXPIRE pattern elsewhere). Log lines carry **djb2 non-crypto `ip_hash` only** (also `email_hash`, `auth_id_hash`) — deliberate raw-IP-out-of-logs posture | ✗ (transient) | T2 |
| 35 | Admin IP + user-agent on sensitive reads | `admin-open-heartcry` request context | `audit_log.meta` (`ip`, `user_agent` ≤500 chars) | — | **Append-only forever** (`prevent_audit_log_mutation` trigger); see Gap 5 for age-out ruling | ✗ | T1 (admin PII) |
| 36 | `audit_log` / `audit_log_underground` meta (jsonb: heartcry_id, user_id, operation_id, scrub records, deactivations, sha256 email hash on UG hard-delete) | System-written | Both tables, **append-only enforced by triggers (verified)** | Admin review surfaces | Life-safety + escalated reads: retained FOREVER (locked ruling — disclosure-relevant). Cleared non-safety flag reads: 30-day age-out RULED but **no machinery exists (Gap 5)** | ✗ | T1 |
| 37 | `email_log` (user_id=recipient, template, sent dates, resend_id, outcome) | `submit-heartcry`, `send-message` T1 alert, `emit_pastoral_digest` | `public.email_log` | — | **No retention machinery (indefinite)**; low-PII rows (internal recipients: triage/pastoral leads). Welcome emails NOT logged here | ✗ | T3 |
| 38 | Device GPS coordinates | CamlView via `@rnmapbox/maps` LocationManager (NOT expo-location); iOS `NSLocationWhenInUseUsageDescription`: "…Your position is never shared." | **Not stored server-side.** Sent to: (a) `get-nearby-churches` edge fn (`{lat,lng}` body — UG callers 403 *before* body parse, so UG coords never enter the pipeline); (b) **Mapbox Geocoding API** (`api.mapbox.com/geocoding/v5/…{lng},{lat}.json`) once per CamlView mount for city label | Mapbox (third party) + Supabase edge runtime (transient) | Not persisted by Replant; Mapbox processor retention per their policy | n/a | T1 |
| 39 | Map viewport / tile requests | GlobeView + CamlView tile loads | — | Mapbox tile API (viewport coords + device IP implicit); **`@rnmapbox/maps` ^10.3.0 with NO telemetry opt-out found** (no `MGLMapboxMetricsEnabled` in Info.plist, no `setTelemetryEnabled`) → SDK-default telemetry to `events.mapbox.com` presumed ACTIVE (Gap 7) | Mapbox | Mapbox-side | n/a | T1 |
| 40 | Client-side storage | expo-secure-store: per-key AES-256 session-encryption keys (`replant.session.k.*`, Keychain/EncryptedSharedPreferences), `covenant_ack`, `tutorial_church_tab_seen`, pending-signout flag, notification-badge pref (device-local). AsyncStorage: **encrypted** Supabase session blob only (AES-GCM, KAN-87) | Device only | — | Cleared on sign-out (key + ciphertext both deleted) | n/a | T2 |
| 41 | Push tokens / analytics / crash / device IDs / avatars / contacts / photos | **NONE.** No expo-notifications, no Sentry/Amplitude/Segment/Firebase, no expo-device, no image picker, no storage uploads from app, no contacts access. expo-screen-capture used for join-code screenshot *detection* (device-side), expo-clipboard write-only | — | — | — | — | — |
| 42 | Supabase Auth telemetry | GoTrue: `last_sign_in_at`, confirmation/recovery/reauth tokens, `raw_app_meta_data` (admin-tier claims via auth hook), `raw_user_meta_data`; **auth request logs incl. IPs are Supabase-platform-managed** (plan-dependent retention — verify in dashboard) | `auth` schema / platform logs | — | Platform-managed; `auth.users` row hard-deleted by sweeper ✓ | D ✓ | T2 |
| 43 | Auth transactional emails (confirm/recovery) | Supabase Auth sender; SMTP provider config is dashboard-side — **verify whether custom SMTP (Resend) is wired** | — | Email provider | Provider-side | n/a | T2 |

### 1e. Website (projectreplant.org — `website/` + `netlify/functions/`) & blog

| # | Field | Collected where | Stored where | Flows to | Retention | DSR | Tier |
|---|---|---|---|---|---|---|---|
| 44 | Join-network form: `name`, `church`, `city`, `email`, `role` | `website/index.html` Netlify Form `join-network` | **Netlify Forms** (platform storage) | `submission-created` background fn appends **name, church, city, email, role + ET timestamp to a Google Sheet** (googleapis + service account) — Google = processor | **No retention/deletion story on either store (Gap 9)** | ✗ | T2 |
| 45 | Volunteer form (`serve-with-us`): `first_name`, `last_name`, `email`, `phone` (opt), `city` (city+country), `location` (Local/Remote/Both toggle — NOT GPS), role checkboxes, etc. | `website/volunteer.html` (has inline privacy sentence) | **Netlify Forms only** (background fn skips non-join-network) | Netlify notification config = dashboard-side, verify | No retention story | ✗ | T2 |
| 46 | Website visitor IPs | Google Fonts loaded remotely (`fonts.googleapis.com`) on all three pages → visitor IP to Google; Netlify serves site (standard logs) | Google / Netlify | — | Provider-side | n/a | T3 |
| 47 | Blog (`blog/`, Astro) | **Static — no forms, no analytics found** | — | — | — | — | — |

---

## 2. Processor & flow map (verified)

1. **Supabase / AWS `us-east-1`** (verified via `get_project`; Postgres 17.6): system of record for everything in §1a–1d. Extensions live: `pg_cron 1.6.4`, `pg_net 0.20.0`, `pgcrypto 1.3`, `postgis 3.3.7`, `supabase_vault 0.3.1`, `pg_stat_statements`, `uuid-ossp`. Vault secret names: `heartcry_encryption_key`, `heartcry_triage_lead_email`, `replant_system_user_id`, `resend_api_key`, `welcome_dm_internal_token`.
2. **Resend** (API key from Vault; From `noreply@projectreplant.org`, digest From/To `info@projectreplant.org`, team notifications To `connect@projectreplant.org`). PII riding outbound, exhaustively: (a) welcome emails — recipient address + `firstName` in body; UG variant deliberately generic (no name/role/church/country/"underground"); (b) new-church team notification — leader full name + email + church id (suppressed for UG); (c) heartcry triage notification — static body, zero PII; (d) pastoral T1 alert — content-free; (e) pastoral digest (sent from the DB via `pg_net`) — queue counts only. Resend retains sent-mail content/metadata per its own policy (processor fact).
3. **Upstash Redis** (REST; region not verifiable from repo — dashboard check): raw IPs + raw signup email in rate-limit key names, ≤1h TTL; pastoral T1 emit cap key carries leader UUID (1h); idempotency caches store **response bodies only** — `{userId, churchId}` UUIDs, 1h TTL. **The create-account idempotency cache does NOT store the signup payload — confirmed from `handler.ts` line 544.**
4. **Netlify**: hosts projectreplant.org + Forms storage (both website forms) + the `submission-created` function runtime.
5. **Google**: Sheets API (join-network lead rows via service account) + remote Google Fonts (visitor IPs).
6. **Mapbox**: tile requests (implicit viewport + IP), one-shot reverse geocode with exact device GPS, and presumed-active default SDK telemetry (Gap 7). Access token is a client-side public token (`EXPO_PUBLIC_MAPBOX_TOKEN`).
7. **Apple/Google stores**: no push, no IAP, no tracking SDKs — nothing flows.

---

## 3. Retention & lifecycle — live verification results

### 3a. Cron layer (verified live: `SELECT jobname, schedule, command FROM cron.job` — 9 jobs, all active)

1. `underground_hard_delete_sweeper_daily` — `0 3 * * *` — `fn_hard_delete_expired_soft_deletes()` ✓ **exists, body verified**: tombstones users (`full_name/first/last='[redacted]'`, `middle_name=''`, honorific/suffix/phone NULL, email→`deleted+<id>@projectreplant.org`), **deletes the `auth.users` row**, UG-audits with sha256 email hash, cascades church `hard_deleted_at` when last leader gone.
2. `church-pii-scrub` — `15 3 * * *` — `scrub_church_pii()` ✓ verified: deactivated+90d / rejected+7d → NULLs `contact_email`/`contact_phone` + audit row. (KAN-63 machinery.)
3. `user-pii-scrub` — `16 3 * * *` — `scrub_user_pii()` ✓ verified: same windows → scrubs `email` + `full_name` **only** (see Gap 1).
4. `underground_expire_stale_proposals_hourly` — `0 * * * *`.
5. `underground_orphan_evidence_intent_hourly` — `0 * * * *` — deletes unconfirmed UG evidence rows >1h old.
6. `underground_day_25_route_daily` — `0 9 * * *` (queue routing).
7. `pastoral-daily-digest` — `0 9 * * *` — `emit_pastoral_digest()` (counts-only email via pg_net; writes email_log incl. suppressed outcomes).
8. `auto-link-pending-parents` — `0 3 * * *`.
9. `admin_tier_promotions_expire_4h` — `0 */4 * * *`.

### 3b. Per-class retention verdicts

1. **User identity:** strong at hard-delete (30-day restore window via `fn_soft_delete_my_account` → sweeper); leaky at 90-day deactivation scrub (Gap 1).
2. **Church PII:** scrub exists for admin-deactivated/rejected paths; **structurally unreachable for self-service deletions** and hard-delete doesn't null contact/address/coords (Gap 2). `contact_name` has no scrub anywhere.
3. **Messages / conversations / testimonies / comments / connection requests:** no retention or purge machinery — retained indefinitely, surviving account deletion in de-attributed form (Gap 8). Prayer requests: self-serve soft-delete RPC only.
4. **Heartcries:** encrypted-at-rest forever; no purge machinery; decrypt-at-read always audited. Defensible; must be disclosed.
5. **audit_log / audit_log_underground:** append-only enforced by triggers (verified). Life-safety + escalated reads retained forever (locked ruling — must appear in the privacy policy). 30-day age-out for cleared non-safety flag reads: **ruled but not built** (Gap 5).
6. **email_log:** no retention story; low-PII (Gap 10, minor).
7. **UG join codes:** bcrypt-10 at rest, single-use, hash-change-blocked by trigger, plaintext only ever in the one-time reveal response. Exemplary.
8. **Upstash:** everything TTL'd ≤1h. Idempotency caches PII-free.
9. **Website leads (Netlify Forms + Google Sheet):** no retention story at all, entirely outside DB machinery (Gap 9).
10. **pg_net:** `net.http_post` used for digest emails — pg_net's internal request/response tables are short-lived queue infrastructure (extension-managed); the request body contains the Resend API key at send time. Noted as a fact; key lives in Vault otherwise.

---

## 4. DSR paths — per right, as of today

| # | Right | What exists TODAY | Verdict |
|---|---|---|---|
| 1 | **Access** | User sees own profile/content in-app piecemeal. No consolidated access mechanism, no admin runbook found in this repo | **No path — compliance gap (Gap 3)** |
| 2 | **Export / portability** | **Nothing.** No export function in DB (`pg_proc` sweep), no endpoint, no admin tooling in this repo | **No path — compliance gap (Gap 3)** |
| 3 | **Rectification** | Self-serve ✓: display-name preference, name order, include-middle-name, honorific, anonymous flag (direct RLS-gated `users` updates); church RAG (Settings); church profile fields via completion-flow edit mode + `update-church` edge fn (onboarding). Self-serve ✗: first/middle/last name, email, phone, role, church contact email/phone (admin-side manual — verify in admin repo). Password: reset-by-email flow ✓; in-app change is a ComingSoon stub | **Partial** |
| 4 | **Deletion** | DB machinery LIVE and verified: `fn_soft_delete_my_account('leader_initiated')` → 30-day restore (`fn_restore_my_account`, `fn_initiate_restore_underground`) → Day-30 sweeper hard-delete incl. `auth.users` row. **But the in-app entry point is a ComingSoonModal stub (KAN-205)** — no user can reach it today. Content survives de-attributed; church contact PII survives (Gap 2) | **Machinery ✓ / user path ✗ (Gap 4)** |
| 5 | **Restriction / objection** | Anonymous flag restricts display, not processing. No formal mechanism | No path — worksheet item for policy wording |
| 6 | **Withdraw consent** | No consent-manager; deletion is the only withdrawal (and it's stubbed) | Rides on Gap 4 |

---

## 5. Cross-border posture — facts only (analysis → counsel)

1. All server-side personal data resides in **AWS us-east-1** (Supabase project region verified live).
2. The user base is global by design — including the GDPR/UK-GDPR/NDPR/DPDP/LGPD/PIPA jurisdictions named on KAN-157 — so every non-US user's data is a cross-border transfer to the US.
3. Processors receiving personal data: Supabase (US region), Resend (US), Upstash (region unverified from repo), Netlify, Google (Sheets + Fonts), Mapbox. DPA/SCC status per processor is dashboard/legal-side — not verifiable from this repo.
4. No data-residency or localization machinery exists (single region, no sharding).
5. `country_continent_map` table + continent-anonymized heartcry feed are the only geography-generalization machinery — protective, not residency-related.

---

## 6. Gaps — ranked

**Compliance gaps (would falsify a legal/store artifact or break a stated promise):**

1. **`scrub_user_pii` misses the structured name columns + phone.** It scrubs `email` + `full_name` only; `first_name`, `middle_name`, `last_name`, `honorific`, `suffix`, `phone` (KAN-229/231, added after KAN-63) survive the 90-day post-deactivation scrub indefinitely. One-migration fix.
2. **Church PII survives the completed deletion lifecycle.** Self-service soft-delete never sets `verification_status='deactivated'` (no trigger does either — verified), so `scrub_church_pii` can never fire for that path; and `fn_hard_delete_expired_soft_deletes` stamps `churches.hard_deleted_at` without nulling `contact_name`/`contact_email`/`contact_phone`/`address`/`lat`/`lng`. A deleted leader's own contact details can persist forever on the church row.
3. **No access/export path for any data-subject** (GDPR Art. 15/20 analogues). Policy v0.3 must either not promise it or ship a process (even a manual admin runbook).
4. **In-app account deletion is a ComingSoon stub (KAN-205)** while the DB machinery is live. Apple App Review 5.1.1(v) requires in-app deletion initiation for apps with account creation — store-readiness blocker, and the wiring target already exists.
5. **Audit-log 30-day age-out (cleared non-safety flag reads) is ruled but unbuilt** — no cron, no function (verified against live `cron.job` + `pg_proc`). Either build it or disclose indefinite retention.
6. **`PrivacyInfo.xcprivacy` declares `NSPrivacyCollectedDataTypes` = empty** (`NSPrivacyTracking` false is correct). Actual collection: name, email, phone, coarse+precise location (church coords; device GPS in transit), messages/user content — the manifest and both store forms must be rebuilt from this inventory.
7. **Mapbox telemetry not disabled.** `@rnmapbox/maps` ^10.3.0 with no opt-out found in code, app.json, or Info.plist → SDK-default device telemetry to events.mapbox.com presumed active; sits badly beside the iOS permission copy "Your position is never shared" and beside the UG threat model. Disable (or verify disabled) and reflect the residual in labels.
8. **No retention story for the content plane** — messages, conversations, testimonies, comments, connection requests: indefinite, surviving account deletion de-attributed. Possibly the right ministry choice — but it must be a *stated* choice in the policy ("retained while the account is active and thereafter in de-identified form"), and the `attribution_display_name` snapshot (row 24) survives later anonymity changes.
9. **Website lead data has no lifecycle** — join-network rows live in Netlify Forms AND a Google Sheet; volunteer submissions in Netlify Forms; no deletion process, no retention limit, and the join-network form (unlike volunteer) carries no privacy notice. Google is an undisclosed-until-now processor.

**Worksheet items (verify/tidy, no artifact falsified yet):**

10. `email_log` retention policy (indefinite today; low-PII). Raw IP/email in Upstash key names — transient (≤1h) and purposeful, but hash-in-key would be cheap hardening; disclose IP processing for security/rate-limiting in the policy.
11. `users.last_seen_at` has no writer in this repo — confirm the admin-side writer and its purpose before disclosing.
12. Supabase Auth SMTP sender + auth-log retention + Upstash region + Netlify form notification targets — four dashboard-side confirmations.
13. Volunteer-form promise "kept private and only used to contact you about serving" — make the Netlify Forms + notification handling match it.

---

## 7. What held up (genuine credit)

1. **The heartcry envelope is the strongest thing in the system:** verify_jwt, Vault-held key, `pgp_sym_encrypt` at rest, plaintext-never-in-row, decrypt only through a SECURITY DEFINER RPC that commits TWO audit rows (with admin IP/UA) *before* releasing content, 5-minute TOTP freshness, static zero-PII triage email, SAFE-LOG envelopes naming forbidden fields. This matches the sensitivity of the data class.
2. **The deletion core is real, not aspirational:** self-serve soft-delete RPC with 30-day restore, a live daily sweeper that tombstones every name field + phone + email AND deletes the `auth.users` row, with UG deletions audited by email *hash* only.
3. **UG data minimization is enforced in three layers** (validator, edge-fn strip, DB CHECK + triggers), join codes are bcrypt-10/single-use/reveal-audited, UG welcome emails are deliberately information-free, the UG 403 in `get-nearby-churches` fires *before* body parse so UG GPS never enters the pipeline, and the only storage bucket is private with hourly orphan cleanup and envelope-encryption columns.
4. **Ops email discipline:** counts-only digest, content-free T1 alerts, no-PII triage pings — Resend sees almost nothing beyond welcome-email first names and one team notification.
5. **The mobile client is unusually quiet:** no analytics, no crash SDK, no push tokens, no avatars, no contacts/photos, session encrypted at rest with Keychain-held AES keys, and log hygiene (djb2-hashed identifiers) applied consistently across edge functions.
6. **Append-only audit enforcement** is real (mutation-blocking triggers on both audit tables, verified live).

## 8. Adjacent notes

1. **`flag_taxonomy_secret.json` at the repo root:** it *does* contain the real detection patterns (the sensitive part), and the repo (`github.com/ife-arike/replant`) is **PUBLIC** — but the file is in `.gitignore` (line 54), `git ls-files` doesn't know it, and `git log --all` shows it was never committed. So: no exposure today; the committed `_shared/taxonomy-codes.ts` mirror strips patterns by construction (AC-12). Residual risk is process-level — a working-tree secret in a public repo's root is one forced-add or gitignore edit away from exposure, and pattern secrecy is what keeps hostile actors from crafting scanner-evading messages. Worksheet: relocate the canonical file outside the repo (it's already read via `--in` path argument) or add a gitleaks rule pinning it.
2. **The whole mobile repo is public** — fine per the console-opacity doctrine (BE gates load-bearing), but the store-listing/privacy-policy team should know the client source, including the iOS permission strings and flag-code *names*, is world-readable.
3. **`connect@` / `info@` / `ruth@projectreplant.org` mailboxes** are where leader PII lands via notifications — the mail provider behind those inboxes is part of the real processor surface for the policy's "who sees your data" answer.
4. Country at user level is UI-collected but never persisted (row 10) — if KAN-187's intent was to *keep* user-level country, that's a product decision to revisit; as-built it is data minimization working in the users' favor.
