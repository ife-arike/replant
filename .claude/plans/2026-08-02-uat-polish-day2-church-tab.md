# Session handoff — Personal UAT polish pass, DAY 2: THE CHURCH TAB

**Authored:** 2026-08-02 at Day-1 close, per program rules. **Program:** 5-day personal UAT polish (one tab per day).
**Registry:** `.claude/plans/uat-polish-program-state.md` — read it FIRST, it carries cross-day state.
**Prayer:** open the session with prayer naming this work (standing CLAUDE.md rule; close the prayer "In Jesus' name, Amen." — and never close anything else liturgically).

## What this pass IS / IS NOT (unchanged from Day 1)

The Founder's own visual + user-friendliness + copy pass; output must feel demo-able (this footage becomes the launch videos). NOT the final UAT. Scope licence: "no limits", but locked rulings bind unless she overrides in the moment (update the ruling file same turn if she does).

Standing obligations every day: admin ↔ app lockstep in the same batch; board hygiene against live Jira (KAN-5 carries the Home ledger precedent; KAN-6 "The Church Tab — At My Location & At Large" [In Progress] is the likely Day-2 board anchor — spot-check live before citing).

## DAY 2 TARGET: The Church tab

Bindings to load before proposing anything (memory files):
1. **Church tab rulings — NO hamburger on this tab, it owns its own chrome** (`feedback_church_tab_design_rulings`).
2. **CamlView pills — GPS vs registered-coords semantics** (`feedback_church_tab_pills`).
3. `without_walls` ≠ organization (online ministry; org personas = para_ministry).
4. Anon identity rules on church surfaces ("A fellow [Role]" + church; UG round lock + church OR region only); UG location invariants (no city/lat/lng EVER).
5. RPL Network ID search predicate (KAN-215, In Progress) may intersect church search surfaces — check live Jira before touching search.
6. F11 display-name preference: every leader-name surface goes through resolve_display_name.
7. Em-dash reduction + audience-context gate on ALL copy; scriptureItalic for scripture/editorial/witness ONLY.

Method: walk first (hierarchy → spacing → copy → motion), propose grouped by what the eye hits first, confirm structural moves, device-verify before claiming fixed (cap 2 tries/symptom). Open by asking what bothers her most about The Church tab right now — chase her hypothesis first.

## HARD OPERATING CHANGES (Founder rulings, Day 1, 2026-08-02)

1. **Sim bench is INSTRUCTION-GATED.** Founder: "leave the metro, ill smoke from my device. only open when i instruct you to." Do NOT boot/drive the simulator unless she says so. Metro stays up for her device (port 8082). Her device is the repro machine.
2. **Never merge for her** (preview-first). Mobile PRs: she smokes the Metro-served branch and merges, or explicitly grants. Admin main: never push/merge, no exceptions.
3. JS-only days: Metro reload only, EAS untouched.
4. One live session per test account (refresh-token rotation signs out the other device).

## Day-1 carryover into Day 2

1. **Founder actions pending:** merge of mobile PR #120 (hamburger pass + Settings batch + chrome copy fixes) after her smoke; admin PR #86 smoke + her merge; the `/join` site deploy (`npx netlify deploy --prod --dir website --message "add /join redirect for app invite links"` — permission-gated for the agent).
2. **Pending-state VISUAL walk:** copy review of every pending-state surface is DONE (code-level, 3 fixes shipped; banners/modals reviewed clean). The live walk of the three branch states never ran on-screen (sim got instruction-gated mid-attempt). Accounts wired for it whenever wanted: +t11 (pending leader + pending church → main banner), +t12/+t13 (no church → register state), +t15/+t7 (pending leader at verified church → leader variant). All Test1234!.
3. **Build queue (Founder-confirmed order):** referral Phase 1 (KAN-344 — panels GO-WITH-CHANGES, all rulings locked, verdicts in `.claude/plans/2026-08-02-kan344-panel-verdicts.md`, consolidated on KAN-344 c.16490) → change password (SEC consult per auth rule; Sensitive tier) → self-deactivation wiring (KAN-205; test with +t5–t8; the existing DeactivationModal is the login-side surface, NOT this flow). These interject between polish days as she directs.
4. **FAQ content pass** — hers; the question list awaits her rewrite (mechanical cleanups done).
5. Day-1 rulings ledger: `rulings_2026_07_28_day1_home_polish.md` items 1–19 (19 = Settings batch: honorifics GO/Father/Mother/Dr./Canon + Reverend-stays-role, version stamp removed, destructive bars 48pt rhythm, password+deactivation to wire).
6. Wall fixture policy: NEVER re-pin aged fixtures; seed new posts instead (top-up register `.qa/2026-08-02-day1-wall-topup.sql`).

## Repo state at handoff (2026-08-02, end of Day-1 session)

- Mobile `~/replant`: branch `feat/uat-day1-hamburger` pushed, **PR #120 OPEN** (7 commits: hamburger pass, Settings walk finds, GO honorific + version + bars, spacing rhythm, honorific additions, chrome copy fixes, docs). Main = `ac0cc76` (PR #119).
- Admin `~/replant-admin`: PR #86 open (`37d29d9`), untouched this session.
- Prod DB: wall = 10 visible posts (5 top-up P13–P17 + 5 survivors); +t1 restored to baseline after the Settings functional pass; no migrations run (KAN-338 pins untouched, still green from 07-28).
- Metro: running on 8082 for her device. Sim: leave alone unless instructed.
