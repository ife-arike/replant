# Prayer Wall cluster — audit verdicts (KAN-224, KAN-225, KAN-258, KAN-260)

## KAN-224 — Prayer Wall · Revelation tab — "Voices from the Body" backend
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Grep across `/Users/ife/replant/src` + `/Users/ife/replant/supabase` for `revelation_voices`, `post_revelation_voice`, `get_revelation_voices` → ZERO hits. No table, no RPCs, no migration.
- `src/components/prayer/RevelationView.tsx:273` — section literally commented "Voices from the Body — visual placeholder only (no MVP backend)"; compose Pressable rendered with `disabled` (line 280–284, "Speak to the church here…"); type chips are plain non-interactive `View`s (lines 290–293). No insight cards, no pagination.
- `RevelationView.tsx` has no supabase import at all — the entire surface is hardcoded scripture (7 archetypes), exactly the MVP placeholder state the ticket describes.
- The Revelation surface itself exists (landed in commit 3339b1d, pill-nav redesign 2026-06-05) — so the ticket's FE anchor is present and ready to wire; everything the ticket covers (table + RLS, 2 RPCs, compose wiring, insight cards, anon toggle) is absent.
MISSING: All A/C — `revelation_voices` table + RLS, `post_revelation_voice`, `get_revelation_voices`, compose-sheet wiring, active chip selection, LeaderInsightCard rows with type badges, UG masking, anonymous toggle. SEC + DBA stamps never occurred.
DEPLOYED: n/a
NEEDS-LIVE-DB: (optional confirmation only; migration-mirror rule already implies absence) `SELECT to_regclass('public.revelation_voices') AS tbl, (SELECT count(*) FROM pg_proc WHERE proname IN ('post_revelation_voice','get_revelation_voices')) AS fns;` — expect NULL / 0
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Zero code hits for revelation_voices / post_revelation_voice / get_revelation_voices in src/ or supabase/ — backend not started.
- RevelationView.tsx:273-297 renders "Voices from the Body" as a disabled compose prompt + non-interactive type chips, explicitly commented "visual placeholder only (no MVP backend)".
- FE anchor (Revelation pill surface, 7 archetype detail views) shipped 2026-06-05 (commit 3339b1d) and is stable — ticket scope is purely additive on top of it.
- Ticket remains valid as specced; requires SEC + DBA panel before build per its own A/C.

## KAN-225 — Prayer Wall · My Prayers — Edit prayer request (update_prayer_request RPC + FE wiring)
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- No migration in `/Users/ife/replant/supabase/migrations/` defines `update_prayer_request` — grep hits only comments in `MyOpenPrayersView.tsx` (lines 22, 174). Prayer write RPCs that DO exist (20260605000010): `create_testimony`, `soft_delete_prayer_request`; plus `create_prayer_request` (20260605000002 §7). No update RPC anywhere.
- `src/components/prayer/MyOpenPrayersView.tsx:173-178` — `onEdit` is an empty handler: "TODO: update_prayer_request RPC needed — DBA ticket required… intentionally never reachable".
- Edit rendered disabled in BOTH surfaces exactly as the ticket premises: pull-up sheet `MyOpenPrayersView.tsx:519` (`<SheetActionButton label="Edit" tone="sky" disabled …>`) and anchored ⋮ menu `MyOpenPrayersView.tsx:626` (`<MenuItem label="Edit" onPress={onEdit} disabled />`).
MISSING: All A/C — the RPC (ownership check, 8-category validation, text/category/urgent-only update), SEC + DBA stamps, pre-filled compose sheet, save confirmation modal, activation of the Edit action in both surfaces.
DEPLOYED: n/a
NEEDS-LIVE-DB: (optional) `SELECT count(*) FROM pg_proc WHERE proname = 'update_prayer_request';` — expect 0
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- update_prayer_request RPC does not exist in any migration; only prayer write RPCs on prod are create_prayer_request / create_testimony / soft_delete_prayer_request.
- MyOpenPrayersView.tsx onEdit (lines 173-178) is an intentionally unreachable TODO stub; Edit renders disabled in both the card pull-up (line 519) and the ⋮ anchored menu (line 626).
- Reuse path is ready: PostPrayerRequestModal already implements the composer pattern (300-char counter, 8-category chips, urgent toggle) the ticket says to pre-fill.
- Note: leader-visible disabled Edit control ships in the current UI — Founder may want this pulled forward before UAT since testers will tap it.

## KAN-258 — Prayer Wall — wire Post and Receive intercession flows (MVP, currently stubbed)
CURRENT LANE: Backlog
VERDICT: BUILT
EVIDENCE:
- Post flow end-to-end: feed_list "+ Post" CTA (verified-only, `PrayerWallScreen.tsx:489-497`) → `handlePostPress` (430-432) → `PostPrayerRequestModal` hosted on both feed_list (552-565) and pill surfaces (652-666) → `create_prayer_request` RPC (`PostPrayerRequestModal.tsx:122-127`) → onSuccess toast + feed refresh/reset so the new request appears.
- Receive flow end-to-end: landing Receive card "SHARE A NEED" ghost CTA (`PrayerWallLanding.tsx:434` → `onPost` → screen 604) → same composer → own need surfaces via `get_open_prayers` on the Receive card previews (`PrayerWallLanding.tsx:200`) and My Prayers view (`MyOpenPrayersView.tsx:151`). Wiring commits f396818 + e0c1f78 (both 2026-06-05) — the ticket (updated 2026-06-23 from `prayer_wall_roadmap.md`) described a pre-06-05 state and was stale at filing.
- Intercede loop: `stand_in_the_gap` (`PrayerWallDetailSheet.tsx:225`, auth_id fix migration 20260604000001) → journal history via `get_standing_in_gap_history` + `get_intercession_holds` (`IntercessionJournalView.tsx:130-131`, migration 20260605000002).
- Scope questions resolved in shipped design: single unified composer (no separate post_intercession_need; RPC is `create_prayer_request`, not `post_prayer_request`); per-post anon toggle IS live (modal lines 211-226 + `p_anonymous_override`, 20260605000002 §7) — not deferred to KAN-150 as the ticket assumed; underground = forced-anon at composer + RPC, and masked server-side (name/country/church_id/leader_role) by 20260702024300 (get_prayer_wall) + 20260702024556 (get_open_prayers anon mask, own-church-only, anon-EXECUTE revoked).
- Anon-leak sentinel coverage: FE display tests `PrayerWallLogic.test.ts:169-192` (underground location masking, anonymous "A fellow leader" fallback); server-side leak surface was the pre-UAT P0-4 pair, remediated + verified on prod 2026-07-02.
MISSING: (non-A/C scope bullet) notification to the requesting leader when others hold their request — zero notification wiring in prayer components; was listed as "scope to figure out", never designed.
DEPLOYED: mobile-tree (needs Expo rebuild note)
NEEDS-LIVE-DB: none
NEEDS-SIM: One closing device pass per DoD: (1) post via "+ Post" on the feed and via "SHARE A NEED" on the Receive card — confirm the request tops the feed and appears on Receive card + My Prayers; (2) Pray on another church's request from the detail sheet — confirm it lands in the Intercession Journal history; (3) post with anon toggle ON — confirm feed shows "A fellow leader" with no name.
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- Both flows wired 2026-06-05 (commits f396818 "wire SHARE A NEED CTA → PostPrayerRequestModal" + e0c1f78 "intercession journal + post request form + pray button wiring") — ticket was stale at filing (2026-06-23), sourced from the pre-wiring roadmap memory.
- Single unified composer shipped: PostPrayerRequestModal → create_prayer_request(p_content, p_category, p_urgent, p_anonymous_override); categories locked to the 8-value set in the RPC.
- Per-post anonymous toggle is LIVE (not post-MVP as ticket assumed); underground posts forced anonymous at composer + RPC + masked by get_prayer_wall/get_open_prayers (2026-07-02 P0-4 remediation).
- Intercede→journal loop live: stand_in_the_gap (auth_id fix 20260604000001) → get_standing_in_gap_history/get_intercession_holds → IntercessionJournalView.
- Open non-A/C item: no notification to the requesting leader when someone holds their request — never designed; suggest splitting to its own ticket if wanted for MVP.
- Stale header comments still claim "coming soon Alert" at PrayerWallScreen.tsx:29-30 and PrayerWallLanding.tsx:15 — cosmetic doc rot, wiring is real; worth a one-line cleanup so future audits aren't misled.

## KAN-260 — Prayer Wall — UX polish: tab switcher redesign + filter bar refinement + "Connect" from prayer cards
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- Item 1 (tab switcher) SUPERSEDED: the ticket's target `PrayerWallSegmentedControl.tsx` no longer exists. c36184b (2026-06-05) shipped exactly the ask ("animated Connect-style segmented control (Feed ↔ Testimonies)"), then 3339b1d (same day) replaced the 2-segment control with the 5-pill `PrayerWallPillNav.tsx` ("Horizontal pill row replacing the old 2-segment control" — Feed · Testimonies · My Prayers · Revelation · Locations, animated sky-tint active state); file deleted in 2f9c1e4 (2026-06-09). Ticket premise was stale at filing (2026-06-23).
- Item 2 (filter bar) NOT ACTIONED: `PrayerWallFilterBar.tsx` last redesigned in the v5/v7 passes of 2026-05-24 (e4ab8a1, 6e18f5a) — BEFORE this ticket; the standing Founder note is still carried in code: `PrayerWallScreen.tsx:519-521` "Filters need their own visual polish (Founder note 2026-06-10 round 3)". Ticket itself says direction TBD, so there is no concrete A/C to satisfy yet.
- Item 3 (Connect from cards) PARTIAL: the affordance exists on `PrayerWallDetailSheet.tsx` — secondary CTA (lines 354-371) with full gating built (disabled + relabelled for underground / anonymous / own-church, lines 256-264; viewerChurchId guard fed from PrayerWallScreen:639) — but `handleConnect` (lines 234-239) is an explicit UI-only stub: "TODO: wire Connect flow — pending SEC checkpoint… tapping does nothing persistent." Zero `navigate('Connect')` calls anywhere in prayer components.
MISSING: Item 2 — no post-ticket filter-bar refinement, no ratified direction. Item 3 — tap routing to a Connect DM (the actual leader-to-leader connection), pending SEC checkpoint. DoD unmet: no CD direction delivered, no Founder placement ratification recorded, no single sweep PR.
DEPLOYED: mobile-tree (needs Expo rebuild note)
NEEDS-LIVE-DB: none
NEEDS-SIM: Device-pass observation of the filter bar in feed_list (ticket's own "flag for device pass observation") + confirm "Connect to this church" on a named non-own-church prayer detail sheet currently does nothing on tap (stub).
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Item 1 is moot: PrayerWallSegmentedControl.tsx was made Connect-style (c36184b) and then replaced entirely by the 5-pill PrayerWallPillNav redesign (3339b1d, deleted 2f9c1e4) — recommend dropping item 1 from scope as superseded.
- Item 2 untouched since the ticket: filter bar's last visual pass was 2026-05-24 (v5 reflow); code still carries the 2026-06-10 Founder polish note at PrayerWallScreen.tsx:519-521; direction remains TBD.
- Item 3 half-built: "Connect to this church" CTA + underground/anonymous/own-church gating shipped on the prayer detail sheet, but handleConnect is a UI-only stub (PrayerWallDetailSheet.tsx:234-239, "pending SEC checkpoint") — an enabled-looking button that does nothing for named posts.
- Ticket should be re-scoped to items 2+3 only; item 3 needs the SEC checkpoint + Connect DM routing ruling before wiring.
