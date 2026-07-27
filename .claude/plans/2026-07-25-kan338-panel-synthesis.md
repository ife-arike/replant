# KAN-338 panel synthesis — identity masking (SEC + DBA + FE lanes returned 2026-07-25)

Full lane reports live in the session transcript; this is the actionable synthesis. **Overall: NEEDS-CHANGES, no unsolvable blockers. The brief's premise was corrected by all three lanes, and what they found instead is more serious.**

## The premise correction (unanimous)

CommentThread does NOT client-resolve authors. It calls `get_comments`, a SECURITY DEFINER RPC that masks server-side, returns no author_id, and gives byte-identical rows to every viewer. The comment surface has the RIGHT architecture already. The panel's work became: harden that RPC (real defects inside it), complete the feed's frozen byline, and close adjacent exposure found along the way.

## Findings by severity (converged across lanes)

**P0-A — `get_comments` has no caller gate and no announcement-open gate** (SEC F-1, DBA §3.2). A 2026-06-03 migration removed the whole gate to let pending leaders read threads; every later version copied the gateless body. SECURITY DEFINER bypasses the RLS policy that carried both gates. Consequence: any authenticated JWT (rejected leader, soft-deleted account inside its 30-day window, mid-signup) can read ANY thread, including on unpublished/deactivated announcements. Fix = restore both gates (active + not-rejected caller; announcement is_active + published). CAVEAT: suspected repo/live drift on this exact function (repo file joins auth_id, live behavior implies id) — pull `pg_get_functiondef` live BEFORE authoring.

**P0-B — underground leaders' names default-exposed in comments** (DBA §3.1). `users.anonymous` defaults false at create-account (no underground branch), is client-PATCHable (not in the privilege-guard trigger), and `get_comments`' name axis has no underground term. A UG leader who never found the anonymity toggle is named on every comment to every authenticated caller. The church axis has ceremony-guarded protection; its name twin has none. Fix = force anonymous=true at UG intake + backfill existing UG members + trigger guard blocking direct un-anonymize + ceremony release valve (spec'd, separate ticket). BLOCKED ON FOUNDER: the backfill is a visible display change, and two rulings conflict (2026-06-05 anon-identity rules say UG masks the name; 2026-06-21 decoupling says UG masks the church, not the name). Panel designed to the later ruling PLUS forced-safe default.

**P0-C (out of brief scope, flagged loudly by SEC) — `search_leaders` returns raw `full_name` for anonymous AND underground leaders** plus anonymous/underground boolean discriminators; masking is FE-only. 2-char minimum query + 30-row cap = alphabet sweep harvests (real name, underground=true, macro-region) for every UG leader platform-wide, today, by any authenticated caller. SEC: "arguably outranks everything in this report." Needs its own ticket immediately; fix = NULL name for anon, role+region label for UG, in the RPC.

**HIGH — named-leader publish path is dead** (all lanes). `content_submission_publish` show_name branch writes `source_label = NULL` ("resolves in-app") but the in-app resolver was deleted; feed renders the masked fallback. A leader who chose to be named renders "A leader in the network" to everyone including herself. Consent violation in the opposite direction from the incident. Fix = compose + freeze the byline server-side at publish (both the SQL RPC and the admin `content-publish.js` twin, which also disagree on author_id today).

**HIGH — `announcements.author_id` is client-reachable** (SEC F-7, FE F3). The FE omits it from SELECT_COLS but any client can request it via PostgREST; for show_name rows it's the leader's real public.users PK (stable correlation key). Fix = column-level REVOKE/GRANT with the P0-2 lesson applied (column REVOKE against a table-level grant is a SILENT NO-OP — pre-flight relacl/attacl, then drop + re-grant column list built from the LIVE schema). Same treatment: `churches.region_admin_only/city/lat/lng`; also REVOKE direct SELECT on `comments` (RPC is the only intended read path).

**MEDIUM — FE avatar derives from write-time `mask_reason`** while the server discloses from live state: anonymous+UG leaders render with the public-anon affordance (no lock), and one divergent state renders a wrong glyph. Fix = server returns a closed avatar/display discriminant; FE becomes a pure renderer.

**Data-model root cause** — `mask_reason` is a priority-ordered single enum; anon+underground collapses to `anon`, so the UG fact of a comment is unrecorded. Fix = record both axes at write (two booleans), backfill provable from the priority order.

## The unifying rule (SEC, endorsed by DBA/FE framing)

**Monotone Protection Ratchet:** disclose an identity attribute only if the author's state permitted it at authorship AND permits it now. Tightening is retroactive and automatic; loosening never un-redacts (single audited exception: the church "brave" two-admin ceremony). Comments = LIVE resolution with the write-time floor. Feed = FROZEN byline with an explicit redaction path (`recompose_frozen_bylines` on anonymity flip / name change / UG conversion). The asymmetry is deliberate and documented.

## Architecture verdicts (unanimous)

- Pre-masked SECURITY DEFINER RPC for comments: APPROVE (shipped; harden per above).
- Frozen denormalized byline for the feed: APPROVE (shipped; complete with named-branch composition + dedicated byline/sublabel columns — `source_label` is overloaded with CTA/resource labels — + DB-level length CHECK + retraction).
- Pre-masked view readable by authenticated: REJECT (query-interface enumeration, security_invoker footgun, silent column drift).
- Per-author-id resolver RPC (`get_announcement_leader_author_by_id`): REJECT (N+1, reintroduces author_id client-side, enumeration oracle — same shape as the P0-4 finding already paid for).
- ATN region label: APPROVE `macro_region_label` as sole source; ship a no-arg self-view RPC (`my_attribution_preview`) returning the EXACT strings publish stamps, so compose preview = published artifact byte-for-byte. Closes content-build open item #10.

## Rollout order (no step widens exposure)

1. VERIFY-LIVE batch (blocked this session: Supabase MCP disconnected): live `get_comments`/`post_comment` defs · pg_policies on users/churches/announcements/comments · announcements relacl/attacl + column list · user_role enum labels · UG un-anonymized count · author_id FK delete action.
2. UG name-axis hardening (P0-B) + create-account change [after Founder GO on backfill].
3. Frozen-byline completion + `recompose_frozen_bylines` + backfill NULL bylines.
4. FE: source_sublabel + admin cap raise (30 → DB CHECK 120).
5. Column REVOKEs (announcements.author_id, churches location cols, comments direct SELECT) with pre-flight.
6. `get_comments` v3 (gates + two-axis ratchet + composed display + legacy passthrough), authored against the LIVE definition.
7. FE cutover to the composed contract; delete client display composition + dead `resolveDisplayName` + 3 stale comments that instruct the anti-pattern.
8. ATN `my_attribution_preview` wiring.
9. Regression pins after each step: `.qa/kan338-identity-pins.sql` (16 SQL pins authored in the DBA report) + FE static pins (no author_id in SELECT_COLS; no from('users'/'churches') under home/) + the 7-state comment truth table + two-account device pass.
10. `search_leaders` fix rides its own ticket, sequenced FIRST among the fixes if Founder agrees.

## Founder decisions needed

1. UG name-axis: settle the 06-05 vs 06-21 ruling conflict; GO/NO-GO on forcing anonymous for existing UG members (visible change; ceremony release valve spec'd but unbuilt — until it exists a UG leader who wants to be named has no path).
2. Comments anonymity ratchet: leader un-anonymizing does NOT retro-name old comments (panel recommends; irreversible either way).
3. Feed retraction: adopting recompose-on-flip means a leader going anonymous pulls their name off old published cards (panel recommends yes).
4. search_leaders ticket now, sequenced first?

## Residual risk accepted (record)

Macro-region label is a 9-bucket disclosure; for sparse regions, region + testimony detail narrows. Ruling-level trade already locked (UG shows church or region), lives in the risk register.

## VERIFY-LIVE RESULTS (2026-07-25, connection restored) + kan338_0001 APPLIED

- **get_comments live def pulled.** Drift CONFIRMED: live joins `au.id = c.author_id` (corrected, with a FIX comment absent from the repo file) — never author against the repo 0621 files. P0-A CONFIRMED live (no caller gate, no announcement-open gate). P0-B name axis CONFIRMED (masks only no_church/anonymous; no UG term; legacy `full_name`). v3 must be authored against THIS def.
- **search_leaders live def pulled — MATERIALLY SAFER THAN REPO; SEC P0-C headline corrected.** Live already: NULLs full_name for safe-UG, converts UG church to macro-region label, excludes UG from name-matching entirely (church_code only), self+block filtering. The UG alphabet-sweep DOES NOT WORK live. KAN-339 RESCOPES to: (1) add the anonymous term to the name CASE (surface anon leaders' real names still ship raw, FE-masked only); (2) caller gate fail-closed (unresolved caller currently skips self/block filters); (3) drop raw anonymous/underground discriminators if FE contract allows. Likely origin of the live version: KAN-305 block-user worktree branch (unmerged) — reconcile the repo file from live.
- **ACL truth:** announcements grants FULL table-level privileges to anon+authenticated (arwdDxtm), zero column ACLs — RLS default-deny is the only write gate; author_id IS selectable on readable rows (F-7 real). comments grants table-level SELECT — per-comment author_id harvestable on readable threads (DBA's comments-REVOKE recommendation stands). Column REVOKE plan is real work: live announcements column list captured (16 cols; re-grant = all minus author_id).
- **FKs:** comments.author_id → users(id) ON DELETE CASCADE. announcements.author_id → users(id) NO ACTION + NOT NULL → leader hard-delete FAILS while cards reference them; recompose-to-system-user must precede any hard delete (deletion-flow dependency noted).
- **user_role enum = 13 values**: canonical 12 + `replant_staff`. role_display_label CASE must carry a replant_staff branch (label decision at v3 authoring).
- **resolve_display_name live signature differs from repo** (no display_name_preference reference found in def) — pull full def at v3 authoring.
- **Ledger:** the 0621 migrations are NOT in supabase_migrations (consistent with the drift story; live get_comments was patched via direct apply).
- **Counts:** UG members 34; un-anonymized was 8; leader-typed announcements 2 (both Team-user seeds); UG-authored leader rows 0 (SEC F1 holds); comments 49.
- **kan338_0001 APPLIED LIVE + VERIFIED:** backfill 8 → 0 un-anonymized, all 34 UG members anonymous, both triggers present. The intake belt (create-account) rides in repo commit cc223bd, deploys with the next edge-function batch.

Remaining build queue (in rollout order): search_leaders rescoped fix (KAN-339, author vs live def) → frozen-byline completion (byline/sublabel + show_name composition + recompose + both publish paths) → column REVOKEs (announcements.author_id, churches location cols, comments SELECT; pre-flight relacl) → get_comments v3 (author vs live def; replant_staff branch; live resolve_display_name) → FE cutover → ATN my_attribution_preview → pins after each step.
