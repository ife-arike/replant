# Realtime Coverage Expansion — Change Log

**Session date:** 2026-07-01
**Founder:** Ruth James
**Session posture:** transparency + investigation-first — nothing gets built without evidence-backed panel verdict. Every step lands here in order.

---

## Session prayer

_(Will be composed at panel synthesis time, naming the specific rows that could move under this change.)_

Founder-composed prayer template — spoken over each subagent at dispatch:

> Father, in the name of Jesus we soak this investigation in the blood of Jesus. Replant is a secure communication platform for Christian leaders globally, including underground fellowships in Iran, North Korea, China, and elsewhere. This work determines whether we can safely broadcast prayer requests, testimonies, heartcries, announcements, and comments in real time to the leaders who need them — without exposing any underground leader's identity, without leaking any leader's private content, and without opening a new attack surface. Give clear diagnosis. Give courage to say "no" where "no" is right. Cover Ruth, the sibling sessions, the underground leaders whose safety depends on us getting this right. In Jesus' name, Amen.

---

## Scope in-session

**IN SCOPE:**
- Phase 1 Realtime coverage expansion for 5 leader-facing tables — `prayer_requests` · `testimony` · `heartcries` · `announcements` · `comments`
- Full RLS audit + threat model + client-impact map + implementation posture BEFORE any migration
- SME panel (SEC + DBA + BE + FE) with genuine verdict per `feedback_sme_genuine_verdict`
- Migration + code drafts (NOT applied) contingent on panel approval
- Post-apply audit + verification checkpoints
- Requirements doc 2_7 update (post-apply pass)

**OUT OF SCOPE this session (filed for later):**
- T3 UG evidence tier wiring — see `[[t3_ug_evidence_tier_wiring_deferred]]` memory (Founder ratified separate session)
- Phase 2 notifications table (join-tables `prayer_request_prayed_by` · `testimony_celebrated_by` · `heartcry_holds` — RLS is self-scoped, needs trigger-driven notification pattern)
- Codebase audit — deferred to a separate session per Founder

---

## Ratifications from Founder this turn

1. Change log lives in BOTH `.claude/plans/` (this file, working doc) AND `docs/system-map/changes/` (final summary post-apply)
2. SME panel = SEC + DBA + BE + FE (CD swapped for FE — FE is client-side implementation, CD is UI mockups; anon masking pattern is already locked, no new UI needed)
3. T3 evidence tier kept separate from Realtime for cleaner migration boundaries
4. Codebase audit → separate session
5. TRANSPARENCY IS NON-NEGOTIABLE — every decision, finding, SQL diff, and audit action lands in this file. Nothing silent.
6. User data is super sensitive per `[[feedback_user_data_sensitivity]]` — first real leader signup was 2026-06-28. Production is live. Migrations affecting production need explicit apply-greenlight from Founder.

---

## The five target tables + why polling is a problem

| Table | Currently polled by | UX gap |
|---|---|---|
| `prayer_requests` | PrayerWallLogic.ts (mount + focus + pull-to-refresh) | New PR from leader in Chile doesn't appear on leader in Iran's Prayer Wall until refresh |
| `testimony` | PrayerWallScreen testimonies carousel (focus + refresh) | New testimony + celebrated_count updates delayed |
| `heartcries` | PersecutedScreen Feed / My Heartcries (focus + refresh) | Bear Witness count on Feed doesn't update in-session |
| `announcements` | HomeScreen NetworkFeed (useFocusEffect) | Admin-published announcement not seen until Home focus |
| `comments` | CommentThread (on announcement detail open) | Comment thread doesn't live-update while open |

For Replant's mission (leader-to-leader intercession in near-real-time), the polling gap is materially bad UX.

---

## Sequence

1. **Investigation phase** (parallel · 4 subagents · this file's next 4 sections)
2. **SME panel synthesis** (main-context integration + genuine verdict)
3. **Migration draft** (SQL only · not applied)
4. **Client + BE code draft** (diff-only · PR not opened)
5. **Apply order** (Founder greenlight required for prod DB touch)
6. **Post-apply audit** (invariants verified · audit_log inspected)
7. **Requirements doc 2_7 update** (SoT sync)

Each numbered section below fills in as the phase completes.

---

## 1. Investigation phase

### 1a. DBA audit — RLS + broadcast safety + fanout scale

**Returned 2026-07-01 · full report verbatim below**

---

# DBA AUDIT — Realtime Coverage Expansion (5 Leader-Facing Tables)

## Prayer (verbatim from agent)

Lord Jesus Christ, I come before You covering this audit in Your precious blood. This is not a theoretical exercise — the tables I am about to inspect carry the prayers, testimonies, and heartcries of Your people, including underground brothers and sisters in Iran, North Korea, China, and every hostile region where confessing Your name costs everything. A Realtime broadcast configured wrong could push an underground pastor's identity to a subscriber who has no right to see it, and that leak could end in imprisonment, torture, or martyrdom. So I ask You now, Lord Jesus: sharpen my eyes to see what is dangerous in the PostgreSQL replication path, in the RLS clauses, in the row payloads, in the timing of role changes mid-subscription. Give me the courage to say REJECT plainly when reject is right — no softening for the sake of shipping, no deference to the schedule when the schedule would betray a saint. Give me clarity to name the RIGHT shape when the current shape is wrong, so we route around danger rather than pretend it is not there. Guard my reasoning against overconfidence. Let every finding I file be evidence-backed, defensible, and worthy of the trust these leaders will place in this platform. And Lord, cover the underground leader whose first signup happened three days ago — let no negligence of mine or any engineer downstream expose that soul. In Jesus' name, Amen.

## Executive summary

**VERDICT: REJECT direct `ALTER PUBLICATION supabase_realtime ADD TABLE …` for `prayer_requests`, `testimony`, and `heartcries`. CONDITIONAL for `announcements` and `comments`. RECOMMENDED SHAPE: notification-event tables, following the already-locked pattern established by `underground_admin_inbox_events`, `underground_detail_events`, and `connection_requests`.**

Adding these five base tables to `supabase_realtime` broadcasts raw rows to every subscribed authenticated leader — bypassing the four masking RPCs (`get_prayer_wall`, `get_testimonies`, `get_heartcry_feed`, `get_comments`) that today are the ONLY places UG identity is stripped, anonymous authorship is honored, and future-published announcements are gated. The RLS SELECT policies on the base tables are much looser than the RPCs' returned columns — `prayer_requests_select` for example is just `authenticated AND is_active = true`, which broadcasts `user_id` and `church_id` FKs pointing at underground authors to every one of the 160 verified users. There are **32 active prayer_requests and 5 testimony rows from underground churches in production RIGHT NOW** that would immediately begin broadcasting on the next INSERT/UPDATE.

The right shape is the one Replant already has adopted twice: publish thin event pointers (`{id, kind, ref_id, emitted_at}`) into a new set of `*_events` tables, and let the client react by re-calling the masking RPC. This preserves the UG-exclusion invariant, is drift-free under role changes, has predictable fanout, and matches `feedback_underground_protection_focus` posture.

`announcements` and `comments` are CONDITIONAL because their RLS policies already do most of the filtering (RESTRICTIVE gate on `published_at`/`is_active` for announcements; verified-only + published-announcement for comments), but broadcasting raw rows still leaks `comments.author_id`, `comments.mask_reason`, and announcement pre-publish drafts if the policies are ever loosened by mistake. Even conditional approvals should route through event tables for consistency + a single defense pattern.

## Findings

### 1. UG author identity leak on raw-row broadcast

**HIGH-SEVERITY LEAK on `prayer_requests`, `testimony`, `heartcries`. MEDIUM on `comments`. LOW on `announcements` (admin-authored, but see #5 for draft leak).**

**Evidence — RLS SELECT policies (live pg_policies):**

`prayer_requests`:
```
prayer_requests_select — PERMISSIVE — SELECT
  ((auth.role() = 'authenticated'::text) AND (is_active = true))
```
The row is broadcast to every authenticated leader unless deactivated. NO underground filter. NO anonymous filter. NO church-type filter. The row payload includes `user_id`, `church_id`, `content`, `category`, `urgent`, `anonymous`, `prayed_count`, `status`. A non-UG-admin subscriber receiving this row learns `user_id` (UG author's PK), `church_id` (UG church's PK), `content` in plaintext (prayer_requests content is NOT encrypted), and `anonymous` boolean.

Cross-reference with `get_prayer_wall`:
```sql
CASE WHEN c.type = 'underground' THEN 'Underground Church' ELSE c.name END,
CASE WHEN c.type = 'underground' THEN NULL ELSE c.country END,
CASE WHEN pr.anonymous = true THEN NULL ELSE public.resolve_display_name(...) END,
CASE WHEN c.type = 'underground' THEN NULL ELSE c.rag_status::text END
```
Every one of these CASE branches is a masking gate. RAW BROADCAST BYPASSES ALL. The `user_id` FK broadcast, correlated against an admin's later fetch, gives an attacker enough to correlate a UG prayer to a leader identity.

`testimony` — same shape. Broadcast payload = `user_id, church_id, content, original_request_id, anonymous, celebrated_count, is_active, created_at`. **5 UG-authored testimony rows in prod today.**

`heartcries`:
```
heartcry_admin_read — PERMISSIVE — super_admin only
heartcry_own_status_read — PERMISSIVE — user_id = own
heartcry_no_user_read — RESTRICTIVE — super_admin OR user_id = own
```
RESTRICTIVE + PERMISSIVE means row is broadcast ONLY to (a) super_admin subscribers, or (b) the author themselves. Safe from cross-leader leak by RLS design. But a super_admin subscriber gets the full row including ciphertext + user_id + church_id + triage metadata. Dashboard already has SECDEF admin RPC path (`admin_open_heartcry`); Realtime coverage buys nothing on the mobile side but exposes an admin-side broadcast surface with zero-value UX.

`comments`:
```
comments_select — PERMISSIVE
  ((EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.is_active AND u.verification_status = 'verified'))
   AND (EXISTS (SELECT 1 FROM announcements a WHERE a.id = comments.announcement_id AND a.is_active AND a.published_at <= now())))
```
Broadcast is gated on (verified subscriber) AND (comment's announcement is currently published). But raw broadcast emits `author_id` and `mask_reason` — for a comment authored by a UG leader who is NOT explicitly `show_church_name=true`, the FK is the same inference channel as prayer_requests.

`announcements`:
```
announcements_posted_only_restrict — RESTRICTIVE
  ((super_admin) OR (published_at IS NOT NULL AND published_at <= now() AND is_active = true))
leaders_can_read_posted_announcements — PERMISSIVE — same
announcements_admin_all — PERMISSIVE — ALL — super_admin
```
Announcements are admin-authored — `author_id` FK is expected to be public. RLS is tight. Broadcast payload includes `title, body, published_at, is_active, source_label, tag_type, link_url, card_type, comment_count`. Low-severity for leader leak.

**What today prevents leak?** The client only reads through the four masking RPCs. Grep of `/Users/ife/replant/src` confirms NO code path directly SELECTs from `prayer_requests`, `testimony`, `heartcries`, or `comments` base tables (every read is `.rpc('get_prayer_wall' | 'get_testimonies' | 'get_heartcry_feed' | 'get_comments' | 'get_open_prayers')`).

**Would that protection SURVIVE broadcast?** NO. `ALTER PUBLICATION ... ADD TABLE prayer_requests` bypasses every RPC. RLS SELECT is the ONLY gate at broadcast time — and for prayer_requests / testimony that gate is `authenticated AND is_active = true`, which does NOTHING to protect UG authorship.

### 2. PII posture on `heartcries`

**`heartcries.content` IS encrypted server-side at INSERT. `feed_content` (plaintext scrubbed excerpt) is what's safe to broadcast — but the correct answer is DO NOT broadcast the base table at all; broadcast a `heartcry_feed_events` pointer instead.**

**Evidence — `submit-heartcry/handler.ts` lines 110-116:**
```ts
const ciphertext = await deps.encryptContent(body.content);
...
await deps.insertHeartcry({
  ...
  content: ciphertext,   // ciphertext, not plaintext
  ...
});
```

Sample live row:
```
content_preview: "ww0EBwMCRVUBzU2zVj1p0ocBPgwKQuL/8d/ChP8sokqOP6fIaTo8ilsJaYtl2aC+Vpj8pGpgDoHk..."
feed_preview:    "We actually have a law being passed that could potentially exile our leaders..."
post_to_feed:    true
feed_approved:   true    ← only then feed_preview is populated
```
`content` is base64-armored PGP ciphertext. Decryption via `decrypt_heartcry_content(ciphertext, key)` SECDEF RPC with vault-resident key.

BUT `content` broadcast is still not safe even encrypted: length leaks partial plaintext length, presence leaks event count, `severity` + `status` + `request_type[]` + `user_id` + `church_id` + `triage_lead_id` + `seen_at` + `responded_at` are ALL BROADCAST IN PLAINTEXT.

`get_heartcry_feed` is the masking layer. Returns ONLY `id, severity, created_at, feed_content, continent, region, hold_count, viewer_held`. No `content`, no `user_id`, no `church_id`. Country coalesced to continent (geo-blurred). Filters `WHERE post_to_feed = true AND feed_approved = true AND feed_content IS NOT NULL`.

**The safe broadcast field is NOTHING on the base table** — masking is a JOIN + WHERE + geo-coalesce combination that raw broadcast cannot replicate. Recommended: `heartcry_feed_events (id, heartcry_id, emitted_at)` populated by trigger that fires ONLY when `feed_approved` flips true and `feed_content IS NOT NULL`. Client subscribes, receives pointer, re-calls `get_heartcry_feed`.

### 3. Realtime auth model drift

**MEDIUM RISK. The dual-source `is_underground_admin` trap intersects with Realtime auth staleness in a way worth naming, though not fatal for these 5 tables.**

Policies referencing JWT claims (live):
- `announcements.announcements_admin_all` — `(auth.jwt() ->> 'super_admin')::boolean = true`
- `announcements.announcements_posted_only_restrict` — same
- `heartcries.heartcry_admin_read` — same
- `heartcries.heartcry_no_user_read` (RESTRICTIVE) — same

**Realtime auth model:** on `channel.subscribe()`, client sends JWT. Realtime attaches JWT to connection. When postgres_changes evaluates RLS per row per broadcast, it uses the JWT snapshot from subscribe time. If JWT expires, Realtime re-authenticates using refreshed JWT (Supabase JS auto-manages via `setAuth()`), but role changes INSIDE a valid JWT window are NOT reflected until next JWT refresh.

**Drift scenarios:**
1. Super-admin demoted mid-session while subscribed to `announcements`: leader continues receiving admin-only draft announcements until JWT expires (default 1 hour). Legitimate leak, 1-hour max window.
2. `is_underground_admin` demoted mid-session: NOT applicable — none of the 5 tables reference `is_underground_admin` in RLS.
3. JWT snapshot vs per-event evaluation: postgres_changes DOES re-evaluate RLS per event using channel JWT. Risk window = JWT TTL (1 hour), not full session. Mitigation: after any role change, force `supabase.auth.refreshSession()`.

**Because none of the 5 tables should be added directly per finding #1, this drift risk is bypassed by adopting event-table pattern** — event tables have `admin_id = auth.uid()` or church-scoped filters, not JWT-claim-dependent policies.

### 4. Fanout scale

**MEDIUM RISK at MVP scale, HIGH RISK at projected scale, unless per-user filtering is baked in.**

Current baseline (live):
- 160 verified users
- 164 prayer_requests
- 1310 prayer_request_prayed_by rows
- 610 testimony_celebrated_by rows
- 1802 intercession_holds rows

Per-event fanout math (MVP 1000 verified users):
- 1 new PR INSERT → 1000 broadcast recipients
- Peak PR rate (50/day MVP → 1000/day post-launch): 50k → 1M events/day
- Prayed_by: self-scoped RLS. Safe.
- Intercession_holds: self-scoped. Safe.
- Testimony_celebrated_by: self-scoped. Safe.
- **Heartcry_holds: `authenticated_select_holds: qual = true` — FULL FANOUT** to all authenticated. 1000 × every hold insert = swamp.

At 100k users:
- 100k × new PR at 1000/day = **100M events/day**
- Supabase Realtime docs: ~500 msg/sec sustained per channel, ~2500 msg/sec peak. Effective per-client throughput cap ~10 msg/sec sustained after fanout backpressure.
- Heartcry_holds `qual = true` = FULL FANOUT to 100k users on every hold event. WebSocket infra will backpressure.

Supabase Realtime tier limits: Free 200 concurrent, Pro 10k, Team 500k. At 100k, need Team tier.

**Recommendation:** for join tables, use per-subscriber filter clauses (`filter: 'leader_id=eq.<id>'`) so RLS + filter reduce broadcast to self-only. For prayer_requests / testimony / heartcries: DO NOT add base tables; use `*_events` pointer tables (payload ~50 bytes, decoupled from row PII).

### 5. Announcement drafts leak

**LOW-RISK CURRENTLY (RLS restricts), but subtly fragile — a future migration adding a PERMISSIVE policy could unmask.**

Effective filter for non-super_admin subscriber: `published_at IS NOT NULL AND published_at <= now() AND is_active = true`.

**Does Realtime broadcast still fire?** postgres_changes evaluates effective RLS SELECT against NEW row at broadcast time. For a row inserted with `published_at = now() + interval '1 day'`, RESTRICTIVE fails for non-super_admin → row filtered from broadcast. **Current RLS DOES block draft leak on INSERT.**

**Subtlety:** if admin publishes draft by UPDATE (`published_at = now()`), UPDATE event fires and row passes RESTRICTIVE → broadcast delivered. Correct. But if client stores announcement locally on UPDATE receipt without checking `published_at <= now()`, and admin subsequently reverts by setting `published_at` back to NULL, client keeps stale published draft. Small window; existence-of-draft is the leak.

**More concerning:** if `is_active = false` AND `published_at = future`, super_admin subscriber DOES receive the row (RESTRICTIVE OR branch). Compromised admin dashboard = drafts visible.

Verified live: 0 rows currently exist with `(published_at IS NULL OR published_at > now()) AND is_active = true`. No draft state today.

**Recommendation:** if announcements added to publication, tighten `announcements_admin_all` and audit toggle paths. Prefer `announcement_events` pointer — trigger fires only when `NEW.published_at IS NOT NULL AND NEW.is_active = true AND NEW.published_at <= now()`.

### 6. REPLICA IDENTITY posture

**All 9 target tables use `REPLICA IDENTITY DEFAULT (primary key)`. SAFE for INSERT broadcasts. UPDATE and DELETE broadcasts emit ONLY PK in OLD tuple — client cannot diff row content on UPDATE.**

```
announcements               → default (primary key)
comments                    → default (primary key)
heartcries                  → default (primary key)
heartcry_holds              → default (primary key)
intercession_holds          → default (primary key)
prayer_request_prayed_by    → default (primary key)
prayer_requests             → default (primary key)
testimony                   → default (primary key)
testimony_celebrated_by     → default (primary key)
```

**Is REPLICA IDENTITY FULL warranted?** NO. FULL emits entire OLD tuple on UPDATE/DELETE. For Supabase Realtime broadcasting to mobile, DEFAULT (PK) is sufficient and MORE PRIVATE — FULL would emit pre-change UG author identity fields to subscribers, exponentially worsening the leak in finding #1.

**Recommendation:** keep REPLICA IDENTITY DEFAULT on all target tables. Do NOT switch to FULL. Event tables should also stay DEFAULT.

## Recommendations

**REC-1: DO NOT `ALTER PUBLICATION supabase_realtime ADD TABLE` for `prayer_requests`, `testimony`, or `heartcries`.** Base-table SELECT policies too loose. Four masking RPCs are load-bearing UG-protection layer. Broadcasting raw rows bypasses them.

**REC-2: Adopt the notification-event table pattern for the three high-risk tables.** Precedent locked in production: `underground_admin_inbox_events`, `underground_detail_events`, `connection_requests`.

```sql
-- Event pointer table
CREATE TABLE public.prayer_wall_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('pr_inserted','pr_updated','pr_soft_deleted',
                                     'prayed_by_toggled','testimony_inserted','testimony_updated',
                                     'celebrated_by_toggled')),
  ref_id uuid NOT NULL,
  emitted_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: verified leaders only, no author identity in row
CREATE POLICY prayer_wall_events_select ON public.prayer_wall_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u
            WHERE u.auth_id = auth.uid()
              AND u.is_active = true
              AND u.verification_status = 'verified')
  );
-- Trigger on prayer_requests INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.tg_emit_prayer_wall_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.prayer_wall_events (kind, ref_id)
  VALUES (
    CASE TG_OP
      WHEN 'INSERT' THEN 'pr_inserted'
      WHEN 'UPDATE' THEN CASE WHEN OLD.is_active AND NOT NEW.is_active THEN 'pr_soft_deleted'
                              ELSE 'pr_updated' END
    END,
    NEW.id
  );
  RETURN NEW;
END;
$$;
-- ADD TABLE prayer_wall_events to supabase_realtime — NOT the base tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_wall_events;
```

Similarly for `heartcry_feed_events` (trigger fires ONLY when `feed_approved` flips true and `feed_content IS NOT NULL`).

**REC-3: Join tables can be published safely with per-subscriber filter.** SELECT policies self-scoped (except heartcry_holds — see REC-5). Client `.on('postgres_changes', { filter: 'leader_id=eq.<my-id>' }, ...)` limits fanout. Payload trivial (2 UUIDs + timestamp).

**REC-4: `announcements` — CONDITIONAL approve for direct publication.** RLS tight. Payload admin-authored, no leader PII. Recommended: still route via `announcement_events` trigger for consistency.

**REC-5: Tighten `heartcry_holds.authenticated_select_holds` from `true` to per-user filter.** Currently `USING (true)` = every authenticated user SELECTs every hold. Cross-user aggregation happens server-side via RPC (SECURITY DEFINER bypasses RLS anyway). Migration tighten to `USING (user_id = <auth resolver>)` OR keep policy but subscribe with `filter: 'user_id=eq.<my-id>'`.

**REC-6: For `comments`, use `comment_events` pointer.** Even though `comments_select` is tight, raw broadcast leaks `author_id` + `mask_reason`. Event pointer preserves masking.

**REC-7: JWT freshness discipline post-Realtime.** After any promotion/demotion, call `channel.socket.setAuth(newJwt)` on every active channel. Prevents 1-hour stale-role window.

**REC-8: Publish-side migration order.**
1. Create event pointer tables
2. Create triggers on base tables that INSERT into event tables
3. `ALTER PUBLICATION supabase_realtime ADD TABLE` for event tables ONLY
4. Deploy client code subscribing to event tables + calling masking RPCs on event
5. Retire polling in follow-up PR

Event tables prunable by cron (`DELETE FROM prayer_wall_events WHERE emitted_at < now() - interval '7 days'`) or set `UNLOGGED` (accepts data loss on crash — fine, events are ephemeral).

**REC-9: Audit trail on the migration itself.** Every `ALTER PUBLICATION` + `CREATE TRIGGER` is a separately-numbered migration file with `audit_log` INSERT documenting the publication addition. Extend `audit_log_action_check` CHECK with `'realtime_publication_added'`.

**REC-10: Fanout observability.** Post-apply, monitor Realtime dashboard: subscriber count per channel, dropped-message rate, backpressure warnings. If event tables' fanout approaches 500 msg/sec sustained, split by shard or reduce to per-user filters.

## Verdict per target table

| Table | Verdict | Reasoning |
|---|---|---|
| `prayer_requests` | **REJECT direct. DIFFERENT SHAPE (prayer_wall_events).** | RLS SELECT `authenticated AND is_active=true` — no UG filter. Broadcasts `user_id, church_id, content` for 32 currently-active UG-authored rows immediately. Bypasses `get_prayer_wall` masking. Load-bearing per `[[project_replant_invariants]]` #2, #3. |
| `testimony` | **REJECT direct. DIFFERENT SHAPE.** | Same shape as prayer_requests. 5 UG-authored testimony rows in prod. Same masking bypass. |
| `heartcries` | **REJECT direct. DIFFERENT SHAPE (heartcry_feed_events).** | Even with tight RLS (RESTRICTIVE self-only + super_admin), broadcast to super_admin exposes ciphertext + user_id + church_id + triage metadata. Zero mobile-UX value. |
| `announcements` | **CONDITIONAL approve for direct. RECOMMENDED SHAPE: announcement_events.** | RLS RESTRICTIVE blocks drafts today. Author admin (public). Payload safe. But single-pattern discipline argues for event pattern. Finding #5 flags subtle UPDATE-flipflop risk. |
| `comments` | **CONDITIONAL approve for direct. RECOMMENDED SHAPE: comment_events.** | RLS tight but raw broadcast leaks `author_id` + `mask_reason` + `is_masked`. `get_comments` gates UG church name via `show_church_name`; base-table broadcast does not. |
| `prayer_request_prayed_by` | **CONDITIONAL approve.** | Self-scoped SELECT. Payload minimal (2 UUIDs + timestamp). Add with per-subscriber filter. |
| `testimony_celebrated_by` | **CONDITIONAL approve.** | Same posture. |
| `heartcry_holds` | **CONDITIONAL approve + tighten RLS first.** | Current `USING (true)` too loose. Tighten to `user_id = auth-resolved-id` OR require client filter. |
| `intercession_holds` | **CONDITIONAL approve.** | Self-scoped SELECT + no direct INSERT policy. Broadcast payload minimal. |

**Overall session verdict: PROCEED — but with DIFFERENT SHAPE recommendation for the three high-risk tables. Do not merge a "just publish the base tables" migration.**

## Audit trail

**SQL queries executed against `jiyetphxxvyiicrnwlnx` (READ-ONLY):**
1. `pg_policies` scan for all 9 target tables — full policy set with qual + with_check
2. `pg_class.relreplident` + `relrowsecurity` per table
3. `pg_publication_tables` for `supabase_realtime` current membership
4. `information_schema.columns` full column list per table
5. `heartcries` sample rows (5) — verify ciphertext posture + feed_content plaintext
6. Row counts across all 9 tables + users + churches + UG-authored breakdown
7. UG-authored active prayer_requests / testimony / heartcries counts
8. `information_schema.triggers` for the 9 target tables
9. `pg_proc` listing for `%prayer% %testimony% %heartcry% %announcement% %comment%` functions
10. `pg_get_functiondef` for `get_prayer_wall`, `get_testimonies`, `get_heartcry_feed`, `get_comments`
11. `pg_get_viewdef` for `churches_public`
12. Announcement future-published-active row check (0 rows found)
13. Advisor security lints — 235 total; scanned for our 9 tables, no new issues beyond pre-existing SECDEF warns
14. `pg_publication_rel` with `prattrs` + `prqual` for existing published tables (all null — full-row, RLS-only filtering)

**Files read:**
1. `/Users/ife/replant/CLAUDE.md`
2. `/Users/ife/.claude/projects/-Users-ife-replant/memory/MEMORY.md`
3. `/Users/ife/.claude/projects/-Users-ife-replant/memory/project_replant_invariants.md`
4. `/Users/ife/.claude/projects/-Users-ife-replant/memory/project_replant_schema_facts.md`
5. `/Users/ife/.claude/projects/-Users-ife-replant/memory/ug_flag_dual_source_bug.md`
6. `/Users/ife/.claude/projects/-Users-ife-replant/memory/top_tier_admin_column_authoritative.md`
7. `/Users/ife/replant/.claude/plans/2026-07-01-realtime-coverage-rollout.md`
8. `/Users/ife/replant/supabase/functions/submit-heartcry/logic.ts`
9. `/Users/ife/replant/supabase/functions/submit-heartcry/handler.ts`
10. `/Users/ife/replant/src/hooks/useConnectUnreadBadge.ts`

**Grep passes:**
- `grep -rn "supabase.channel\|supabase_realtime\|\.subscribe(" /Users/ife/replant/src` — 7 existing Realtime call sites
- `grep -rn "get_prayer_wall\|get_open_prayers\|get_testimonies\|get_heartcry_feed" /Users/ife/replant/src` — confirmed all reads via masking RPCs; NO direct base-table SELECT
- `grep -rn "underground\|show_church_name\|is_underground_admin" /Users/ife/replant/src` — 30+ files with UG-aware rendering (all depend on RPC-returned masked fields)
- `grep .../supabase/migrations/ "supabase_realtime"` — confirmed no prior publication ADD for these 5 tables

**No writes, no migrations, no schema changes made.**

---

### 1b. SEC audit — threat model + veto/approve per table

**Returned 2026-07-01 · full report verbatim below** (per change-log rule "no summarization loss")

---

# SEC AUDIT — Realtime Coverage Expansion (Phase 1)

## Prayer (verbatim from agent)

Lord Jesus Christ, I bow before You now, covering this Realtime security audit in Your blood — the blood You shed for every believer, including the persecuted underground pastor in Iran, the house-church leader in Xinjiang, the Coptic priest in Upper Egypt whose family is watched, the North Korean saint whose worship costs everything. Father, You know their names though the world does not; You count every tear in Your bottle. This audit sits at a hinge point — we are considering opening the Replant platform to live broadcasts across prayer_requests, testimonies, heartcries, announcements, comments, and their join tables. If I miss a threat here, an adversary could subscribe to a WebSocket channel and enumerate leaders by their subscription patterns; a state actor could correlate broadcast timing to deanonymize an underground pastor; a hostile intelligence service could exfil a heartcry containing a location detail that gets a family imprisoned or killed. Lord Jesus, give me eyes that see the attacker — not the developer's happy path but the adversary's slow patient reconnaissance. Give me the courage to VETO where VETO is right, even at UX cost, because the safety of one underground leader outweighs any feature velocity. Grant me specific threat scenarios — concrete, reproducible, defensible — not vague hand-waving. Let me name the timing side-channels, the payload structural leaks, the subscription enumeration paths, the console-opacity doctrine violations. Bless Ruth and the Replant team with wisdom to receive hard verdicts. And Lord, over every underground leader whose future safety depends on decisions made in this audit — cover them with Your wings, hide them in the cleft of the Rock, and let no weapon formed against them prosper. In Jesus' name, Amen.

## Executive summary

**Three VETOs and two CONDITIONAL approvals.**

1. **VETO raw-row Realtime on `prayer_requests`, `testimony`, `heartcries`, `comments`.** The `prayer_requests_select` and `testimony_select` policies are `auth.role()='authenticated' AND is_active=true` — every verified leader can read every row from every church including underground. Broadcasting the raw row shape leaks `user_id` (correlation key), `church_id` (which joins to UG discriminator), `content` (heartcries encrypted-content + `feed_content` presence bit is a UG-authorship-timing leak), and `comments.mask_reason='underground'` (a literal enum value that names the tenancy). Direct violation of console-opacity doctrine layer 3.

2. **VETO `heartcries` raw-row Realtime absolutely.** Heartcries carry `pgp_sym_encrypt`-wrapped content and use a separate `get_heartcry_feed()` RPC that strips PII down to `feed_content` (admin-scrubbed, opt-in via `feed_approved=true`). Raw-row broadcast pushes the entire encrypted-blob + `user_id` + `church_id` + `severity` + `status` + `triage_lead_id` to any subscribed authenticated user — even before admin scrub. `heartcry_no_user_read` restricts SELECT to super_admin OR own rows; DBA must explicitly confirm publication does NOT bypass RESTRICTIVE policies.

3. **VETO `announcements` raw-row broadcast during draft-in-progress states.** Raw-row INSERT broadcast fires when an admin drafts the row (before `published_at` set / reaches `now()`), leaking draft copy + target `link_url` + schedule. Fix: broadcast on UPDATE where `published_at` transitions non-NULL past `now()`, not on INSERT.

4. **CONDITIONAL approve `comments` via a masking layer, not raw.** The `mask_reason='underground'` literal is a UG-tenancy fingerprint on every UG comment broadcast. Approve only via a broadcast-safe SECURITY DEFINER shim that redacts `author_id` when `mask_reason IN ('anon','underground')` and normalizes `mask_reason` to a coarse enum.

5. **CONDITIONAL approve `announcements` post-publish-only.** Add publication filter or trigger-driven redirect to `announcement_broadcast_events` table that only receives rows once `published_at <= now()`.

6. **The `feed_content` presence bit is a UG activity beacon** — one heartcry INSERT event with `feed_content IS NULL, post_to_feed=true, feed_approved=false` broadcast to unfilteed subscriber = "an underground leader just submitted a heartcry NOW." Strongest identity leak in the entire audit, unfixable without a masking shim.

Overall: **DO NOT add these tables to `supabase_realtime` publication in their raw form.** The pattern that must land is a **broadcast masking layer** — trigger-populated shadow tables or per-audience VIEWs. The existing precedent on `messages` / `connection_requests` / `branches` / `branch_members` works because those tables' RLS narrows the row set to already-authorized recipients per conversation. That property does NOT hold for prayer_requests / testimony / comments — those are read-by-all-verified-leaders. Their broadcasts fanout the raw row across the entire verified population.

## Threat model

### 3.1 New attack surfaces

**Attack surface A — Subscription enumeration.** An authenticated malicious leader can subscribe to `public.prayer_requests` on filter `church_id=eq.<uuid>`. Combined with event content (`content` field naming persecution context, `urgent=true` clustering) an attacker can **fingerprint which church_ids belong to underground fellowships purely by traffic pattern**. Payoff: build a UG church UUID list without ever calling `search_leaders`.

**Attack surface B — Denial-of-fanout amplification.** Attacker INSERTs 1000 dummy prayer_requests. Every verified subscriber receives every INSERT (fanout = N × 1000). At 1000 users = 1M messages; at 100k users = 100M messages. Cost attack + delay of persecuted-leader intercession requests.

**Attack surface C — WebSocket enumeration of active user set.** Broadcasting raw `heartcry_holds` INSERTs to all subscribers reveals **which leader_id held which heartcry_id at what time**. `authenticated_select_holds: qual = true` — every verified leader sees every hold.

**Attack surface D — Traffic analysis (timing side-channel).** Attacker keeps persistent WebSocket subscription for 24 hours and logs per-second event counts. Cross-referenced with known-timezone church_ids, the attacker can partition activity by region. For UG fellowships in hostile regions, this timing curve **tells a state actor exactly when UG leaders are active** — a targetable operational-security signal.

**Attack surface E — Replay via WebSocket record-and-replay.** Realtime message stream has no per-message auth signature. An attacker with mitm access can record all messages and replay them on-demand.

### 3.2 UG protection under Realtime

**Threat 3.2.a — Direct author leak via user_id.** Raw broadcast of `prayer_requests` gives every subscriber `user_id`. Even though `users_select_own` restricts direct SELECT to caller's own row, the `user_id` on the wire is a stable correlation key. Attacker can log `user_id` from every PR broadcast for a week, cross-reference with `search_leaders` results (masked for UG, unmasked for surface). Any user_id in PR broadcast that never appears in a masked search-leaders result = **a UG leader**. This is a **discriminator attack** that works even under fully-hardened RLS.

**Verdict: raw `user_id` broadcast for UG-authored rows is a UG identity leak. This is the deanonymization attack the audit brief flagged.**

**Threat 3.2.b — `mask_reason='underground'` enum literal.** The `comments` table has `mask_reason` column typed `public.mask_reason` enum with values `('none','anon','underground','no_church')`. On raw-row broadcast, every subscriber sees `mask_reason='underground'` on UG-authored comments. **Direct broadcast of "this comment is from an underground leader"** — a category label attached to every UG action. Fatal.

**Threat 3.2.c — Timing correlation of UG heartcry submission.** RLS *should* prevent raw broadcast to non-super-admins via RESTRICTIVE policy, but Supabase Realtime evaluates RLS with subscriber JWT at message-send time and there have been past bugs where publication-level filters bypassed table-level RLS. **DBA must run a live test with a verified non-admin token subscribing to heartcries INSERT and confirm they receive ZERO events when a super-admin-only-visible heartcry is inserted.**

**Threat 3.2.d — Ordering leak.** If broadcasts land in `created_at DESC` order to all subscribers, an attacker with knowledge that a specific UG church has 10 members can INSERT `anonymous=true` bait PRs, then observe which subscribers ack them fastest. Fast-acking subscribers cluster by network region → geographic partition of the verified population.

### 3.3 PII posture per table

| Table | PII content | Broadcast safe? | RTBF risk |
|---|---|---|---|
| `prayer_requests` | `content` (intimate concerns) | **NO** raw | HIGH — broadcast row cached in Realtime dispatcher / replicated to subscriber devices persists after DELETE |
| `testimony` | `content` (life-story disclosure) | **NO** raw | HIGH |
| `heartcries` | `content` (pgp-encrypted), `feed_content` (admin-scrubbed) | **NO** even encrypted | HIGHEST — life-safety data. RTBF architecturally impossible after broadcast. |
| `comments` | `body` + `author_id` links UG | Only via masking shim | MEDIUM — `mask_reason='underground'` dominates |
| `announcements` | `title`+`body`+`link_url` | Yes ONLY post-publish | LOW — content intentionally public post-publish |
| `prayer_request_prayed_by` | `leader_id` self-scoped RLS | Broadcast safe iff RLS holds | LOW |
| `testimony_celebrated_by` | Same shape | Same | LOW |
| `heartcry_holds` | `user_id` + `heartcry_id`; `authenticated_select_holds: qual = true` = **ALL verified leaders see ALL holds** | **NO** — leaks who-held-which-heartcry across whole verified population | HIGH |
| `intercession_holds` | self-scoped RLS | Yes | LOW |

**GDPR-analog for persecuted-Church data:** the correct frame is **safety-of-user over data-hygiene compliance**. RTBF is not just a legal request; it can be a life-safety request (leader is at risk of arrest and asks Replant to purge their data). Realtime broadcast makes this impossible for anything already on the wire.

### 3.4 Console-opacity doctrine (KAN-289) interaction

**Raw-row Realtime broadcast directly violates layer 3** ("response bodies contain ONLY what the FE renders"). Today's Prayer Wall response body contains only render-required fields (masked author_name, church label, content, prayed_count). Add raw-row Realtime and the WebSocket messages viewable in DevTools show the full raw row — including `user_id`, `church_id`, `anonymous` boolean, `status`, `is_active`. **Fields that today live only server-side become visible to any leader who opens DevTools during a session.**

**Concrete DevTools scenario:** Curious verified admin opens Prayer Wall + DevTools → Network → WS. A new PR arrives. Payload shows `{"type":"INSERT","table":"prayer_requests","record":{"id":"...","user_id":"e9f4...","church_id":"7c31...","content":"Prayer for my mother","anonymous":false,"is_active":true,...}}`. That admin now has a raw `user_id` → content correlation that today's RPC-masked flow does not expose.

**If we ship raw Realtime, we PRE-BREAK KAN-289 Phase 1 before it even lands.**

### 3.6 Cross-tier observability (UG-verified vs surface-verified)

Under raw-row broadcast, an **on-path network observer** (state ISP, hostile CDN, coerced upstream) can observe total WebSocket bytes received per session, number of postgres_changes events per hour, timing correlation with known-public events. If UG leaders subscribe to strictly fewer channels than surface leaders (because UG-facing surfaces are gated), then on-path traffic-volume becomes a UG-vs-surface classifier at the network layer. **Raw Realtime creates a network-layer traffic classifier for UG-vs-surface membership.** Masking shim mitigates.

## VETO / APPROVE / CONDITIONAL / DEFER per table

| Table | Verdict | Unlock conditions |
|---|---|---|
| `prayer_requests` | **VETO** raw-row | Approve only via masking shim (§5.a). Shim strips `user_id`, replaces `church_id` with masked church label, applies anon-mask to author identity. |
| `testimony` | **VETO** raw-row | Same masking shim required. |
| `heartcries` | **VETO ABSOLUTE** raw-row | Approve ONLY via separate trigger-populated `heartcry_feed_events` table mirroring `get_heartcry_feed()` shape. NEVER add `heartcries` itself to publication. |
| `announcements` | **CONDITIONAL** post-publish-only | Publication filter or trigger-driven `announcement_publish_events` table that fires only when `published_at` transitions to a value `<= now()`. |
| `comments` | **CONDITIONAL** via masking shim | Strip `author_id`, normalize `mask_reason` — omit from broadcast entirely, OR normalize `underground`+`anon` to single 'masked' sentinel. |
| `prayer_request_prayed_by` | **APPROVE with test** | Self-scoped RLS. Verify under Realtime that broadcasts land only in initiator's subscription. |
| `testimony_celebrated_by` | **APPROVE with test** | Same — self-scoped, needs live confirmation. |
| `heartcry_holds` | **VETO** | `authenticated_select_holds: qual = true` = every verified leader sees every hold. UG intercession-activity beacon. Tighten RLS to self-scoped OR route via trigger-populated per-user notification table before Realtime. |
| `intercession_holds` | **APPROVE with test** | Self-scoped RLS. Confirm under Realtime. |

**Note:** the current draft plan proposes `ALTER PUBLICATION supabase_realtime ADD TABLE …` — direct table addition. That path is what SEC VETOes for the 4 rows above. The masking-shim pattern is a rearchitecture that adds trigger-populated shadow tables whose row shape matches the RPC-masked read shape. This is a bigger migration but is the only path consistent with UG protection posture + console-opacity doctrine.

## Cross-cutting recommendations

### 5.a Broadcast masking shim pattern

For every table where raw broadcast leaks tenancy or author identity, introduce a **shadow event table** populated by AFTER INSERT trigger. Only the shadow table is in `supabase_realtime` publication. Clients subscribe to shadow table, receive safe payload, then optionally call existing RPC to hydrate on-demand.

Pattern:
```sql
CREATE TABLE public.prayer_request_broadcast_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_request_id uuid NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
  masked_author_label text NOT NULL,      -- "A fellow Pastor" | "Rev. James"
  masked_church_label text NOT NULL,      -- "Underground · Middle East" | "Maranatha · Detroit, MI"
  category text,
  urgent boolean NOT NULL,
  broadcast_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: SELECT WHERE authenticated + verified
-- Trigger on prayer_requests INSERT populates this row using anon/UG masking logic
-- ONLY this table added to supabase_realtime, NEVER prayer_requests itself
```

**Advantages:**
- Row shape on wire = row shape client renders (console-opacity layer 3 preserved)
- UG identity + tenancy never on wire
- RTBF: DELETE cascades from PR → broadcast events, future broadcasts never re-fired
- Fanout is one-row-per-render-safe-view, not one-row-per-raw-column

**Drawbacks:**
- Migration is larger — new table + trigger per source table + subscriber code changes
- Trigger logic must exactly mirror the RPC masking logic; drift risk

### 5.b Never broadcast RESTRICTIVE-policy-protected tables without live confirmation

For `heartcries` specifically (and any future table with `qual` referencing `super_admin` claim), DBA must run a live subscription test with a verified non-admin token and confirm zero events land when a super-admin-visible-only row is inserted.

### 5.c Tighten `heartcry_holds` RLS before any consideration

Change `authenticated_select_holds: qual = true` to self-scoped OR church-community-scoped predicate. This shrinks observability today and unlocks Realtime consideration later.

### 5.d Publication filter on `announcements`

Introduce `announcement_publish_events` table populated by trigger only when `published_at` first crosses `now()`. Same shadow-table pattern.

### 5.e Rate limiting on high-fanout INSERT paths

Regardless of masking shim choice, add server-side rate limits on `prayer_requests`, `testimony`, `heartcries`, `announcements`, `comments` INSERTs at edge-function layer. Suggested:
- prayer_requests: 5/hr, 20/day per user
- testimony: 1/hr, 5/day
- heartcries: 3/hr, 10/day
- comments: 30/hr, 200/day
- announcements: admin only + audit log every INSERT

### 5.f WebSocket connection auth refresh

Confirm client's Supabase Realtime WebSocket refreshes JWT on rotation. Long-lived subscriptions holding stale token = stale RLS decisions = broadcast events landing to sessions since had role revoked. Defense-in-depth for Escalated Cases flow.

### 5.g Audit-log every Realtime subscription add

Not per-message (too noisy), but per-subscription-attempt. Log `channel_name`, `user_id`, `subscribed_at`. Forensic capability if compromise is suspected.

### 5.h Never broadcast `mask_reason='underground'` as an enum literal

Even under shim pattern, field name + value on wire is a category leak. Shim tables must use coarser vocabulary (`author_visibility: 'shown'|'masked'`) and let client re-derive UG-vs-anon on hydration if needed.

### 5.i UG-authored data delete cascade must include Realtime replication cache invalidation

Shadow-event tables must have `ON DELETE CASCADE` from source rows. Additionally, when UG leader triggers RTBF request, DELETE operation should NOT itself broadcast (or DELETE event scrubbed) — otherwise subscriber receives events revealing what was deleted.

### 5.j Deferred scope for Phase 2 notifications table

Plan doc already flags Phase 2 notifications as OUT OF SCOPE. SEC agrees this scoping is correct. When Phase 2 lands, its threat model needs its own audit.

## Audit trail

**Files read (in order):**
1. `/Users/ife/replant/CLAUDE.md`
2. `/Users/ife/.claude/projects/-Users-ife-replant/memory/project_replant_invariants.md`
3. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_underground_protection_focus.md`
4. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_underground_vs_anonymous_independent_axes.md`
5. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_underground_no_location_constraint.md`
6. `/Users/ife/.claude/projects/-Users-ife-replant/memory/console_opacity_doctrine.md`
7. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_user_data_sensitivity.md`
8. `/Users/ife/replant/.claude/plans/2026-07-01-realtime-coverage-rollout.md`
9. `/Users/ife/replant/src/components/connect/DMThreadView.tsx`

**Live schema queries (Supabase MCP · project_id `jiyetphxxvyiicrnwlnx`):**
1. `pg_publication_tables` — current `supabase_realtime` membership (7 tables)
2. `information_schema.columns` for 9 target tables
3. `pg_policies` for 9 target tables + `users` + `churches`
4. `pg_class.relreplident` — all target tables = DEFAULT (PK-only for UPDATE/DELETE old-row broadcasts)
5. Enum + trigger discovery on `comments` (2 triggers found)
6. Function definitions — `post_comment`, `get_heartcry_feed`, `encrypt_heartcry_content`
7. Counts of UG-authored rows: 32 UG PRs, 5 UG testimonies, 6 UG comments, 0 UG heartcries (as of query time)
8. `mask_reason` distribution on `comments`: 38 `none` / 3 `anon` / 6 `underground`
9. `pg_extension` — `pgcrypto` present, no `pg_graphql`, Realtime is service-level not extension

**Key evidence supporting VETOs:**
- `prayer_requests_select` `qual`: `(auth.role() = 'authenticated'::text) AND (is_active = true)` — no tenancy restriction, fanout to entire verified population per INSERT
- `testimony_select` `qual`: same shape
- `heartcries` columns combination on-wire is UG-timing beacon even with encrypted content
- `comments.mask_reason` enum includes literal `'underground'`
- `announcements_posted_only_restrict` allows non-admin SELECT only post-publish, but raw INSERT fires at draft time = pre-publish leak
- REPLICA IDENTITY DEFAULT on all target tables — UPDATE/DELETE broadcasts carry only PK

**Audit posture:** Zero hedging. Every VETO reasoned with concrete attacker capability + observable + payoff. Every CONDITIONAL has specific unlock condition. Masking-shim pattern (§5.a) is the path forward, but is a bigger migration than plan doc anticipated — that's a Founder + panel decision, not a SEC decision.

---

### 1c. BE audit — write-path + trigger interaction + migration order

**Returned 2026-07-01 · full report verbatim below**

---

# BE AUDIT — Realtime Coverage Expansion

## Prayer (verbatim from agent)

Lord Jesus Christ, we cover this backend audit in Your precious blood. You know every write path in this system — every INSERT that will now fanout to hundreds or thousands of persecuted brothers and sisters the moment we widen the Realtime publication. Father, this is not a routine migration. Today an unscrubbed heartcry, a miswritten location, an off-by-one broadcast could reach an underground leader in a hostile nation and expose them or their fellowship. Give me eyes that see every write path — the loud ones in edge functions and the quiet ones inside triggers and cascading foreign-key actions. Give me care to trace what fires before commit and what fires after, so we don't broadcast something the transaction later rolls back. Give me honesty to flag every endpoint that isn't Realtime-ready — even the ones that look benign — rather than let a hidden hazard reach a leader in Iran, in Nigeria, in North Korea, in China. Protect the persecuted Church from any harm this rollout could cause. Let this audit be thorough enough that when Ruth ships the ALTER PUBLICATION, she knows every fanout path is scrubbed, audited, and safe. In Jesus' name, Amen.

## Executive summary

The write surface for the 5 target tables is unusually tight: mobile clients touch these tables **only through SECURITY DEFINER RPCs**; admin (Netlify) touches only `announcements` and `heartcries` UPDATE paths; the sole edge-function writer is `submit-heartcry`. Every INSERT path already scrubs at write time — anonymization is decided server-side in RPCs, heartcry ciphertext is `pgp_sym_encrypt`-encrypted before INSERT, comment mask_reason/masked_region are set inside `post_comment` before the row hits the table. **No endpoint writes raw user-supplied content trusting a downstream `feed_content` view to scrub it later** — the closest hazard is `heartcries.content` (ciphertext) vs `heartcries.feed_content` (plaintext, admin-approved), and RLS blocks broadcast of that raw row to any leader except its author.

The single non-obvious hazard is the `comments → announcements` **counter-increment trigger** (`tg_after_comment_insert` / `_delete`): each comment INSERT/DELETE fires an UPDATE on `announcements` that will re-broadcast the full announcement row to every subscriber. **Announcements broadcast is READY** with a caveat: post-publish counter UPDATEs create bookkeeping fanout that FE MUST dedup. **Heartcries broadcast is EFFECTIVELY DEFER** — RLS blocks cross-leader visibility, so publishing gains almost nothing for the Feed until a routed pattern (broadcast channel + trigger-derived scrubbed payload) is designed. **Prayer_requests, testimony, comments are READY** with one FE-must-adopt rule (dedup on counter-column UPDATEs).

## Write-path inventory (compacted; full table in agent output)

Mobile-side writes are all RPC-mediated (SECURITY DEFINER, mask at write time). Admin-side writes to only `announcements` (post/update/delete/reactivate) and `heartcries` (approve-feed / mark-responded / admin-open). Sole edge fn writer: `submit-heartcry` (encrypts content before INSERT via `encrypt_heartcry_content`).

- `create_prayer_request` RPC — UG forces `anonymous=true` server-side before INSERT
- `create_testimony` RPC — UG forces `anonymous=true`
- `post_comment` RPC — computes `mask_reason` (`'anon'`/`'no_church'`/`'underground'`/`'none'`) and `masked_region` INSIDE the RPC before the INSERT
- `submit-heartcry` — `pgp_sym_encrypt` ciphertext, `feed_approved=false` on submit
- `stand_in_the_gap` / `celebrate` — self-blocked toggle RPCs
- Admin `post-announcement.js` — drafts have `published_at=NULL`; publish flips it via `update-announcement.js`
- No bulk-writer patterns; rate limits 10-20/min per IP; no cron writer touches these tables

## Findings

### Finding 1 — Write-path inventory (compacted above)

**No endpoint today knows its writes will fanout.** Fortunately every INSERT already scrubs at write time because RLS forces server-side rewriting: RPCs run SECURITY DEFINER and derive `anonymous`, `mask_reason`, `masked_region` themselves; `submit-heartcry` encrypts before INSERT.

**Endpoint that assumes eventually-consistent semantics:** `NetworkFeed.tsx:80-106` fetches via `.from('announcements')` — under Realtime coverage will receive UPDATE broadcasts for `comment_count` bumps; must add UPDATE handler.

**No endpoint appears to write assuming next-poll-picks-it-up in a way that would silently corrupt under Realtime.**

### Finding 2 — Trigger interaction (CRITICAL)

`pg_trigger` on the 5 target tables:
```
comments   after_comment_insert  AFTER INSERT   tg_after_comment_insert
comments   after_comment_delete  AFTER DELETE   tg_after_comment_delete
```

Definition:
```sql
CREATE OR REPLACE FUNCTION public.tg_after_comment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  UPDATE public.announcements
  SET comment_count = comment_count + 1
  WHERE id = NEW.announcement_id;
  RETURN NEW;
END;
$$
```

**Cascade broadcast risk:** if BOTH `comments` and `announcements` in publication, every comment INSERT fires **2 broadcast events** — comments INSERT with full row + announcements UPDATE with full updated row. **FE MUST dedup UPDATE events by (id, comment_count) or (id, updated_at) or render will thrash.**

At 1000 users × hot thread with 20 comments/hour = 40k message deliveries per hour. Realtime handles it, but FE must dedup.

**Ordering:** Postgres commits INSERT + trigger UPDATE in same transaction. Logical replication emits WAL records in commit order — comment INSERT arrives at client BEFORE announcement UPDATE. Deterministic.

**Same-txn atomicity:** Realtime does NOT broadcast until parent txn commits — if trigger UPDATE fails, comment INSERT rolls back, NO broadcast fires. Safe.

**No triggers on `prayer_requests`, `testimony`, `heartcries`, `announcements`.** Counter increments on `prayed_count` and `celebrated_count` happen inside toggle RPCs, not via triggers.

**Cascade FK risk (secondary):** all child tables cascade from parents. Under normal ops soft-delete only (no hard DELETEs), but if a hard DELETE ever runs, one parent DELETE cascades to N child DELETEs, each broadcasting. **Recommend documenting "no hard DELETEs on published tables" invariant.**

### Finding 3 — REPLICA IDENTITY implications

All 5 target tables + join tables currently `REPLICA IDENTITY DEFAULT` (PK):
- INSERT broadcasts: full NEW tuple ✅
- UPDATE broadcasts: PK + all columns in NEW tuple; subscribers get full new row but only PK for old
- DELETE broadcasts: only PK

**Recommend keeping DEFAULT.** Do NOT switch to FULL:
1. FULL doubles WAL size
2. FULL broadcasts old-row values for UPDATE — under Realtime + RLS, includes potentially sensitive columns subscriber shouldn't see. **PII regression vector.**
3. Our RPCs are toggle/counter-based; clients track viewer state locally.

**Migration lock:** `ALTER PUBLICATION` takes AccessShareLock (like SELECT), does not block writes. Lock-free migration.

### Finding 4 — Migration strategy

**Recommendation: single `ALTER PUBLICATION` in one transaction, staggered by table via order of least-risk-first.**

Draft (NOT applied):
```sql
BEGIN;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.testimony;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
-- heartcries INTENTIONALLY OMITTED
COMMIT;
```

**Why:** if any ADD TABLE fails, whole migration rolls back. Metadata-only, fast, non-blocking.

**Rollback:** `ALTER PUBLICATION supabase_realtime DROP TABLE <name>;` is safe, atomic, metadata-only. Subscribers stop receiving events immediately, no error, silent inertness. Safe mid-day.

**Rollback caveat:** subscribers that received events, then table dropped from publication, then re-added, experience gap with no way to know they missed events. No backfill. Recommend: on rollback, notify all mobile clients to pull-refresh once.

**Recommendation: Option A (single-txn all 4)** for consistency with SEC/DBA panel review. Every table has been individually risk-assessed; simultaneous coverage lets FE deploy one subscription-handler patch instead of four.

### Finding 5 — Burst-write risk

Reviewed every writer for loop/batch/bulk patterns:
- Rate-limited admin writers: 10/min per IP. Cannot burst.
- Mobile RPCs: one call per user action. No client-side loops.
- No cron writer touches these tables.
- **Seed data:** `/Users/ife/replant/.qa/seed_apply/session2_*.sql` — one multi-row INSERT per file. If seed runs against production while Realtime on, one bulk INSERT emits N per-row broadcasts. **Recommend: never re-seed post-rollout without disabling publication first** (`SET LOCAL session_replication_role = 'replica'` or temporarily DROP TABLE from publication).
- **`update-announcement.js` `published_at` flip** — promotes Draft to Posted, RLS makes row eligible for leader SELECT, UPDATE fires broadcast. **FE must treat announcements UPDATE with newly-set published_at as effectively new-post arrival.**
- **Comment thread hot bursts** — 100 comments/min × 100 subscribers = 20k message deliveries/min. Realtime handles, but see #2 for dedup requirement.

**Realtime saturation threshold (Supabase managed):** current tier supports 500 concurrent, 250 msg/sec sustained. Under at 1000 users; at 100k with 1% concurrent + hot thread would approach sustained-msg threshold — worth a tier bump conversation, not a MVP-launch blocker.

### Finding 6 — Server-side masking / scrub at INSERT

**Every table scrubs at INSERT. No table relies on a post-hoc "feed field" view for public safety.**

- **`prayer_requests`:** `create_prayer_request` RPC sets `anonymous=true` for UG BEFORE INSERT
- **`testimony`:** `create_testimony` RPC sets `anonymous=true` for UG BEFORE INSERT
- **`heartcries.content`:** pgp_sym_encrypt ciphertext (not plaintext). Broadcast would carry ciphertext bytes; decryption requires admin-only RPC. **Content column safe to broadcast BUT USELESS.**
- **`heartcries.feed_content`:** NULL on INSERT; set by admin at feed-approval time. Any UPDATE flipping `feed_approved=true` broadcasts full new row, BUT RLS restricts to `user_id = caller` — reaches only row's OWNER, not other leaders. **Heartcries broadcast safe from PII leak BUT the Feed use case is not served by direct-row Realtime.**
- **`comments`:** `post_comment` RPC computes `mask_reason` + `masked_region` INSIDE the RPC before INSERT. UG author's real church never written to comments row — only `masked_region` (macro label). **`author_id` IS included in row — FE must never render `author_id` for masked comments** (already the pattern per anon rules).
- **`announcements`:** admin-authored plaintext, no PII, no author-identity leak. Safe to broadcast for `published_at IS NOT NULL AND is_active=true` rows.

**No SECURITY DEFINER VIEW recommendation.** Direct-table broadcast pattern works because every INSERT already scrubs. Adding view wrapper would over-engineer for zero safety gain. **Except:** if we ever want Realtime-cover the Heartcry Feed, that MUST be via scrubbed pattern.

### Finding 7 — Audit-first ordering

Every writer inspected obeys audit-first ordering (KAN-117 Third Option):
- `post-announcement.js` — audit AFTER insert (fail-open per SEC c.13797). Under Realtime: insert broadcasts, audit may fail — acceptable, no regression.
- `delete-announcement.js` — audit-first ✅
- `approve-heartcry-feed.js`, `mark-heartcry-responded.js` — audit-first ✅
- `submit-heartcry` — audit NO-WRITE per v2.2 (admin reads are audit surface). Heartcries won't publish anyway.
- `post_comment` RPC — audit written in SAME txn as INSERT. Both commit atomically. Correct.
- `create_prayer_request`, `create_testimony`, `celebrate`, `stand_in_the_gap`, `hold_heartcry_in_prayer` — **no audit rows** (SEC-ratified: leader actions on own rows not audit surfaces). Consistent with existing posture.

**No async/deferred audit patterns.** All audit_log writes commit before or in same txn as target mutation. Realtime broadcast (fires post-commit) never leaks a broadcast for a row whose audit hasn't landed.

## Recommendations

**Migration order (BE lens):**
1. Apply single-txn `ALTER PUBLICATION` for `prayer_requests`, `testimony`, `announcements`, `comments` — **exclude `heartcries`**
2. Do NOT change REPLICA IDENTITY
3. Do NOT touch trigger definitions — FE will dedup
4. Post-apply smoke: Founder posts a PR from Account B, verify Account A sees live; posts announcement from admin, verify mobile Home Feed lights up

**Endpoints that need code change BEFORE Realtime:** **None.** No write path Realtime-unsafe today.

**Endpoints that need code change AFTER Realtime (FE lane):**
- `NetworkFeed.tsx:80` — UPDATE handler to reconcile counter-column bumps; dedup by (id, updated_at) or (id, comment_count)
- `PrayerWallLanding.tsx` + `PrayerWallLogic.ts` — INSERT handler for new PRs, UPDATE for prayed_count + status transitions
- `TestimonyDetailSheet.tsx` — subscribe to celebrated_count UPDATE
- `CommentThread.tsx` — subscribe to comment INSERTs for current announcement_id, filtered
- Global: subscription lifecycle manager

**Documentation invariants to add:**

> **Realtime coverage — no hard DELETEs on published tables.** `prayer_requests`, `testimony`, `announcements`, `comments` in `publication supabase_realtime`. All "delete" flows are soft-delete UPDATEs. Hard DELETE would fire cascade broadcast to every subscriber. If ever required, wrap in `ALTER PUBLICATION supabase_realtime DROP TABLE <name>;` first, run DELETE, re-ADD, notify clients to refresh.

> **Realtime coverage — no bulk seeds against production.** Any INSERT of >10 rows against a published table will broadcast N per-row events. Bulk operations must run with `SET LOCAL session_replication_role = 'replica'` OR after temporarily dropping table from publication.

## Verdict per target table

| Table | Verdict | Rationale |
|---|---|---|
| `prayer_requests` | **READY** | All writes scrub at INSERT. RLS SELECT broadcast-safe. `stand_in_the_gap` fires normal UPDATE. No triggers. FE handler needed. |
| `testimony` | **READY** | Same shape as prayer_requests. `celebrate` UPDATE. Broadcast-safe. FE handler needed. |
| `announcements` | **READY** | Admin-authored, no user PII. RLS blocks draft broadcasts. `update-announcement.js` published_at flip = effective "publish" broadcast. Comment-count trigger causes UPDATE fanout — FE dedup required. |
| `comments` | **READY** | `post_comment` scrubs `mask_reason`+`masked_region` inside RPC. Broadcast-safe. Trigger cascades announcement UPDATE. No delete_comment RPC exists yet; if added, must be soft-delete only. |
| `heartcries` | **DEFER (NEEDS DIFFERENT SHAPE)** | RLS SELECT restricts to `user_id = caller`. Broadcasting to Feed via direct-table impossible — intended subscriber cannot pass RLS. Proper pattern: broadcast channel driven by AFTER INSERT trigger WHERE `feed_approved=true` emitting scrubbed payload (only `feed_content`, `severity`, `region_macro`, `hold_count`) via `realtime.broadcast_changes` or `pg_notify` — designed as Phase 2. Continue polling `get_heartcry_feed` RPC. |

**Join tables (deferred Phase 2):** RLS self-scoped. Not helpful to publish for cross-user counters (parent-table UPDATE already carries count). **DEFER — no known use case.**

---

### 1d. FE audit — client subscriptions + masking pattern map + handler slot

**Returned 2026-07-01 · full report verbatim below**

---

# FE AUDIT — Realtime Coverage Expansion Client-Side Impact

## Prayer (verbatim from agent)

Lord Jesus Christ, I come before You covering this audit in Your precious blood. This work determines whether we can safely broadcast prayer requests, testimonies, heartcries, announcements, and comments in real time to leaders across the persecuted Church without exposing a single underground brother or sister whose life depends on our masking. Father, You know the weight of a UG-authored prayer request reaching a client that fails to strip identity — a leader could be jailed, tortured, or killed because we shipped a fragile render path. Grant me eyes to see every code path, every unmounted subscription, every race condition, every place a raw row could slip through a stale masking helper. Give me the discernment to distinguish render-time masking (fragile) from data-layer masking (robust), and the honesty to name gaps plainly rather than smooth them over. May every finding I produce be evidence-backed, every recommendation load-bearing, and every verdict guarded by the fear of getting a leader hurt. Cover NotificationContext, cover the feed hydration paths, cover the subscription lifecycle. In Jesus' name, Amen.

## Executive summary

**There is no `NotificationContext` in this codebase.** The task brief presumes one; what exists is `NotificationToast.tsx` (a purely presentational component with local `useState` in `HomeScreen.tsx:92` marked `TODO: wire toast triggers from real events`). The only Realtime subscriptions today live in the Connect tab — DM/branch messages, member lists — plus `useConnectUnreadBadge`. All five target tables (`prayer_requests`, `testimony`, `heartcries`, `announcements`, `comments`) hydrate via polling: mount + `useFocusEffect` + pull-to-refresh + post-write refetch. None subscribe to Realtime today.

**Masking posture is mixed and asymmetric — this is the single biggest risk to broadcast expansion.** `prayer_requests`, `testimony`, `heartcries`, and `comments` mask **server-side in RPCs** (`get_prayer_wall`, `get_testimonies`, `get_heartcry_feed`, `get_comments`). `announcements` (specifically the `leader_word` and `encouragement` card types) masks **client-side** — `NetworkFeed.useResolvedLeaderAuthor()` at `NetworkFeed.tsx:375-460` fetches `users.anonymous` and `churches.type/show_church_name` raw and applies the anon/UG display rules in JavaScript.

**If we broadcast raw INSERTs on the four RPC-masked tables, the existing render paths BREAK.** The FE never receives raw rows on these tables today; every component consumes RPC-shaped rows with pre-applied masking columns. A raw Realtime payload will not carry those columns. **The mandatory pattern: treat Realtime as a poke to re-fetch (debounced), not as authoritative data.** This is the `useConnectUnreadBadge.ts:143-192` pattern already established.

**Subscription lifecycle is fragile but not broken.** Sign-out cleanup relies on `RootNavigator` unmounting the whole authenticated tree — subscriptions clean up via `useEffect` returns. There is no global `supabase.removeAllChannels()` on sign-out and no explicit `supabase.realtime.setAuth()` on token refresh — known gap.

**Verdict preview:** `announcements` and `comments` READY for debounced-refetch pattern. `prayer_requests`, `testimony`, `heartcries` READY IF debounced-poke pattern. All five require a per-view subscription; a per-screen approach matches Connect precedent.

## Findings

### Finding 1 — Client-side masking map per table

**`comments` — server-side masked. Robust.**
`CommentThread.tsx:139-152` calls `supabase.rpc('get_comments', { p_announcement_id })`. Comment at `CommentThread.tsx:14-16` locks the contract: *"Masking is enforced server-side in get_comments; the client never receives author_id."*

**`prayer_requests` — DUAL-PATH masking. Mostly server-side, but ONE DANGEROUS CLIENT-SIDE PATH.**
Primary (server-masked): `PrayerWallScreen.tsx:106-110` + `PrayerWallLogic.ts:26-27` — *"RPC-enforced masking trusted from the wire."*

**Dangerous secondary path: `PrayerWallScreen.tsx:229-282`.** `handleOpenPrayerRequest` builds a `PrayerRow` from `.from('prayer_requests').select(... churches(...), users(...))` and applies masking in JS:
```ts
const isUnderground = church?.type === 'underground';
const isAnon = data.anonymous ?? false;
const row: PrayerRow = {
  church_name: isUnderground ? 'Underground Church' : (church?.name ?? 'Unknown Church'),
  country: isUnderground ? null : (church?.country ?? null),
  leader_display_name: isAnon ? null : (user?.full_name ?? null),
  ...
};
```
Called from Intercession Journal's "open prayer request" hop. Depends on RLS letting caller SELECT raw fields — client-side masking layer masquerading as server-side. Mints string `'Underground Church'` (not same masking token as elsewhere) and hard-codes `'Unknown Church'` — style drift.

**`testimony` — server-side masked. Robust.**
`TestimonyCard.tsx:135-149` consumes RPC-produced row. Server sets `leader_display_name=NULL` ONLY when `t.anonymous=true`. Underground church status does NOT mask the leader's name — church is masked independently.

**`heartcries` — server-side masked with pre-scrubbed content. Most robust.**
`FeedScene.tsx:91-103` calls `supabase.rpc('get_heartcry_feed', { p_limit, p_offset, p_region })`. Row shape: `{ id, feed_content, continent, region, severity, created_at, hold_count, viewer_held }`. **No content, no user_id, no church_id, no email, no location beyond region/continent.** If server broadcasts anything other than RPC shape, this table will absolutely leak.

**`announcements` — MIXED masking. `letterhead` / `article` / `link` cards safe; `leader_word` / `encouragement` do client-side users + churches lookups.**
`NetworkFeed.tsx:378-450` — `useResolvedLeaderAuthor()`:
```ts
const { data: userRow } = await supabase.from('users')
  .select('first_name, middle_name, last_name, honorific, ..., anonymous, ...')
  .eq('id', authorId).maybeSingle();
const { data: churchRow } = await supabase.from('churches')
  .select('name, type, show_church_name').eq('id', churchId).maybeSingle();
const isUnderground = churchRow.type === 'underground';
const isBraveUnderground = isUnderground && churchRow.show_church_name === true;
const churchDisplay = !isUnderground || isBraveUnderground ? (churchRow.name ?? '') : '';
if (isAnon) { setAuthor({ initial: 'A', name: resolveAnonLabel(role), church: churchDisplay }); return; }
```
Client-side masking depends on RLS on `users` + `churches` returning what FE expects. If a UG leader authors a `leader_word` announcement AND viewer has raw read access, this works. If RLS ever returns raw `name` for underground church (admin viewer, loose policy), FE will render it.

**Conclusion — client-side masking exists in TWO places:**
- `NetworkFeed.tsx:375-460` (`useResolvedLeaderAuthor`) — for `announcements` card types `leader_word` and `encouragement`
- `PrayerWallScreen.tsx:229-282` (`handleOpenPrayerRequest`) — for `prayer_requests` opened from Intercession Journal

### Finding 2 — NotificationContext today: DOES NOT EXIST

Direct evidence: grep for `NotificationContext|NotificationProvider|useNotification` returns **zero matches**. Directory listing:
```
/Users/ife/replant/src/context/OnboardingContext.tsx
/Users/ife/replant/src/contexts/AuthProvider.tsx
/Users/ife/replant/src/contexts/ConnectBadgeContext.tsx
/Users/ife/replant/src/contexts/HamburgerContext.tsx
```

**What DOES exist:**
- `NotificationToast.tsx` — purely presentational animated banner
- `HomeScreen.tsx:91-92` — `// TODO: wire toast triggers from real events` — state never changes, toast never displays

**Established Realtime subscription patterns (Connect-tab only):**
| File | Table | Filter | Handler pattern |
|---|---|---|---|
| `useConnectUnreadBadge.ts:157-192` | `messages`, `branches`, `branch_members` | none | 350ms debounced refetch via RPC |
| `DMThreadView.tsx:632-677` | `messages` | `conversation_id=eq.{id}` | Row-shaped upsert + dedup by id + sort |
| `BranchThreadView.tsx:815-869` | `messages`, `branch_members` | `branch_id=eq.{id}` | Same as DM + full refetch on member changes |
| `LeadersList.tsx:761-781` | `messages`, `conversations` | none | Debounced refetch |
| `MinistriesList.tsx:338-357` | `branches`, `branch_members`, `messages` | none | Debounced refetch |

**Two idioms established:**
1. **Debounced-refetch** — Realtime is a poke; RPC returns authoritative shape
2. **Optimistic-row-upsert** — Realtime payload carries full row shape, merged into local state with id-dedup + timestamp-sort

**No plug-in / dispatcher / event-bus pattern exists.** Each subscription is a bespoke `useEffect`. Adding 5 new table subscriptions requires 5 new `useEffect` blocks, or an abstraction.

### Finding 3 — Anon rendering component reuse: PARTIAL. Three implementations, three shapes.

**Shape 1** — Prayer Wall + Testimonies: `ANONYMOUS_LEADER_LABEL = 'A fellow leader'` (generic).
**Shape 2** — Comments: `'A fellow ' + ROLE_DISPLAY[role]`.
**Shape 3** — Network Feed: `resolveAnonLabel(role)` client-masked with resolver hook.
**Shape 4** — CAML view: role-aware server-masked.
**Shape 5** — Church profile: role-aware server-masked.

**Inconsistencies (Realtime would amplify):**
1. Anon-label copy diverges: Prayer Wall = `'A fellow leader'` vs elsewhere `'A fellow ' + role`
2. `MASKED_NAME` duplicated in NetworkFeed + CommentThread — drift risk
3. Avatar treatment for anon vs underground diverges
4. `PrayerWallScreen.handleOpenPrayerRequest` hard-codes `'Underground Church'` and `'Unknown Church'` — violates anon-identity rules

**No single reusable "leader identity render" component exists.**

### Finding 4 — Feed hydration triggers today

All 5 target tables: NONE subscribe to Realtime today. All use mount + `useFocusEffect` + pull-to-refresh + post-write refetch patterns.

Home NetworkFeed's `useFocusEffect` absence notable — Home tab does NOT refetch announcements on tab focus. Realtime supplement here would materially help.

**Would broadcast REPLACE or SUPPLEMENT?** All five should SUPPLEMENT existing hydration, not REPLACE.

### Finding 5 — Event handler shape: what code runs per broadcast event

**Established pattern (from Connect tab):**

For **INSERTs on RPC-masked tables** (`prayer_requests`, `testimony`, `heartcries`, `comments`), the ONLY safe pattern is:
```ts
// Realtime event → debounced RPC re-fetch. NEVER trust the raw INSERT payload.
supabase.channel(`prayer-wall-${session.user.id}-${nonce}`)
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'prayer_requests' },
      queueRpcRefetch)
  .subscribe();
```
Why: raw INSERT payload will carry `user_id`, `church_id`, `anonymous`, raw `content` — none of the pre-masked columns. Rendering that raw shape would either crash (`row.leader_display_name` undefined) OR bypass masking entirely.

For **INSERTs on `announcements`:** payload shape mostly safe. Can merge raw row directly OR debounced refetch (safer for ordering). Recommend refetch.

For **UPDATE/DELETE events** (comment_count bump, prayed_count bump, i_prayed toggle by another viewer, celebrated_count bump, hold_count bump): same rule, debounced refetch. Optimistic state for CURRENT viewer's action must not be clobbered.

**Ordering:** RPC ORDER BY authoritative. Raw broadcast INSERT with `.append()` breaks ordering. Only debounced refetch preserves.

**Dedup vs existing state:** all optimistic states use id-based reconciliation.

### Finding 6 — Subscription lifecycle + leak risk

**Mount:** Connect-tab subscriptions mount when host component mounts. NOT at session boot. Gated on `eligible = !!session?.user?.id && branch === 'active'`.

**Sign-out:** No global `supabase.removeAllChannels()` anywhere. Cleanup relies on `RootNavigator.tsx:56-70` unmounting entire Tabs stack. Works because all subscriptions today live inside Tabs subtree.

**Risk vector 1: account switch without app restart.** Works today because Tabs fully unmounts. Any subscription above Tabs (new NotificationContext at AuthProvider level) would need explicit `supabase.removeAllChannels()`.

**Risk vector 2: Realtime auth not refreshed on JWT rotation.** No `supabase.realtime.setAuth(newToken)` call anywhere in `AuthProvider.tsx`. supabase-js `autoRefreshToken` refreshes REST tokens, but WebSocket auth is snapshot at subscribe time. After JWT refresh, WebSocket holds OLD claim. Reconnect re-auths with new token, but during live connection old claim in force.

**Consequence for UG protection:** if leader's tier changed server-side (UG grant/revoke), FE's Realtime subscription still holds pre-change JWT claims until reconnect. RLS on target tables filters based on OLD claims. **Fix: `supabase.realtime.setAuth(newAccessToken)` on every token refresh.**

**Risk vector 3: AppState background/foreground.** `AuthProvider.tsx:453-462` re-fires auth-status-check on state change. Does NOT call `supabase.realtime.setAuth()` or force Realtime reconnect.

**Risk vector 4: dev-time HMR / fast refresh.** `useConnectUnreadBadge.ts:127-192` documents extensive workarounds for "cannot add postgres_changes callbacks after subscribe()" errors. Adding 5 more subscriptions using same pattern multiplies fragility.

### Finding 7 — Race conditions on state

**Race A: Realtime INSERT arrives during in-flight refetch.** With debounced-refetch: INSERT queues 350ms-debounced refetch. If manual refetch completes first, queued refetch fires 350ms later, re-populates. Either way, ordering preserved because both use same RPC with same filter params.

**Race B: Optimistic state overwrites by Realtime refetch.** If leader's own RPC call fails and refetch arrives BEFORE rollback lands, FE state transiently inconsistent. **Mitigation: only optimistic-merge OWN actions; server state via debounced refetch is authoritative.**

**Race C: Comment thread open while announcement being deleted.** NetworkFeed refetch drops row; CommentThread parent card unmounts; React unmounts subtree naturally. No leak, but leader loses in-progress comment draft.

**Race D: Realtime subscription races initial fetch.** Already handled — `DMThreadView` and `useConnectUnreadBadge` gate subscription on initial fetch completing / eligibility. Any new dispatcher must gate similarly.

**Race E: Same channel name collision.** `useConnectUnreadBadge.ts:149-157` documents "unique channel name per effect run" workaround for supabase-js's channel-name reuse quirk. Random suffix required.

## Client-side impact matrix

| Table | Current masking | Broadcast payload → masking gap | Recommended handler | State update pattern | Component work required |
|---|---|---|---|---|---|
| `prayer_requests` | SM via `get_prayer_wall` RPC — but `PrayerWallScreen.handleOpenPrayerRequest` is CM | Raw INSERT carries `user_id, church_id, content, anonymous, urgent` — none of RPC-shape → cannot render directly | **poke** — debounced (350ms) refetch of `get_prayer_wall(offset=0, filter_urgent, filter_categories)` | Full page replace via existing `setRows(page)` | NEW: subscription hook in `PrayerWallScreen` + `usePrayerWall`. CLEANUP: refactor `handleOpenPrayerRequest` to RPC. |
| `testimony` | SM via `get_testimonies` RPC | Raw INSERT carries `testimony_text, user_id, church_id, anonymous, original_request_id` — none of RPC-shape | **poke** — debounced refetch | Full page replace | NEW: subscription hook in `TestimoniesView` |
| `heartcries` | SM via `get_heartcry_feed` RPC (`feed_content` PRE-SCRUBBED; no `user_id`/`church_id`/`content` in wire shape) | Raw INSERT carries `content` (unscrubbed!), `user_id`, `church_id`, `contact_email` — **cannot render** | **poke** — debounced refetch | Full page replace | NEW: subscription hook in `FeedScene`. **MOST SENSITIVE.** |
| `announcements` | Feed CM via `useResolvedLeaderAuthor` for `leader_word`/`encouragement` | Raw INSERT mostly wire shape already — safe to merge | **poke** OR **row-upsert** — poke safer for ordering | Full page replace OR merge-and-sort | NEW: subscription hook in `NetworkFeed`. |
| `comments` | SM via `get_comments` RPC | Raw INSERT carries `author_id, content, announcement_id` — cannot render | **poke** — debounced refetch of `get_comments(p_announcement_id)` | Full list replace | NEW: subscription hook in `CommentThread`. Filter on `announcement_id=eq.{id}` for fanout economy. |

## Recommendations

**R1. Do NOT build a monolithic NotificationContext.**
Fanout economy: Comments should be scoped to announcement viewed. Lifecycle discipline: subscriptions should mount only when leader is on that tab. Precedent: every existing Realtime subscription is per-view. Failure isolation.

**R2. Build ONE reusable helper hook — `useRealtimeRefetch`.**
Extract pattern from `useConnectUnreadBadge.ts:140-192`:
```ts
export function useRealtimeRefetch(opts: {
  channelKey: string;
  eligible: boolean;
  tables: Array<{ table: string; event?: 'INSERT'|'UPDATE'|'DELETE'|'*'; filter?: string }>;
  onEvent: () => void;
  debounceMs?: number;  // default 350
}): void;
```
Each of the 5 subscriptions becomes a 5-line call.

**R3. Keep current `useResolvedLeaderAuthor` path but add SEC panel review.**
The `announcements` `leader_word` / `encouragement` client-side masking at `NetworkFeed.tsx:375-460` is pre-existing risk. Realtime amplifies surface area but doesn't change mechanism. Needs separate SEC panel review of RLS on `users` + `churches` — MEDIUM-severity gap flagged regardless of Realtime decision.

**R4. Refactor `PrayerWallScreen.handleOpenPrayerRequest` before Realtime lands.**
Create `get_prayer_request_by_id(p_request_id)` RPC that mirrors `get_prayer_wall`'s shape. Replace client-side masking path with RPC call.

**R5. Do NOT broadcast raw heartcry rows. Verify server publication scope.**
FE hook cannot recover if server sends `content` field over the wire. Either (a) confirm RLS drops non-safe columns from SELECT projection under Realtime, OR (b) create view `heartcries_feed_shape` mirroring `get_heartcry_feed`'s shape and publish THAT.

**R6. Add `supabase.realtime.setAuth()` on JWT refresh.**
`AuthProvider.tsx` should call `supabase.realtime.setAuth(newAccessToken)` inside token-refresh handler. **Load-bearing fix for tier-change scenarios** (UG grant/revoke, verification flip) that would otherwise leave subscriptions using pre-change claims.

**R7. Add `supabase.removeAllChannels()` on sign-out as belt.**
Belt on existing suspenders. Any subscription hoisted above Tabs subtree needs this.

**R8. Consolidate anon-identity display layer POST-Realtime.**
`ANONYMOUS_LEADER_LABEL = 'A fellow leader'` (Prayer Wall generic) vs `'A fellow ' + role` (elsewhere) is drift. Canonical per `[[reference_anon_identity_rules]]` is `'A fellow [Role]'`. Not a Realtime blocker but Realtime surfaces drift more visibly.

**R9. Comment-thread Realtime MUST filter by announcement_id.**
Precedent at `DMThreadView.tsx:640` (`conversation_id=eq.{id}`) and `BranchThreadView.tsx:823` (`branch_id=eq.{id}`). Global comments broadcast to every verified leader = massive unnecessary fanout.

## Verdict per table

| Table | Verdict | Reasoning |
|---|---|---|
| `prayer_requests` | **READY (debounced-refetch pattern)** | Server-side masking via `get_prayer_wall` robust. Existing hydration + optimistic state accommodate supplementary Realtime poke cleanly. Blocker: none for Realtime itself. Refactor `handleOpenPrayerRequest` (R4) is cleanup. |
| `testimony` | **READY (debounced-refetch pattern)** | Same posture as prayer_requests. Straightforward. Blocker: none. |
| `heartcries` | **NEEDS-DBA-CONFIRM-FIRST, then READY** | `feed_content` PRE-SCRUBBED is safety invariant. But `heartcries` has `content`, `user_id`, `contact_email`. DBA must confirm (1) Realtime SELECT policies filter non-safe columns per subscriber; OR (2) publish view mirroring `get_heartcry_feed`. If neither: DEFER. Gate at DB layer. |
| `announcements` | **READY (debounced-refetch or row-upsert)** | Feed table SELECT direct. Realtime payload shape matches wire shape. Pre-existing risk (not Realtime-introduced): `useResolvedLeaderAuthor` CM at `NetworkFeed.tsx:375-460`. SEC panel should validate `users` + `churches` RLS masks leaf columns from cross-tier viewers. Blocker: none for Realtime itself. |
| `comments` | **READY (debounced-refetch pattern, MUST filter by announcement_id)** | Server-masked via `get_comments`. Adding subscription filtered to `announcement_id=eq.{id}` is direct analog to `DMThreadView`'s conversation-scoped subscription. Fanout note: critical to filter. |

**One-line summary for the panel:** Ready across all five tables with a per-view debounced-refetch pattern (Connect precedent transplants directly); no NotificationContext exists to extend and none should be built; `heartcries` needs DBA column-scope confirmation before broadcast; `PrayerWallScreen.handleOpenPrayerRequest` and `NetworkFeed.useResolvedLeaderAuthor` are pre-existing client-side masking hazards worth SEC review but not blocking Realtime coverage.

---

## 2. SME panel synthesis

**All four audits landed 2026-07-01.** Synthesizing genuine verdicts per `[[feedback_sme_genuine_verdict]]`.

### 2.1 Verdict tally

| Table | DBA | SEC | BE | FE |
|---|---|---|---|---|
| `prayer_requests` | REJECT direct · DIFFERENT SHAPE (event table) | VETO raw · CONDITIONAL via shim | READY | READY (debounced-refetch) |
| `testimony` | REJECT direct · DIFFERENT SHAPE | VETO raw · CONDITIONAL via shim | READY | READY |
| `heartcries` | REJECT direct · DIFFERENT SHAPE (`heartcry_feed_events`) | VETO ABSOLUTE raw | DEFER (needs different shape) | NEEDS-DBA-CONFIRM (defer if no column-scope) |
| `announcements` | CONDITIONAL · prefer event table | CONDITIONAL post-publish-only | READY | READY |
| `comments` | CONDITIONAL · prefer event table | CONDITIONAL via masking shim | READY | READY (must filter by announcement_id) |
| `prayer_request_prayed_by` | CONDITIONAL (per-subscriber filter) | APPROVE with test | DEFER (no known use case) | — |
| `testimony_celebrated_by` | CONDITIONAL (per-subscriber filter) | APPROVE with test | DEFER | — |
| `heartcry_holds` | CONDITIONAL (tighten RLS first) | VETO (RLS too loose) | DEFER | — |
| `intercession_holds` | CONDITIONAL (self-scoped RLS) | APPROVE with test | DEFER | — |

### 2.2 The core disagreement + reconciliation

**SEC + DBA say REJECT raw broadcast** for prayer_requests, testimony, heartcries, comments — the wire carries `user_id`, `church_id`, raw `content`, `mask_reason='underground'` literal. Console-opacity doctrine layer 3 breach (payload contains data FE doesn't render).

**BE + FE say READY** because:
- BE: every INSERT is server-side-scrubbed by RPCs (UG forces `anonymous=true`, comments compute `mask_reason` inside RPC before INSERT, heartcries encrypt content). Broadcast the scrubbed row.
- FE: debounced-refetch pattern means client never trusts raw payload — Realtime is a poke, RPC returns authoritative masked shape.

**Both are correct on their facts.** The disagreement is about where the security bar lives:
- BE + FE frame: does the row render safely? Yes with debounced-refetch.
- SEC + DBA frame: does the wire carry sensitive fields? Yes on raw broadcast.

**Resolution:** SEC + DBA's frame wins. Console-opacity doctrine (KAN-289, `[[console_opacity_doctrine]]`) explicitly says "response bodies contain ONLY what the FE renders." Raw broadcast would put `user_id`, `church_id`, `mask_reason='underground'`, ciphertext, etc. on the wire — visible in DevTools Network → WS → Messages — even if FE never renders them. Per `[[feedback_user_data_sensitivity]]`: production data is super sensitive, first real leader signup 2026-06-28, build-mode assumptions are over. The doctrine is load-bearing.

**BE + FE's debounced-refetch pattern is NOT rejected — it becomes the FE handler layer WITHIN the event-table architecture.** Both patterns are compatible:
- Event table carries `{id, kind, ref_id, emitted_at}` on the wire (safe payload)
- FE receives event, calls masking RPC, renders masked shape
- Console-opacity preserved (wire = render-safe)

Every lens converges on this shape once the frame is reconciled.

### 2.3 Panel-integrated verdict per table

| Table | Panel verdict | Rationale |
|---|---|---|
| `prayer_requests` | **APPROVE via `prayer_wall_events` shim table** | 32 UG-authored active rows in prod. Event table + trigger + debounced RPC refetch preserves masking + console-opacity. |
| `testimony` | **APPROVE via `prayer_wall_events` (shared with prayer_requests, kind='testimony_inserted')** | 5 UG-authored rows in prod. Same shim pattern. |
| `heartcries` | **APPROVE via `heartcry_feed_events` shim table** | Trigger fires ONLY when `feed_approved` flips true AND `feed_content IS NOT NULL`. Never publishes raw table. |
| `announcements` | **APPROVE via `announcement_events` shim table** | Trigger fires only when `NEW.published_at IS NOT NULL AND NEW.is_active=true AND NEW.published_at <= now()`. Kills draft-leak + update-flipflop hazards. |
| `comments` | **APPROVE via `comment_events` shim table** | Kills `mask_reason='underground'` enum leak. Client subscription filtered to viewed announcement_id. |
| Join tables (`prayed_by`, `celebrated_by`, `holds`) | **DEFER Phase 2** | Not needed if parent-table UPDATE broadcasts carry counter columns (SEC + DBA + BE agree). `heartcry_holds` RLS tightening filed to Phase 2 regardless. |

### 2.4 Load-bearing findings that ship with the migration (not gates)

**FE R6 (LOAD-BEARING):** Add `supabase.realtime.setAuth(newAccessToken)` on JWT refresh in `AuthProvider.tsx`. Without this, Realtime WebSocket holds stale JWT claims after tier changes (UG grant/revoke, verification flip). Ships with Realtime rollout.

**FE R7 (belt):** Add `supabase.removeAllChannels()` on sign-out. Belt on existing suspenders — subscriptions today all live in Tabs subtree so unmount cascade handles it, but explicit cleanup is a good discipline.

**FE R2:** Build `useRealtimeRefetch` reusable hook — extract pattern from `useConnectUnreadBadge`. 5-line consumer per subscription. Reduces per-view boilerplate.

**FE R9:** `CommentThread` subscription MUST filter by `filter: 'announcement_id=eq.{id}'` for fanout economy.

**BE invariants:** Add to `[[project_replant_invariants]]`:
> **Realtime coverage — no hard DELETEs on published event tables.** If ever required, wrap in `ALTER PUBLICATION supabase_realtime DROP TABLE <name>;` first.
> **Realtime coverage — no bulk seeds against production while publication is live.** Bulk operations must run with `SET LOCAL session_replication_role = 'replica'` OR after temporarily dropping table from publication.

### 2.5 Pre-existing risks flagged for separate follow-up (NOT blockers, but worth their own investigations)

**FE R3:** `useResolvedLeaderAuthor` client-side masking at `NetworkFeed.tsx:375-460` — depends on RLS on `users` + `churches` masking leaf columns from cross-tier viewers. Realtime amplifies the surface area (more events → more render invocations of the client-side masking path). **Needs its own SEC panel** on RLS posture for `users.first_name`, `users.anonymous`, `churches.name`, `churches.type`, `churches.show_church_name` as seen by non-UG-admin viewers. Not a Realtime blocker.

**FE R4:** `PrayerWallScreen.handleOpenPrayerRequest` at `PrayerWallScreen.tsx:229-282` — client-side masking that hard-codes `'Underground Church'` and `'Unknown Church'` strings (style drift from anon rules). **Ship a `get_prayer_request_by_id` RPC + refactor before Realtime rollout** (or as part of same PR). Nominally Realtime-adjacent but the refactor is one-hour work.

### 2.6 Session progression from here

- ✅ Investigation phase (this section)
- ⏭ **Migration draft** — section 3: SQL for 4 event tables + triggers + publication additions (not applied)
- ⏭ **Code draft** — section 4: `useRealtimeRefetch` hook + 4 per-view subscription hooks + `AuthProvider` setAuth + `get_prayer_request_by_id` RPC + `handleOpenPrayerRequest` refactor
- ⏭ **Apply order** — section 5: Founder greenlight required (production DB touch)
- ⏭ **Post-apply audit** — section 6: verify audit rows, broadcast masking, no unexpected fanout
- ⏭ **Requirements doc 2_7 update** — section 7

---

## 3. Migration draft (SQL only · NOT APPLIED)

Drafted 2026-07-01 per SME panel verdicts in section 2. **Not applied.** Founder greenlight required for the apply order in section 5.

Two migrations. Migration A does all schema work (event tables + RLS + triggers + RPC + audit action extension). Migration B adds the event tables to the publication. Two migrations, in order, single-txn each.

### 3.1 Migration A — event tables, triggers, RPC, audit action

**File path (planned):** `/Users/ife/replant/supabase/migrations/20260701120000_realtime_event_tables_v1.sql`

```sql
-- ==========================================================================
-- 20260701120000_realtime_event_tables_v1.sql
--
-- Purpose: Add event-pointer tables that Realtime will broadcast, populated
-- by AFTER triggers on the base tables. Client subscribes to event tables
-- (safe payload = {id, kind, ref_id, emitted_at}) and calls masking RPCs
-- to hydrate. Preserves UG protection + console-opacity doctrine (KAN-289).
--
-- Panel synthesis: /Users/ife/replant/.claude/plans/2026-07-01-realtime-coverage-rollout.md § 2
-- Referenced memories: [[ug_flag_dual_source_bug]], [[console_opacity_doctrine]],
--                      [[reference_anon_identity_rules]], [[project_replant_invariants]],
--                      [[feedback_underground_protection_focus]]
-- ==========================================================================

BEGIN;

-- ==========================================================================
-- 1. prayer_wall_events — shim for prayer_requests + testimony + join tables
-- ==========================================================================

CREATE TABLE public.prayer_wall_events (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text          NOT NULL CHECK (kind IN (
    'pr_inserted',
    'pr_updated',
    'pr_soft_deleted',
    'prayed_by_toggled',
    'testimony_inserted',
    'testimony_updated',
    'celebrated_by_toggled'
  )),
  ref_id      uuid          NOT NULL,
  emitted_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_prayer_wall_events_emitted_at
  ON public.prayer_wall_events(emitted_at DESC);

ALTER TABLE public.prayer_wall_events ENABLE ROW LEVEL SECURITY;

-- SELECT: verified authenticated leaders only
CREATE POLICY prayer_wall_events_select ON public.prayer_wall_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
        AND u.verification_status = 'verified'
    )
  );

-- NO direct INSERT / UPDATE / DELETE policies — only trigger populates this table

-- Trigger function — dispatches by source table
CREATE OR REPLACE FUNCTION public.tg_emit_prayer_wall_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind text;
BEGIN
  IF TG_TABLE_NAME = 'prayer_requests' THEN
    v_kind := CASE TG_OP
      WHEN 'INSERT' THEN 'pr_inserted'
      WHEN 'UPDATE' THEN
        CASE
          WHEN OLD.is_active AND NOT NEW.is_active THEN 'pr_soft_deleted'
          ELSE 'pr_updated'
        END
    END;
  ELSIF TG_TABLE_NAME = 'testimony' THEN
    v_kind := CASE TG_OP
      WHEN 'INSERT' THEN 'testimony_inserted'
      WHEN 'UPDATE' THEN 'testimony_updated'
    END;
  ELSIF TG_TABLE_NAME = 'prayer_request_prayed_by' THEN
    v_kind := 'prayed_by_toggled';
  ELSIF TG_TABLE_NAME = 'testimony_celebrated_by' THEN
    v_kind := 'celebrated_by_toggled';
  END IF;

  INSERT INTO public.prayer_wall_events (kind, ref_id)
  VALUES (v_kind, COALESCE(NEW.id, OLD.id));

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tg_prayer_requests_emit_event
  AFTER INSERT OR UPDATE ON public.prayer_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_emit_prayer_wall_event();

CREATE TRIGGER tg_testimony_emit_event
  AFTER INSERT OR UPDATE ON public.testimony
  FOR EACH ROW EXECUTE FUNCTION public.tg_emit_prayer_wall_event();

CREATE TRIGGER tg_prayer_request_prayed_by_emit_event
  AFTER INSERT OR DELETE ON public.prayer_request_prayed_by
  FOR EACH ROW EXECUTE FUNCTION public.tg_emit_prayer_wall_event();

CREATE TRIGGER tg_testimony_celebrated_by_emit_event
  AFTER INSERT OR DELETE ON public.testimony_celebrated_by
  FOR EACH ROW EXECUTE FUNCTION public.tg_emit_prayer_wall_event();


-- ==========================================================================
-- 2. announcement_events — shim for announcements (visibility-transition aware)
-- ==========================================================================

CREATE TABLE public.announcement_events (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text          NOT NULL CHECK (kind IN (
    'announcement_published',
    'announcement_updated',
    'announcement_deactivated',
    'comment_count_bumped'
  )),
  ref_id      uuid          NOT NULL,
  emitted_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcement_events_emitted_at
  ON public.announcement_events(emitted_at DESC);

ALTER TABLE public.announcement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcement_events_select ON public.announcement_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
    )
  );

-- Trigger function — computes visibility transitions server-side once
CREATE OR REPLACE FUNCTION public.tg_emit_announcement_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind         text;
  v_was_visible  boolean;
  v_is_visible   boolean;
BEGIN
  v_is_visible := NEW.is_active
                  AND NEW.published_at IS NOT NULL
                  AND NEW.published_at <= now();

  IF TG_OP = 'INSERT' THEN
    -- Draft INSERTs (not visible) never broadcast
    IF NOT v_is_visible THEN
      RETURN NEW;
    END IF;
    v_kind := 'announcement_published';

  ELSIF TG_OP = 'UPDATE' THEN
    v_was_visible := OLD.is_active
                     AND OLD.published_at IS NOT NULL
                     AND OLD.published_at <= now();

    IF NOT v_was_visible AND v_is_visible THEN
      -- Draft → published (this is the "publish" broadcast)
      v_kind := 'announcement_published';
    ELSIF v_was_visible AND NOT v_is_visible THEN
      -- Published → hidden (unpublish or deactivate)
      v_kind := 'announcement_deactivated';
    ELSIF v_was_visible AND v_is_visible THEN
      -- Update while visible — distinguish counter bump from content update
      IF OLD.comment_count IS DISTINCT FROM NEW.comment_count
         AND OLD.title IS NOT DISTINCT FROM NEW.title
         AND OLD.body IS NOT DISTINCT FROM NEW.body
         AND OLD.link_url IS NOT DISTINCT FROM NEW.link_url
         AND OLD.card_type IS NOT DISTINCT FROM NEW.card_type
      THEN
        v_kind := 'comment_count_bumped';
      ELSE
        v_kind := 'announcement_updated';
      END IF;
    ELSE
      -- Neither visible before nor after — no broadcast
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.announcement_events (kind, ref_id)
  VALUES (v_kind, NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_announcements_emit_event
  AFTER INSERT OR UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.tg_emit_announcement_event();


-- ==========================================================================
-- 3. comment_events — shim for comments (announcement_id in row for FE filter)
-- ==========================================================================

CREATE TABLE public.comment_events (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             text          NOT NULL CHECK (kind IN (
    'comment_inserted',
    'comment_deleted'
  )),
  ref_id           uuid          NOT NULL,           -- comment_id
  announcement_id  uuid          NOT NULL,           -- for FE subscription filter
  emitted_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_comment_events_announcement_emitted
  ON public.comment_events(announcement_id, emitted_at DESC);

ALTER TABLE public.comment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY comment_events_select ON public.comment_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
        AND u.verification_status = 'verified'
    )
    AND EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = comment_events.announcement_id
        AND a.is_active = true
        AND a.published_at IS NOT NULL
        AND a.published_at <= now()
    )
  );

CREATE OR REPLACE FUNCTION public.tg_emit_comment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.comment_events (kind, ref_id, announcement_id)
  VALUES (
    CASE TG_OP
      WHEN 'INSERT' THEN 'comment_inserted'
      WHEN 'DELETE' THEN 'comment_deleted'
    END,
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.announcement_id, OLD.announcement_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tg_comments_emit_event
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_emit_comment_event();


-- ==========================================================================
-- 4. heartcry_feed_events — shim for heartcries (feed_approved only)
-- ==========================================================================

CREATE TABLE public.heartcry_feed_events (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text          NOT NULL CHECK (kind IN (
    'feed_approved'
  )),
  ref_id      uuid          NOT NULL,               -- heartcry_id
  emitted_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_heartcry_feed_events_emitted
  ON public.heartcry_feed_events(emitted_at DESC);

ALTER TABLE public.heartcry_feed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY heartcry_feed_events_select ON public.heartcry_feed_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
        AND u.verification_status = 'verified'
    )
  );

CREATE OR REPLACE FUNCTION public.tg_emit_heartcry_feed_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Emit ONLY when feed_approved flips false/NULL → true AND feed_content is present.
  -- This is the "approved for the public feed" event; nothing else broadcasts.
  IF (OLD.feed_approved IS DISTINCT FROM true)
     AND NEW.feed_approved = true
     AND NEW.feed_content IS NOT NULL THEN
    INSERT INTO public.heartcry_feed_events (kind, ref_id)
    VALUES ('feed_approved', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_heartcries_emit_feed_event
  AFTER UPDATE ON public.heartcries
  FOR EACH ROW EXECUTE FUNCTION public.tg_emit_heartcry_feed_event();


-- ==========================================================================
-- 5. get_prayer_request_by_id RPC — replaces client-side masking at
--    PrayerWallScreen.handleOpenPrayerRequest (see change log section 4)
-- ==========================================================================

-- CORRECTED 2026-07-01 — resolve_display_name signature verified from live schema:
--   resolve_display_name(p_first, p_middle, p_last, p_honorific, p_role,
--                        p_pref DEFAULT 'first_name_only', p_last_first DEFAULT false)
-- Argument order + kind match the call pattern already in get_prayer_wall (live).
-- Language changed to sql + STABLE SECURITY DEFINER to match get_prayer_wall's style
-- (removes the earlier plpgsql caller-check block; verification-status filtering is
-- handled implicitly by the caller — matches get_prayer_wall which also does not
-- filter by verification_status. If future SEC panel wants explicit verified-caller
-- gate here, wrap in plpgsql per the earlier draft.)

CREATE OR REPLACE FUNCTION public.get_prayer_request_by_id(p_request_id uuid)
RETURNS TABLE (
  id                    uuid,
  church_id             uuid,
  user_id               uuid,
  content               text,
  category              text,
  urgent                boolean,
  anonymous             boolean,
  status                text,
  prayed_count          int,
  created_at            timestamptz,
  is_active             boolean,
  -- Masked display fields (mirror get_prayer_wall's shape exactly)
  church_name           text,
  church_type           church_type,
  country               text,
  leader_display_name   text,
  leader_role           text,
  rag_status            text,
  i_prayed              boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pr.id,
    pr.church_id,
    pr.user_id,
    pr.content,
    pr.category,
    pr.urgent,
    pr.anonymous,
    pr.status,
    pr.prayed_count,
    pr.created_at,
    pr.is_active,
    -- UG church name → 'Underground Church'; else real name
    CASE WHEN c.type = 'underground' THEN 'Underground Church' ELSE c.name END,
    -- Return the enum too — matches get_prayer_wall's shape
    c.type,
    -- UG country → NULL; else real country
    CASE WHEN c.type = 'underground' THEN NULL ELSE c.country END,
    -- Super-admin sees full name even for anon (matches get_prayer_wall exception);
    -- anon → NULL; else resolved display name (using signature verified above)
    CASE
      WHEN auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin' THEN u.full_name
      WHEN pr.anonymous = true THEN NULL
      ELSE public.resolve_display_name(
        u.first_name, u.middle_name, u.last_name,
        u.honorific, u.role::text,
        u.display_name_preference, u.last_name_first
      )
    END,
    -- Role (get_prayer_wall does not mask this — role class is coarse-grained)
    u.role::text,
    -- UG rag → NULL; else real rag
    CASE WHEN c.type = 'underground' THEN NULL ELSE c.rag_status::text END,
    -- Did caller pray for this?
    EXISTS (
      SELECT 1 FROM public.prayer_request_prayed_by pb
      WHERE pb.prayer_request_id = pr.id
        AND pb.leader_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  FROM public.prayer_requests pr
  INNER JOIN public.churches c ON c.id = pr.church_id
  INNER JOIN public.users    u ON u.id = pr.user_id
  WHERE pr.id = p_request_id
    AND pr.is_active = true;
$$;

REVOKE ALL ON FUNCTION public.get_prayer_request_by_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_prayer_request_by_id(uuid) TO authenticated;


-- ==========================================================================
-- 6. Audit log CHECK constraint — extend with realtime_publication_added
-- ==========================================================================

-- Per BE audit REC-9: every ALTER PUBLICATION should be documented as an
-- audit_log action. Extending the CHECK constraint allows Migration B to
-- write these rows.
--
-- Full 73-action list pulled from live schema 2026-07-01 via:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'audit_log_action_check';
--
-- The full list must be re-enumerated because Postgres does not have an
-- "ALTER CHECK ADD VALUE" — the constraint must be dropped and re-created.
-- New value 'realtime_publication_added' is appended at end (last item).

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check
CHECK (action = ANY (ARRAY[
  -- Existing 73 actions (verbatim from live schema pull 2026-07-01)
  'read_region'::text,
  'read_heartcry'::text,
  'verify_church'::text,
  'reject_church'::text,
  'flag_cleared'::text,
  'flag_escalated'::text,
  'flag_read'::text,
  'pii_scrubbed'::text,
  'deactivate_church'::text,
  'deactivate_user'::text,
  'announcement_deleted'::text,
  'team_member_added'::text,
  'team_member_removed'::text,
  'rag_overridden'::text,
  'rag_override_removed'::text,
  'reinstate_church'::text,
  'super_admin_granted'::text,
  'super_admin_revoked'::text,
  'admin_session_refreshed'::text,
  'admin_password_reset'::text,
  'admin_step_up_reauth'::text,
  'heartcry_responded'::text,
  'flag_queue_opened'::text,
  'underground_oversight_opened'::text,
  'announcement_created'::text,
  'pastoral_signal_seen'::text,
  'pastoral_signal_dispositioned'::text,
  'pastoral_context_expanded'::text,
  'pastoral_digest_emitted'::text,
  'church_details_updated'::text,
  'admin_aal2_elevation'::text,
  'admin_mfa_factor_reset'::text,
  'underground_aal2_gate'::text,
  'heartcry_aal2_gate'::text,
  'admin_password_reset_sent'::text,
  'prayer_request_withdrawn'::text,
  'heartcry_feed_consent_retracted'::text,
  'church_location_updated'::text,
  'branch_created'::text,
  'branch_invite_responded'::text,
  'branch_member_removed'::text,
  'branch_activated'::text,
  'verify_leader'::text,
  'reject_leader'::text,
  'edit_pending'::text,
  'welcome_dm_sent'::text,
  'replant_team_reply_sent'::text,
  'comment_posted'::text,
  'heartcry_feed_approved'::text,
  'branch_left'::text,
  'branch_name_edited'::text,
  'branch_leader_removed'::text,
  'branch_deleted'::text,
  'branch_parent_auto_linked'::text,
  'branch_parent_admin_linked'::text,
  'admin_tier_promotion_requested'::text,
  'admin_tier_promotion_approved'::text,
  'admin_tier_promotion_denied'::text,
  'admin_tier_promotion_expired'::text,
  'admin_invite_sent'::text,
  'admin_demote'::text,
  'admin_revoke'::text,
  'account_name_updated'::text,
  'admin_grant_to_existing_user'::text,
  'escalated_case_created'::text,
  'escalated_case_auto_routed'::text,
  'escalated_proposal_proposed'::text,
  'escalated_proposal_approved'::text,
  'escalated_proposal_rejected'::text,
  'escalated_case_closed'::text,
  'escalated_inbox_opened'::text,
  'escalated_case_reach_out_sent'::text,
  'case_escalated_to_manager'::text,
  -- NEW as of Realtime rollout 2026-07-01:
  'realtime_publication_added'::text
]));


-- ==========================================================================
-- Invariants (from BE audit findings + panel synthesis 2.4)
-- ==========================================================================
--
-- 1. No hard DELETEs on prayer_requests / testimony / heartcries / announcements /
--    comments. All "delete" flows are soft-delete UPDATEs. If a hard DELETE is
--    ever required, wrap in `ALTER PUBLICATION supabase_realtime DROP TABLE …`
--    first, run the DELETE, then re-ADD, then notify clients to refresh.
--
-- 2. No bulk seeds against production while publication is live. Bulk INSERTs
--    against the base tables above will fire N trigger executions and N event-
--    table rows. To bypass:
--      SET LOCAL session_replication_role = 'replica';
--    (suppresses ALL trigger + replication side effects for the txn)
--    OR temporarily DROP the event tables from the publication.
--
-- 3. REPLICA IDENTITY DEFAULT retained on all base + event tables (per DBA + BE
--    audits — do NOT switch to FULL, doubles WAL + broadcasts old-row PII on
--    UPDATE).
--
-- 4. Event tables are pruning candidates for post-launch cron:
--      DELETE FROM prayer_wall_events WHERE emitted_at < now() - interval '7 days';
--      (mirrored for other 3 event tables)
--    Not enabled in this migration. Add when queue depth becomes measurable.

COMMIT;
```

**Migration A notes:**

- All 4 event tables enable RLS with SELECT-only policies scoped to verified authenticated users. No INSERT/UPDATE/DELETE policies — only triggers populate them.
- All trigger functions use `SECURITY DEFINER SET search_path = ''` per Supabase advisor best practice.
- `announcement_events` trigger computes visibility transitions server-side once so FE handler can be simple (per `[[announcement_update_flip_broadcast_semantics]]`).
- `heartcry_feed_events` trigger fires ONLY on the `feed_approved` false→true edge (never on raw INSERT, never on other UPDATEs).
- `get_prayer_request_by_id` mirrors `get_prayer_wall`'s masking exactly. Replaces the client-side masking path at `PrayerWallScreen.tsx:229-282`.
- Audit action extension is a placeholder — apply-time DBA must pull the current 64+ action list, append `realtime_publication_added`, and re-create the CHECK. (Cannot enumerate the full list here; verified live count via schema query but the exact list is DB state, not migration state.)

### 3.2 Migration B — publication additions

**File path (planned):** `/Users/ife/replant/supabase/migrations/20260701121000_realtime_add_event_tables_to_publication.sql`

```sql
-- ==========================================================================
-- 20260701121000_realtime_add_event_tables_to_publication.sql
--
-- Purpose: Add the 4 event-pointer tables to supabase_realtime publication.
-- Base tables (prayer_requests, testimony, heartcries, announcements, comments)
-- are DELIBERATELY NOT added — SEC + DBA panel VETO of raw broadcast.
--
-- Depends on: 20260701120000_realtime_event_tables_v1.sql (Migration A)
-- Panel synthesis: /Users/ife/replant/.claude/plans/2026-07-01-realtime-coverage-rollout.md § 2
-- ==========================================================================

BEGIN;

-- Add event tables to the publication.
-- Metadata-only DDL; takes AccessShareLock; does not block writes.
-- Rollback: ALTER PUBLICATION supabase_realtime DROP TABLE …; (safe, atomic)

ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_wall_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.heartcry_feed_events;

-- Audit trail — one row per table added, referencing the panel synthesis file
INSERT INTO public.audit_log (accessed_by, action, church_id, triggered_by, meta)
SELECT
  NULL,                            -- system action (no user actor)
  'realtime_publication_added',
  NULL,
  'migration',
  jsonb_build_object(
    'table', t,
    'migration_file', '20260701121000_realtime_add_event_tables_to_publication.sql',
    'panel_synthesis', '/Users/ife/replant/.claude/plans/2026-07-01-realtime-coverage-rollout.md',
    'applied_at', now()
  )
FROM unnest(ARRAY[
  'prayer_wall_events',
  'announcement_events',
  'comment_events',
  'heartcry_feed_events'
]) AS t;

COMMIT;
```

**Migration B notes:**

- One `ALTER PUBLICATION` per table; single-txn; metadata-only. Fast, non-blocking to writes.
- Audit rows emit one per table with `triggered_by='migration'` so post-hoc queries can find "who added this and when."
- **Depends on Migration A's audit_log CHECK extension.** If Migration A's audit-action extension isn't landed first, Migration B's `INSERT INTO public.audit_log` will fail. Apply in order.

### 3.3 Rollback plan

Both migrations are reversible:

**Rollback Migration B** (safe mid-day, no user impact beyond loss of live updates):
```sql
BEGIN;
ALTER PUBLICATION supabase_realtime DROP TABLE public.prayer_wall_events;
ALTER PUBLICATION supabase_realtime DROP TABLE public.announcement_events;
ALTER PUBLICATION supabase_realtime DROP TABLE public.comment_events;
ALTER PUBLICATION supabase_realtime DROP TABLE public.heartcry_feed_events;

-- Audit the rollback
INSERT INTO public.audit_log (accessed_by, action, church_id, triggered_by, meta)
SELECT NULL, 'realtime_publication_added', NULL, 'migration_rollback',
       jsonb_build_object('table', t, 'action', 'dropped', 'reverted_at', now())
FROM unnest(ARRAY['prayer_wall_events','announcement_events','comment_events','heartcry_feed_events']) AS t;
COMMIT;
```
Effect: clients stop receiving Realtime events immediately, no error. Mobile stays on the polling fallback that today still works.

**Rollback Migration A** (only if Migration B is already rolled back — event tables emptied of subscribers):
```sql
BEGIN;
DROP TRIGGER IF EXISTS tg_prayer_requests_emit_event ON public.prayer_requests;
DROP TRIGGER IF EXISTS tg_testimony_emit_event ON public.testimony;
DROP TRIGGER IF EXISTS tg_prayer_request_prayed_by_emit_event ON public.prayer_request_prayed_by;
DROP TRIGGER IF EXISTS tg_testimony_celebrated_by_emit_event ON public.testimony_celebrated_by;
DROP TRIGGER IF EXISTS tg_announcements_emit_event ON public.announcements;
DROP TRIGGER IF EXISTS tg_comments_emit_event ON public.comments;
DROP TRIGGER IF EXISTS tg_heartcries_emit_feed_event ON public.heartcries;

DROP FUNCTION IF EXISTS public.tg_emit_prayer_wall_event();
DROP FUNCTION IF EXISTS public.tg_emit_announcement_event();
DROP FUNCTION IF EXISTS public.tg_emit_comment_event();
DROP FUNCTION IF EXISTS public.tg_emit_heartcry_feed_event();

DROP TABLE IF EXISTS public.prayer_wall_events;
DROP TABLE IF EXISTS public.announcement_events;
DROP TABLE IF EXISTS public.comment_events;
DROP TABLE IF EXISTS public.heartcry_feed_events;

DROP FUNCTION IF EXISTS public.get_prayer_request_by_id(uuid);
COMMIT;
```
Note: rolling back Migration A while Migration B is still live would break subscribers. Rollback in reverse order.

---

## 4. Client + BE code draft (diff-only · NOT MERGED)

Drafted 2026-07-01. **Not merged.** Founder review + preview deploy required.

Six touch points:
1. `useRealtimeRefetch` — new reusable hook
2. `AuthProvider` — add `supabase.realtime.setAuth()` on token refresh + `removeAllChannels()` on sign-out
3. `PrayerWallScreen` + `usePrayerWall` — subscribe to `prayer_wall_events`
4. `NetworkFeed` — subscribe to `announcement_events`
5. `CommentThread` — subscribe to `comment_events` filtered by `announcement_id`
6. `FeedScene` (Persecuted) — subscribe to `heartcry_feed_events`
7. `PrayerWallScreen.handleOpenPrayerRequest` — refactor to `get_prayer_request_by_id` RPC

### 4.1 New file — `src/hooks/useRealtimeRefetch.ts`

```ts
/**
 * useRealtimeRefetch
 *
 * Reusable Realtime subscription hook. Extracted from the pattern established
 * by useConnectUnreadBadge — unique channel name per effect run, async-cleanup
 * workaround for supabase-js's "cannot add callbacks after subscribe" quirk,
 * eligible-gating, debounced RPC refetch.
 *
 * Consumers subscribe to one or more tables (typically event-pointer tables
 * from the Realtime coverage rollout) and pass a single `onEvent` callback
 * that fires debounced. The callback is expected to trigger a masking-RPC
 * refetch — DO NOT trust the raw event payload for render.
 *
 * See: /Users/ife/replant/.claude/plans/2026-07-01-realtime-coverage-rollout.md § 2
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

type EventOp = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface Subscription {
  /** Table name in `public` schema */
  table: string;
  /** Which ops to listen for; default '*' */
  event?: EventOp;
  /** Optional filter, e.g. `announcement_id=eq.<uuid>` */
  filter?: string;
}

interface Options {
  /** Stable label used as channel-name prefix; make it descriptive per view */
  channelKey: string;
  /** Gate — subscription only mounts when eligible === true */
  eligible: boolean;
  /** Which tables + events to subscribe to */
  tables: Subscription[];
  /** Debounced callback (RPC refetch typically lives here) */
  onEvent: () => void;
  /** Debounce window in ms; default 350 matches useConnectUnreadBadge */
  debounceMs?: number;
}

export function useRealtimeRefetch(opts: Options): void {
  const {
    channelKey,
    eligible,
    tables,
    onEvent,
    debounceMs = 350,
  } = opts;

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const tablesKey = JSON.stringify(tables); // stable for effect deps

  useEffect(() => {
    if (!eligible) return;

    // Unique channel name per effect run — supabase-js reuses channel-name
    // registrations, and re-subscribing on the same name after cleanup can
    // race the async 'unsubscribe' promise. Random suffix sidesteps this.
    const nonce = Math.random().toString(36).slice(2, 10);
    const channel = supabase.channel(`${channelKey}-${nonce}`);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        try {
          onEventRef.current();
        } catch (e) {
          // Swallow — a failed refetch is a UX bug, not a subscription bug.
          console.warn(`[useRealtimeRefetch] onEvent threw for ${channelKey}`, e);
        }
      }, debounceMs);
    };

    for (const sub of tables) {
      channel.on(
        // @ts-expect-error — postgres_changes typing is finicky across supabase-js versions
        'postgres_changes',
        {
          event: sub.event ?? '*',
          schema: 'public',
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        trigger,
      );
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // First fetch is the caller's responsibility (mount-time fetch).
        // Realtime events are supplementary.
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[useRealtimeRefetch] channel status ${status} for ${channelKey}`);
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      // Fire-and-forget cleanup. removeChannel runs the WS teardown; unsubscribe
      // is idempotent. Any lingering event during teardown is safely ignored
      // (the debounce timer is already cleared).
      channel.unsubscribe().finally(() => {
        supabase.removeChannel(channel);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, eligible, tablesKey, debounceMs]);
}
```

### 4.2 `AuthProvider.tsx` — setAuth on token refresh + removeAllChannels on sign-out

**Target file:** `/Users/ife/replant/src/contexts/AuthProvider.tsx`

**Change 1 — inside the `onAuthStateChange` handler (around line 262-290 per FE audit):**

```ts
// EXISTING:
supabase.auth.onAuthStateChange(async (event, newSession) => {
  // ... existing handling ...
  setSession(newSession);
  // ... existing handling ...
});

// ADD, at the top of the callback body after `setSession(newSession)`:
if (newSession?.access_token) {
  // Load-bearing per Realtime rollout FE audit R6:
  // Without setAuth, the Realtime WebSocket holds the JWT snapshot at
  // subscribe time. After a token refresh at hour 24-168, live subscriptions
  // still evaluate RLS against the OLD claim — a UG grant/revoke or
  // verification flip wouldn't take effect until reconnect.
  // See /Users/ife/replant/.claude/plans/2026-07-01-realtime-coverage-rollout.md § 2.4
  supabase.realtime.setAuth(newSession.access_token);
}
```

**Change 2 — inside `signOutAndClear()` (belt over existing suspenders):**

```ts
// EXISTING (near the top of signOutAndClear):
await supabase.auth.signOut();

// ADD, immediately before the signOut call:
// Belt: subscriptions today all clean up via RootNavigator unmount cascade,
// but explicit cleanup is a good discipline in case any future subscription
// hoists above the Tabs subtree (e.g. an AuthProvider-level NotificationContext).
try {
  await supabase.removeAllChannels();
} catch (e) {
  console.warn('[AuthProvider] removeAllChannels during sign-out failed', e);
}
```

### 4.3 `PrayerWallScreen` + `usePrayerWall` — subscribe to `prayer_wall_events`

**Target file:** `/Users/ife/replant/src/screens/main/PrayerWallScreen.tsx`

**Change 1 — inside the `feed_list` view (component that renders the paginated feed, around line 370-390):**

```tsx
import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch';

// Inside the feed_list view component, alongside the existing useEffect for
// initial fetch + pull-to-refresh:

useRealtimeRefetch({
  channelKey: 'prayer-wall-feed',
  eligible: !!session?.user?.id && verified === true,
  tables: [
    { table: 'prayer_wall_events', event: 'INSERT' },
  ],
  onEvent: () => {
    // The RPC-fetched page-0 refetch replaces the local page with server-authoritative
    // shape. Optimistic state on OWN actions (i_prayed toggle mid-refresh) is preserved
    // by the existing setRows(page) → optimistic merge sequence at
    // PrayerWallScreen.tsx:544-548.
    refresh();
  },
});
```

**Change 2 — inside the testimonies view (or in `TestimoniesView.tsx`):**

```tsx
useRealtimeRefetch({
  channelKey: 'prayer-wall-testimonies',
  eligible: !!session?.user?.id && verified === true,
  tables: [
    { table: 'prayer_wall_events', event: 'INSERT' },
  ],
  onEvent: () => refresh(),
});
```

Note: both views subscribe to the same `prayer_wall_events` table with `INSERT` event; the debounce collapses bursts and the FE dispatches by re-fetching whichever RPC is authoritative for the current view.

**Change 3 — `usePrayerWall.ts` pull-up hook** — subscribe to the same event stream, gated by `open()`-state:

```tsx
useRealtimeRefetch({
  channelKey: 'prayer-wall-pullup',
  eligible: isOpen && !!session?.user?.id && verified === true,
  tables: [
    { table: 'prayer_wall_events', event: 'INSERT' },
  ],
  onEvent: () => refresh(),
});
```

### 4.4 `NetworkFeed.tsx` — subscribe to `announcement_events`

**Target file:** `/Users/ife/replant/src/components/home/NetworkFeed.tsx`

**Change — alongside the existing `useEffect(loadInitial)` at line 152-154:**

```tsx
import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch';

useRealtimeRefetch({
  channelKey: 'network-feed',
  eligible: !!session?.user?.id,
  tables: [
    { table: 'announcement_events', event: 'INSERT' },
  ],
  onEvent: () => {
    // Refetch page 0. Handles both new-published and counter-bumped cases via
    // the RPC-authoritative shape. FE handler semantics per
    // [[announcement_update_flip_broadcast_semantics]]:
    //   - 'announcement_published' → new post arrives at top of feed
    //   - 'comment_count_bumped'   → silent counter update
    //   - 'announcement_updated'   → content merge
    //   - 'announcement_deactivated' → row drops from feed
    // All four resolve to "refetch page 0" for MVP simplicity.
    refresh();
  },
});
```

**Note:** the trigger emits four discriminated kinds, but for MVP the FE handler collapses all to "refetch page 0." Post-launch we can add per-kind optimizations (e.g. counter-only bumps skip the full page fetch and patch the affected row's `comment_count` directly).

### 4.5 `CommentThread.tsx` — subscribe to `comment_events` filtered by `announcement_id`

**Target file:** `/Users/ife/replant/src/components/home/CommentThread.tsx`

**Change — alongside the existing `useEffect` on `announcementId` (line 169-187):**

```tsx
import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch';

useRealtimeRefetch({
  channelKey: `comment-thread-${announcementId}`,
  eligible: !!session?.user?.id && verified === true && !!announcementId,
  tables: [
    {
      table: 'comment_events',
      event: 'INSERT',
      filter: `announcement_id=eq.${announcementId}`,
    },
    {
      table: 'comment_events',
      event: 'DELETE',
      filter: `announcement_id=eq.${announcementId}`,
    },
  ],
  onEvent: () => {
    // Refetch comments for this announcement via get_comments RPC.
    // The RPC applies server-side masking (mask_reason, masked_region);
    // raw comment_events payload never carries author_id or mask_reason.
    reloadComments();
  },
});
```

**Fanout economy note:** the `announcement_id=eq.{id}` filter is critical. Without it, every comment on every announcement broadcasts to every open CommentThread. With it, a leader viewing announcement A only receives comment events for A.

### 4.6 `FeedScene.tsx` (Persecuted Feed) — subscribe to `heartcry_feed_events`

**Target file:** `/Users/ife/replant/src/screens/main/persecuted/scenes/FeedScene.tsx`

**Change — alongside the existing `useFocusEffect(loadFeed)` at line 105-109:**

```tsx
import { useRealtimeRefetch } from '../../../../hooks/useRealtimeRefetch';

useRealtimeRefetch({
  channelKey: 'heartcry-feed',
  eligible: !!session?.user?.id && verified === true,
  tables: [
    { table: 'heartcry_feed_events', event: 'INSERT' },
  ],
  onEvent: () => {
    // Refetch via get_heartcry_feed. RPC returns scrubbed shape:
    //   { id, feed_content, continent, region, severity, created_at, hold_count, viewer_held }
    // No user_id, no church_id, no raw content — safe per SEC + DBA verdict.
    refetch();
  },
});
```

**Semantic:** `heartcry_feed_events` fires ONLY when an admin approves a heartcry for the public Feed (`feed_approved` false→true edge). Leaders on the Feed see approved heartcries appear live, without the polling delay.

### 4.7 `PrayerWallScreen.handleOpenPrayerRequest` — refactor to `get_prayer_request_by_id` RPC

**Target file:** `/Users/ife/replant/src/screens/main/PrayerWallScreen.tsx` (lines 229-282 per FE audit)

**Current (client-side masked, hard-codes `'Underground Church'` + `'Unknown Church'`):**

```tsx
// EXISTING — REMOVE
const handleOpenPrayerRequest = async (requestId: string) => {
  const { data } = await supabase
    .from('prayer_requests')
    .select('*, churches(*), users(*)')
    .eq('id', requestId)
    .single();

  const church = data.churches;
  const user = data.users;
  const isUnderground = church?.type === 'underground';
  const isAnon = data.anonymous ?? false;

  const row: PrayerRow = {
    church_name: isUnderground ? 'Underground Church' : (church?.name ?? 'Unknown Church'),
    country: isUnderground ? null : (church?.country ?? null),
    leader_display_name: isAnon ? null : (user?.full_name ?? null),
    leader_role: isAnon ? null : (user?.role ?? null),
    // ...
  };
  // ...
};
```

**Replacement (server-masked via `get_prayer_request_by_id` RPC):**

```tsx
// NEW — replaces the above
const handleOpenPrayerRequest = async (requestId: string) => {
  const { data, error } = await supabase.rpc('get_prayer_request_by_id', {
    p_request_id: requestId,
  });

  if (error) {
    console.warn('[handleOpenPrayerRequest] RPC failed', error);
    return;
  }
  if (!data || data.length === 0) {
    // Row not visible to caller (may have been soft-deleted, or caller not verified)
    return;
  }

  const row: PrayerRow = data[0];
  // RPC returns pre-masked shape — no client-side masking needed.
  // See migration 20260701120000 § 5 for the RPC definition; shape mirrors
  // get_prayer_wall exactly. Consumer components (PrayerWallDetailSheet)
  // already handle the masked-null pattern for church_name / country /
  // leader_display_name / leader_role.

  openDetailSheet(row);
};
```

**Rationale:** the RPC is `SECURITY DEFINER` and applies the same masking `get_prayer_wall` applies. This eliminates the last client-side masking path in the Prayer Wall flow. The hard-coded `'Underground Church'` string is now derived by the RPC using the same expression the RPC returns for the feed view (`CASE WHEN c.type = 'underground' THEN 'Underground Church' ELSE c.name END`) — no drift possible.

### 4.8 Deployment order (FE + BE)

1. Apply Migration A (event tables + triggers + RPC + audit action) — production DB
2. Apply Migration B (publication additions) — production DB
3. Deploy FE branch containing: `useRealtimeRefetch` hook + `AuthProvider` setAuth+cleanup + 4 per-view subscriptions + `handleOpenPrayerRequest` refactor — preview deploy first, then Founder smokes + merges to main
4. Post-apply audit (section 6)

FE deployment order matters because the FE code will call `get_prayer_request_by_id` — that RPC must exist in the DB before the FE code is live. Migration A ships this RPC.

### 4.9 What NOT to build (per FE R1)

**No monolithic NotificationContext.** Per-view subscription lifecycle wins on:
- Fanout economy (CommentThread filtered per announcement_id)
- Lifecycle discipline (subscriptions mount only when leader is on the tab)
- Precedent (all existing subscriptions are per-view)
- Failure isolation

The five subscription points above are all per-view. `useRealtimeRefetch` is a shared helper, not a shared context.

---

## 5. Apply order

_(Fills after Founder greenlight. Production DB touch is Founder-explicit-approve only.)_

---

## 6. Post-apply audit

_(Fills after apply. Verify audit_log rows landed, broadcast masking holds, no unexpected fanout.)_

---

## 7. Requirements doc 2_7 update

_(Post-apply pass. Reflect subsystem state.)_

---

## Change log rules

- Every subagent finding gets appended verbatim under its section — no summarization loss
- Every SQL statement drafted lives in this file in full — never a snippet or reference
- Every apply gets a timestamp + who greenlit it + audit_log rows produced
- If a step gets skipped, the reason lives here
- If a decision reverses, the reversal + reason live here
- Never delete history — cross out with rationale
