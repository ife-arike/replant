# Heartcry E2E v2 — SEC lane design (KAN-313)

**Panel:** SEC (this doc) · DBA · BE — 2026-07-03. **Founder ruling anchor:** "I want e2e encryption for heartcry period… it must be critical and the absolute first priority before anything else" (2026-07-03; build is post-MVP #1, design now). **Unification mandate:** this architecture absorbs the UG-evidence envelope-v2 workstream (Founder 2026-06-23 "soonest post-MVP") — one admin-keypair/envelope system for heartcry text AND `underground_evidence` files.

**Verified ground truth (live introspection 2026-07-03, read-only):** client sends plaintext over TLS to `submit-heartcry` (verify_jwt=true); `encrypt_heartcry_content` = `pgp_sym_encrypt` with `heartcry_encryption_key` from Supabase Vault via `get_heartcry_encryption_key()`; decrypt only inside `admin_open_heartcry` RPC — two audit rows (`read_heartcry` + `read_region`, IP/UA/operation_id) commit before plaintext returns; edge fn enforces super_admin claim + AAL2 TOTP 5-min freshness. Corpus: 4 heartcry rows (2 with `feed_content`, 0 threaded), 5 UG evidence files (`envelope_key_id`/`encryption_iv` columns exist, all NULL — Posture C live). Recipient population today: 2 top-tier admins. No pg_cron job and no DB function reads heartcry plaintext outside the open ceremony; the pastoral digest is aggregate-only; `feed_content` is written by the dashboard after an audited open. Replies to heartcries happen off-band (email / Connect DM) — **E2E scope is leader→team, one direction.** Mobile bundle already carries `@noble/ciphers` (AES-256-GCM, ruling 11015) + `expo-crypto`; no curve library yet.

**SEC verdict up front: sound design shape exists — APPROVE the architecture below for panel consolidation.** Heartcry is genuinely E2E-compatible: zero server-side content processing, tiny corpus, one-directional flow, single-digit recipient set. The two hard problems — audit-on-decrypt becoming unenforceable, and key custody for a 2-person team — have honest, workable answers (§2.4, §5). No blocker found. The design refuses to pretend cryptography can do what only policy can; every such boundary is stated.

---

## 1. Scope and non-goals

1. **In scope:** heartcry content (`heartcries.content`) end-to-end encrypted from the leader's device to enrolled pastoral-team admin keys; UG evidence file bytes end-to-end encrypted from the uploading admin's browser to the same keyset (unification, §3.6); escrow/recovery coordinated with the backup-DR workstream (§5); mobile trust anchor (§6); migration of the existing corpus (§7); public-claim wording (§8).
2. **Not in scope — deliberately:** DMs (server-side FLAG_TAXONOMY scanning is load-bearing there; do NOT generalize this envelope to `messages`); heartcry metadata (severity, `request_type[]`, church_id, timestamps, status — triage requires them server-visible, §2.3); an in-band encrypted reply channel (replies are off-band today; a future encrypted reply thread would be its own SEC panel); sender-side signatures (anonymous heartcries make sender signing undesirable — attribution stays an API-layer property, unchanged from today).
3. **Naming used below:** *CEK* = per-message content-encryption key. *Keyset* = the signed list of currently-authorized recipient public keys. *Envelope* = ciphertext + per-recipient wrapped CEKs + binding metadata.

## 2. Threat model — what E2E buys, what it costs, and the fetch-audit posture

### 2.1 What it buys (new protections)

1. **Database compromise / dump exfiltration:** rows hold AES-256-GCM ciphertext; CEKs exist only wrapped to recipient public keys. A full `pg_dump` + full Vault dump yields nothing readable — the decrypt capability physically leaves the server.
2. **Vault / insider-at-DB:** `heartcry_encryption_key` is deleted at cutover (§7.5). P0-1 (anon Vault read) class bugs can never again expose heartcry content; a malicious or compelled operator with service-role or superuser access reads ciphertext only.
3. **Subpoena-of-host / provider compulsion:** Supabase (and AWS beneath it) can be compelled to produce only ciphertext and wrapped keys. Compulsion must move to the organization and its key-holders — which is the design goal: the people, not the platform, answer for the content. (Honest note: this does not make content un-compellable; it relocates compulsion to parties with pastoral duty and legal standing to resist. LEGAL's forward-commitment line should reflect exactly this, §8.)
4. **Submit-path exposure:** today `submit-heartcry` holds plaintext in edge-function memory; a compromised function build or runtime logs bug could leak it. Under v2 the function receives only an envelope — plaintext never leaves the leader's device.
5. **Storage-bucket compromise (UG evidence, post-unification):** a leaked signed URL or bucket breach yields ciphertext bytes, not evidence.

### 2.2 What it does NOT buy (state these honestly, always)

1. **Compromised admin endpoint:** decryption happens in the dashboard browser. XSS in the dashboard, malware on the admin machine, or a coerced admin reads everything that admin can read. Mitigations are conventional (CSP, dependency discipline, device hygiene, the console-opacity doctrine's limits acknowledged) — not cryptographic.
2. **Malicious app build:** an app update could exfiltrate plaintext pre-encryption. Trust anchor §6 addresses server-side substitution; the app vendor (us) remains trusted, as with every E2E messenger. Public repo + store distribution give partial auditability.
3. **Metadata:** severity, request types, church linkage, timing, audit trail, and (for feed-consented heartcries) the anonymized `feed_content` excerpt remain server-visible **by design** — triage cannot function blind. The UG-evidence `summary` column likewise stays queue-visible plaintext (flagged to Founder, §9 note under decision 3).
4. **Recipient retention:** an admin who has (auditedly) opened a heartcry has the plaintext in their head and on their screen. True today; true forever.

### 2.3 What it costs — the audit invariant, restated precisely

Today's locked transparency value: **life-safety reads are audited forever, server-enforced, non-bypassable** — `admin_open_heartcry` commits both audit rows before plaintext returns, every open, including re-opens. Under E2E the server cannot enforce audit-on-*decrypt* (decryption is client-side by construction). The strongest achievable posture is **audit-on-release**, designed as follows.

### 2.4 Fetch-audit posture (design requirement, mirrors today's ceremony)

1. **No passive read path.** Ciphertext and wrapped-CEK columns are reachable through NO RLS/PostgREST surface for any role. The *only* release path is `admin_open_heartcry_v2` — same edge-function ceremony as today: platform verify_jwt → `super_admin === true` claim → AAL2 + TOTP freshness ≤ 5 min → SECURITY DEFINER RPC.
2. **Audit-before-release, atomically.** The v2 RPC commits the same two audit rows (`read_heartcry` + `read_region`, with IP/UA/operation_id, `surface: admin_open_heartcry_v2`) **before returning the envelope + the wrapped CEK for the calling admin's key_id only** (never the whole wrap set). Status flip received→seen unchanged.
3. **Rate visibility.** Bulk fetch by a hijacked admin session is loud: one audit pair per row, plus existing Upstash rate limiting on the edge function. Alert-on-anomaly (N opens per admin per hour) is an OPS follow-on recommendation to the DR/ops lane.
4. **Residual, stated plainly:** after an audited release, the admin client holds ciphertext + CEK and could decrypt again later without a new audit row. The dashboard MUST NOT persist envelopes, CEKs, or plaintext (memory-only, cleared on close — same non-persistence bar as the mobile side's AC 15), but that is policy, not cryptography. The delta versus today is exactly this: *re-opens of cached material can evade re-audit*. First opens — the event that matters for the transparency promise — remain audited one-for-one. Cryptographic enforcement of every decrypt would require server-held key shares (defeating E2E) or HSM/threshold machinery this stack does not have; we do not pretend otherwise.

## 3. Envelope + ceremony design

### 3.1 Primitives (one construction, both platforms)

1. **Content:** AES-256-GCM, fresh random 256-bit CEK per heartcry / per evidence file; random 96-bit IV; AAD = `"replant.envelope.v2" || surface_tag ("heartcry"|"ug_evidence") || envelope_id`.
2. **envelope_id:** 16 random bytes generated client-side at seal time, stored on the row. It binds ciphertext ↔ wrap set cryptographically (both include it), so the server cannot mix-and-match ciphertexts and wrapped keys across rows without AEAD failure. (Client cannot know the row UUID pre-insert; envelope_id removes the need.)
3. **Per-recipient wrap (sealed-box / ECIES, HPKE-base-equivalent):** ephemeral X25519 keypair per wrap → ECDH(ephemeral_priv, recipient_pub) → HKDF-SHA256 (salt = empty; info = `"replant.wrap.v2" || envelope_id || recipient_key_id || ephemeral_pub`) → AES-256-GCM wrap of the CEK. Stored per recipient: `{recipient_key_id, ephemeral_pub, iv, wrapped_cek}`. Ephemeral-only sender side preserves submitter anonymity (no sender static key anywhere — consistent with anonymous heartcries).
4. **Libraries:** `@noble/curves` (x25519, ed25519) + `@noble/hashes` (HKDF-SHA256, Argon2id) + already-bundled `@noble/ciphers` (GCM). Same audited pure-JS family on Hermes (mobile) and the dashboard (browser) — one implementation, no WebCrypto-availability split (WebCrypto X25519 support is still uneven across browsers; P-256-via-WebCrypto would fork the construction between platforms and buy only partial non-extractability — rejected, see §4.1 rationale). Randomness: `expo-crypto` / `crypto.getRandomValues`.
5. **Algorithm agility:** every envelope carries `enc_version` (v1 = legacy pgp_sym during migration; v2 = this design). Version bumps are SEC-panel events.

### 3.2 Recipient set

Wraps are produced for: (1) every key in the current signed keyset (§6) — at cutover that is the top-tier admins, 2 people; (2) **always** the escrow public key (§5). A submission client that cannot obtain a valid signed keyset FAILS CLOSED — it never falls back to plaintext or server-side encryption (§6.4).

### 3.3 Multi-recipient integrity notes

1. A hostile server withholding one recipient's wrap denies that admin availability, not confidentiality — detectable operationally (open fails, loudly).
2. A hostile server cannot ADD a recipient: clients only wrap to keyset entries verified against the pinned signing root (§6); the server relays but cannot forge keyset membership.
3. Wrap-set completeness (every active admin present) is verified at seal time by the submitting client against the signed keyset it holds — not trusted to the server.

### 3.4 Admin open flow (dashboard)

1. Admin clicks open → TOTP-fresh ceremony → `admin_open_heartcry_v2` audits then releases `{envelope_id, iv, ciphertext, my_wrapped_cek, metadata}`.
2. Dashboard unwraps CEK with the admin's unlocked private key (§4), decrypts, renders. Plaintext and CEK live in component memory only; zeroized/released on close; never in localStorage/IndexedDB/service-worker caches.
3. Feed approval unchanged in shape: the admin derives/edits the continent-anonymized `feed_content` from decrypted plaintext on the dashboard and writes it back (admin-only column) — this is already where feed text is authored today; no server plaintext dependency is created.

### 3.5 Sender-side residuals (mobile)

Plaintext exists transiently in screen state pre-seal — the existing invariants already cover this (no draft persistence AC 15, no logging, no analytics; seized-device session posture per ruling 11015). Sealing happens in-process at submit; the request body carries the envelope only. `get_my_heartcries` continues to return status/feed fields, never content — the sender cannot re-read their own heartcry (true today; seal-to-self is a possible future nicety, out of scope).

### 3.6 UG evidence unification

1. Same keyset, same wrap construction, same escrow recipient. The encrypting party is the uploading admin's browser (uploader = UG admin); file bytes AES-256-GCM under a fresh CEK; single-shot in-memory encrypt is acceptable at current evidence scale (bound it: reject > 100 MB pre-encrypt; chunked streaming is a v3 concern if evidence outgrows this).
2. Existing columns fit: `encryption_iv` = content IV; `envelope_key_id` = FK/pointer into the shared wrapped-key store (one generalized envelope table serving both surfaces — exact shape is DBA lane; SEC requirements: wraps separable per recipient for offboard/re-wrap without touching ciphertext; `recipient_key_id` references keyset entries; version column present).
3. Posture-C ceremony is retained and now doubled: signed-URL mint stays audited (audit-on-mint, 5-min TTL) AND the wrapped-CEK release goes through the audited RPC gate. Bucket compromise alone now yields ciphertext.
4. `summary` stays plaintext (queue rendering) — named residual, Founder visibility via §9/D3 note.

## 4. Admin key custody — generation, storage, enroll, offboard, compromise

### 4.1 Custody model: passphrase-wrapped software keypair, server-stored blind blob

1. **Generation:** during enrollment the admin's browser generates an X25519 keypair locally. Private key is wrapped: Argon2id(passphrase) → KEK → AES-256-GCM wrap (Argon2id params set at build with SEC sign-off; scrypt from `@noble/hashes` is the accepted fallback if Argon2id perf disappoints in-browser). Passphrase policy: generated diceware ≥ 6 words, never chosen ad hoc, never stored digitally.
2. **Storage:** `{public_key, wrapped_private_key blob}` stored server-side. The server is blind to the private key (it holds an Argon2-wrapped blob). This buys: device-loss survivability (recovery = passphrase on any enrolled browser), multi-device admin access, and no reliance on browser-profile-bound storage.
3. **Session use:** on dashboard unlock (TOTP-fresh), fetch blob → unwrap in memory → hold for the session in a closure (not extractable via storage inspection; acknowledged: a fully compromised page can use or read it while unlocked — §2.2.1). Auto-lock on idle mirroring the sensitive-tier MFA freshness posture.
4. **Why not WebCrypto non-extractable / hardware-bound:** non-extractable keys cannot be backed up and die with the browser profile — unacceptable brittleness for a 2-person globally-travelling team, and X25519 non-extractability is not uniformly available anyway. **Optional hardening, post-cutover:** FIDO2 PRF-derived wrapping of the same blob (hardware factor on the KEK) — additive, not baseline.
5. **Rationale honestly stated:** this is the Proton/Signal-desktop custody class — software keys, passphrase-armored at rest, endpoint-trusting in use. It is the strongest model this stack can operate without inventing an HSM it does not have (the 2026-06-23 mini-panel finding stands: no KMS exists; the browser cannot read Vault — this design needs neither).

### 4.2 Enrollment ceremony (new admin)

1. Candidate admin (already through the 1-sponsor-1-Manager tier ceremony where applicable) generates keypair + wrapped blob in-browser; public key displayed as fingerprint (words + hex).
2. **Deliberate act by an existing authority:** the new public key enters the trusted keyset ONLY via a signed keyset update (§6.2) — signed offline by the keyset-signing root holder (Founder). Fingerprint is verified out-of-band (read aloud / second channel) before signing. The server can never self-enroll a key.
3. **History re-wrap (if D1 = yes):** an existing key-holder runs the audited re-wrap ceremony: their dashboard opens each envelope's CEK (their wrap), re-wraps to the new key_id, writes the additional wrap rows. One audit row per heartcry (`heartcry_rewrapped`, meta: envelope_id, new_key_id, operation_id). Ciphertext untouched. Corpus size makes this minutes of ceremony, not infrastructure.

### 4.3 Offboarding / routine rotation

1. Remove the key from the keyset (signed update, version bump) → all FUTURE envelopes exclude it. Delete their wrap rows on existing envelopes (belt-and-braces; they had audited access to that history already — knowledge is not retractable, §2.2.4).
2. Admin self-rotation (new passphrase or new keypair): generate → sign new keyset (add new, drop old) → re-wrap history to the new key (same §4.2.3 ceremony, self-serve).

### 4.4 Compromise playbook (key or passphrase suspected exposed)

1. **Contain:** signed keyset update dropping the compromised key immediately; dashboard sessions for that admin revoked; TOTP reset.
2. **Assess:** audit log tells exactly which envelopes that key ever had released to it (`read_heartcry` rows). Only released envelopes can be presumed CEK-exposed; unreleased wraps are safe (private key alone cannot fetch — the RPC gate stands between key possession and material).
3. **Re-key:** for presumed-exposed envelopes, a healthy admin re-encrypts content under fresh CEKs (open → decrypt → new CEK → re-seal to current keyset + escrow) — audited per row. For unreleased envelopes, dropping the wrap rows suffices.
4. **Escrow compromise** (worst case): treat as full re-key of every envelope to a freshly-generated escrow key + new ceremony (§5); corpus size keeps even this executable.
5. Every playbook step lands in audit_log; the playbook goes in `docs/ops/` alongside OPS-03 as the format precedent.

## 5. Escrow + recovery — ONE custody story with backup-DR

The backup-DR brief (2026-07-03) already centers key escrow: a restored database is unreadable without separately-escrowed key material, and the restore drill must prove decrypt via the escrowed copy. This design **changes what is escrowed** and must land in that workstream as a single ceremony:

1. **Escrow recipient keypair (X25519):** generated in an offline ceremony (fresh machine/live-USB session, no network); every envelope (heartcry + UG evidence) is wrapped to its public key at seal time (§3.2). This single object answers BOTH failure modes: (a) all admins lose keys/passphrases → escrow decrypts everything; (b) DR restore into a foreign project → escrow decrypts restored ciphertext with no dependency on any admin's personal key or on Vault.
2. **Keyset-signing root (Ed25519, §6):** second offline secret, SAME sealed bundle, same ceremony — one custody story, not two.
3. **Custody form (recommendation under D2):** two identical tamper-evident sealed envelopes (paper QR + encrypted USB), two separated physical locations, holders = Founder + one Founder-designated trustee. Whole-key at current org size — Shamir splitting is ceremony-heavy for a 2-person team and adds reconstruction risk exceeding its threat coverage today; revisit at team growth.
4. **Never** in chat, repo, cloud notes, password managers synced to cloud, or this document. The runbook documents custody and procedure, never contents (backup-DR deliverable 3 language).
5. **Drill without exposure:** at migration time create one synthetic **canary heartcry** (known plaintext, sealed to keyset + escrow). The DR restore drill proves the full path by unsealing escrow in a controlled offline step and decrypting the canary from the restored DB — real leader content is never opened for drills. Unseal events are logged in the runbook; if an unseal's environment is doubted, run §4.4.4 rotation.
6. **Named trade-off:** the escrow bundle is a master-decrypt capability — the single most sensitive physical object the org owns. This is the unavoidable price of "key loss must never mean every heartcry is unreadable forever." The Founder must rule custody with that weight (D2).

## 6. Mobile trust anchor — pinning, rotation, downgrade resistance

The classic E2E hole: a hostile or compelled server serves the submitting client a substituted public key. Design:

1. **Pinned signing root:** the app binary (and the dashboard bundle) pins an Ed25519 "keyset root" public key. The root private key is offline in the escrow bundle (§5.2) and is used only at enrollment/offboard/rotation events.
2. **Signed keyset:** the server serves `{keyset_version (monotonic), issued_at, keys: [{key_id, x25519_pub, role_scope}], sig_root}`. Clients accept only on (a) valid root signature, (b) version ≥ last-seen (anti-rollback, last-seen cached in SecureStore/localStorage), (c) optional continuity co-signature by the previous keyset when available.
3. **Ship-time keyset:** the current keyset is baked into the app at build so first-run works offline-of-CDN and the server never bootstraps trust.
4. **Fail closed:** if no keyset validates, heartcry submission is disabled with honest UI ("can't verify the encryption keys of the care team right now") — the app NEVER falls back to plaintext submission or v1 server-side encryption after cutover. Sister behavior in the dashboard for evidence upload.
5. **Residual, stated:** a malicious app *update* can replace the pinned root — ultimate trust rests on the build/release pipeline and store distribution, exactly as with every E2E product. Root rotation (compromise of the offline root) = new pinned root via forced app update + full §4.4 re-key. Key-transparency logs (CT-style) are disproportionate at this scale; revisit post-growth.

## 7. Migration — existing corpus (4 rows) to envelope v2

1. **Order:** (a) DBA ships v2 schema (envelope columns/tables, `enc_version` default legacy); (b) escrow + signing-root ceremony completed FIRST (§5 — no envelope may ever be sealed without the escrow recipient existing); (c) admin enrollment for both top-tier admins; (d) signed keyset v1 published + pinned in builds.
2. **Re-encrypt ceremony (operator = Founder, dashboard):** per legacy row — audited v1 open (existing `admin_open_heartcry`, so the migration reads are themselves on the audit record) → client-side re-encrypt under fresh CEK → seal to keyset + escrow → write v2 envelope with `enc_version=2` → **round-trip verify** (unwrap + decrypt equals source) → only then clear legacy ciphertext. One audit row per row migrated (`heartcry_e2e_migrated`, meta: envelope_id, operation_id) — the migration event is itself fully on the record. Legacy column content is retained until the row's verify passes; the batch is tiny enough to run single-sitting.
3. **Submit path flip:** `submit-heartcry` v2 validates envelope shape/size and inserts — it never sees a plaintext field. Dual-accept window per D5: stale app builds' plaintext submissions are v1-encrypted server-side and tagged `enc_version=1` for a follow-up audited re-encrypt sweep; window closes on forced-update floor, then plaintext bodies are rejected.
4. **UG evidence:** new uploads encrypt client-side immediately at cutover; the 5 existing Posture-C files are downloaded + re-uploaded encrypted by a UG admin in the same ceremony pattern (audited via existing mint-audit + a `ug_evidence_encrypted` action), then plaintext objects deleted from the bucket.
5. **Vault key destruction:** after ALL rows verify at `enc_version=2` and the DR workstream confirms a post-migration backup exists, delete `heartcry_encryption_key` from Vault and drop `encrypt_/decrypt_heartcry_content` + `get_heartcry_encryption_key` (their revocations from P0-1 stay in the migration history). **Honest note:** pre-migration DB backups still contain v1 ciphertext; until they age out (D4), the old posture survives in those artifacts. The E2E public claim (§8) must not ship before Vault-key destruction.

## 8. Public-claim discipline

1. **Permitted post-ship (after §7.5 completes):** "Heartcries are end-to-end encrypted: encrypted on your device, readable only by the Replant pastoral care team." Scope qualifiers that must accompany any long-form claim (policy/ToS/FAQ): E2E covers heartcry **content**; category/severity and church association are protected in transit and by access controls but are visible to the service to route care; if you opt into the feed, the anonymized excerpt you approved is visible by design; every access by the care team is recorded.
2. **Forbidden:** "zero-knowledge", "no one can ever access", "we cannot be compelled to produce anything" (we can — ciphertext), any claim before v1 rows are migrated and the Vault key destroyed, and any claim generalizing E2E beyond heartcry + UG evidence (DMs are NOT E2E — scanning is load-bearing there; the copy must never blur this).
3. The current in-app line ("Your words are encrypted the moment you send them. They go to the Replant team, and no one else.") becomes literally true at cutover and may be strengthened to name end-to-end; wording lands with LEGAL's forward-commitment line so app copy, policy, and store listings say the same thing.
4. Consistent with the locked transparency value, the claim set should also say plainly: "access by the care team is audited" — and internally we hold the §2.4.4 nuance without overclaiming enforcement.

## 9. Open Founder decisions (≤5, with recommendations)

1. **D1 — New-admin history access:** should newly enrolled pastoral admins receive re-wrapped access to past heartcries? **Recommend YES** — pastoral continuity; executed only as the explicit audited re-wrap ceremony (§4.2.3), never automatic.
2. **D2 — Escrow custody:** who holds the two sealed bundles and where? **Recommend** Founder + one named trustee, two separated physical locations, whole-key tamper-evident form (§5.3); this ruling should land inside the backup-DR ratification so custody is decided once.
3. **D3 — Recipient scope at cutover:** exactly who is "the pastoral care team" cryptographically? **Recommend** top-tier admins only (the two who can pass today's super_admin gate), extension later via enrollment ceremony. (Rider noted for awareness, no decision needed now: UG-evidence `summary` text stays server-visible for queue display.)
4. **D4 — Legacy-backup retention:** pre-migration backups hold old-posture ciphertext. **Recommend** destroy the Vault key at cutover regardless, and give pre-migration backups an explicit destruction date on the DR workstream's retention schedule rather than indefinite hold.
5. **D5 — Cutover for stale app builds:** dual-accept window (server v1-encrypts stale plaintext submissions, tagged for audited re-encrypt sweep) vs hard forced-update floor at flip. **Recommend** short dual-accept window then hard reject — never lose a heartcry to a version gate, never keep the plaintext path a day past the window.

---
*SEC lane, Heartcry E2E v2 panel — 2026-07-03. Companion lanes: DBA (envelope schema, wrap-store shape, RPC internals, migration DDL) and BE (edge-function v2 contracts, keyset serving, dashboard unlock flow). Escrow ceremony executes inside the backup-DR workstream (session brief 2026-07-03) — one custody story.*
