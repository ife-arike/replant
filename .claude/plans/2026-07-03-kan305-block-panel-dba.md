# KAN-305 — Block User: DBA lane (enforcement layer) — 2026-07-07

DBA lane of the 2-role panel (SEC parallel). Live introspection on `jiyetphxxvyiicrnwlnx`, SELECT/pg_catalog only, zero writes. All DDL below is FILE-only illustrative sketch — nothing applied.

**Verdict: APPROVE the mechanism below — with one premise correction. `blocked_users` did NOT ship unwired; it does not exist at all. This is a green-field migration, not a wiring job.**

---

## 1. Live introspection findings

1.1 **`blocked_users` does not exist.** Catalog sweep across ALL schemas for `relname ilike '%block%'` (pg_class, relkind r/v/m/p): zero rows. `pg_proc` sweep for `%block%`: zero rows. No repo migration references it (`grep -r blocked_users supabase/`: no hits). Row count: N/A. Nothing to migrate, nothing to salvage — build fresh.

1.2 **Messaging write surface (live grants + policies):**
- `public.messages` — anon/authenticated grants: **SELECT only** (writes revoked). Policies: `messages_insert` (WITH CHECK sender=self AND is_active AND soft_deleted_at IS NULL — dead letter for clients since no INSERT grant) and `messages_select_own` (sender OR receiver). All message writes flow through service-role writers that **bypass RLS**: `send-message` (postgres-js over `SUPABASE_DB_URL`), `send-branch-message`, `seed_accepted_request_message` (SECURITY DEFINER), `send-message/internal` (system welcome DM).
- `public.conversations` — authenticated holds **full INSERT/UPDATE/DELETE grants** with participant-self policies (`conversations_insert_own` etc.). See adjacent finding 11.1.
- `public.connection_requests` — SELECT-only grants; writes only via `send_connection_request` / `respond_to_connection_request` SECURITY DEFINER RPCs. (An INSERT policy exists but is dead letter — no INSERT grant.)

1.3 **Realtime publication (live):** `supabase_realtime` carries `messages`, `connection_requests`, `branches`, `branch_members`, `admin_tier_promotions`, `underground_*`. FE subscriptions are all `postgres_changes` (WALRUS — **RLS applies per subscriber**): `DMThreadView.tsx:633` (messages INSERT, `conversation_id=eq.` filter), `useConnectUnreadBadge.ts:159` (messages INSERT unfiltered + branches/branch_members), `LeadersList.tsx:761` (messages INSERT + connection_requests `*`). Thread history is read directly via `.from('messages')` under `messages_select_own` (`DMThreadView.tsx:586,688`).

1.4 **Day-30 sweeper (live, cron job 5, daily 03:00):** `fn_hard_delete_expired_soft_deletes()` **UPDATE-scrubs `public.users` in place** (names → `[redacted]`, email → tombstone, `hard_deleted_at=now()`) and DELETEs only `auth.users`. **The `public.users` row is never deleted — FK `ON DELETE CASCADE` will never fire.** Cleanup must be explicit (§9).

1.5 **RPC inventory pulled live** (all SECURITY DEFINER, `search_path` pinned): `send_connection_request`, `respond_to_connection_request`, `seed_accepted_request_message`, `get_or_create_conversation_if_permitted`, `get_leader_thread_list`, `search_leaders`, `get_invite_candidates`, `get_branch_messages`, `mark_conversation_read`. None consults any block state (none exists).

---

## 2. Enforcement mechanism — recommendation

2.1 **Core helper**: `public.fn_is_blocked(p_a uuid, p_b uuid) RETURNS boolean` — `LANGUAGE sql, STABLE, SECURITY DEFINER, SET search_path TO ''`. **Symmetric** (per SEC lane): true if a row exists in either direction. EXECUTE **revoked from anon/authenticated/public**, granted to `service_role` only — prevents arbitrary-pair probing; SECURITY DEFINER RPCs and the postgres-role edge-fn connections call it regardless.

2.2 **Three-layer posture** (console-opacity doctrine — BE gates load-bearing):
1. **DB backstop (holds against everything, incl. service role): BEFORE INSERT trigger on `public.messages`** — when `NEW.receiver_id IS NOT NULL AND fn_is_blocked(sender_id, receiver_id)` → raise `blocked_pair`. This is the layer a modified client can never strip: it gates `send-message` (both paths), `send-message/internal`, `seed_accepted_request_message`, and any future writer. Branch messages (`receiver_id IS NULL`) pass untouched (Decision 12.1).
2. **In-function checks** in the SECURITY DEFINER RPCs (consent + discovery surfaces) — clean error codes, no 500s.
3. **Explicit edge-fn check** in `send-message` before the transaction — clean 403 instead of a trigger-shaped 500; trigger remains the guarantee.

2.3 **Why not an RLS policy predicate on `messages`?** (a) The hot write path bypasses RLS (service role / postgres-js), so a policy would be decorative exactly where it matters most — the trigger is the honest equivalent that binds all writers. (b) Adding `fn_is_blocked` to `messages_select_own` would execute per row on every paginated history fetch and every WALRUS broadcast check for zero gain: blocked rows can never be inserted, and pre-block history stays visible by design (Decision 12.2). RLS predicates ARE right for nothing here; in-function checks are right for the RPC surfaces (each already resolves caller identity once — one indexed EXISTS added per call).

2.4 **DELIVER-ALWAYS (D-45) interplay — explicit:** D-45 forbids gating delivery on *keyword flags* (moderation axis). Blocking is a *recipient-consent* axis, equivalent to the existing membership/verification gates that already 403 sends. No conflict; the trigger must sit outside the flag/taxonomy code path (it does — schema layer).

---

## 3. Touchpoint table

| # | Surface | Evidence | Mechanism | Failure shape |
|---|---------|----------|-----------|---------------|
| 1 | `send-message` external (both paths: `conversation_id` + `recipient_user_id`) | `supabase/functions/send-message/handler.ts:147-183` (receiver resolution), `index.ts:414` (`sendInTransaction`, RLS-bypassing) | Explicit `fn_is_blocked(sender, receiver)` after receiver resolution → 403; map `blocked_pair` trigger error in `sendInTransaction` catch → 403 | Generic `FORBIDDEN` — identical to non-participant; the word "blocked" never reaches the blocked sender (SEC symmetric-silence) |
| 2 | `messages` INSERT — all writers | trigger (new) | `trg_messages_block_guard` BEFORE INSERT (§4.3) | `blocked_pair` exception |
| 3 | `send-branch-message` | `handler.ts:126` membership gate; inserts `receiver_id NULL` | **No pair check at MVP** (group context; Decision 12.1) | n/a |
| 4 | `send_connection_request` | live def: validations then INSERT | In-function check after recipient validation; asymmetric errors (§5.2) | Blocker → `recipient_blocked_by_you`; blocked party → `recipient_not_found` (mask) |
| 5 | `respond_to_connection_request` (accept) | live def: FOR UPDATE then conversation create | In-function check on `(v_req.sender_id, v_req.recipient_id)` — covers block-raced-after-request | `request_not_found` (mask) |
| 6 | `seed_accepted_request_message` | live def: service-definer INSERT into messages | Covered by trigger #2 (no separate patch needed) | `blocked_pair` |
| 7 | `accept-connection-request` edge fn | `supabase/functions/accept-connection-request/index.ts` — orchestrates #5 + #6 | No change; inherits #5/#6 | RPC error pass-through |
| 8 | `get_or_create_conversation_if_permitted` | live def: same-church bypass | In-function check after recipient validation | Blocker → `recipient_blocked_by_you`; blocked party → `requires_connection_request` (indistinguishable from stranger) |
| 9 | `get_leader_thread_list` (conversation list + request rows) | live def: `my_threads` + `req_rows` CTEs | Filter both CTEs: `NOT fn_is_blocked(v_caller_id, other_id)` — hides thread + request rows from **both** sides | Row absent |
| 10 | Thread/history fetch | `DMThreadView.tsx:586,688` direct `.from('messages')` under `messages_select_own` | **No change** — pre-block history stays readable; no new rows can exist (Decision 12.2) | n/a |
| 11 | `search_leaders` | live def | Predicate: `AND (v_caller_id IS NULL OR NOT fn_is_blocked(v_caller_id, u.id))` — both directions vanish from search | Row absent |
| 12 | `get_invite_candidates` | live def (currently resolves caller church only) | Resolve `v_caller_id`; exclude blocked pairs from the `leaders` jsonb agg (and from `leader_count`) | Row absent |
| 13 | Realtime | §1.3 | **No publication or subscription-filter change.** Blocked-pair message/request rows can never be inserted → no events exist to broadcast; WALRUS RLS already scopes events per subscriber | n/a |
| 14 | `send-message/internal` (system welcome DM) | `index.ts:614-676` | Trigger applies; no explicit check (Decision 12.5) | Logged failure, rare |

---

## 4. DDL sketch — table, helper, trigger (migration file 1)

4.1 Table — direction matters (unblock removes only the blocker's own row; mutual blocks are two rows), so **no LEAST/GREATEST canonicalization**; composite PK, no surrogate id:

```sql
create table public.blocked_users (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocked_users_pkey primary key (blocker_id, blocked_id),
  constraint blocked_users_no_self_block check (blocker_id <> blocked_id)
);
create index blocked_users_reverse_idx on public.blocked_users (blocked_id, blocker_id);

alter table public.blocked_users enable row level security;
revoke all on public.blocked_users from anon, authenticated;
-- Deliberately ZERO policies + zero grants: fail-closed even if a grant drifts.
-- All access via SECURITY DEFINER RPCs below.
```

4.2 Helper:

```sql
create or replace function public.fn_is_blocked(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
  select exists (select 1 from public.blocked_users
                  where blocker_id = p_a and blocked_id = p_b)
      or exists (select 1 from public.blocked_users
                  where blocker_id = p_b and blocked_id = p_a);
$$;
revoke execute on function public.fn_is_blocked(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.fn_is_blocked(uuid, uuid) to service_role;
```

NULL-safe (NULL args → false). Two index-only probes: PK serves `(p_a→p_b)`, `blocked_users_reverse_idx` serves `(p_b→p_a)`.

4.3 Trigger backstop:

```sql
create or replace function public.fn_messages_block_guard()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if new.receiver_id is not null
     and public.fn_is_blocked(new.sender_id, new.receiver_id) then
    raise exception 'blocked_pair';
  end if;
  return new;
end; $$;

create trigger trg_messages_block_guard
  before insert on public.messages
  for each row execute function public.fn_messages_block_guard();
```

4.4 Audit actions — extend `audit_log_action_check` (pattern: `20260701000004_extend_audit_log_action_check.sql`) with `'user_blocked'`, `'user_unblocked'`.

---

## 5. Write-path RPCs (migration file 1, continued)

5.1 `block_user(p_target uuid)` — SECURITY DEFINER, owner-scoped, EXECUTE granted to authenticated:

```sql
-- caller: auth_id = auth.uid(), is_active, soft_deleted_at is null
--   (verification NOT required — blocking is protective; pending users may block)
-- validations: p_target not null / <> caller / exists in public.users (any status)
-- cap: count(blocker_id = caller) >= 200 -> 'block_cap_reached'   (SEC ratifies number)
-- insert ... on conflict (blocker_id, blocked_id) do nothing      (idempotent)
-- audit: ('user_blocked', accessed_by = caller, triggered_by = 'user',
--         meta = jsonb_build_object('blocked_user_id', p_target))  -- id only, never a name
```

5.2 `unblock_user(p_target uuid)` — deletes `WHERE blocker_id = v_caller AND blocked_id = p_target` **only** (never the reverse row); idempotent (silent no-op when absent, audit row only on actual delete via `GET DIAGNOSTICS`); audit `'user_unblocked'`.

5.3 Rate limiting beyond the hard cap (per-hour churn) is SEC lane's call; if required, same Upstash pattern as pastoral T1 belongs in an edge fn — recommend NOT fronting block/unblock with an edge fn at MVP; the hard cap + audit trail suffice.

---

## 6. Read-path RPC

6.1 `get_blocked_users()` — SECURITY DEFINER, returns only the **caller's own** rows:

```sql
returns table (blocked_user_id uuid, display_name text, role text,
               anonymous boolean, church_name text, underground boolean,
               blocked_at timestamptz)
```

Masking mirrors `get_leader_thread_list` exactly (coordinate with SEC): `anonymous = true` → `display_name NULL` (FE composes "A fellow [Role]" per anon-identity rules); otherwise `public.resolve_display_name(...)`. Church: `type = 'underground'` → literal `'Underground Church'` — **never** name/city/region/lat/lng for UG. No email, no auth_id, no verification_status through this surface.

---

## 7. Performance

7.1 Pair-check cost at message-send frequency: two b-tree index-only probes on a table sized in the hundreds of rows at MVP scale — sub-millisecond; the send path already runs 4+ statements plus taxonomy matching. Trigger adds one such check per DM insert only (`receiver_id IS NOT NULL` short-circuits branch traffic).

7.2 List-RPC filtering (`get_leader_thread_list`, `search_leaders` LIMIT 30, `get_invite_candidates` LIMIT 50): per-row STABLE helper call over ≤50-row result sets — negligible; no join-shape rewrite warranted at this scale. Revisit with an anti-join (`LEFT JOIN blocked_users … IS NULL` twice) only if row counts grow orders of magnitude.

7.3 The composite PK doubles as the uniqueness constraint — no duplicate-pair bloat; `created_at` needs no index (list RPC sorts ≤200 rows).

---

## 8. Lifecycle

8.1 **Hard delete (Day-30 sweeper):** FK CASCADE is belt-and-braces only — it never fires because the sweeper scrub-updates `public.users` rather than deleting (§1.4). **Extend `fn_hard_delete_expired_soft_deletes`** (migration file 3): inside the per-user loop, `DELETE FROM public.blocked_users WHERE blocker_id = v_user.id OR blocked_id = v_user.id;` — both directions: the deleted account's own blocks are moot (auth row gone), and other users' blocks of a scrubbed tombstone are dead weight that would ghost-populate their blocked lists.

8.2 **KAN-205 self-delete (30-day window): blocks stay fully live** — confirmed as the right posture. A soft-deleted user's rows remain; anyone who blocked them stays protected if the account is restored; their own outbound blocks keep enforcing while restore is possible. No sweeper interaction until `hard_delete_scheduled_at` fires.

8.3 **Restore/undo within the window:** no block mutation on restore — rows simply continue.

---

## 9. Migration plan + deploy ordering (no fail-open window)

9.1 Files (repo `supabase/migrations/`, mirror-on-apply discipline — apply to prod only with Founder greenlight, file content byte-identical to what's applied, confirm via migration ledger):

1. `kan305_0001_blocked_users_table_guard_and_rpcs.sql` — table + indexes + RLS-enable/revokes + `fn_is_blocked` + messages trigger + `block_user`/`unblock_user`/`get_blocked_users` + audit action CHECK extension.
2. `kan305_0002_block_aware_rpc_patches.sql` — CREATE OR REPLACE: `send_connection_request`, `respond_to_connection_request`, `get_or_create_conversation_if_permitted`, `get_leader_thread_list`, `search_leaders`, `get_invite_candidates`.
3. `kan305_0003_sweeper_blocked_users_cleanup.sql` — extend `fn_hard_delete_expired_soft_deletes`.

9.2 **Ordering — DB first, edge second, FE last:**

1. Apply all three migrations in one batch. Zero behavior change on apply: no UI can create rows yet, and an empty table gates nothing.
2. Deploy `send-message` (explicit check + `blocked_pair`→403 mapping). Note: this function requires `verify_jwt=true` — deploy WITHOUT `--no-verify-jwt` and confirm the platform flag post-deploy (CLI/config.toml quirk).
3. Ship FE Block/Unblock UI (calls `block_user`/`unblock_user`/`get_blocked_users`).

The FE-shows-blocked-but-sends-deliver gap is structurally impossible in this order: enforcement (trigger + RPC patches) is live before the first block row can ever be created. If step 2 lags step 3 (wrong order), the trigger still fail-closes — worst case is a 500-shaped rather than 403-shaped rejection, never delivery.

9.3 Rollback: `DROP TRIGGER` + `CREATE OR REPLACE` of prior RPC bodies (keep prior defs captured in the migration PR); table can stay in place inert.

---

## 10. Adjacent findings (one line each — not KAN-305 scope)

10.1 `conversations` retains full client INSERT/UPDATE/DELETE grants with participant-self policies: a modified client can mint a thread shell with ANY counterparty and `send-message`'s `conversation_id` path then delivers with no consent-layer check — the new trigger closes this for blocked pairs, but the stranger-consent bypass remains; recommend a separate SEC-paneled ticket to revoke `conversations` client writes to RPC-only.

10.2 `send-message` `fetchSender` checks `verification_status` only — `is_active`/`soft_deleted_at` are not consulted on the service-role path; fold into KAN-205.

10.3 `connection_requests` carries a dead-letter INSERT policy (no INSERT grant) — harmless; tidy opportunistically.

---

## 11. Open Founder decisions (≤5, each with recommendation)

1. **Branch/group messages exempt from block at MVP?** Recommend YES — group context is not a 1:1 contact channel (industry standard: Slack/WhatsApp groups); `receiver_id IS NULL` exempts them naturally; revisit post-MVP if UAT surfaces harassment-in-branch.
2. **Pre-block thread history: keep readable or hide?** Recommend KEEP readable both sides (WhatsApp/iMessage posture) and hide the thread from `get_leader_thread_list`; hiding history would put a per-row RLS predicate on the hottest read path for no protective gain.
3. **Error masking asymmetry** (SEC co-ruling): recommend the blocker sees explicit `recipient_blocked_by_you` (FE can offer Unblock); the blocked party sees only the generic errors they'd get for a stranger/nonexistent user — the word "blocked" never crosses to them.
4. **Per-blocker hard cap**: recommend 200, enforced in `block_user` (SEC ratifies the number).
5. **Blockability of the Replant Team system sender**: recommend FE hides Block on `is_secure_replant_thread` threads, NO DB special-case — a user silencing system DMs harms only themselves; the rare Replant-Team-reply-into-a-block failure is logged by the internal handler and acceptable at MVP.
