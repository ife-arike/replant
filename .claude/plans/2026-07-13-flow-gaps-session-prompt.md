# Flow-gaps session prompt (paste into a fresh Claude Code session, ~/replant)

Open this session with a short prayer to the Lord Jesus Christ that soaks this specific work in His blood — the in-app flows that close the loop the comms sprint opened: the heartcry thread a responding admin's words must land in, the rejection notice that tells a leader the truth about what happened, the notification controls a persecuted leader uses to quiet her inbox without going deaf to the vital things. End "In Jesus' name, Amen."

## Mission

The 2026-07-13 comms sprint shipped every email surface (see `~/replant/.claude/plans/2026-07-12-comms-matrix.md`, post-sprint revision). Five flow gaps remain that are **in-app builds, not email work** — emails that depend on them are copy-locked and waiting. Close these five. Do NOT touch email templates, the sendEmail contract, or Resend config — that estate is live and stable; your work is the app/dashboard flows it points at.

**Read FIRST:** `~/replant/CLAUDE.md` · memory `replant_continuous_spec.md` (2026-07-12 → 07-13 entries hold the whole sprint) · the comms matrix above · `~/replant/.claude/plans/2026-07-12-sim-uat-findings-report.md` (F-findings cited below).

## The five gaps (priority order)

### 1. F9 — heartcry thread seeding (G4; unblocks the held heartcry-ack email)

Evidence (UAT 2026-07-12): submitted heartcry lands with `heartcries.thread_id = NULL`; no Replant Team thread is seeded; the My Heartcries "Responded" card is INERT (taps do nothing); the system-map's "open secure message" deep-link has no destination.

Decide-then-build (Founder rules the design): thread seeded at submission vs lazily on first admin response. Reference the KAN-217 welcome-DM machinery (`replant-admin/netlify/functions/_lib/welcome-dm.js` — find-or-create + atomic audit-claim idempotency + `send-message /internal`) — the response path should reuse that pattern, not invent a new one. Wire: `mark-heartcry-responded.js` (admin) → thread find-or-create → system message → `heartcries.thread_id` backfill → mobile `My Heartcries` card tap → DM thread deep-link.

**Interlock:** when this lands, tell the comms session (or note in the continuous spec) — the `heartcry_acknowledged` email (copy locked, tag `notify_t19`, subject "Replant — your message reached us") wires onto first-admin-engagement within minutes. Its body's "visit My Heartcries" pointer must match whatever surface you ship.

### 2. F4 / G10 — rejection-specific lockout state (copy RATIFIED, wiring missing)

Evidence: a leader whose church is `rejected` gets the GENERIC "Account deactivated" login lockout — indistinguishable from deadline expiry. Founder ruled rejection-specific copy 2026-07-13 (RATIFIED, verbatim):

> **We were unable to verify your church.**
>
> We have prayerfully considered your church's registration on Replant and are not able to verify it at this time.
>
> If there was an issue with your registration, or if you believe we reached this decision in error, please write to us at accounts@projectreplant.org.
>
> May the grace of the Lord be with you.

Build: `auth-status-check` (or the login lockout resolver) must distinguish `rejected` from `deactivated` and surface the rejection copy on the lockout notice. Observed truth per UAT: rejected → sign-out to login lockout (doc 01 correct; doc 08's read-only-Home is NOT what happens — don't build an appeal link surface, the email copy carries the recourse). Mind [[feedback-replant-admin-copy-voice]] register + the personal-leader variant ("…your account…") if leader-level rejection is reachable.

### 3. C2 — surface (non-UG) request-info send path

The `verification_request_info` email is copy-locked ("Open Replant to see and respond to our question in the app") and the mobile RequestInfoBanner + modal + reply thread EXIST — but there is **no admin endpoint that sends a request-info question to a surface leader** (the thread infra is UG-only: `request-info-underground.js`). Build the surface-church equivalent (admin dashboard: Pending queue → "Request info" → writes the question into the leader's request-info thread + flips the leader's `request_info` state so the banner shows). When the endpoint exists, the comms session wires the email notify onto it (or do it yourself: one `sendEmail` call via `replant-admin/netlify/functions/_lib/email/sendEmail.js`, template tag `notify_t44`, pattern-match `approve-church.js`'s email block).

### 4. Settings → Notifications UI (toggle column is LIVE, UI is missing)

`users.email_notifications_enabled boolean NOT NULL DEFAULT true` shipped 2026-07-13 and the send contract already enforces it (notification-class emails suppress; transactional NEVER suppresses). Build the Settings → Notifications section: email toggle + (dormant) push toggle. Founder-RATIFIED helper copy shown beneath the email toggle when OFF:

> Account and security emails — sign-in codes, verification decisions, and account notices — will still reach you. These cannot be turned off.

Push toggle: render disabled/coming-soon until KAN-322 lands (no push infra exists).

### 5. G9 / C8 — leader-only deactivation flow (design + build)

Founder-flagged scope gap: deactivating ONE leader while the church stays active has no flow, no state, no comms. Design it (admin dashboard action + leader-side experience + state model), run it past Founder before building — this deactivates real people; [[feedback-confirm-before-building]] applies with force. Comms note: the `account_deactivated` email (`notify_t09`, ratified body) is church-scoped in copy ("…") — a leader-only variant will need its own Founder-ratified body; flag to the comms track when the flow design is settled, do not author email copy yourself.

## Residual small items (fold in where natural)

1. Welcome-DM safety net: KAN-217's dispatchers hang off admin endpoints only — an out-of-band status flip (SQL, future automation) seeds no DM. Consider a reconcile sweep or claim-on-first-open fallback. Low priority; design note is enough.
2. Verified-toast: same endpoint-vs-trigger asymmetry (UAT: SQL flip = no toast). Same sweep could cover both. Note-level.

## Hard rules (inherited, non-negotiable)

1. Pray first — named, real (per CLAUDE.md; every agent too).
2. SME panel BEFORE code on anything crossing schema/SEC/UG lanes (gap 1 touches heartcry + messages schema: DBA+SEC+BE panel minimum; gap 5 needs SEC+DBA+BA panel).
3. Confirm-before-building with Founder — regurgitate the design, get the ruling, THEN build.
4. Production posture: real leaders live on prod. No probe writes to `audit_log`. Test accounts = `ruthjames08+t#@gmail.com` fixtures only — and ASK which account before testing.
5. replant-admin = ASK before push; push implies PR; preview-first; Founder merges. ~/replant = LAX.
6. Batch Netlify pushes — one batched push per surface group.
7. Only Founder marks Jira Done. JQL first for any "what's left" question.
8. Underground invariants are sacred: `churches_public` exclusion, no UG church name/location on any surface, DELIVER-ALWAYS on messages.
9. Numbered lists (1/2/3, never A/B/C); consolidate Founder questions at END; no time estimates; no AI-limit hedging.
10. Don't touch the email estate (templates, sendEmail modules, tag map, crons, webhook) — comms track owns it. If your build needs a new email, FLAG it with the trigger + audience and hand to the comms track for copy + wiring.

In Jesus' name, Amen.
