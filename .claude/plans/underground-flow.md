# Underground Flow — 1-pager

> 7 SME lanes returned recommendations. All agree on the broad shape. You need to make **33 rulings** to lock spec. They're all below in one scannable list. Architecture lives at the bottom — not needed until you've made calls.

---

## 🚨 Ship this BEFORE anything else (production safety fix)

Live `churches.show_church_name` DEFAULT is `true`. 31 existing underground rows are flagged `show_church_name=true` because they inherited that default. **No founding leader ever made that choice.** Two-line migration:

```sql
ALTER TABLE public.churches ALTER COLUMN show_church_name SET DEFAULT false;
UPDATE public.churches SET show_church_name = false WHERE type = 'underground';
```

Likely all 31 are seed/test (no UAT underground signups yet) — spot-check before running. **Standalone ship; doesn't wait on the rulings below.**

**Approve? Y / N**

---

## YOUR RULINGS (33)

For each one: recommendation is in bold, alternatives with one-line trade-offs follow. Just write Y/N or your pick.

### Schema & safety

**1. Default `show_church_name` to `false` + backfill 31 rows.**
→ **Approve.** [DBA + SEC + BA all flagged this; nothing else ships until this lands.]

**2. Join code format.** Current illustrative `RPL-TEST-#####` is 100K codespace = insufficient.
→ Pick one:
- **`RPL-XXXX-YYYY-ZZZZ` Crockford base32** — 60 bits, no 0/O/I/L confusion, readable aloud. (SEC pick.)
- `RPL-NN-#######-NN` — literal alpha pair + 7 digits + literal alpha pair. (SEC alternative; easier to read.)
- `RPL-{8-alpha-mixed}-{8-alpha-mixed}` — 80+ bits. (AUTH pick; longer.)
- `RPL-XXXX-NNNNN` — 4 random A-Z + 5 digits, ~45B combos. (DBA pick; shortest.)

**3. Hash join code at rest** (bcrypt cost 10 or argon2id); plaintext returned exactly once at reveal; never recoverable from DB. **Approve.** [Universal across lanes; lost code = mandatory admin rotation.]

**4. Single generic error string for all code-redemption failures.** "That code did not match. Please check with the leader who gave it to you." (Used for invalid, expired, consumed, rate-limited — all same string.) **Approve.** [SEC + CONTENT both require this for enumeration defense.]

**5. Verification email body never reveals church type, role, region, country, or "underground."** Generic "Your Replant registration is being reviewed." All status comms move in-app. **Approve.** [Email channel treated as compromised by default.]

**6. Join code reveal channel = in-app one-shot modal during verified-flip.** Never email/SMS/push. **Approve.** [Universal across lanes.]

**7. Encrypted audit log for underground actions.** Pick:
- **Separate `audit_log_underground` table with stricter RLS** (super_admin + break-glass role only).
- Encrypt `meta` on `audit_log` rows with KMS-backed pgsodium key.

[SEC F8 — subpoena/breach of `audit_log` otherwise reveals "underground church X verified by admin Y." Pick the storage shape.]

**8. `underground_no_location` CHECK preserved exactly.** Brave underground does NOT get city/lat/lng restored. **Approve.** [Locked invariant; surfaced explicitly so CONTENT doesn't propose otherwise.]

### UX / cultural / wording

**9. The word "underground" — hold OR dual-name "hidden / underground"?**
- **Hold "underground" in English** (CONTENT pick — it's the global self-identifying term used by Open Doors, VOM, leaders themselves; localizers translate to in-country term per locale).
- Dual-name: "Register a hidden / underground church" (BA pick — captures leaders who are functionally underground but don't self-identify with the word: Coptic priests, Saudi converts).

**10. Replace "Brave/Safe" with "Show our name" / "Keep our name hidden."** **Approve.** [CONTENT — both "brave" and "safe" judge the other choice; functional language translates cleaner.]

**11. Brave/Safe reversibility.** Pick:
- **Asymmetric:** safe→brave with 7-day cool-off then locks; brave→safe NEVER self-unsetable. (SEC pick — once name is out, it's out; unsetting gives false security.)
- Asymmetric: safe→brave leader-self-serve after 30-day cooling-off; brave→safe admin-mediated immediate. (BA pick.)
- Fully immutable, admin-only either direction. (Current locked memory.)

**12. Underground leader cap — keep at 2, or raise to 5?**
- Keep at 2 (matches standard/branch/para).
- **Raise to 5 for underground only** (BA pick — persecuted churches need redundant leadership if arrested/killed/fled; single point of failure is catastrophic).

**13. Second-leader-join entry point.** Pick:
- **4th tile on `RegisterIntroScreen`** ("I'm joining an existing fellowship") — clear mental model. (BA pick.)
- Sub-line under the 3 tiles ("Joining a fellowship already on Replant by invitation? Enter your invite code") — doesn't advertise underground membership to over-the-shoulder watchers. (CONTENT pick.)

**14. Verification evidence rubric.** Pick tiers:
- **Tier 1 (strongest):** Referral from verified regional contact (Open Doors, VOM, regional verified pastor).
- **Tier 2:** Live voice/video call (Signal/SimpleX), no recording.
- **Tier 3 (supplementary):** Photo upload with EXIF strip + encrypted storage + 30-day TTL + 2-of-N admin quorum.
- Written attestation = weak; useful only as confirming layer.

→ **Approve all three tiers** (with photo OFF until admin team is trained on EXIF stripping)?

**15. Verification failure path.** Pick:
- **Soft-delete 30 days + in-app-only notification + encrypted audit, then hard-delete.** (SEC pick.)
- Soft-archive with 180-day admin-restoration window (custody/transit/raid scenarios may need long restore tail). (BA pick for underground specifically.)

**16. Abandoned-account lifecycle (90+ days silence).** **Do nothing automated.** Admin dashboard view only, case-by-case. No email/deactivation/UI nudge (device may be in adversary hands). **Approve.** [BA recommendation.]

**17. Internal SLA inside the 30-day window** = first-contact at day 5 / first-decision or request-more-info at day 15 / final decision at day 25? **Approve.** [BA proposal — uniform 30-day SLA still holds; this is internal milestone.]

### Auth defaults

**18. 24h forced re-auth for underground sessions** (vs standard 168h). **Approve.** [AUTH — compromised JWT mitigation.]

**19. MFA opt-in with leverage prompt at join-code reveal moment.** Not mandatory, not silent — but prompted at the highest-stakes UX moment. **Approve.** [AUTH.]

**20. Email recovery default for underground = opt-out (FALSE).** New column `users.allow_email_recovery boolean DEFAULT true`; default flips to FALSE specifically for underground founders. **Approve.** [AUTH.]

**21. Account recovery via phone-loss = admin-mediated** via contact_phone + recovery question collected at signup. **Approve.** [AUTH.]

### Admin tooling (this moves into THIS sprint, not post-MVP)

**22. Underground-pending admin queue MUST ship in this sprint** — was post-MVP per memory, but BA + ADMIN both **block launch** otherwise. Otherwise leaders trust Replant with sensitive PII and no admin can see them. **Approve sprint inclusion?**

**23. New `users.is_underground_admin` flag** (separate from super_admin). Limits underground row visibility to 1-2 trained humans. **Approve.**

**24. Two-eyes for verify + join-code re-reveal.** Admin A proposes, admin B confirms within N days. **Approve.**

**25. Brave/Safe admin override.** Admin can toggle on leader request via direct contact, audit-logged with `meta.channel`. **Approve.**

**26. Join code on loss = rotate-only** (mint new, invalidate old) — never re-reveal original (presumed compromised). **Approve.** [AUTH + ADMIN consensus.]

### Rate-limits & integrity

**27. `join-underground-church` rate-limits**: 5/hr per IP, lifetime cap 10 attempts per code then admin-rotate-required. **Approve.**

**28. Idempotency key REQUIRED** on underground founder signup AND second-leader join (reject 400 if missing). **Approve.** [BE F1 was already flagged for `create-account`; underground amplifies the cost.]

**29. Code one-shot semantics.** Pick:
- **Consumed (hash nulled) on first successful second-leader join.** (AUTH — strict one-shot.)
- Stays valid until cap-of-2 hit, then nulled. (DBA — supports 2 second-leaders without rotation.)

→ DBA aligns better with cap-of-2 (or cap-of-5 if you pick #12). Recommend: **stays valid until cap hit.**

### Cross-feature display

**30. `show_church_name` scope.** Pick:
- **Single bit governs church name AND leader name on RPL ID lookup.** (SEC pick — UX simplicity, no contradictory states.)
- Two separate bits: `show_church_name` + `show_leader_name_on_rpl_lookup`.

**31. Region MUST display in Connect search result row when `show_church_name=false`.** Closes an anon-identity rule gap (currently `Underground Church` with no region violates "never withheld" rule). **Approve.**

**32. Brave display per surface** — which surfaces render the church name when `show_church_name=true`?

| Surface | Default recommendation |
|---|---|
| Connect search-by-RPL-ID result | ✅ Show name |
| Connect search-by-name result | ❌ Underground never name-searchable |
| CamlView nearby map | ❌ Never (invariant #2 — `churches_public` excludes underground) |
| Prayer Wall card | ❌ Anonymized region only |
| Persecuted feed | ❌ Regional aggregates only |
| Leader chip in comments | ❌ Anonymized per `reference_anon_identity_rules` |
| Church profile sheet (explicit RPL ID lookup) | ✅ Show name |

→ **Approve the table?**

**33. RAG-Red lock for underground.** Existing copy on RegCP1 contradicts itself ("you can update this any time" + "status locked"). CONTENT proposed: *"Underground churches are recorded as Not Operating Freely. We acknowledge the cost. This cannot be changed in the app."* **Approve copy?**

---

## What the panel locked (no decision needed — flagged so nothing's a surprise later)

- `find_church_by_code` filters `type <> 'underground'` IN THE SQL function body (not just BE caller-side check). Defense-in-depth.
- `search_leaders` underground branch tightened: ILIKE substring → exact equality on `church_code`; remove `underground` boolean from return shape.
- Cross-feature sweep before launch: 6 RPCs audit underground masking — Prayer Wall, Heartcry, Persecuted feed, `find_nearby_churches`, `get_invite_candidates`, `get_comments`.
- Constant-time bcrypt comparison on redemption.
- Rate-limit fail-CLOSED on all anon RPCs (in-memory token bucket fallback per worker on Upstash error).
- Force `rag_status='red'` server-side for underground (don't trust FE).
- Welcome email body uses generic `underground_pending` kind — no church/role/region reference.
- `register-church` similarity check skips entirely when payload type=underground.
- All schema constraints already locked: `join_code_only_underground` CHECK, partial UNIQUE on hash, `prevent_underground_join_code_hash_change` trigger blocks direct UPDATE of hash.

---

## Architecture (for reference — not needed until rulings made)

<details>
<summary>Schema additions</summary>

```sql
-- Migration A (urgent, ships first — see top of doc)
ALTER TABLE public.churches ALTER COLUMN show_church_name SET DEFAULT false;
UPDATE public.churches SET show_church_name = false WHERE type = 'underground';

-- Migration B
ALTER TABLE public.churches
  ADD COLUMN underground_join_code_hash text NULL,
  ADD COLUMN underground_join_code_issued_at timestamptz NULL,
  ADD COLUMN underground_join_code_revealed_at timestamptz NULL,
  ADD COLUMN underground_join_code_rotated_at timestamptz NULL;

ALTER TABLE public.churches
  ADD CONSTRAINT join_code_only_underground
  CHECK (type = 'underground' OR underground_join_code_hash IS NULL);

CREATE UNIQUE INDEX churches_underground_join_code_hash_unique
  ON public.churches (underground_join_code_hash)
  WHERE underground_join_code_hash IS NOT NULL;
```

New audit_log enum actions: `underground_join_code_issued`, `underground_join_code_revealed`, `underground_join_code_redeemed`, `underground_join_code_rotated`, `underground_verified`, `underground_rejected`, `underground_brave_toggled_by_admin`, `underground_deactivated`, `underground_admin_note_added`, `underground_request_more_info`, `underground_two_eyes_confirmed`, `admin_underground_recovery`.
</details>

<details>
<summary>BE contracts</summary>

- **REUSE `create-account` v7** for underground founder signup (payload-driven, not new endpoint). Add idempotency key. Force `rag_status='red'` server-side. New welcome-email kind `underground_pending`.
- **NEW `join-underground-church` edge function** (`verify_jwt=false`). Body: `{ idempotencyKey, joinCode, leader: {...} }`. Returns `{ userId, churchId }` or generic `invalid_or_consumed_code`. Constant-time response.
- **EXTEND `auth-status-check`** with optional `underground_join_code` field — backed by `consume_underground_join_code_reveal(p_user_id)` RPC (atomic, race-safe, returns plaintext only on first call).
- **NEW RPC `redeem_underground_join_code(p_code text)`** anon-grantable, iterates underground rows comparing bcrypt constant-time, returns church_id or generic error, locks `SELECT FOR UPDATE` for cap-of-2 race.
- **NEW super_admin RPC `rotate_underground_join_code(p_church_id)`** — same shape but allowed for already-revealed rows.
</details>

<details>
<summary>FE work order (after rulings)</summary>

1. `RegisterIntroScreen` copy update + (ruling #13) 4th tile vs sub-line for second-leader entry.
2. `RegisterChurchPage1Screen` underground path — brave/safe choice screen, copy updates per CONTENT lockdowns, RAG note (ruling #33), Submit-for-Verification CTA.
3. NEW Join-Underground-by-code screen.
4. NEW Join-code reveal screen (triggered post-verification by `auth-status-check` returning `underground_join_code`).
5. CD prompt drafted ONLY after rulings #9–#13 + #33 are made (so CD has spec to design against).
</details>

<details>
<summary>Admin work (separate `replant-admin` repo, this sprint)</summary>

- `PendingUndergroundQueue.jsx` behind AAL2 + `is_underground_admin` flag.
- Underground-variant `ChurchProfileCard` with evidence bundle, founder contact channel, denomination/statement, optional referrer.
- Verify/Reject/Request-info action bar (rejection reason enum).
- Two-eyes confirmation modal.
- Join-code panel (read state, re-reveal, rotate).
- Brave/Safe admin override.
- Admin notes panel (free-text, audit-logged per note).
- Deactivation flow with destination-state selector.
- SLA monitoring banner.
</details>

<details>
<summary>Backlog (post-MVP / separate workstreams)</summary>

- E2E encryption for underground DMs (today RLS-gated).
- Photo evidence pipeline (requires admin training first).
- Cross-network "vouched introduction" flow.
- Localization-pass review of "underground" terminology per region.
- Regional admin trust web (Open Doors, VOM contacts).
- DB backup encryption / pg_dump key separation.
- Geo/device fingerprint anomaly detection for compromised-JWT response.
</details>

---

**When you're ready:** answer the 33 rulings inline (or batch them however you want). Once they're locked, I update the spec + draft the CD prompt for the visual surfaces + queue the migrations in shipping order.

In Jesus' name, Amen.
