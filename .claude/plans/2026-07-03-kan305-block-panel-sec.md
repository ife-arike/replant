# KAN-305 — Block User — SEC lane (2-role panel; DBA lane parallel)

**Date:** 2026-07-03 · **Lane:** SEC (semantics matrix + protections) · **Store driver:** Apple 1.2(c) verbatim "the ability to block abusive users from the service"; Play requires blocking for 1:1 interaction. Supersedes the post-MVP mute ruling.

**Verdict: APPROVE with one premise correction and one adjacent hole flagged.** The design below is buildable against the live surface as introspected 2026-07-03.

---

## 0. Premise correction + evidence base (read first)

**0.1 — `blocked_users` does NOT exist live.** Sweep of `pg_class` for `relname ILIKE '%block%'` across ALL schemas on `jiyetphxxvyiicrnwlnx` returned zero rows; `information_schema.columns` for `public.blocked_users` returned zero rows; no `%block%`/`%mute%` function exists in `public`. The panel brief's "exists live, UNWIRED" fact is stale. Design proceeds green-field; **DBA lane owns table shape** — this document specifies the semantic contract the shape must carry (pair binding, acquisition context, timestamps; §3.4).

**0.2 — Live enforcement geography (introspected + repo-verified):**
- DM writes: `send-message` edge fn (service-role) is the **sole client-reachable message write** — `authenticated` holds **SELECT only** on `public.messages` (INSERT revoked; the `messages_insert` RLS policy is vestigial). Accept-path seeding via `respond_to_connection_request` / `seed_accepted_request_message` (SECURITY DEFINER).
- DM reads: `DMThreadView.tsx` reads `public.messages` **directly under RLS** (`messages_select_own`: sender OR receiver), and `messages` + `connection_requests` are in the `supabase_realtime` publication — Realtime pushes are RLS-scoped. Unread badge = `get_leader_thread_list` + `get_branch_list` (`useConnectUnreadBadge.ts:72-73`).
- Consent layer: `send_connection_request` (30-day declined cooldown precedent at `20260609000003_connect_request_flow_v1.sql:146-155`), recipient RLS pending-only.
- Same-church bypass: `get_or_create_conversation_if_permitted` — same `church_id` opens a 1:1 without a request.
- Replant Team: `conversations.is_secure_replant_thread` flag; thread list renders 'Replant Team' and suppresses counterparty church (`connect_request_flow_v1.sql:433-443`).
- Directory: `search_leaders` (UG masking in-RPC: NULL name for safe-UG, macro-region label), `get_invite_candidates` (excludes UG churches and own church; returns `user_id`+`full_name` per leader).
- Branch invites: `create_branch(p_name, p_invited_user_ids uuid[])` takes **raw uuids** — candidate filtering alone is cosmetic; nonexistent/unverified invitees raise `unverified_invitee` (`20260529000003_kan214_connect_follow_ups_v1.sql`).
- Prayer wall: `get_prayer_wall` projection does **not** expose author `user_id`; anon/UG masking is in-RPC (`20260702024300_...sql`).

---

## 1. Scope matrix (v1 minimal-honest for the store; extensible)

Doctrine: **block the contact plane, hard, server-side, both directions; treat shared devotional surfaces as congregational space; protect the blocker from surveillance.** Console-opacity locked ruling applies: every cell below is a BE gate (edge fn or SECURITY DEFINER RPC or RLS); FE may additionally hide affordances but never carries enforcement.

| # | Surface | Semantics | Why |
|---|---------|-----------|-----|
| 1.1 | **DM send — blocked → blocker** | **Hard stop** in `send-message` (both branches: `conversation_id` path and lazy-create `recipient_user_id` path). Existing generic envelopes reused: 403 `FORBIDDEN` on conversation path, 400 recipient-unacceptable on recipient path. No row written, so nothing exists for Realtime/RLS to leak — silence by construction. | Apple 1.2(c) core. |
| 1.2 | **DM send — blocker → blocked** | **Also stopped (symmetric).** Recommended over asymmetric: (a) prevents block-then-taunt (blocker messaging someone who cannot reply is an abuse shape of its own); (b) one predicate ("pair contains a block in either direction") is simpler to prove complete than two directional ones; (c) blocker who wants to talk can unblock — the ceremony is theirs. | Defended §1 note below. |
| 1.3 | **Connection requests — both directions** | `send_connection_request` consults the pair and raises **`recipient_not_found`** — the exact exception class a deleted/nonexistent user produces (§2 ambiguity doctrine). Pending incoming request from the blocked user at block time: **auto-declined** (normal `declined` semantics; starts the existing 30-day cooldown; sender sees an ordinary decline — a decline is a normal, non-oracle event). Pending outgoing request FROM the blocker: auto-`withdrawn` (vanishes from recipient inbox exactly like any withdrawal under pending-only recipient RLS). Belt-and-suspenders: `respond_to_connection_request` re-checks the pair at accept time (block-vs-accept race). |
| 1.4 | **Existing thread — blocker side** | **Freeze-and-hide.** Conversation row is retained (never deleted): filtered out of `get_leader_thread_list` `conv_rows`, and pair messages suppressed from the blocker's reads at the RLS layer (covers `DMThreadView` refetch of cached `conversation_id`, Realtime, and keeps `fetchTotalUnread` consistent for free since the badge derives from the thread-list RPC). Retention is deliberate: **the thread is evidence** for the parallel report lane; deletion would destroy it. |
| 1.5 | **Existing thread — blocked side** | **Freeze-in-place, still visible.** Thread stays in their list; sends fail with the same generic envelope as sending to a deactivated counterparty. This makes the blocked party's total symptom set **identical to "the other leader left the platform"** (§2). Recommended over hide-both — a silently vanishing thread is a *new* observable state that exists only for blocks, i.e., an oracle. |
| 1.6 | **Same-church bypass** | `get_or_create_conversation_if_permitted` consults the pair → raises the existing `requires_connection_request`... **no** — that invites a request that will also fail confusingly; raise **`recipient_not_found`** (consistent story). Same-congregation harassment is the *most likely* real case; this path must not be forgotten. |
| 1.7 | **Branch invites** | Pair suppressed from `get_invite_candidates` output (both directions); **`create_branch` is the gate** — a blocked-pair uuid in `p_invited_user_ids` raises the existing **`unverified_invitee`** exception (identical to nonexistent/unverified users; no new error name, no oracle). `respond_to_branch_invite` re-checks (invite-then-block race). |
| 1.8 | **Directory (search / browse)** | `search_leaders` + `get_invite_candidates` suppress the pair **both directions**, but ONLY for identity-known blocks — see §3.3 for the masked-context exception (de-masking oracle). Blocker stops encountering the abuser; abuser finds the blocker "gone" = deactivation story. |
| 1.9 | **Comments directed at blocker content** | `post_comment` gate: blocked user cannot comment on blocker-authored prayer requests / testimonies. Directed-at-you content IS contact. Failure shape: same error class as commenting on a soft-deleted request (soft-delete exists — `soft_delete_prayer_request` — so "no longer available" is an established, non-oracle outcome). |
| 1.10 | **Blocker-authored feed content → hidden from blocked** | `get_prayer_wall`, `get_open_prayers`, `get_testimonies`, `get_comments`, `get_heartcry_feed` exclude rows authored by anyone who has blocked the caller. **Anti-surveillance:** the named threat is a leader *hounded by another* — the hound monitoring the victim's prayer content (emotional state, circumstances, movements) is exactly the exfil the block must close. No pastoral cost in this direction. Residual risk noted §3.5. |
| 1.11 | **Blocked user's content → blocker keeps seeing it** (prayers, testimonies, comments on third-party posts) | **Leave readable (recommended; Founder decision D1).** Store defense: Apple 1.2(c) requires "the ability to block abusive users" — the ability is the hard contact plane (1.1–1.9). Review-notes text: *"Blocking prevents all contact from the blocked user: direct messages, message requests, group invitations, and comments on the blocking user's content. Shared community prayer content remains visible by design — this is a prayer platform and members may continue to intercede for those they have blocked. Abusive content is handled by report + moderation."* Hiding an intercession request has real pastoral cost; the report lane (parallel ticket) owns content abuse. |
| 1.12 | **Branch (group) co-membership** | **Out of the v1 contact plane** (Founder decision D3). Shared branches are group space like the wall; blocking does not eject either party or suppress group messages at BE. The *invite* vector (1.7) is closed, so no NEW shared spaces can be forced. Optional post-MVP: FE-only courtesy collapse of blocked members' branch messages, explicitly labeled cosmetic (doctrine-compliant because it claims nothing). |
| 1.13 | **Replant Team secure threads** | **Carve-out everywhere:** every predicate above skips conversations with `is_secure_replant_thread = true`, and the block UI is never offered on them. Blocking must never sever the moderation/safety channel (heartcry replies). Deliberately NOT implemented as "cannot block staff users": refusing a block on a staff member's account would itself leak who is staff (an oracle). The block row may exist; the secure channel is surface-exempt. Admin dashboard surfaces are service-role and unaffected throughout. |

**Symmetry note (1.1/1.2):** the recommendation is **symmetric contact stop, asymmetric visibility** (blocker: hidden+quiet; blocked: frozen+normal-looking). This is the pairing that satisfies both "the victim stops seeing the abuser" and "the abuser learns nothing."

---

## 2. Silence guarantee — the ambiguity-class doctrine

**2.1 — Rejected: silent-drop (fake success).** Making blocked sends "appear to succeed" requires writing ghost message rows addressed to a non-consenting recipient (the sender's own thread refetch under `messages_select_own` would otherwise lose the message and reveal the lie). Ghost rows are toxic here: (a) the flag scan + `postCommitFlagEffects` would fire pastoral/admin alerts off messages the "recipient" can never see — moderation re-contact becomes a block bypass; (b) stored abuse content accumulates addressed to the victim; (c) it corrupts the honesty of "delivered." **DELIVER-ALWAYS is not in tension:** D-45 clause 3 governs the *scan* never gating delivery of an authorized send (`send-message/handler.ts:185-191`); the consent layer already hard-rejects unauthorized sends before the scan (unverified sender 403, non-participant 403). A block is a consent gate, upstream of DELIVER-ALWAYS's jurisdiction.

**2.2 — Adopted: honest generic failure inside an existing ambiguity class.** The blocked party's every symptom must be **indistinguishable from "that leader deactivated / left the platform"** — a symptom set that already exists (deactivated users: sends fail via `isRecipientAcceptable` / `is_active` checks; absent from `search_leaders`; requests raise `recipient_not_found`). Rules:
- **No new error codes, no new strings, anywhere.** Reuse byte-identical existing envelopes/exceptions: 403 `FORBIDDEN`, `recipient_not_found`, `unverified_invitee`, soft-deleted-content class.
- **No timing oracles:** the pair check must run in the same position/shape as the existing recipient-validity checks it shadows (DBA: same query, one more predicate — not a separate early-exit).
- The blocked side keeps thread history (1.5) because *vanishing history* is not in the deactivation symptom set today (`get_leader_thread_list` conv_rows does not filter on counterparty `is_active` — verified in the RPC body).
- Determined-adversary honesty: a harasser with a second account can eventually infer a block (their content still visible to the second account, etc.). Full epistemic silence is not achievable on any platform with shared surfaces; the guarantee we make is **no cheap, single-account, deterministic oracle**. The store requires blocking, not unfalsifiability.

**2.3 — Realtime/pipeline silence by construction.** Because blocked contact never produces a row (no message INSERT, no request INSERT), there is nothing for the `supabase_realtime` publication, unread badge, or push/email pipelines to deliver. Suppression-by-absence beats filtering-after-the-fact at every layer.

---

## 3. UG / anonymity interactions

**3.1 — Bind to the real `public.users.id`, acquired server-side only.** Block placement is by **content handle, never by client-supplied author id**: `block_user_from_conversation(p_conversation_id)`, `..._from_request(p_request_id)`, `..._from_prayer(p_prayer_request_id)`, `..._from_comment(p_comment_id)`, and plain `block_user(p_user_id)` only from identity-known surfaces (search result, named thread). The RPC resolves author → inserts pair → **returns void**. There must never exist an RPC that maps content-handle → author id to the client (that would be a de-masking primitive; note `get_prayer_wall` deliberately omits author `user_id` today — block RPCs must not undo that).

**3.2 — Blocked-list rendering shows the mask, not the person.** The block row stores `acquired_via` (context enum) + the display facts lawful at acquisition. List rendering reuses the exact thread-list/search masking pipeline: anon → "A fellow [Role]"; UG → role + 'Underground Church' / macro-region per `search_leaders` CASE logic; never `full_name` for a masked acquisition. A blocker who blocked "A fellow Pastor" sees "A fellow Pastor" in their list, forever (even if they later encounter the same person named — the list renders acquisition context, not a live join).

**3.3 — The differential-visibility de-masking oracle (key finding).** If blocking a *masked* handle (anon prayer card, anon DM, UG-masked identity) also removed that person from **named directory surfaces** (`search_leaders`, `get_invite_candidates`, invite pickers), the blocker could diff directory-before vs directory-after and **resolve the mask to a named leader**. Therefore: **suppression scope is keyed to acquisition context.**
- *Identity-known block* (named thread, named request, search profile): full matrix incl. directory suppression (1.8).
- *Masked-context block*: contact plane + thread freeze/hide + feed rules apply; **directory surfaces are NOT touched.** The blocker may still see the (unlinkable) named person in search — acceptable, because the blocker cannot connect the two, and contact from either identity surface is still hard-stopped at the pair level (enforcement binds the real id regardless).

**3.4 — Contract for DBA shape (consequence of 3.1–3.3):** pair (blocker_id, blocked_id) unique; `acquired_via` context; `created_at`; masked-display snapshot fields (or enough to re-derive the mask without a live identity join); no client-readable column may carry the raw identity of a masked-acquisition target beyond the FK itself — the blocked-list read RPC projects the mask, never the row.

**3.5 — No escalation side-effects; residual correlation noted.** Reports auto-route (UG auto-route triggers, `20260701000003_...sql`); **blocks must not**: no trigger on the block table may write `escalated_cases`, `underground_admin_inbox_events`, or any admin inbox — audit_log only (§6). Confirmed requirement, matching the brief. Residual risk (accepted): under 1.10, a harasser who already *suspects* a set of anon posts belongs to their victim gains confirmation when the set vanishes. Weighed against live surveillance of a victim's prayer content, protection wins; the leak requires a pre-existing suspicion to exploit and reveals only "someone who blocked me authored these," not a name.

---

## 4. Abuse asymmetries

**4.1 — Block-then-harass (posting ABOUT the blocked party in shared surfaces).** Out of scope for the block mechanism (it is content abuse, not contact) — **flagged to the report/moderation lane**: report surfaces must accept reports against authors the reporter has blocked (do not let the block hide the harasser's content from the *report* picker; the blocker under 1.11 still sees it, so v1 is coherent). One-line ruling requested from Founder only if 1.11 flips to hide (D1).

**4.2 — Blocking to evade moderation.** Closed by 1.13: Replant Team secure threads (`is_secure_replant_thread`) are surface-exempt from every block predicate; admin dashboard reads/writes are service-role. Leaders cannot block their way out of moderation contact, and there is no "cannot block staff" refusal oracle.

**4.3 — Churn/rate caps.** Block-table ops rate-capped (recommend 30 block ops per rolling 24h — generous for legitimate use, kills scripted probe loops that could refine §2's residual inferences or spam audit) and a per-user list cap (recommend 500 active) to bound the RLS/RPC predicate cost DBA must pay on every hot read path. Re-blocking a just-unblocked pair is always allowed (never make a frightened leader wait); the daily cap is the only brake. Parameters are recommendations, not Founder decisions.

**4.4 — Adjacent hole (must close with this work): client INSERT on `conversations`.** Live grants give `authenticated` INSERT/UPDATE/DELETE on `public.conversations` and `conversations_insert_own` WITH CHECK only requires the caller to be a participant. A client can therefore mint a conversation row with any counterparty, no consent — and `send-message`'s `conversation_id` branch treats participation as authorization. Today that is a consent-layer bypass; after KAN-305 it would be a block bypass **unless** the send-path pair check (1.1) is pair-based, which it is — but the hole should still be closed (revoke INSERT or add pair+consent trigger) so conversation existence regains meaning. Flagged for DBA lane inclusion; do not ship blocks while leaving this open.

---

## 5. Unblock

- **Ceremony:** Settings → Blocked list → unblock, single confirm. Simple; no MFA step-up beyond the session's normal tier (blocking/unblocking is self-scoped, not privilege-scoped).
- **Restores:** contact plane reopens; thread reappears in the blocker's list with full history (rows were frozen, never deleted — 1.4); directory suppression lifts. Normal consent rules resume (no conversation → connection request required as usual; existing thread → send works).
- **No signal to the formerly-blocked:** their sends simply start succeeding; nothing announces anything (their side never displayed a block state to begin with — §2).
- **No cooldown** on unblock or re-block (4.3 rationale). Auto-declined requests from 1.3 stay declined — unblock does not resurrect consent; the existing 30-day decline cooldown continues to govern re-requests (normal semantics, no special case).

---

## 6. Audit + admin visibility

- **Audit:** `user_blocked` / `user_unblocked` added to the `audit_log` action CHECK (append-only table; extend via the established `audit_action_additions` migration pattern, e.g., `20260623_0005`, `20260701000004`). Row carries actor + target ids + `acquired_via`; **never** content, never the mask-resolution. Verification by `pg_get_constraintdef`, not probing (locked rule).
- **Admin visibility:** surface **aggregate only** — "blocked by N leaders" as a moderation signal on the admin leader profile and joined into the report lane's aggregation (one-leader-blocked-by-many is exactly the pattern the report lane wants). **No browsable who-blocked-whom pair list** in the dashboard (Founder decision D4): pair-level browsing enables admin-side correlation of masked identities (an admin seeing "UG leader X blocked leader Y" links surfaces §3.3 keeps apart) and imports pastoral politics; break-glass pair inspection remains possible via OPS-03 with audit, which is the right friction.

---

## 7. Enforcement completeness list (SEC owns the list; DBA owns the mechanism)

Every path that must consult the block pair (or is explicitly exempt). "Pair check" = block exists in either direction, skipping `is_secure_replant_thread` conversations.

**Contact/write gates:**
1. `send-message` edge fn — **both branches**: `conversation_id` path (pair check on resolved counterparty; skip when `is_secure_replant_thread`) and `recipient_user_id` lazy-create path (pair check beside `isRecipientAcceptable`).
2. `send_connection_request` — pair check → `recipient_not_found`.
3. `respond_to_connection_request` — accept path re-check (block-vs-accept race; auto-decline at block time is primary, this is the belt).
4. `seed_accepted_request_message` — inherits 3's guarantee; re-check pair before seeding (it is a separate SECURITY DEFINER entry point).
5. `get_or_create_conversation_if_permitted` — same-church bypass; pair check → `recipient_not_found`.
6. `create_branch` — invitee loop pair check → existing `unverified_invitee`.
7. `respond_to_branch_invite` — pair re-check on accept (invite-then-block race).
8. `post_comment` — pair check against the parent content author (1.9) → soft-deleted-content error class.
9. Direct client `conversations` INSERT — close the grant/policy hole (4.4).
10. `send-branch-message` edge fn — **reviewed, intentionally NOT pair-gated** (1.12, group space); record the exemption in code comment so it reads as decided, not missed.

**Read/visibility gates:**
11. `get_leader_thread_list` — filter pair from `conv_rows` (blocker side only) AND `req_rows`; secure-thread exempt; this alone keeps `fetchTotalUnread` badge consistent.
12. `messages` RLS SELECT — suppress pair rows from the **blocker's** reads (covers `DMThreadView` cached-id refetch + Realtime + any future direct read). Blocked side unchanged (1.5).
13. `search_leaders` — pair suppression, both directions, **identity-known blocks only** (3.3).
14. `get_invite_candidates` — same rule as 13 (filter inside the `leaders` jsonb_agg, and drop empty ministries via the existing HAVING).
15. Feed RPCs — `get_prayer_wall`, `get_open_prayers`, `get_testimonies`, `get_comments`, `get_heartcry_feed`: exclude blocker-authored rows from the blocked caller's results (1.10). `get_landing_testimonies` (unauthenticated landing) — no caller, no filter; reviewed-exempt.
16. New surface: block/unblock RPCs (content-handle family, 3.1) + blocked-list read RPC (masked projection, 3.2) — these are themselves BE gates and must enforce caps (4.3) and audit (§6).
17. `mark_conversation_read` — reviewed, no gate needed (self-scoped timestamps; harmless on hidden threads).
18. Admin/dashboard surfaces + heartcry pipeline (`submit-heartcry`, `admin-open-heartcry`) — reviewed-exempt (service-role moderation channel; 1.13).

Anything added later that (a) writes contact toward a user, (b) lists users, or (c) lists user-authored content must state its pair-check position at panel time — completeness is a property to be maintained, not achieved once.

---

## 8. Open Founder decisions (5, with recommendations)

- **D1 — Blocker's view of the blocked user's devotional content (matrix 1.11):** leave readable (contact-plane doctrine) vs hide-from-blocker. **Recommend: leave readable**, ship the review-notes defense text in 1.11; report lane owns content abuse. If Apple review pushes back, the hide is a pure additive predicate on the §7.15 RPCs — no schema change.
- **D2 — Blocked-side thread rendering (matrix 1.5):** freeze-in-place visible (deactivation ambiguity class) vs hide-both. **Recommend: freeze-in-place** — hide-both creates a block-only observable state (§2.2).
- **D3 — Branch group surfaces at v1 (matrix 1.12):** no group suppression (invites closed only) vs BE-gated suppression of blocked members' branch messages. **Recommend: no suppression at v1**; post-MVP FE cosmetic collapse candidate.
- **D4 — Admin visibility shape (§6):** aggregate block-count signal only vs browsable pair list. **Recommend: aggregate only**, pair inspection via OPS-03 break-glass.
- **D5 — Pending incoming request at block time (matrix 1.3):** auto-decline (starts normal 30-day cooldown; sender sees ordinary decline) vs leave-to-expire (sits 30 days, then ordinary expiry). **Recommend: auto-decline** — it clears the blocker's inbox instantly and both outcomes are normal-looking; leave-to-expire keeps the request rotting in the blocker's UI or requires a third hidden state.

---

*SEC lane, KAN-305. Evidence: live introspection of `jiyetphxxvyiicrnwlnx` (pg_class/pg_policy/pg_proc/grants/publication, SELECT-only) + repo at `/Users/ife/replant` (send-message edge fn, connect flow migrations, feed RPC migrations, DMThreadView/useConnectUnreadBadge). Zero writes performed. No time estimates per standing rule.*
