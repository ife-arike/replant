# CD FOLLOW-UP — sidebar restructure (mid-design delta)

> Paste this into the in-progress Escalated Cases CD chat. This is a delta on the prior brief at `.claude/plans/cd-prompt-escalated-cases.md` — that brief is otherwise still in force.

---

## Opening prayer (hard rule)

Open this delta with a brief intercession in the name of Jesus Christ — that the structural change you receive here serves the design without thrashing the work already in progress; that the Lord would direct your hand on every cell + label + flow you re-render. End with "In Jesus' name, Amen."

## The change

After dispatching the original brief, Founder caught a chrome problem the SME panel missed: with three sibling pages under Operations (Pastoral Signals · Flagged Messages · Escalated Cases), the sidebar gets crowded and "where do I look first" becomes a cognitive load. The cleaner shape — and Founder-ratified now — is to **merge into a single sidebar entry with four tabs:**

```
[Parent Sidebar Entry · name TBD]
  ├─ Tab 1 — Pastoral Signals      · Sensitive   (regular + super_admin + Manager)
  ├─ Tab 2 — Flagged Messages      · Moderation  (regular + super_admin + Manager)
  ├─ Tab 3 — Replant Team Inbox    · Sensitive   (regular + super_admin + Manager)
  └─ Tab 4 — Escalated Cases       · Sensitive   (super_admin + Manager only — REGULARS DO NOT SEE THIS TAB)
```

## Per-tab eyebrow lineage is PRESERVED

Each tab carries its own eyebrow strip — DO NOT unify under one parent eyebrow. The Sensitive / Moderation register distinction is part of how admins read the surface:

- Pastoral Signals → eyebrow `OPERATIONS / SENSITIVE`
- Flagged Messages → eyebrow `OPERATIONS / MODERATION`
- Replant Team Inbox → eyebrow `OPERATIONS / SENSITIVE`
- Escalated Cases → eyebrow `OPERATIONS / SENSITIVE`

The page chrome below the tab bar is per-tab. The tab bar is the only shared chrome.

## Parent sidebar entry name — placeholder for now

A CONTENT lane is being asked to propose the parent name. Use a placeholder in your mockups (`[Parent Name TBD]` or similar) until the name lands. Don't burn cycles iterating on a label that's going to be ratified separately.

## Tier visibility on the tab bar itself

- **Regular admin** sees 3 tabs: Pastoral Signals · Flagged Messages · Replant Team Inbox. The Escalated Cases tab is NOT rendered for them — fully hidden from the tab bar, not just disabled. This preserves the anti-gossip rule (Founder-locked): after a regular escalates, the case leaves their view entirely.
- **super_admin + Manager** see all 4 tabs. Within Escalated Cases, Manager has the destructive write surface (Approve proposal / etc.); super_admin has propose-only.

## What's UNCHANGED from the prior brief

Everything else in `.claude/plans/cd-prompt-escalated-cases.md` still stands:

- Three-tier visibility model + propose/approve workflow inside Escalated Cases
- All locked verbs: "Escalate this case" (regular) / neutral "Escalate" (super_admin) / "Close case" / "Restrict temporarily" / "Reach out"
- Locked confirmation copy: *"Your escalation has gone up. If further action is needed from you, someone will reach out."*
- Two sections by source axis inside Escalated Cases (From Pastoral / From Flagged) — distinct color accents
- Listen-first action ordering: Reach out → Restrict → Revoke → Close
- 8-token dispose taxonomy (locked)
- Reach Out via Connect DM with 7-day auto-email fallback
- "Admin Name from Replant Team" sender attribution
- SLA aggregate banner 3 / 7 / 14 days
- Case ID convention `EC-XXXXXX`
- Voice register per `[[feedback-replant-admin-copy-voice]]`

## One impact worth re-rendering

The sidebar entry in `Shell.jsx` you were planning to add gets revised:

- **Before (sibling-page model in original brief):** new entry `Escalated Cases` between Pastoral Signals + Flagged Messages
- **Now:** ONE new parent entry replaces the existing Pastoral Signals + Flagged Messages entries. The parent owns the route (e.g., `/triage` or whatever the CONTENT-picked name becomes). The 4 tabs hang off it with sub-routes (e.g., `/triage/pastoral`, `/triage/flagged`, `/triage/team-inbox`, `/triage/escalated`).

If you've already mocked the sidebar with three sibling entries, swap to the single parent + tab bar. If you haven't gotten that far yet, you save a step — just render the new shape directly.

## Closing prayer

Close with thanks for the surface this design is building toward + petition for steady hands as you revise. In Jesus' name, Amen.

---

*Delta authored 2026-06-30 by SM session. Founder-ratified Option B (merge under one parent) following the original Escalated Cases SME synthesis at `.claude/plans/sme-synthesis-escalated-bundle.md`.*
