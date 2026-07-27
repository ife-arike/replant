# KAN-321 — "Replant is live" waitlist broadcast runbook

**Trigger:** manual, Founder-initiated, on App Store approval day. One-shot,
high-visibility, no re-send button. Everything below stages ahead of time so
launch day is a 30-minute checklist, not a scramble.

**Mechanism ruling (Batch 6):** Resend **Broadcast + Audience**, NOT a custom
sender function. Reasons: broadcast-class email gets a compliant unsubscribe
link for free (CAN-SPAM — this is the one Replant email that is announcement-
class, not transactional), Resend handles list-level suppression, and the
send is reviewable in the dashboard before firing.

## Pre-stage (any time before launch)

1. **Recipient source:** the Join-Us Registrations Google Sheet (Netlify
   `submission-created` appends every join-network submission; column E =
   email). ⚠ Real waitlist PII — pointer-only in artifacts per Founder
   ruling; never export into a repo.
2. **List hygiene pass (CC does this on launch week):**
   1. Dedupe emails (case-folded).
   2. Drop rows present in `email_suppressions` / hard-bounced in `email_log`
      (query via Supabase; the intake welcome sends give bounce signal).
   3. Drop obvious test fixtures (`ruthjames08+t*`).
3. **Import → Resend Audience** "Replant waitlist" (via Resend MCP
   `create-contact-import` or dashboard CSV upload).
4. **Copy:** drafted below — Founder ratifies BEFORE launch week, CD shell
   (docs/emails/emails-v2 tokens) applied. Compose as a Resend Broadcast
   draft (`compose-broadcast`), leave UNSENT.

## Launch day

1. Confirm the App Store link resolves (and Play link if applicable).
2. Paste final link(s) into the broadcast draft; Founder reads the rendered
   preview in the dashboard.
3. **Founder presses send** (or explicitly tells CC to `send-broadcast`).
4. Watch the Resend broadcast dashboard for delivery/bounce stats; the
   email-dead-letter digest cron will surface estate-level anomalies.

## Draft copy (Founder ratifies; voice bench = her join-us draft)

Subject: **Replant is here.**

> Dear friend,
>
> The day we wrote to you about has come. Replant is live on the App Store.
>
> You raised your hand before you could see the whole picture, and you have
> been on the list since. You are among the first to know: the network is
> open, and your place in it is ready.
>
> **Download Replant:** [App Store link]
>
> Sign up with this email address, register your church or ministry, and
> our team will walk with you through verification.
>
> Thank you for praying over this network while it was being built. The
> churches yet to connect, the leaders carrying burdens alone, the brothers
> and sisters who suffer for the Name — this is for them, and for you.
>
> See you in the network.
>
> — The Replant Team
>
> *"That they all may be one, as thou, Father, art in me, and I in thee…"*
> John 17:21 — KJV

Tag: `intake_t41` (reserved in email-tag-map.json). Unsubscribe footer:
Resend broadcast default.

## Known-open before this can fire

1. Copy ratification (above).
2. App Store approval (external gate).
3. List hygiene pass (launch week).
4. Family-1 shell applied to the broadcast HTML (CC, launch week).
