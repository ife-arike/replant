# Replant — Release notes

Per-sprint release notes documenting what shipped across DBA / Admin BE+FE / Mobile lanes for every build dispatch. Convention ratified 2026-06-23.

## Convention

- **Filename:** `YYYY-MM-DD-{workstream-slug}.md` (date = day the sprint's 3-lane build returned verdicts, not the day it merged).
- **Authored:** AFTER subagent verdicts return, BEFORE Founder marks the Jira ticket Done.
- **Source of truth:** subagent OUTPUT FORMAT blocks (section 11 of every build manifest) feed the notes directly — no separate authoring effort.
- **Audience:** Founder + future-Claude sessions reading what shipped without trawling commits.
- **Pair with:** the matching build manifest at `docs/build_manifest_{workstream}.md`.

## Template

See [TEMPLATE.md](TEMPLATE.md).

## Index

(Populated as sprints ship.)
