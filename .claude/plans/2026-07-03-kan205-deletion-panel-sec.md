# KAN-205 — In-app account deletion — SEC lane design (2026-07-03)

SEC lane of the 2-role mini-panel (CONTENT runs parallel). Repo read-only; live DB verified SELECT-only against `jiyetphxxvyiicrnwlnx`. All RPC/column/cron/grant facts below were verified live, not assumed.

**Scope anchor:** KAN-205 re-scoped 2026-07-03 to FULL deletion (Apple 5.1.1(v): deactivation-only insufficient; confirmation steps allowed). Same in-app flow satisfies Play's in-app leg; web request page is KAN-303.

---

## 0. Verified machinery (evidence)

| Fact | Evidence |
|---|---|
| `fn_soft_delete_my_account(p_reason)` — leader-only path, `p_reason` must be `'leader_initiated'`; sets `soft_deleted_at=now()`, `hard_delete_scheduled_at=now()+30d`, `is_active=false`, `deactivated_at=now()`; mirrors soft-delete onto the church when caller is the last active leader | `supabase/migrations/20260623_0006_soft_delete_rpcs.sql:80-147`; live: confirmed in `pg_proc` |
| `fn_restore_my_account()` — self-restore iff `soft_delete_reason='leader_initiated'`, not hard-deleted, and `soft_deleted_at + 30d >= now()`; restores church mirror only when church reason is also `leader_initiated` | `20260623_0006:156-225` |
| Day-30 sweeper `fn_hard_delete_expired_soft_deletes()` — tombstones name fields to `[redacted]`, nulls phone/honorific/suffix, rewrites email to `deleted+<uuid>@projectreplant.org` (frees UNIQUE slot), sets `hard_deleted_at`, then **DELETEs the `auth.users` row**; cascades church `hard_deleted_at` when last leader gone. No GRANT to authenticated — system-only | `20260623_0007:29-120`; cron `underground_hard_delete_sweeper_daily` `0 3 * * *` **active=true live** |
| `fn_initiate_restore_underground(p_church_id)` — **ADMIN-side, not a leader path** (see §2.3) | `20260623_0008:467-489` |
| RLS: soft-deleted leaders READ but cannot WRITE (`users_update_own` requires `is_active AND soft_deleted_at IS NULL`; write policies on prayer_requests/heartcries/messages/comments/connection_requests all gate) | `20260623_0003`; live `pg_policy` confirms `users_select_own` = `auth.uid()=auth_id` (no active gate — gated shell reads work) |
| Client CANNOT directly write `soft_deleted_at` / `hard_delete_scheduled_at` / `hard_deleted_at` / `is_active` — no column-level UPDATE grant to authenticated (live `information_schema.column_privileges`). Guard trigger additionally blocks privilege columns | `20260702031920_guard_users_privilege_columns_trigger.sql` |
| Settings entry today = ComingSoonModal ("Account deactivation is on the way.") | `src/screens/main/SettingsScreen.tsx:783-788`, button at `:1258-1265` |
| No FE caller of either RPC exists yet (grep: zero hits in `src/` + `supabase/functions/`) | verified |
| No MFA on mobile (JoinCodeReveal shows a coming-soon placeholder only); no push infra (no expo-notifications dep, no token registration) — **push-nothing confirmed** | `src/screens/main/JoinCodeRevealScreen.tsx:361-366`; `package.json` |

---

## 1. Re-auth gate

**What the RPC enforces today:** a valid, signature-checked JWT resolving to an active, non-soft-deleted `public.users` row (`20260623_0006:98-106`). Nothing else — no password re-entry, no session freshness, no MFA (none exists on mobile).

**Posture (proportionate to destructive-but-restorable):**

1. **FE must add password re-entry at the moment of deletion.** Ceremony: explain screen → password field → `signInWithPassword(session email, typed password)` as the knowledge-factor check → on success, call `fn_soft_delete_my_account('leader_initiated')`. This defeats the unattended-unlocked-device attacker (the realistic threat; a 168h rolling refresh token means "signed in" can be weeks stale — KAN-41 anchor cited at `auth-status-check/handler.ts:97-99`).
2. **Server-side hardening (conditional):** GoTrue access tokens can carry an `amr` claim (method + timestamp). If verified present on this project's password logins, harden the RPC to require a password `amr` timestamp within **5 minutes** — the Sensitive tier of the locked 4-tier MFA-freshness ruling, applied consistently. If the claim is absent, accept the FE-only gate: the residual (raw-token attacker calls PostgREST RPC directly) is bounded by full 30-day restorability plus §4's global revoke.
3. Do NOT block on MFA — building mobile MFA is out of scope and Apple requires the flow now.

---

## 2. Restore path, precisely

**2.1 Can a soft-deleted leader still sign in? YES.** Soft-delete touches only `public.users`; the `auth.users` row survives until the Day-30 sweep (`20260623_0007:88-90` is the only auth-row delete). Password sign-in and token refresh keep working for all 30 days. `users_select_own` lets the FE read `soft_deleted_at` + `hard_delete_scheduled_at` to render exact days-remaining.

**2.2 THE BLOCKER — the app cannot currently SEE a self-deleted user.** `auth-status-check` derives `branch_substate='soft_deleted'` from the **CHURCH's** `soft_deleted_at`, never the user's (`supabase/functions/auth-status-check/logic.ts:365-371`); `fetchUserStatus` doesn't even SELECT the user's soft-delete columns (`index.ts:73-79`); the user-level `is_active` check is super_admin-only (`handler.ts:96-107`). Consequences, verified against the resolver:

- **Second leader on a 2-leader church self-deletes** → church stays live → resolver returns `active` (user `verification_status` is untouched by soft-delete) → leader sees a fully "active" app in which every write fails on RLS. No restore prompt exists anywhere.
- **Pending leader self-deletes, church deadline later lapses** → `pending_past_deadline_needs_write` fires `deactivateAtomically` (`index.ts:117-124`), clobbering the surface with `verification_status='deactivated'` + a fresh `deactivated_at` over the self-deletion state.
- **Skip-flow leader** (church_id NULL) is explicitly excluded from substates (`logic.ts:358-360`).

**Required BE change (same build slice):** `fetchUserStatus` selects the user's `soft_deleted_at`/`soft_delete_reason`/`hard_delete_scheduled_at`; resolver checks USER soft-delete FIRST → new substate **`self_deleted`** when reason=`leader_initiated` (existing `soft_deleted` stays = rejection ceremony); `deactivateAtomically` must be skipped for soft-deleted users.

**2.3 The UG variant, honestly:** `fn_initiate_restore_underground` is **not a leader restore path**. It is gated by `fn_assert_underground_admin` (`20260623_0008:476`) and only stamps an `underground_restore_initiated` audit row with `admin_initiated: true`; the actual restore ships via `fn_propose_underground_action('restore')` + second-admin `fn_confirm_underground_proposal` (`:327-345`). WHY: it exists for **admin-initiated** deactivations (rejections), where `fn_restore_my_account` correctly refuses (`'admin-initiated deactivation; contact team to restore'`, `20260623_0006:189-191`) — reactivating a rejected/possibly-burned underground church is a safety-sensitive act, so it inherits the two-eyes ceremony (admin restore also resets church `verification_status='pending'`, forcing re-verification). A UG leader who **self**-deleted restores via the same `fn_restore_my_account` as everyone else — and the round trip preserves the church's verified status (neither RPC touches `verification_status` on the leader-initiated path). That reassurance belongs in the copy.

**2.4 Sign-in-after-delete ceremony (design):** sign-in succeeds → auth-status-check returns `self_deleted` → RootNavigator mounts a dedicated **RestoreScreen** (new branch), NOT the tabs and NOT the rejection read-only shell (a leader who chose to leave should not wake up inside a read-only app): deleted-on date, permanent-on date, two actions — **Restore my account** (`fn_restore_my_account` → `refresh()` → active) and **Keep it deleted** (sign out). Restore prompt appears **only after successful password auth** — nothing pre-auth discloses that a deletable account exists.

---

## 3. Coercion/duress posture (persecuted-context)

The 30-day window is the duress mitigation: a coerced deletion is fully reversible once the leader is safe, and Day-30 completion requires nothing (silence is safe). The trade: the confirm screen that says "you can restore within 30 days" also tells a coercer reading the screen that the account — and its data — survives 30 more days.

**Recommended posture: disclose plainly, one register, everywhere (Founder decision #1).** Reasoning: (a) the coercer's real asset is the live unlocked session in his hand, not the tombstone — restorability knowledge adds little marginal harm; (b) restore requires full credentials and surfaces only post-auth (§2.4), so a coercer without the password learns nothing at sign-in; (c) under-disclosing a 30-day retention window is itself a legal/store-review defect; (d) the worst coercion play (force a restore to harvest contacts) already requires the password — the same key that unlocks everything else. Offer the Founder a terser UG-variant confirm screen as the alternative, but SEC recommends one honest register: quiet, factual, no countdown streamers.

Structural duress mitigations regardless of ruling: no pre-auth existence signal; generic auth errors unchanged; no deletion-confirmation email in v1 to a possibly-monitored inbox for UG accounts (email behavior is a CONTENT/legal surface — flag, don't build silently).

---

## 4. Session/device teardown

**Verified:** the RPC revokes NOTHING — no auth schema writes (`20260623_0006:80-147`). Refresh tokens survive soft-delete; sessions die only at Day-30 auth-row deletion ("sessions die naturally on next refresh cycle," `20260623_0007:86-87`).

1. **This device:** after RPC success → existing `signOutAndClear()` (`src/utils/signOutAndClear.ts:28-41`, with its offline-retry flag) + `performClearAndRoute()` (`src/contexts/AuthProvider.tsx:192-215`) — wipes the encrypted session blob both halves (AsyncStorage ciphertext + SecureStore AES key, `src/lib/secure-storage.ts:108-111`).
2. **Other devices (Founder decision #2):** `supabase.auth.signOut()` scope defaults to **global** in supabase-js v2 — recommend relying on that deliberately (document it): all refresh tokens revoked; other devices die at access-token expiry, or sooner via the AppState-foreground auth-status-check / cross-endpoint 401 interceptor (`src/lib/supabase.ts:48-66`). The locked 2026-06-22 "existing sessions stay live" ruling covered admin-initiated rejection (leader shouldn't be booted by someone else's act); self-deletion is the owner's own act — global teardown is the safer sister action, and it protects the leader whose OTHER device was seized.
3. **Local residue beyond the session:** `signOut` does NOT clear `covenant_ack` (`src/screens/main/ConnectScreen.tsx:112`), `notif_message_badge` (`src/lib/connect-prefs.ts:24`), or tutorial-seen flags. Add a `wipeLocalAccountState()` util enumerating these SecureStore keys, called only on the deletion path (not ordinary sign-out). Re-showing the covenant on a future restore is correct behavior anyway.
4. **Push:** nothing to tear down — confirmed no push infrastructure exists.

---

## 5. Edge states

1. **Pending leader:** RPC permits (gates on `is_active`, not verification_status) — correct; Apple requires deletion for any account. Needs the §2.2 resolver fix or their surface mis-renders/clobbers.
2. **Second leader (cap-of-2):** slot frees at soft-delete instantly — `countActiveLeaders` counts `is_active=true` (`supabase/functions/join-underground-church/index.ts:230-238`). A replacement can join inside the 30-day window; restore can then transiently exceed the cap (no cap check in `fn_restore_my_account`). Recommend: allow-over-cap transient, surface in the UG/admin queue rather than blocking a lawful restore (decision #4).
3. **Sole FOUNDING leader of a verified church:** church mirror soft-deletes immediately and hard-deletes Day-30 (`20260623_0006:129-145`, `0007:94-110`). **Disclosure list (CONTENT wordsmiths; SEC defines WHAT):** (a) the church profile leaves the network immediately with you; (b) it is permanently removed after 30 days; (c) restoring within 30 days brings both back with verified status intact; (d) UG: the church's join code dies with it; (e) a pending second leader does NOT keep the church alive-in-standing but DOES block the mirror (they count as active) — copy must not promise church deletion when a pending co-leader exists.
4. **Open escalated case / in-flight UG proposal:** nothing blocks or is blocked — `escalated_cases` FKs are plain `REFERENCES public.users(id)` (`20260701000001:15-26`), preserved by the tombstone-not-delete invariant; the case stays actionable, Reach-Out DMs land unread (leader can't write back — RLS). One adjacent guard worth adding: `fn_confirm_underground_proposal('verify')` will verify a church that soft-deleted mid-proposal (`20260623_0008:267-272` has no `soft_deleted_at IS NULL` guard) — one-line WHERE fix.
5. **Admin-initiated deactivation colliding with self-deletion:** admin-first → self-delete RPC correctly errors (`no active user found`). Self-first → admin reject's mirror skips already-soft-deleted users (`WHERE soft_deleted_at IS NULL`, `20260623_0008:299-301`), so the reason stays `leader_initiated`; leader can self-restore into a rejected church and lands on the support_contact surface (coherent). **Race:** admin expedited `hard_delete` only advances `hard_delete_scheduled_at` (`:318-326`); `fn_restore_my_account` checks `soft_deleted_at+30d`, not the schedule — a leader_initiated leader can un-schedule an admin's expedited hard-delete before the 03:00 sweep. Fix: restore RPC also refuses (or admin action also sets reason) when an expedited schedule is earlier than the natural window. Low frequency, worth the one-line hardening.

---

## 6. Abuse

1. **Delete/restore cycling:** no rate shape on either RPC (verified — no counters, no Upstash on PostgREST RPCs; Upstash covers edge functions like search/reveal only). Each last-leader cycle also flaps the church's network visibility. Recommend a minimal server-side shape inside the RPCs: e.g. 3 delete/restore cycles per 30 days, then `support_contact` (decision #5). Not a launch blocker; the loop is self-limiting and fully audited once §7 lands.
2. **Deletion as harassment-evasion:** an open flag/escalated case **survives** — flagged message content persists de-attributed (sweeper touches only `users`/`churches` rows), the `escalated_cases` row persists, tombstone preserves FKs. What's lost is the ability to sanction the account (it self-erased) — consistent with there being no suspension lifecycle at MVP (separate locked ticket). Posture: acceptable; admins retain the 30-day window to act (UG expedited hard_delete exists; a future "moderation hold" that pauses self-restore is post-MVP and would need its own SEC panel).

---

## 7. Audit

**Today (verified):** UG-only. `underground_deactivated` (self-delete, `20260623_0006:113-117`), `underground_restore_initiated` w/ `self_initiated:true` (`:198-202`), `underground_hard_delete_executed` w/ sha256 email hash (`0007:57-70`). **A standard-church or skip-flow leader's self-deletion, restore, and hard-deletion write NO audit row anywhere.** The main `audit_log` CHECK (extended `20260701000004`) has no fitting action.

**Design:** extend `audit_log` action CHECK with `account_soft_deleted`, `account_restored`, `account_hard_deleted`; the two leader RPCs + sweeper write them for non-UG accounts (UG keeps routing to `audit_log_underground` unchanged — don't leak UG events into the broader log). Keep audit-before-content ordering. Meta: reason, self_initiated, scrubbed-email hash on hard delete — mirroring the UG shape. Never write audit from the client (append-only invariant).

Hygiene nit found in passing: `soft_delete_reason` has a column-level UPDATE grant to authenticated (live check) — inert (RLS blocks writes once soft-deleted; RPCs overwrite it), but revoke for symmetry with its sibling columns.

---

## 8. Build slice (ordered)

1. BE: auth-status-check user-level `self_deleted` substate + skip `deactivateAtomically` for soft-deleted rows (§2.2) — **the blocker**.
2. BE: non-UG audit actions in both RPCs + sweeper (§7); `soft_delete_reason` grant revoke; confirm-verify soft-deleted guard; restore-vs-expedited-hard-delete guard (§5.4/5.5).
3. BE: `fn_my_deletion_preview()` (SECURITY DEFINER, self-scoped) returning `{ is_last_active_leader, church_type, church_verification_status, pending_co_leader }` — the FE cannot read co-leader counts under current RLS and the confirm screen must know whether to fire the church-cascade warning.
4. FE: Settings row → deletion ceremony (explain w/ preview-driven disclosures → password re-entry → RPC → global signOut → `wipeLocalAccountState()`).
5. FE: `self_deleted` branch + RestoreScreen ceremony (§2.4).
6. Optional hardening: AMR freshness in RPC (§1.2); cycle rate shape (§6.1).

---

## 9. Open Founder decisions (≤5, with recommendations)

1. **Restorability disclosure loudness** — RECOMMEND: plain, factual disclosure of the 30-day window in the confirm flow and post-auth restore screen, one register for standard and UG (no pre-auth signals anywhere). Alternative: terser UG confirm variant.
2. **Other-device sign-out on self-deletion** — RECOMMEND: yes, global refresh-token revoke (deliberate deviation from the admin-rejection "sessions stay live" ruling; different actor, different intent).
3. **Re-auth depth** — RECOMMEND: FE password re-entry now; add server-side AMR 5-min freshness iff the claim is verified present on this project's tokens.
4. **Restore over cap-of-2** — RECOMMEND: allow transient over-cap on restore, surface in admin queue; never block a lawful restore.
5. **Delete/restore cycle rate shape** — RECOMMEND: minimal server-side counter (3 cycles/30d → support_contact), shipped with the RPC audit pass.

---

## Genuine verdict

**Build-ready shape with ONE true blocker.** The DB machinery is real, live, and better-hardened than the ticket assumed (column-grant lockdown verified; tombstone invariants sound; cron active). But no FE flow can ship correctly until auth-status-check learns to see USER-level soft-deletion — today a self-deleted leader who isn't the last leader on their church signs into an app that looks active and silently fails every write, and there is no restore surface at all. That resolver change, the non-UG audit gap, and the deletion-preview RPC are the same build slice as the UI. Re-auth is an FE ceremony plus optional RPC hardening — no MFA dependency. The UG restore variant needs no new machinery: self-deleted UG leaders use the standard self-restore; `fn_initiate_restore_underground` remains the admin two-eyes lane for rejections, as designed.
