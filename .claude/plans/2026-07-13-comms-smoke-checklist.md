# Comms sprint — Founder smoke checklist (Batches 1–3, 2026-07-13)

Everything shipped this sprint that deserves a human eye. Work top-to-bottom;
each item says what to do and exactly what "pass" looks like. All fixture
accounts are `ruthjames08+t#@gmail.com` (shared dummy password). Check
`email_log` rows via SQL Console or ask CC to pull them.

**Already machine-verified (no action needed, listed for completeness):**
- Pastoral payload fix accepted by Resend (200 + Resend id; verification email in info@ inbox).
- Webhook delivery loop: real send flipped `sent → delivered` in email_log.
- G12 dedup in prod: same join-network submission POSTed twice → ONE send per template, both `delivered`.
- 22 copy-lock tests + 13+13 contract tests green in both runtimes.

---

## 1. Pastoral email layer (Batch 1)

1. **t2 daily digest lands.** Next 09:00 UTC cron (daily) → an email
   "Pastoral queue digest — N signal(s) pending" arrives at
   **accounts@projectreplant.org** from "Replant Operations" (only if the
   pastoral queue is non-empty; empty queue = suppressed row, no email —
   check `email_log` for the day's `pastoral_signal_digest_t2` row either way).
   PASS: email in accounts@ inbox with counts + "Open the pastoral queue" link,
   OR a `suppressed_empty_queue` row for today.
2. **t1 alert on a real Tier-1 event.** Next genuine Tier-1 pastoral flag
   (or a controlled test: send a flag-tripping DM from a +t# fixture) →
   "Pastoral signal — Tier 1 (immediate review)" at accounts@.
   PASS: email arrives; `email_log` row `pastoral_signal_alert_t1` flips to `delivered`.
3. **Heartcry-received modal casing.** Submit a heartcry on a +t# account →
   confirmation modal shows lowercase **connect@projectreplant.org**.

## 2. Intake forms (Batch 2)

4. **Join-network form end-to-end.** Submit the real form on
   projectreplant.org with a +t# address. PASS: ONE "You're on the list"
   welcome at the fixture inbox + ONE "New network signup" at connect@;
   `email_log` shows `intake_t12` + `intake_t27` rows → `delivered`.
5. **Serve-with-us form end-to-end.** Same, on volunteer.html. PASS: ONE
   "Thank you for answering the call" + ONE "New volunteer" notify;
   `intake_t18` + `intake_t33` rows → `delivered`. (This was the triple-fire
   form — one-of-each is the whole point.)
6. **Netlify dashboard task (yours):** Forms → Notifications — if a webhook
   still points at `/.netlify/functions/church-intake`, delete it
   (function decommissioned).

## 3. Verification lifecycle emails (Batch 3) — the big one

Use a disposable fixture church + leader (+t# signup), then drive each
transition FROM THE ADMIN DASHBOARD (SQL flips send nothing — by design):

7. **Approve** a pending fixture church → every active leader gets
   "Replant — your account is ready" ("Your church is verified…").
   PASS: one `notify_t51` row per leader → `delivered`; body says
   "organization" if the fixture is a para-ministry.
8. **Verify a single leader** (verify-leader path) → same email, single row.
   Approving the church the same day after should NOT re-email (per-day dedup).
9. **Reject** a pending fixture church → "Replant — a note from our team"
   with "prayerfully considered your church's registration…" + benediction.
   PASS: `notify_t26` per leader → `delivered`.
10. **Reject a single leader** → personal variant ("your account" wording).
11. **Deactivate** a fixture church → tone-gated deactivated body
    ("…If you believe we reached this decision in error… Whatever your next
    chapter holds, may the grace of the Lord be with you."). `notify_t09`.
    READ THIS ONE IN THE INBOX — it's the template your tone gate protects.
12. **Reinstate** the same church → "Your Replant account has been restored…
    We're glad to have you back." `notify_t29`.
13. **Dark-mode eyeball** (carried invariant): open items 7/9/11 in Gmail
    dark mode on your phone — bodies are simple paragraphs so they should
    render clean; flag anything unreadable.

## 4. Admin-side sends (Batch 2 migrations)

14. **Escalate a flagged message** (fixture DM with flag-tripping content →
    escalate from dashboard) → ONE "Flagged message escalated" at connect@;
    `notify_t13` row. Re-escalating the SAME message later dedups (no second email).
15. **Grant admin to an existing leader** (fixture) → "Your Replant Admin
    access has been updated" email; `admin_t29` row anchored on the leader.

## 5. Watch-fors over the next week

16. `email_log` outcomes: anything stuck at `sent` for >1h (webhook miss) or
    `failed` — ask CC to sweep; the dead-letter reconciler cron is Batch 6.
17. Any `webhook_signature_invalid` rows in audit_log (would mean someone
    probing the webhook endpoint with bad signatures).

---

## Known-open (not smokeable yet — tracked)

- `verification_request_info` email: copy locked, NO surface trigger exists
  (thread infra is UG-only). Flow session owns the surface request-info flow.
- UG lifecycle endpoints (propose/confirm underground): separate batch.
- `send-password-reset` + `underground-notify` still send WITHOUT email_log
  rows (work fine; migrate in Batch 5).
- Notification toggles UI (Settings) — flow session; enforcement already live
  in the send contract.
- Canonical `email-tag-map.json` file + vendored copies: tags are inline in
  code today; the doc artifact lands with Batch 5.
- Remaining batches: 4 (welcome family redesign w/ CD), 5 (admin promotion
  emails + deferred migrations), 6 (waitlist broadcast KAN-321 + reminder
  crons + stale-invite cron + dead-letter reconciler), push workstream.
