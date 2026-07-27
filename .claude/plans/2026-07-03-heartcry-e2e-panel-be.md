# Heartcry E2E v2 — BE lane design (KAN-313)

**Panel:** 3-role design panel, BE lane (SEC + DBA run parallel). **Ruling anchor:** Founder-LOCKED 2026-07-03, KAN-313 (live-Jira spot-checked 2026-07-03: "Heartcry E2E v2 — CRITICAL #1 post-MVP (unified envelope encryption; SEC design panel now)", In Progress). Unified with UG-evidence envelope v2 per KAN-313 description ("absorbs the UG-evidence envelope-v2 workstream").

**BE verdict: GO.** True E2E for heartcry is achievable on the current stack with no native-module additions and a cheap migration (live corpus: 4 rows, 2 with `feed_content`). Honest limits stated in §0.2 — none are blockers, all must be named in LEGAL-owned public wording (KAN-157 lineage: never overclaim).

---

## 0. Scope and honest limits

### 0.1 What becomes E2E
`heartcries.content` (the cry itself) and UG-evidence file bytes + filenames. Encrypted on the leader's device; decryptable only by enrolled pastoral-team admins in their browsers. The server (edge functions, Postgres, Vault, backups, Supabase staff, a leaked service-role key) can never produce plaintext for v2 rows.

### 0.2 What does NOT become E2E — say it plainly
1. **Metadata stays server-visible plaintext:** `severity`, `request_type`, `post_to_feed`, `church_id`, `user_id`, timestamps, row existence. Triage and the feed depend on them. (Dispatch-confirmed: severity/request_type stay client metadata → plaintext columns.)
2. **The admin browser is a plaintext endpoint.** E2E moves trust from "server + admin" to "admin only." A compromised admin machine still reads heartcries. That is the design, not a defect.
3. **Departed admins may retain what they already read.** Rotation kills future access; it cannot recall past plaintext from a human's memory or screenshots.
4. **Legacy ciphertext lives in DB backups** under the Vault key until backup retention ages them out (§6.4).
5. **Old app builds send plaintext to the server during the rollout window** (§6.1 — DELIVER-ALWAYS trade, explicit sunset).

### 0.3 Verified current path (every server behavior that touches plaintext today)
| # | Hop | Today | v2 replacement |
|---|-----|-------|----------------|
| 1 | `HeartcrySubmissionScreen` → HTTPS body | plaintext `content` in JSON | ciphertext envelope only |
| 2 | `submit-heartcry` `validateBody` | trim / non-empty / ≤10,000 chars on plaintext | envelope shape checks only (§2.4); plaintext checks move client-side |
| 3 | Deno isolate memory | holds plaintext between parse and RPC | never sees plaintext |
| 4 | `encrypt_heartcry_content(plaintext, key)` RPC | **plaintext travels as a SQL parameter into Postgres** (exposed to statement logging / `pg_stat_statements` surfaces) | RPC deleted from the v2 path; retired at sunset |
| 5 | Vault `get_heartcry_encryption_key` boot load | symmetric key in isolate memory | not loaded on v2 path; retained only for legacy window |
| 6 | `admin_open_heartcry` RPC | `pgp_sym_decrypt` **server-side**, plaintext in RPC return JSON | returns ciphertext + caller's wrapped key; decrypt moves to admin browser (§3) |
| 7 | `feed_content` | authored **admin-side post-decrypt** (verified live: no server auto-generation; no UPDATE RLS policy; only `admin_open_heartcry` + `retract_heartcry_feed_consent` update `heartcries`) | stays admin-authored, now in-browser post-decrypt (§2.6 — BE rules against leader-device generation) |
| 8 | Triage email | already static zero-PII (D-26 / SEC G-24) | unchanged |
| 9 | `get_my_heartcries` | returns `feed_content` + status, **never** `content` — leaders never re-read their own cry | unchanged; no leader-side wrap needed (load-bearing simplification) |
| 10 | Feed read `get_heartcry_feed` | reads `feed_content` only | unchanged |

---

## 1. Envelope spec + library choice

### 1.1 Library ruling (mobile): extend @noble. Not libsodium.
- `@noble/ciphers` 2.2.0 is **already bundled** (AES-256-GCM proven in `src/lib/secure-storage.ts`, SEC ruling 11015) and `expo-crypto` already provides OS RNG.
- Add `@noble/curves` (X25519 subpath; pulls `@noble/hashes` for HKDF-SHA256). Pure JS, Hermes-safe, audited lineage, ~20–35 KB min+gz total added. No config-plugin, no EAS native churn.
- libsodium.js is WASM — not runnable under Hermes; RN would need `react-native-libsodium` (new **native** dependency, new build surface, new supply-chain trust). Sealed-box wire compatibility with libsodium buys nothing: we own both endpoints (RN client wraps, our admin browser unwraps).
- **Admin browser uses the same @noble code** (shared `envelope-v2` module published to both repos or vendored) so one construction, one test-vector set, no cross-library interop bugs. WebCrypto custody question is SEC's call (§3.2) — it does not change the wrap math.

### 1.2 Construction (ECIES-style sealed box on noble primitives)
Per submission:
```
CMK      = 32 random bytes                     (expo-crypto OS RNG)
iv       = 12 random bytes
ct       = AES-256-GCM(key=CMK, iv, plaintext) (@noble/ciphers gcm)
per enrolled admin key (key_id, admin_pub X25519), roster epoch E:
  eph    = X25519 ephemeral keypair            (fresh per wrap)
  shared = x25519(eph.priv, admin_pub)
  wk     = HKDF-SHA256(ikm=shared, salt=eph.pub||admin_pub,
                       info="replant-envelope-v2-wrap", len=32)
  wrap_iv = 12 random bytes
  wrapped = AES-256-GCM(key=wk, iv=wrap_iv, CMK)   → 48 bytes
zeroize CMK, eph.priv, wk after use (best effort in JS)
```
One CMK, N wraps (pastoral roster is small — single digits). New admins cannot read old rows until the re-wrap ceremony (§4.2). Content ciphertext is never touched by rotation — only 48-byte wraps move.

### 1.3 Wire envelope (client → `submit-heartcry` v2 body)
```jsonc
{
  "v": 2,
  "client_msg_id": "uuid",          // idempotency key (§2.3)
  "key_epoch": 7,                   // roster epoch the client verified
  "content_env": { "iv": "b64(12B)", "ct": "b64(≤64KB)" },
  "wrapped_keys": [
    { "key_id": "uuid", "eph_pub": "b64(32B)",
      "wrap_iv": "b64(12B)", "wrapped": "b64(48B)" }
  ],
  "severity": "urgent",             // metadata — plaintext by design (§0.2.1)
  "request_type": ["prayer"],
  "post_to_feed": false
}
```

---

## 2. Client-side encryption path (mobile)

### 2.1 Flow (diagram-in-text)
```
Leader taps "Send My Heartcry"
  → validate plaintext locally (trim, non-empty, ≤10,000 chars)  [replaces server hop #2]
  → ensure verified roster (cached signed roster, epoch E; §4.1)
      • roster cache stale >7d AND unreachable → block send with
        "reconnect to send" state (never encrypt to an unverifiable roster)
  → generate client_msg_id + CMK + iv; encrypt; wrap CMK to each roster key
  → POST supabase.functions.invoke('submit-heartcry', envelope)
  → 200 {success:true} → confirmation modal (unchanged Screen 15B)
  → error → keep envelope IN MEMORY; "Try again" resends the SAME bytes
```

### 2.2 New module `src/lib/heartcry-envelope.ts`
```ts
export interface RosterKey { key_id: string; x25519_pub: Uint8Array }
export interface VerifiedRoster { epoch: number; keys: RosterKey[] }
export async function sealHeartcry(
  plaintext: string, roster: VerifiedRoster, clientMsgId: string,
): Promise<HeartcryEnvelopeV2>;
```
Same SECURITY INVARIANTS block as the screen: no logging, no persistence, no analytics; plaintext and CMK exist only in function scope.

### 2.3 Offline / retry semantics — encrypted-payload idempotency
- **Encrypt once, retry the identical bytes.** GCM nonce reuse is only dangerous across *different* plaintexts; a byte-identical resend is safe. Any edit to the content (or roster refresh) discards the envelope and regenerates CMK + iv + `client_msg_id`.
- **Server dedupe:** unique index `(user_id, client_msg_id)`; insert `ON CONFLICT DO NOTHING`; conflict returns the same `200 {success:true}` (submission-level exactly-once over at-least-once retries; timeout-then-retry can no longer double-insert — a strict improvement over today).
- **No offline queue at v2.** AC 15 (no draft persistence) stands: envelope lives in screen memory only; app kill = cry discarded, leader re-types. Persisting even ciphertext creates seized-device forensic surface ("this device sent a heartcry at T"). → Decision D5.

### 2.4 What `submit-heartcry` BECOMES
Keeps: platform `verify_jwt=true`; anon-role 401 split; `fetchSubmitter` verified-leader 403 gate; metadata validation (severity/request_type enums, `post_to_feed === true` coercion); insert with column defaults (`status`, `feed_approved` untouchable by clients); static zero-PII triage email + `email_log`; SAFE-LOG envelope.
Drops (v2 path): `encrypt_heartcry_content` RPC call; Vault `get_heartcry_encryption_key` boot load; every plaintext read.
Adds — envelope validation **without reading content**:
1. `v === 2`; `client_msg_id` UUID; base64 fields decode; `iv` = 12 B; `wrap_iv` = 12 B; `eph_pub` = 32 B; `wrapped` = 48 B.
2. `ct` length: > 16 B (GCM tag alone = empty plaintext — reject) and ≤ 64 KB b64 (10,000-char UTF-8 ceiling × 4 B + margin; hop-#2 hard cap re-expressed in ciphertext bytes).
3. Roster check (server-side, public info): `key_epoch` is active or within grace (§4.3); every `key_id` exists; **strip wraps whose `key_id` is revoked**; require ≥1 wrap for a currently-active key after stripping — else 409 `ROSTER_STALE` (client refreshes roster, re-seals, resends; content never leaves the device unprotected).
4. Insert: `content = ct`, `content_iv`, `enc_version = 2`, `key_epoch`, `client_msg_id`, wraps → `envelope_keys` (§5) in one transaction. Mark `needs_rewrap = true` when accepted wraps < current active roster (grace-window submissions self-report for the ceremony).
5. Legacy branch: body with `v` absent + string `content` → existing v1 path unchanged (§6.1).

Handler `Deps` delta: `encryptContent` → removed on v2; add `getActiveRoster()` (cached like BootCache, epoch-invalidated) and `insertHeartcryV2(row, wraps)`.

### 2.5 Severity / request_type
Client metadata, plaintext columns, unchanged semantics. Restate in ticket + LEGAL wording: triage sorting and the feed filter depend on them; they are **outside** the E2E boundary (§0.2.1).

### 2.6 `feed_content` — BE rules AGAINST leader-device generation (genuine-verdict item)
Dispatch asked whether the leader's device should produce the anonymized preview. **BE ruling: no — keep authorship at the admin plaintext endpoint, now in-browser.** Verified truth: `feed_content` is already authored admin-side post-decrypt after `post_to_feed` consent; the mobile submit path has never written it, and the continent anonymization lives in the `get_heartcry_feed` JOIN, not in `feed_content`.
- Leader-device generation would store a **plaintext-derived excerpt in the DB from submission time, before any approval** — re-opening the exact hole E2E closes. `feed_approved` gating limits *display*, not *storage*.
- The hostile-client mismatch question (forged `feed_content` ≠ content) evaporates: the leader client never supplies it. Admin curates the preview while reading decrypted content in-browser, then writes `feed_content` + `feed_approved` through a new gated RPC `admin_approve_heartcry_feed(p_heartcry_id, p_feed_content, p_operation_id, ...)` (SECURITY DEFINER, super_admin + TOTP-fresh edge wrapper, audit row `heartcry_feed_approved`) — replacing the admin-side service-role write path honestly (**admin-side**: dashboard repo builds the UI; contract designed here from DB truth). KAN-313's "feed_content generation moves client-side" is satisfied — the *admin browser* is the client; no server process ever derives anything from content. → Decision D1.

---

## 3. Admin dashboard decrypt path (admin-side; designed from DB/API truth)

### 3.1 Fetch — `admin_open_heartcry` v2 (audit-before-ciphertext)
Server-enforced audit-before-*decrypt* is impossible under E2E; the strongest achievable (per KAN-313) is audit-before-*fetch*: both audit rows commit in the same transaction that releases ciphertext, so no ciphertext ever leaves without its audit trail.
```sql
admin_open_heartcry(p_heartcry_id uuid, p_admin_id uuid, p_admin_key_id uuid,
                    p_operation_id uuid, p_ip text, p_user_agent text) RETURNS json
-- unchanged: 2 audit rows (read_heartcry, read_region) INSERTed before RETURN;
--            status received→seen flip + triage_lead_id set; church context block.
-- v2 rows:   'encryption':'e2e_v2', 'content_env':{iv,ct}, 'key_epoch',
--            'wrapped_key': the CALLER'S wrap only (key_id match on p_admin_key_id;
--            never the full wrap set), or 'needs_rewrap':true if caller has no wrap.
-- v1 rows (window only): 'encryption':'server_v1', 'content': plaintext as today.
-- caller key revoked/absent from active roster → EXCEPTION key_not_authorized
--            (edge fn maps → 403) BEFORE any ciphertext or audit-status flip.
```
Edge fn `admin-open-heartcry` keeps: gateway 401 / anon 401 / non-super-admin 403 branching, **TOTP 5-min freshness gate (unchanged, still load-bearing — it now gates ciphertext+wrap release)**, `p_admin_id` resolution via `public.users.auth_id`, SAFE-LOG envelope (ciphertext/wraps join the never-log list). Adds `p_admin_key_id` from the request body, cross-checked against `pastoral_team_keys.admin_user_id = p_admin_id`.

### 3.2 Key custody + unlock ceremony (aligns with SEC lane's custody call)
BE recommendation, marked pending SEC concurrence:
- **@noble in-browser, not WebCrypto non-extractable.** Non-extractable X25519 keys cannot be escrowed — and KAN-313 locks custody to the backup-DR escrow ceremony (key loss = permanent loss of every wrapped cry). X25519 `deriveBits` support is also still uneven across the browsers admins actually use.
- Enrollment ceremony (TOTP-fresh): generate X25519 keypair in-browser → escrow private key via the backup-DR ceremony (QR/paper, same custody ritual) → encrypt private key under an admin passphrase (scrypt from `@noble/hashes`, per-key salt, AES-256-GCM) → store wrapped blob in IndexedDB → POST pubkey via `admin-enroll-key` edge fn (TOTP-gated) → root-key roster re-sign (§4.1) activates it.
- **Per-session unlock:** passphrase prompt unwraps the private key into module-scope memory; auto-lock on tab close / idle timeout aligned to dashboard session discipline; decrypted content and private key never touch localStorage/IndexedDB/console (console-opacity doctrine: BE gates load-bearing; strip/minify deterrent).
- Rendering: decrypt → in-memory string → render; existing dashboard copy-protection posture applies unchanged (no clipboard affordances, no print styling).

### 3.3 Failure states (explicit UI contracts, SEC-register copy)
| State | Detection | Surface |
|---|---|---|
| Revoked key | RPC `key_not_authorized` → 403 | "Your decryption key is no longer enrolled." Enrollment path. |
| No wrap for this admin (joined post-message, pre-ceremony) | `needs_rewrap:true` | "Awaiting key handover — ask a current teammate to run the re-wrap ceremony." Metadata still shown. |
| Legacy row in window | `encryption:'server_v1'` | Renders as today; badge "server-encrypted (pre-E2E)". |
| TOTP stale | existing `AAL2_EXPIRED` | Unchanged re-verify flow. |
| Wrong passphrase / missing local key | client-side unwrap failure | Retry; recover-from-escrow path (backup-DR runbook). |
| GCM auth-tag failure | decrypt throws | "Integrity check failed — do not trust this content." Audit row already exists; flag for SEC review. |

---

## 4. Rotation / roster plumbing

### 4.1 Pinned team roster via signed config
- **Root signing key:** one Ed25519 keypair. Public key **pinned in the mobile app build** (config constant) and in the dashboard bundle. Private key: Founder-held, offline, escrowed via the backup-DR ceremony; used only to sign roster epochs. (Ed25519 verify = `@noble/curves/ed25519`, same dependency.) → Decision D4.
- **Roster document:** `{ epoch, keys: [{key_id, x25519_pub, admin_user_id}], activated_at, grace_until, sig }` — sig over canonical JSON bytes. Stored in `team_key_epochs`; served by a public `get-team-roster` edge fn (verify_jwt=true, any authenticated leader). The server distributes but cannot forge: clients verify against the pinned root pubkey and enforce **monotonic epoch** (reject epoch < last verified — anti-rollback).
- Mobile caches the verified roster (plain AsyncStorage is fine — roster is public data); refreshes on app-start/foreground; staleness rule in §2.1.

### 4.2 Re-wrap ceremony (new admin) — batched, audited, resumable
Existing admin's browser (TOTP-fresh, unlocked key):
```
admin_list_rewrap_batch(p_admin_key_id, p_target_key_id, p_limit int)
  → [{heartcry_id | evidence_id, scope, wrapped_key{...}}]   -- caller's wraps for
     objects (heartcry + ug_evidence, unified) missing a wrap for target key_id
  → browser: unwrap CMK → re-wrap to target pubkey            -- 48-byte wraps only;
                                                              -- content ciphertext never moves
admin_submit_rewraps(p_target_key_id, entries[{scope, object_id, eph_pub, wrap_iv, wrapped}])
  → validates target is active roster member; INSERT ... ON CONFLICT (scope, object_id, key_id)
    DO NOTHING  → idempotent = RESUMABLE (re-run until list_rewrap_batch returns 0 rows)
  → one audit row per batch: action 'envelope_rewrap_batch',
    meta {target_key_id, count, operation_id}
```
Both wrapped in a TOTP-gated `admin-rewrap` edge fn (**admin-side** UI: progress bar over batches; interruption-safe by construction). Note honestly: a re-wrapping admin transiently holds each CMK in browser memory — they already hold read access to that content; no new trust is created.

### 4.3 Departure / rotation + the dual-accept grace window
- Revoke: new epoch E+1 signed by root key with the member removed (`pastoral_team_keys.status='revoked'`, `epoch_revoked=E+1`). Server: `admin_open_heartcry` 403s the revoked key immediately; DELETE the revoked key's `envelope_keys` rows (hygiene — their historical plaintext access is already history, §0.2.3).
- **Dual-accept window (a leader mid-submission must never lose a heartcry):** `submit-heartcry` accepts `key_epoch ∈ {E, E-1}` until `team_key_epochs.grace_until` (recommend 7 days). Revoked-key wraps inside a grace submission are **stripped at insert** (§2.4.3) so a departed admin never gains a wrap on a post-departure cry; the row is flagged `needs_rewrap` and the ceremony (§4.2) fills the gap. Past grace with zero valid wraps → 409 `ROSTER_STALE` → client auto-refreshes roster, re-seals, resends within the same submit interaction (one extra round-trip, no leader-visible loss; content never falls back to plaintext).

---

## 5. Schema deltas (BE proposal — DBA lane owns final DDL)

```sql
ALTER TABLE public.heartcries
  ADD COLUMN enc_version   smallint NOT NULL DEFAULT 1,   -- 1=server pgp_sym, 2=E2E
  ADD COLUMN content_iv    text,                          -- b64 12B (v2 rows)
  ADD COLUMN key_epoch     integer,
  ADD COLUMN client_msg_id uuid,
  ADD COLUMN needs_rewrap  boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX heartcries_user_msg_uniq ON public.heartcries(user_id, client_msg_id)
  WHERE client_msg_id IS NOT NULL;

CREATE TABLE public.pastoral_team_keys (
  key_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.users(id),
  x25519_pub text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  epoch_added integer NOT NULL, epoch_revoked integer,
  created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.team_key_epochs (
  epoch integer PRIMARY KEY,
  roster_doc jsonb NOT NULL, root_sig text NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(), grace_until timestamptz NOT NULL);

-- Unified envelope (heartcry + UG evidence — one table per KAN-313 unification)
CREATE TABLE public.envelope_keys (
  scope text NOT NULL CHECK (scope IN ('heartcry','ug_evidence')),
  object_id uuid NOT NULL,
  key_id uuid NOT NULL REFERENCES public.pastoral_team_keys(key_id),
  eph_pub text NOT NULL, wrap_iv text NOT NULL, wrapped_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, object_id, key_id));
-- RLS: deny-all to anon/authenticated; SECURITY DEFINER RPCs + service role only.
-- No client ever reads another admin's wraps.
```
`underground_evidence_files` re-adopts `enc_version`, `content_iv` (the v2-deferred columns from the Posture C migration), plus `chunk_count`, `enc_meta` (encrypted filename/mime blob, §6.5).

---

## 6. Compatibility, migration, UG-evidence file leg

### 6.1 Old builds during rollout — fail-open to server-side encryption, never drop a cry
`submit-heartcry` accepts BOTH bodies for the window: v1 plaintext → existing path (`enc_version=1`, Vault pgp_sym); v2 envelope → E2E path. **DELIVER-ALWAYS:** a leader on an old build in a hard place must never get a rejected heartcry; v1 rows remain protected exactly as today (TLS + at-rest pgp_sym + audited TOTP-gated decrypt). The honest trade: plaintext still transits server memory for old builds. **Sunset:** store min-version enforcement + `enc_version=1` insert count at zero for 30 consecutive days → disable the v1 branch (fail-closed thereafter), REVOKE/DROP `encrypt_heartcry_content`, stop loading the Vault key in `submit-heartcry`. → Decision D2.

### 6.2 One-time migration of existing rows (corpus: 4 rows — do it in the enrollment session)
In-browser ceremony, TOTP-fresh, after ≥1 admin key enrolled: for each `enc_version=1` row → `admin_open_heartcry` (plaintext via legacy path; **2 audit rows per row fire as normal — the migration is fully audited by construction**) → re-encrypt with fresh CMK in-browser → `admin_migrate_heartcry_v2(p_heartcry_id, p_content_env, p_wraps[], p_operation_id)` writes ciphertext + wraps + `enc_version=2` transactionally, audit action `heartcry_migrated_e2e`. Idempotent (skips rows already v2); trivially resumable at 4 rows but built batch-shaped because UG evidence reuses it.

### 6.3 UG-evidence file leg (same envelope, chunked)
- **Client upload-encrypt (mobile):** per-file CMK (one envelope row-set in `envelope_keys`, `scope='ug_evidence'`); 4 MB chunks; per-chunk IV = `base_iv(8B) || chunk_index(4B counter)` — no IV reuse, no whole-file RAM spike under Hermes; GCM tag per chunk. Filename + MIME encrypted into `enc_meta` under the same CMK (plaintext filenames leak identity); storage path = opaque UUID.
- Upload ciphertext chunks to the private `underground_evidence` bucket via the existing signed-upload flow; Posture C controls (deny-all storage RLS, 5-min signed URLs, audit-on-mint) all stay — they now guard ciphertext.
- **Admin-side:** mint signed URL (audited, unchanged) → fetch chunks → unwrap CMK via own `envelope_keys` wrap (released through the same audit-before-fetch RPC pattern, `admin_open_evidence`) → per-chunk decrypt → assemble Blob → object-URL render, revoked on close.
- Migration from Posture C: same §6.2 ceremony shape — signed-URL download → in-browser encrypt → re-upload → envelope rows → delete plaintext object (corpus currently near-zero; confirm count at build time).

### 6.4 Legacy Vault key end-of-life
Vault key must outlive every artifact encrypted under it: destroy only after (a) all rows migrated, (b) v1 sunset (§6.1), (c) **DB backup retention horizon passes** (backups hold pgp_sym ciphertext; premature destruction would silently break restore-readability — coordinate with the parallel backup-DR workstream; hold the key in that workstream's escrow until then, destruction as a logged ceremony). → Decision D3.

### 6.5 Rollout sequence (stages, no time estimates)
1. DDL (§5) + roster epoch 1 signed + `get-team-roster` live.
2. Admin enrollment ceremony (≥2 keys before anything else — single-key = single-point-of-loss; escrow both).
3. `admin-open-heartcry` v2 + dashboard decrypt path deployed (**admin-side**); still all-v1 data — dual-mode read proven.
4. §6.2 migration of the 4 rows; verify each opens via browser decrypt.
5. `submit-heartcry` dual-accept deploy (v1 + v2 branches) — server-first so old and new builds both land safely.
6. Mobile release: envelope module + roster pinning + new submit body.
7. UG-evidence leg (client upload-encrypt + `admin_open_evidence` + Posture C migration).
8. Monitor `enc_version=1` insert count → sunset per D2 → drop legacy RPCs → D3 key end-of-life on its own horizon.

---

## 7. Test story — what proves E2E

1. **Canary grep (the headline proof):** integration harness submits content = `HC_E2E_CANARY_<uuid>` through the real edge fn against a scratch project/branch with a scratch roster keypair. Assert the canary appears **nowhere server-side**: `heartcries.content` (b64-decode ≠ canary), edge-fn captured logs, Postgres logs, `pg_stat_statements`, a full `pg_dump` grep. Run the same harness against the v1 path — it FAILS at the RPC-parameter hop (§0.3 #4). That differential is the honest before/after evidence for the ticket.
2. **Round-trip vectors:** shared `envelope-v2` test vectors (fixed CMK/eph/iv) asserted identically in RN (jest/Hermes) and browser (vitest) builds — seal on one, open on the other, both directions for the re-wrap path.
3. **Audit-rows-before-release contract:** open a v2 row via RPC; assert both `read_heartcry` + `read_region` rows exist with the response's `operation_id` and that an RPC forced to fail *after* audit-insert releases no ciphertext (transaction atomicity probe via `pg_get_constraintdef`-style inspection, never touching append-only audit rows).
4. **Idempotency:** identical envelope POSTed twice → one row, two 200s. Distinct `client_msg_id` → two rows.
5. **Rotation matrix:** enroll B → re-wrap → B decrypts; revoke A → A's open 403s pre-audit-flip, A's wraps deleted, grace-window submission carrying A's wrap has it stripped and row flagged `needs_rewrap`; epoch rollback (serve E-1 after E) → client rejects (pinned-root + monotonic epoch test).
6. **Failure-state UI contracts (admin-side):** each row of §3.3 exercised against a mock RPC in the dashboard repo's harness.
7. **File leg:** multi-chunk file round-trip incl. tamper test (flip one ciphertext byte → chunk GCM failure surfaces §3.3 integrity state, no partial render).

---

## 8. Open Founder decisions (≤5, with BE recommendations)

- **D1 — `feed_content` authorship:** BE recommends **admin-authored in-browser post-decrypt** (matches verified current data flow; keeps every content-derived byte out of the DB pre-approval; kills the forged-preview vector). Alternative (leader-device excerpt at submit) stores plaintext-derived content server-side before approval — BE ruling: regression, decline.
- **D2 — v1-accept sunset trigger:** store-enforced minimum app version PLUS zero `enc_version=1` inserts for 30 consecutive days, then disable the plaintext branch. Until then DELIVER-ALWAYS holds.
- **D3 — legacy Vault key destruction:** hold in backup-DR escrow until the DB-backup retention horizon passes post-migration, then a logged destruction ceremony. Never destroy while any restorable backup needs it.
- **D4 — root roster-signing key custody:** Founder-held offline Ed25519, escrowed via the same backup-DR ceremony; app pins only the public key. (Signing cadence is rare: roster changes only.)
- **D5 — offline encrypted-draft queue:** BE recommends **no** at v2 — AC 15 no-persistence posture stands; retries are in-memory within the screen session. Revisit only with a seized-device SEC panel.

---
*BE lane, 2026-07-03. Repo evidence: `src/screens/main/HeartcrySubmissionScreen.tsx`, `supabase/functions/submit-heartcry/{index,handler,logic}.ts`, `supabase/functions/admin-open-heartcry/index.ts`, `src/lib/secure-storage.ts`, migrations `20260528000008`, `20260606000001–4`, `20260607000002`, `20260702021323`. Live-DB introspection (SELECT-only): `heartcries` columns, `admin_open_heartcry` / `encrypt|decrypt_heartcry_content` / `retract_heartcry_feed_consent` definitions, heartcries RLS policies, row counts. KAN-313 spot-checked live per CLAUDE.md Jira-anchor rule.*
