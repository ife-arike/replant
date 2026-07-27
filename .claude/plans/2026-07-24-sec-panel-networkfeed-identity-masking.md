# SEC panel brief — NetworkFeed identity masking: CommentThread resolver + named-leader attribution architecture

**Jira:** KAN-338 · **Founder GO:** 2026-07-24 ("yes we can plan for it now") · **Repo:** ~/replant (mobile), project jiyetphxxvyiicrnwlnx

Every panel agent opens with real prayer naming this work: the identities this system guards belong to leaders in places where a name in the wrong hands is a life-safety matter. Pray accordingly, then work accordingly.

## Panel composition

- **SEC (lead)** — identity-exposure architecture, RLS posture, threat model. Required seat; this is an auth/identity panel.
- **DBA** — RLS introspection, RPC vs view vs denormalized-column trade, migration specs.
- **FE consult** — CommentThread + feed render contracts, cache behavior, regression surface.

All agents: seasoned experts, endgoal-oriented, **genuine verdicts** (approve / needs-changes / reject on the merits; never a forced approve-with-changes).

## The incident that triggered this (2026-07-24)

Founder logged into a second (non-admin) leader account and saw leader-authored feed cards attributed to "A leader in the network" with a literal '·' avatar placeholder, while her super_admin account had always shown real behavior. Root cause, verified live:

- `public.users` SELECT RLS = exactly two policies: `users_select_own (auth.uid() = auth_id)` and `users_admin_select (super_admin JWT)`. Normal leaders cannot read any other user's row. Fail-closed, **no leak**.
- The old `useResolvedLeaderAuthor` hook fetched `users` + `churches` client-side per card and masked in JS. Resolution therefore succeeded only for super_admins (and self-authored rows). **Identity display depended on the viewer's privileges, not the post.**

## Interim already shipped (LOCKED until this panel closes; do not relitigate, build on it)

Commit f0b1e8d on `feat/flow-gaps-mobile` (2026-07-24), per the 2026-07-22 SME-panel interim ruling:

- NetworkFeed **never resolves authors client-side**. `author_id` removed from the feed projection.
- Leader-voice cards (leader_word, encouragement) render **frozen attribution**: `source_label` byline composed server-side at publish by `content_submission_publish` (real name when the leader chose visibility, else role+region mask via `content_role_region_label`), avatar = Replant seal.
- The two pre-M5b leader seeds repointed to the system Team user (028be745…).
- Every viewer now sees identical attribution on the feed. `useResolvedLeaderAuthor` is deleted from NetworkFeed.

## What this panel decides

1. **CommentThread's resolver copy** (`src/components/home/CommentThread.tsx`) still live-resolves comment authors client-side — the same per-viewer divergence and the same exposure pattern, live today. Decide its replacement (same frozen pattern? RPC? denormalized author display stamped at write?). Comments are higher-volume and interactive; write-time stamping has update semantics (name changes, anonymity flips) the panel must rule on.
2. **Named-leader attribution architecture.** Leaders who chose to be known by name currently can never be resolved by normal viewers anywhere. Candidates:
   - `get_announcement_leader_author_by_id(p_author_id)` SECURITY DEFINER RPC returning a **pre-masked shape** (per the 2026-07-01 filing);
   - a pre-masked view/projection readable by authenticated;
   - denormalized display columns stamped at write time (freeze semantics — matches the feed's shipped pattern).
   Decide one, spec the migration + contract, define invalidation on name-change/anonymity-flip.
3. **RLS introspection items** (filed 2026-07-01, evidence updated 2026-07-22):
   - `public.users` SELECT: can any cross-tier viewer receive raw `anonymous`, `first_name`, `last_name`, `honorific` for a UG author? (Current policies say no; verify + regression-pin.)
   - `public.churches` SELECT: `churches_select_active` exposes non-underground churches to all authenticated; `churches_underground_restrict` gates UG rows to own-church. Verify `show_church_name`, `type`, `name` leaf exposure against the masking rules below.
4. **ATN region label.** "A Pastor from your region" degradation stands until a client-safe macro-region label exists. Decide the macro-region source (server-composed label, never raw city/coords) — this closes content-build open item #10.

## Locked rulings the design MUST honor (inline, verbatim intent)

- **Underground: no city/lat/lng EVER.** DB CHECK forces location NULL for underground; "brave" = `show_church_name only`. Underground protection focus = location/identity/data-exfil.
- **Underground ≠ anonymous — independent axes.** `users.anonymous` masks the leader's name ("A fellow {role}", church stays real). UG + `show_church_name=false` masks the church (display ''), not the leader's name. Both, either, or neither can hold.
- **Anon identity rules:** public anon = "A fellow [Role]" + real church; UG adds round lock + church OR region only.
- **Console-opacity doctrine (KAN-289):** BE gates are load-bearing; client-side stripping/minification is deterrent only. Client-side masking as the sole defense is the exact posture this panel exists to end.
- **DELIVER-ALWAYS invariant** and production posture: real leader data is live; no fix may black-hole content delivery.
- **Frozen-byline interim stays** on the feed until the panel's architecture ships.

## Deliverables

1. Verdict per lane (genuine).
2. Chosen architecture with migration + RPC/view specs (SQL-level), FE contract changes, and rollout order that never leaves a window where either divergence or exposure regresses.
3. Regression list: what must be re-verified on device (two-account divergence test is the canonical repro: super_admin vs normal leader viewing the same leader-authored card + comment thread).
4. Explicit statement of anything deferred, with its risk.

## Evidence anchors

- `~/.claude/.../memory/useResolvedLeaderAuthor_client_side_masking_pending_sec_panel.md` — full history + file:line exposure map (2026-07-22 KAN-335 verification).
- Deleted-resolver reference implementation: git history of `src/components/home/NetworkFeed.tsx` (pre-f0b1e8d) lines ~375-460.
- `content_submission_publish` (M5b) — server-side byline composition (`content_role_region_label`).
- Live RLS: `pg_policies` for `users` / `churches` (quoted in KAN-338 description context, re-verify live at panel time).
- Incident screenshots: Founder's 2026-07-24 second-account pass (session record, KAN-323 c.16474 era).
