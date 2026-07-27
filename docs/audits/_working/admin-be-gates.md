# Admin BE Gate-Stack Audit — `replant-admin/netlify/functions/`

**Scope:** 91 Netlify functions + `_lib/` shared helpers + `_emails/`
**Posture:** READ-ONLY static analysis. No code/DB/Jira/git/memory changes.
**Date:** 2026-07-01
**Auditor role:** Senior application-security engineer (pre-UAT audit)
**Context:** Secure comms for persecuted Christian leaders. Real leaders live since 2026-06-28. A skipped gate can unmask an underground leader or let the wrong tier act. Life-safety.

Ground-truth gate stack (destructive endpoints, in order):
`verifyAnyAdmin → assertAtLeast(tier) → AAL2 freshness → optional step-up (TOTP) → rate-limit → audit-first (audit_log INSERT before side effect) → effect`

---

## VERDICT: **NEEDS-FIX**

The `_lib` gate helper architecture is genuinely strong and the escalated-cases / underground-mutation / pastoral-reveal paths are model implementations. But **three legacy super_admin endpoints predating the KAN-114/117 step-up rollout were never retrofitted**, and — most seriously — **`read-region.js`, the underground identity-reveal endpoint, lacks the `is_underground_admin` gate AND AAL2 freshness**. That single P0 is the exact unmasking risk this audit exists to catch. Fix the P0 + P1s before UAT; the P2/P3 items are hardening.

---

## P0 — MUST FIX BEFORE ANY FURTHER UAT

### P0-1 — `read-region.js` reveals underground leader identity with NO underground-admin gate and NO AAL2 freshness
- **File:** `netlify/functions/read-region.js:35-73`
- **Evidence:** Gate is `verifySuperAdmin` ONLY (line 40). No `isUndergroundAdmin` / `fn_assert_underground_admin` check, no `checkAal2Freshness`, no step-up, no rate-limit. The response body returns the underground church's **Real Name, Macro-Region, City/Area, Country, Contact Email, Contact Phone, Admin Notes** (lines 64-73), filtered to `.eq('type','underground')`.
```js
const { user } = await verifySuperAdmin(event.headers.authorization)   // line 40 — ONLY gate
...
return ok({ 'Real Name': data.name, 'City/Area': data.city, 'Country': data.country,
            'Contact Email': data.contact_email, 'Contact Phone': data.contact_phone, ... })
```
- **Impact:** Per the tier matrix, Underground Oversight (incl. the identity reveal) = `super_admin + manager + is_underground_admin`. As written, ANY holder of the `super_admin` JWT claim who is NOT an underground admin can POST a `churchId` and receive a persecuted underground leader's full name, city, country, phone, email. This is the single most sensitive data path in the system and it is missing both the UG gate and the life-safety freshness gate. This is the KAN-288 gap in its most dangerous form. The sibling identity path, `read-heartcry`, is life-safety gated; the UG evidence path, `underground-evidence-signed-url.js`, carries the full UG gate — `read-region` is the inconsistent, unguarded outlier.
- **Contrast (correct sibling):** `reach-out-to-leader-from-message.js:127-138` does the exact inline UG gate this endpoint is missing: `const targetIsUg = targetUser?.church?.type === 'underground'; if (targetIsUg && !isUndergroundAdmin(jwt)) return fail('forbidden_underground_admin', 403)`.
- **Recommendation:** Convert `read-region` to `makeUndergroundGatedHandler` (adds `is_underground_admin` claim + AAL2 gate + audit) OR add the inline `isUndergroundAdmin(jwt)` assertion + `checkAal2Freshness(jwt, { tier: 'sensitive_destructive' })` before the query. Given it exposes identity + contact, `sensitive_destructive` (5-min) is the right freshness tier. It already writes `read_region` audit-first (line 45) — keep that.

---

## P1 — FIX BEFORE UAT

### P1-1 — `deactivate-church.js`, `reinstate-church.js`, `rag-override.js`: declared TIER 1 destructive actions with NO step-up and NO AAL2
- **Files:** `deactivate-church.js:8`, `reinstate-church.js:8`, `rag-override.js:8`
- **Evidence:** All three gate on `verifySuperAdmin` + write audit-first (correct ordering), but none call `checkAal2Freshness` or `validateStepUp`. Yet `action-names.js:20-28` declares `DEACTIVATE_CHURCH`, `REINSTATE_CHURCH`, `RAG_OVERRIDE` as TIER 1 (step-up-required) actions. These are the three oldest files in the directory (May 8) — they predate the KAN-114/117 step-up rollout and were never retrofitted. The sibling `update-church-details.js` (also super_admin, church-scoped) DOES carry `validateStepUp` (action `update-church-details`).
- **Impact:** A compromised/hijacked super_admin session with a stale-but-valid JWT can take a church offline (`deactivate-church`), flip its safety signal (`rag-override` — RAG-Red is the underground safety indicator), or reinstate a deactivated church, all WITHOUT proving physical presence via TOTP. Inconsistent with the entire rest of the destructive surface.
- **Recommendation:** Add `checkAal2Freshness(jwt, { tier: 'sensitive_destructive' })` + `validateStepUp(token, { expectedAction: ACTIONS.DEACTIVATE_CHURCH / REINSTATE_CHURCH / RAG_OVERRIDE, expectedUserId: user.auth_id, event })` to all three, matching `update-church-details.js`. The action-name constants already exist.

### P1-2 — `approve-heartcry-feed.js`: publishes decrypted heartcry plaintext to the public feed with NO AAL2 and NO step-up
- **File:** `netlify/functions/approve-heartcry-feed.js:11-45`
- **Evidence:** Gate is `verifySuperAdmin` only (line 18) + audit-first (line 25). No `checkAal2Freshness`, no `validateStepUp`, no rate-limit. The endpoint takes admin-supplied `feedContent` (the decrypted heartcry plaintext) and writes it to `heartcries.feed_content` where `get_heartcry_feed` surfaces it publicly (lines 36-44).
- **Impact:** Heartcry Inbox = super_admin + manager (tier arguably satisfied by the `super_admin` claim). But this is an **irreversible content-exposure action** — a leader's private crisis message becomes public — and it sits behind only a session check. Every other heartcry path (`read-heartcry` decrypt) is life-safety gated (90-sec AAL2 + step-up). Making the content PUBLIC deserves at least the sensitive-destructive gate.
- **Recommendation:** Add `checkAal2Freshness(jwt, { tier: 'sensitive_destructive' })` and consider a step-up token. At minimum add the AAL2 freshness gate; publishing another person's crisis content is a destructive, high-gravity write.

---

## P2 — SHOULD FIX

### P2-1 — `update-account-name.js`: tier gate reads an UNVERIFIED JWT (no `verifyAnyAdmin` signature check)
- **File:** `netlify/functions/update-account-name.js:30-56`
- **Evidence:** The only auth is `assertAtLeast(authHeader, 'regular')` (line 35). `assertAtLeast` (in `_lib/admin-tier-gate.js:32`) calls `readBearerTier` → `decodeJwtPayload`, which **base64-decodes the payload without verifying the signature**. There is no `verifyAnyAdmin`/`verifySuperAdmin` call, so the JWT signature is never validated at the BE layer.
- **Mitigation (why not P0/P1):** The actual mutation runs through `makeUserClient(authHeader).rpc('fn_update_admin_name')` (lines 71-75). PostgREST validates the JWT signature server-side, and the RPC is SECURITY DEFINER scoped to `auth.uid()`, so a forged/tampered token fails at the Supabase boundary (`auth.uid()` null → RPC raises). Effective access control is preserved by the DB layer.
- **Impact:** The endpoint's own tier gate is decorative — it trusts an unverified `admin_tier` claim. A forged token passes the BE gate and is only stopped at the DB. Inconsistent with every other endpoint; a future refactor that stopped routing through the user-scoped RPC would silently become exploitable.
- **Recommendation:** Add `await verifyAnyAdmin(authHeader)` before `assertAtLeast`, matching every sibling endpoint. Cheap, closes the defense-in-depth gap.

### P2-2 — `revoke-admin.js` (legacy) does not clear `is_underground_admin` in either source
- **File:** `netlify/functions/revoke-admin.js:13,110,126`
- **Evidence:** Legacy super_admin-boolean revoke path. Sets `app_metadata.role = null` (line 126) but never touches `is_underground_admin` in `app_metadata` OR `public.users`. Superseded by `revoke-admin-tier.js` (which clears both sources correctly).
- **Impact:** IF this legacy endpoint is still wired/callable, a revoke through it drops the super_admin claim but leaves `public.users.is_underground_admin = true` orphaned. Because `fn_assert_underground_admin()` is COLUMN-authoritative (reads `public.users`, per the dual-source ruling), the revoked admin's UG gate would still PASS until the column is cleared by other means. Underground identity access outlives the revoke.
- **Recommendation:** Confirm `revoke-admin.js` is dead/unrouted and remove it, OR add the dual-source `is_underground_admin=false` clear (both `app_metadata` and `public.users`) matching `revoke-admin-tier.js:89-109`.

### P2-3 — `mark-heartcry-responded.js`: declared TIER 1 action with no AAL2/step-up
- **File:** `netlify/functions/mark-heartcry-responded.js:8`
- **Evidence:** `verifySuperAdmin` + audit-first only. `action-names.js:27` declares `MARK_HEARTCRY_RESPONDED` as TIER 1. No AAL2, no step-up.
- **Impact:** Lower than P1-2 — this only flips `responded_at` (state, not content exposure). But it is a declared TIER 1 action running without its declared gate.
- **Recommendation:** Add AAL2 freshness (`sensitive_destructive`) for consistency, or formally re-tier it to TIER 2 if state-only-flip doesn't warrant step-up. Resolve the doc-vs-impl drift either way.

### P2-4 — Netlify Forms webhooks not signature-verified
- **Files:** `join-welcome.js`, `volunteer-welcome.js`
- **Evidence:** Both are public webhook handlers (no auth by design) that validate only `form_name` (`EXPECTED_FORM_NAME`). No HMAC/signature verification.
- **Impact:** Limited — Netlify Forms webhooks are not signed by default, and the blast radius is triggering a welcome email (spam/abuse), not data exposure. No DB write, no PII read.
- **Recommendation:** If Netlify webhook signing is available for the site plan, enable it and verify. Otherwise accept the residual risk and note it. Low urgency.

---

## P3 — HARDENING / INFORMATIONAL

### P3-1 — CORS `Access-Control-Allow-Origin: *` on all endpoints
- **Evidence:** 21 literal `Access-Control-Allow-Origin': '*'` occurrences across functions + `_lib/supabase-admin.js:341,349,358`.
- **Impact:** Auth is bearer-JWT in the `Authorization` header (not cookies), so CSRF is not the vector and `*` is a common admin-API posture. But wildcard CORS on endpoints returning underground identity (`read-region`) is worth tightening to the admin origin (`admin.projectreplant.org`) for defense-in-depth.
- **Recommendation:** Consider pinning `Access-Control-Allow-Origin` to the admin origin. Low priority.

### P3-2 — `underground-evidence-signed-url.js` uses `tier: 'browse'` (30-min AAL2) to mint evidence-file URLs
- **File:** `underground-evidence-signed-url.js:77`
- **Evidence:** Full UG gate + rate-limit + RPC audit-first present (good), but the AAL2 tier is `browse` (30 min) for minting a 5-min signed GET URL to an underground evidence photo.
- **Impact:** Evidence photos are UG-sensitive; a 30-min freshness window is looser than the 5-min `sensitive_destructive` used by other UG exposure paths. It DOES carry the UG-admin gate, so this is a freshness-tier nuance, not an open door.
- **Recommendation:** Consider `sensitive_destructive` for evidence-URL minting to match the gravity of the artifact.

### P3-3 — `approve-escalated-proposal.js` self-approve BE block is `user.id`-conditional
- **File:** `approve-escalated-proposal.js:124`
- **Evidence:** `if (user.id && proposal.proposer_id === user.id) return fail('SELF_APPROVE_FORBIDDEN', 403)`. If `user.id` is null (admin with no `public.users` row), the BE block is skipped.
- **Impact:** Minimal. `proposer_id` is NOT NULL (enforced at propose time via the 23514 catch), a null-`user.id` approver can't match a non-null proposer_id anyway, and the DB CHECK `ecp_no_self_approve` is the authoritative backstop. Defense-in-depth only.
- **Recommendation:** Note only. The DB CHECK is the real gate; the BE block is belt-and-suspenders.

---

## Accepted deviations (NOT findings — reasoned exceptions to audit-first)

- **`approve-church.js:93-113`** — audit written AFTER the church mutation + leader cascade (KAN-212). Rationale is sound: the audit meta requires `leaders_verified_count` which only exists post-cascade, `audit_log` rows are immutable so it can't be back-patched, and a failed church update still aborts before the cascade + audit. Not identity-sensitive (authoring a verification). Two-write atomicity preserved.
- **`post-announcement.js:146-186`** — audit-after-insert (KAN-200, SEC c.13797). Needs `announcement_id` (post-insert); `announcements.author_id` self-documents authorship; fail-open is deliberate. Public content authoring, not sensitive.
- **UG endpoints showing "no writeAuditLog in JS"** (`underground-claim`, `underground-narrative-note`, `underground-evidence-*`, `underground-release-claim`, `underground-sibling-*`, `cancel/counter-propose`, etc.) — the per-action audit row (`audit_log_underground`) is written **inside the SECURITY DEFINER RPC before the side effect** per the manifest §2 contract, documented in `_lib/underground-admin-gate.js:15-18`. The JS-layer `writeAuditLog` calls that DO appear (e.g. `counter-propose-underground.js:115`) are secondary forensic rows (notify-channel-down), not the action audit. Audit-first holds at the DB layer.
- **7 endpoints with no `verify*` call** — all legitimately non-admin-action:
  - `join-welcome.js`, `volunteer-welcome.js` — public Netlify Forms webhooks (form_name validated).
  - `scheduled-underground-evidence-exif-scrub.js`, `scheduled-underground-orphan-bytes.js` — cron, invoked by Netlify with no JWT, service-role by design.
  - `decline-underground-proposal.js` — 410 GONE tombstone (deprecated; returns before any work).
  - `activate-account.js` — gates on LIVE `auth.users.app_metadata` (admin_tier/role) via service-role `getUser` because the magic-link session is pre-hook AAL1; user id is from the verified JWT, never the body.
  - `church-intake.js` — public leader-facing intake by design; underground type rejected at BE (line 100); rate-limited at Netlify edge.

---

## What works well (patterns worth protecting)

1. **The `_lib` gate-helper architecture is excellent.** `verifySuperAdmin`/`verifyAnyAdmin` (JWT signature+expiry via `supabase.auth.getUser` THEN claim read), `assertAtLeast` (rank-based tier ceiling), `checkAal2Freshness`/`classifyAal2Failure` (4-tier freshness with fail-closed default = `sensitive_destructive`), `validateStepUp` (HMAC-SHA256, constant-time compare via `timingSafeEqual`, **action-bound + user-bound** token so a token minted for action A can't be replayed against action B), and `makeUndergroundGatedHandler`/`makeAal2GatedHandler` factories. Composable, testable (dep-injection factory shape everywhere), fail-closed by design.

2. **Audit-first ("Third Option", KAN-117) is the default and is genuinely honored.** The audit row lands before the side effect across the mutating surface; the two documented audit-after exceptions are reasoned (immutable-row-needs-post-effect-id) and still abort before the effect on a pre-check failure. `makeAal2GatedHandler` treats pass-path audit-write failure as a 500 ("no audit row → no payload").

3. **`is_underground_admin` dual-source sync is correct in all three writers.** `approve-admin-promotion.js:98-124` sets BOTH `auth.users.app_metadata.is_underground_admin` (JWT mint) AND `public.users.is_underground_admin` (the COLUMN the gate RPC reads). `demote-admin.js:95-117` and `revoke-admin-tier.js:89-109` symmetrically clear BOTH. `grant-admin-to-existing.js` correctly does NOT set it (grants `regular` tier, which per Founder ruling carries no UG access). The column-authoritative gap the ruling warns about is closed on the tier-model paths.

4. **The Founder "never" holds: `approve-admin-promotion.js` is MANAGER-ONLY.** `assertAtLeast(auth, 'top_tier')` (line 27) rejects super_admin (rank 2 < top_tier rank 3), and `top_tier` is the maximum rank so nothing over-qualifies. There is no super_admin-claim shortcut. A super_admin genuinely cannot approve a promotion. Full TIER 1 stack on top (AAL2 sensitive_destructive + action-bound step-up).

5. **Escalated-cases 2-eyes is enforced at the BE, not just the DB.** `approve-escalated-proposal.js` gates Manager-only + self-approve block (`proposal.proposer_id === user.id`) + DB CHECK `ecp_no_self_approve` backstop; `propose-escalated-action.js` enforces `proposer_tier ∈ {super_admin, top_tier}`, category-required-for-escalate, reasoning 30-500 chars, a ≥2-Manager quorum floor, and a UG identity-leak tripwire on the reasoning text.

6. **IDOR defense is consistently strong.** Sensitive read/act endpoints re-derive participant IDs server-side and gate on queue membership rather than trusting client input: `expand-pastoral-context.js` requires the message to have a pastoral-axis `moderation_state` row (closes the "iterate arbitrary message_ids to read private DMs" vector); `triage-pastoral-action`, `escalate-flag`, and both `reach-out-*` re-read `sender_id`/`receiver_id` from the message row. Client-supplied tier is read ONLY to record which tier proposed — never as the authorization gate.

7. **Log hygiene is clean.** No `console.*` prints a service-role key, Resend key, Upstash token, JWT, password, or leader PII. No `process.env` interpolation into logs. Verbose DB errors are mapped to clean wire strings via conflict-map helpers on the tier/UG paths.

8. **The sensitive UG mutators are model implementations.** `hard-delete-underground-confirm.js` (UG gate + sensitive_destructive AAL2 + server-side typed church_code confirm + 2-eyes self-confirm block + RPC audit-first) and `confirm-underground-proposal.js` (same stack) are exactly the layered defense this system needs.

---

## Per-function coverage summary

**Fully-gated destructive/sensitive (gate stack complete for their tier):**
approve-admin-promotion, demote-admin, revoke-admin-tier, deny-admin-promotion, request-admin-promotion, grant-admin-to-existing, invite-admin, approve-church, reject-church, verify-leader, reject-leader, edit-pending, update-church-details, send-team-reply, expand-pastoral-context, read-heartcry, heartcry-inbox, triage-pastoral-action, escalate-flag, clear-flag, open-flagged-message, propose-escalated-action, approve-escalated-proposal, reject-escalated-proposal, close-escalated-case, reach-out-to-leader-from-case, reach-out-to-leader-from-message, propose-underground, confirm-underground-proposal, hard-delete-underground-confirm, counter-propose-underground, cancel-underground-proposal, initiate-restore-underground, confirm-restore-underground, request-info-underground, underground-claim, underground-release-claim, underground-request-release, underground-sibling-approve, underground-sibling-reject, underground-narrative-note, underground-evidence-create-intent, underground-evidence-confirm, underground-evidence-delete, underground-evidence-signed-url (P3 freshness note), underground-force-unmark-claim, underground-oversight, list-underground-churches (list surfaces — super_admin+AAL2; see note below), and the UG list/read helpers via `makeUndergroundGatedHandler`.

**Read-only / list surfaces (gated appropriately):** list-team-members, list-team-inbox, list-pastoral-queue, list-flagged-messages, list-escalated-cases, list-admin-tier-promotions, lookup-user-by-email, pending-leaders, list-*-underground (all via UG or AAL2 gate), read-region (**P0 — under-gated**).

**Concern list (findings above):** read-region (P0), deactivate-church / reinstate-church / rag-override (P1), approve-heartcry-feed (P1), update-account-name (P2), revoke-admin legacy (P2), mark-heartcry-responded (P2).

**Note on `underground-oversight.js` + `list-underground-churches.js`:** Both list surfaces gate on `super_admin + AAL2` via `makeAal2GatedHandler` but do NOT require `is_underground_admin`. They return underground church IDs/status/region (NAMES ARE WITHHELD — per-row reveal is via `read-region`). This is a lesser instance of the same KAN-288 gap: a super_admin lacking the UG flag can enumerate the existence/count/status of underground churches. Lower severity than P0-1 because no identity/contact leaks here — but for strict matrix conformance (`Underground Oversight = super_admin + manager + is_underground_admin`) these two list surfaces should ALSO carry the `is_underground_admin` gate. Folded into the P0-1 remediation theme (KAN-288 UG-gate sweep): add `isUndergroundAdmin(jwt)` to read-region (P0), underground-oversight, and list-underground-churches together.

**Non-admin-action (correctly ungated):** join-welcome, volunteer-welcome, scheduled-underground-evidence-exif-scrub, scheduled-underground-orphan-bytes, decline-underground-proposal (410), activate-account (live-app_metadata gate), church-intake (public intake).

**Meta/log endpoints (verifyAnyAdmin, appropriate):** log-session-refresh, log-aal2-elevation, log-admin-password-reset, request-step-up, validate-relay-token.
