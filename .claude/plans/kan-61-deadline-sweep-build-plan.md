# KAN-61 — verification deadline sweep: build plan (Founder "plan to build" 2026-07-13)

## What exists today (important — the consequence already half-exists)

1. **Login-time enforcement is LIVE:** `auth-status-check` resolves a stale `verification_deadline` into deactivation when the leader next opens the app (v7 rewrite, continuous spec 2026-06-18). A leader past deadline who logs in IS deactivated and sees the lockout.
2. **Reminders are LIVE as of 2026-07-13:** day-7 + day-1 emails (armed cron). Leaders now hear the clock.
3. **The deactivation email is LIVE on the admin-manual path** (`deactivate-church.js` → `notify_t09`, ratified body).

## What KAN-61 adds (the actual gap)

1. **Offline enforcement:** a leader who never re-opens the app currently stays `pending` forever in the DB (only flipping at next login). The sweep flips state on schedule.
2. **The email at the moment of deactivation** on the automated path (today the login-time flip sends nothing — the leader discovers the lockout cold).
3. **`coleader_departed` → remaining leader** (`notify_t38`, copy locked) when one of two leaders deactivates and the slot reopens (D-02).

## Proposed shape (panel sharpens; Founder rules)

1. **DB-side sweep function** (pattern-proven: pastoral digest / reminder sweeps): daily cron, `verification_status='pending' AND verification_deadline < now()`, batched LIMIT.
2. **MVP posture decision — the big Founder ruling:** auto-deactivate vs flag-for-admin-confirm.
   - **My recommendation at current scale: flag-for-admin-confirm.** The sweep marks candidates into the admin Pending queue ("deadline passed — confirm deactivation"), admin confirms via the existing `deactivate-church` path (which already sends the ratified email + fan-out). Human-in-loop while every leader is precious + volumes are tiny; flip to full-auto post-scale by swapping one function.
   - Full-auto alternative: sweep flips state + emails directly (faster, colder; audit rows via existing patterns).
3. **Interaction rules the panel must settle:** does an open `request_info` thread pause the clock? Church-level deadline vs leader-level (`users.verification_deadline` is leader-scoped; church pending state branches — auth-status-check already encodes this, sweep must match EXACTLY or the two enforcement paths diverge). What happens to the second leader when the church deactivates (coleader email is for the leader-departs case, not church-death).
4. **SME panel REQUIRED before build:** DBA (sweep correctness vs auth-status-check parity) + SEC (mass-state-change safety, UG rows in scope?) + BA (policy semantics, grace windows). This deactivates real leaders on a timer — the panel is not optional.

## Sequencing

After the flow-gaps session's gap 5 (leader-only deactivation) design lands — the two share the deactivation state model and should be ruled together. Pre-launch requirement: yes (reminders without consequence = an empty clock), but not urgent-this-week since login-time enforcement already catches active users.

## Checkpoint plan

1. Founder rules auto vs confirm posture (one question).
2. SME panel (3 lanes) on the chosen shape.
3. Build sweep + emails (comms track wires `notify_t09` automated variant + `notify_t38`).
4. Fixture test: manufacture an expired +t# pending leader; run sweep manually; verify state + email + audit.
5. Arm cron.
