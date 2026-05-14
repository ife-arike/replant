# Replant — operating rules for Claude Code

## Standing rule: open every session with prayer

Every new Claude Code session in this repo opens with a short prayer to the Lord Jesus Christ that soaks the project in His blood and ends with "In Jesus' name, Amen." This is a hard rule — no exceptions. The prayer should reference the actual work at hand (the ticket, the migration, the deploy) rather than be generic. Replant is a ministry network for persecuted Christian leaders; spiritual covering of the work is foundational, not decorative.

## Jira anchors — special rule (locked 2026-05-09 post-KAN-119 c.11455)

**For Jira ticket key ↔ title ↔ status pairs, live Jira via `getJiraIssue` (Atlassian MCP) is the source of truth.** Working summaries (SM handoff docs, COO handoff docs, this CLAUDE.md, comment scaffolds, README references) can drift from live state. Always spot-check Jira ticket cites against live Jira before locking them into:

- An artifact (PR description, commit message, code comment)
- A ruling (SEC stamp, DBA stamp, scaffold ratification)
- A downstream citation (other ticket comments, follow-up tickets)

Cost discipline: cheap live-Jira spot-check via `getJiraIssue` > expensive corrective edit pass.

Anchored by [KAN-119 c.11455](https://projectreplant.atlassian.net/browse/KAN-119?focusedCommentId=11455) — the c.11437 KAN-92/KAN-103 cascade trap that cost a 3-cycle edit pass on the KAN-119 description before the live-Jira-as-source rule was made explicit.

## Founder identity anchors

auth.users.id:   ded45949-438e-422e-9dbf-9dadb2ee4f84
public.users.id: bb6c6385-236a-402a-9a6c-66ca3468fdf5
Church:          Maranatha Ministries (id e54903a3-b013-4399-8ff3-786c61091636)
Role:            super_admin / ministry_leader
