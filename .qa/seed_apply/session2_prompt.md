# Session 2 Starter Prompt

Paste this entire block into a new Claude Code session in `/Users/ife/replant`:

---

Resume Replant seed work, Session 2. Pray first per CLAUDE.md (the work tonight is applying ~3,500 rows of artisan content + telemetry across the global persecuted Church's representation in the DB — name the work in the prayer).

## Where we are

Session 1 finished mid-day 2026-06-11. Already in prod DB:

| Table | Rows | Notes |
|---|---|---|
| `churches` | 146 (140 net-new + 6 KEEP) | RPL-30001 → RPL-30134 |
| `users` | 198 (188 net-new + 10 KEEP) | leaders linked to churches via JOIN-friendly full_name |
| `daily_scripture` | 108 (91 forward-dated + 17 existing) | 06-13 → 09-11, 13 themed weeks |
| `announcements` | 23 (18 net-new authored by Replant Team `028be745` + 5 aged) | scheduled 06-11 → 06-24 |
| Post-INSERT UPDATE | `churches.profile_completion_done_by` linked for 116 churches | done |

Skipped per Founder Option A: `heartcries` (she generates live encrypted). Skipped per schema gap: `network_updates` (schema only allows event types, not quantitative summary cards — see memory file).

## What Session 2 must do

Apply 4 SQL files in `/Users/ife/replant/.qa/seed_apply/`:

```
1. session2_prayer_requests.sql   ~182 rows  (SSA fully drafted; 111 more need to be drafted by you per region — texture rules + spot-checks already in the file)
2. session2_testimony.sql           30 rows  (13 parent-linked to answered prayer_requests + 17 standalone — all fully drafted, just execute)
3. session2_comments.sql            44 rows  (all fully drafted with mask logic baked in, just execute)
4. session2_telemetry_generator.sql ~3,290 generated rows (algorithmic — just execute the file)
```

**Read `session2_README.md` first** for the full state + memory references + tone bars.

## Apply order (FK dependencies)

1. Read `session2_README.md` end to end
2. Execute `session2_prayer_requests.sql` — **HOWEVER**, the file only has SSA region fully drafted (46 rows). For the other 8 regions (MENA, SA, ESEA, EE/CA, LAC, NA, WE, OP — ~136 rows), the file has spot-check exemplars and `TODO Session 2` markers. You'll need to draft those remaining rows inline using the texture rules captured in the file. Match Founder's voice (specific, vulnerable, no em dashes, no aesthetic-Christian prose). Reference category-locked taxonomy from `PrayerWallLogic.ts:40-49` (8 EXACT casing values: `Healing`, `Protection`, `Provision`, `Salvation`, `Unity`, `Guidance`, `Endurance`, `Laborers`).
3. Execute `session2_testimony.sql` (lookups by content fragment match — pre-baked)
4. Execute `session2_comments.sql` (lookups by announcement title + leader name — pre-baked; also updates `comment_count` denormalized counter at end)
5. Execute `session2_telemetry_generator.sql` (algorithmic, generates ~3,290 rows across `prayer_request_prayed_by`, `testimony_celebrated_by`, `intercession_holds`)
6. Run verification queries at the bottom of each file

## Critical memory files to load context from

In `/Users/ife/.claude/projects/-Users-ife-replant/memory/`:

- `feedback_underground_no_location_constraint.md` — underground rows have NULL city/lat/lng (already enforced — churches already in DB)
- `feedback_announcement_tag_card_constraints.md` — tag_type and card_type are different axes (already applied for announcements)
- `feedback_admin_underground_pending_filter.md` — pending underground filtered from main admin view (expected)
- `feedback_leader_name_middle_rule.md` — middle names ~25% (already applied for SSA + MENA users)
- `postmvp_network_updates_quantitative_cards.md` — skip network_updates
- `postmvp_prayer_wall_categories.md` — locked 8-category set, exact casing
- `feedback_prayer_must_be_legitimate.md` — pray real prayers, not "Amen."
- `feedback_agents_must_pray.md` — all sub-agents pray first

## Voice/tone bars (locked across many iterations in Session 1)

For the prayer_requests you'll draft and any other content:

- **No em dashes** (looks AI-drafted)
- **Casual, room-temp warm** (not corporate, not preachy, not aesthetic-Christian)
- **Specific concrete details** (named individuals, named months, specific places)
- **Prayer requests are vulnerable not performative** — leaders speaking from real weight
- **Underground voice** — most are normal length (full burdens); 4 total are short-coded ("Cover us. Movement in the area.")
- **No "the body is wider for your presence" / "Lord's Day" / "Holding before the Lord. No names needed." style phrases** — Founder explicitly rejected these in Session 1

## Founder rules to honor

- KEEP set untouched: 6 churches (RPL-00001, RPL-02097, RPL-02100-02103) + 10 users + Replant Team system user `028be745`
- audit_log append-only — never write to it directly
- Excluding KEEP churches from `intercession_holds` generator (organic from Founder activity)
- After 4 files execute, the DB has ~4,000 net-new rows total. Founder will spot-check in the app.

## When done

Mark Session 2 complete and message Founder:

```
Session 2 complete. All 4 files executed cleanly:
- prayer_requests: X rows
- testimony: 30 rows
- comments: 44 rows
- telemetry: ~Y rows across 3 tables

Verification queries all pass. Founder ready to spot-check in app.
```

## Open questions Session 2 may need to answer

If the user_role enum doesn't have a "director" value (Edward Henderson / William MacKenzie / Dietrich Schmidt got "ministry_leader" instead), confirm with Founder before drafting any role-specific content. The 12 user_role values: `pastor`, `apostle`, `prophet`, `evangelist`, `teacher`, `elder`, `bishop`, `reverend`, `intercessor`, `psalmist`, `ministry_leader`, `other`.

Trust the work in Session 1's iteration history. Where the conversation captured tone rulings (announcements went through 4 rounds; comments went through 2 rounds), preserve those. Don't re-litigate.

In Jesus' name, Amen.
