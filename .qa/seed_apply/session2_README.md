# Replant Seed — Session 2 Handoff

**Written 2026-06-11 by Session 1 (mid-session) for Session 2 to execute.**

## Session 1 state (already in prod DB)

| Table | Rows landed | Notes |
|---|---|---|
| `churches` | 146 (140 net-new + 6 KEEP) | RPL-30001 → RPL-30134, plus 6 RPL-00001/02097/02100-02103 KEEP |
| `users` | 198 (188 net-new + 10 KEEP) | leaders L1-L188 + 10 KEEP including system user `028be745` |
| `daily_scripture` | 108 (91 net-new + 17 existing) | forward weeks 06-13 → 09-11 |
| `announcements` | 23 (18 net-new + 5 aged) | new ones authored by Replant Team `028be745`, scheduled 06-11 → 06-24 |
| Post-INSERT UPDATE | 116 churches linked to founding leader via `profile_completion_done_by` | clean |

## What Session 2 needs to apply

| File | Target table | Rows |
|---|---|---|
| `session2_prayer_requests.sql` | `prayer_requests` | 182 |
| `session2_testimony.sql` | `testimony` | 30 (13 parent-linked + 17 standalone) |
| `session2_comments.sql` | `comments` | 44 (with mask_reason / is_masked / masked_region computed per author) |
| `session2_telemetry_generator.sql` | `prayer_request_prayed_by` + `testimony_celebrated_by` + `intercession_holds` | ~3,290 generated |

**`heartcries` and `heartcry_holds` are SKIPPED.** Founder Option A: she'll generate live encrypted heartcries from test accounts.

**`network_updates` is SKIPPED.** Schema only allows event types `'church_verified'` / `'prayer_submitted'`; quantitative-summary card vision requires schema migration. See `postmvp_network_updates_quantitative_cards.md` memory.

## Apply order (Session 2)

1. **prayer_requests** first — FK target for testimony.original_request_id
2. **testimony** — references prayer_requests for parent-link (13 of 30)
3. **comments** — references announcements (already in DB)
4. **telemetry generator** — references all of the above + churches/users

## Schema constraints to honor (saved to memory in Session 1)

- `underground_no_location` — underground churches must have NULL city/lat/lng (already enforced — churches already applied)
- `announcements_tag_type_check` — only urgent/update/notice/new/none; **`call_to_action` and `article` are CARDS not tags** — already applied for announcements; comments don't use these
- `network_updates_type_check` — only church_verified/prayer_submitted (skipped this table)
- `comments` table writes normally go through `post_comment` RPC; direct INSERT bypassing the RPC requires Session 2 to **compute mask_reason / is_masked / masked_region** server-side equivalent logic per author state

Mask logic for comments (replicating the RPC):
- If author's `churches.type = 'underground'` → `mask_reason = 'underground'`, `is_masked = true`, `masked_region = country`
- Else if `users.anonymous = true` → `mask_reason = 'anon'`, `is_masked = true`, `masked_region = NULL`
- Else if `users.church_id IS NULL` → `mask_reason = 'no_church'`, `is_masked = true`, `masked_region = NULL`
- Else → `mask_reason = 'none'`, `is_masked = false`, `masked_region = NULL`

Each comment SQL row uses subqueries to derive these from the resolved author + author's church.

## Tone bars (locked in Session 1 across multiple iterations)

For prayer_requests, testimony, comments — preserve voice that was established:

- **No em dashes** (Founder rule — looks AI-drafted)
- **Casual, conversational, room-temp warm** (not corporate, not preachy, not aesthetic-Christian)
- **Specific concrete detail** (named individuals: Sister Bénédicte, Deacon Brian, Mama Adesola; named months: "Eight months", "Twenty months ago"; specific places)
- **Comments mix emotional openers** — "Amen.", "Wow,", "My God,", "Lord have mercy.", "Bless God.", "Hallelujah." — not just "Joining from X." / "Praying with you."
- **Prayer requests are vulnerable not performative** — leaders speaking from real weight, not Christian-aesthetic prose
- **Testimonies celebrate specifically** — name what the Lord did, no generic praise

## Memory files to reference

All saved in `~/.claude/projects/-Users-ife-replant/memory/`:
- `feedback_underground_no_location_constraint.md`
- `feedback_admin_underground_pending_filter.md`
- `feedback_announcement_tag_card_constraints.md`
- `feedback_leader_name_middle_rule.md`
- `feedback_prayer_must_be_legitimate.md`
- `feedback_agents_must_pray.md`
- `feedback_verification_approved_ux.md`
- `feedback_postgrest_fk_disambiguation.md`
- `postmvp_network_updates_quantitative_cards.md`
- `postmvp_prayer_wall_categories.md`
- `postmvp_international_data_honorifics.md`

## Verification after Session 2 applies all files

```sql
SELECT
  (SELECT COUNT(*) FROM public.prayer_requests) AS prayer_requests,
  (SELECT COUNT(*) FROM public.testimony) AS testimony,
  (SELECT COUNT(*) FROM public.testimony WHERE original_request_id IS NOT NULL) AS parent_linked_testimonies,
  (SELECT COUNT(*) FROM public.comments) AS comments,
  (SELECT COUNT(*) FROM public.prayer_request_prayed_by) AS prayed_by,
  (SELECT COUNT(*) FROM public.testimony_celebrated_by) AS celebrated_by,
  (SELECT COUNT(*) FROM public.intercession_holds) AS intercession_holds;
```

Expected (approx):
- prayer_requests: ~182
- testimony: 30
- parent_linked_testimonies: 13
- comments: 44
- prayed_by: ~1,130
- celebrated_by: ~520
- intercession_holds: ~1,640
