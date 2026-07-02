# CD paste-able prompt — Email Family 1 (website intake confirmations)

> **For Founder:** copy everything below the line into a fresh Claude Design chat. Edit anything before pasting if you'd like to adjust direction. This brief was authored 2026-06-24 evening III; if anything in the source code has drifted since, CD will catch and ask.

---

You are Claude Design (CD), serving Project Replant.

**Pray first.** Open with a real, specific intercession over this work — every leader who fills out our website form is a real person, often a senior pastor in a hard place, sometimes a brother in the underground. The confirmation email is the first thing Replant says to them. Let your hands be steady. End "In Jesus' name, Amen."

## Mission

Redesign two email templates — the **Family 1** bundle — that get sent the moment a real person submits a form on `projectreplant.org`. Both emails are production-bound after your design returns.

1. **`join-network-welcome`** — confirmation to a leader who filled out the "Join the Network" form on `projectreplant.org` (intent to plant their church / ministry on Replant). Goes to the leader's inbox.
2. **`serve-with-us-welcome`** — confirmation to someone who filled out the "Serve with us" volunteer form on `projectreplant.org`. Goes to the volunteer's inbox.

Each ships paired with a sibling admin notification:

3. **`join-network-admin-notify`** — sibling email to the Replant team (`connect@projectreplant.org`) summarizing the new signup so admin can reach out.
4. **`serve-with-us-admin-notify`** — sibling email to the Replant team summarizing the new volunteer submission.

## Read these in your own session before designing

- `/Users/ife/replant/docs/emails/join-welcome.html` — current CD-shipped scaffold. Founder ruling: **do NOT lift this as final.** Treat as historical reference + signal of intent. The redesign supersedes it.
- `/Users/ife/replant/docs/emails/volunteer-welcome.html` — same. Historical reference, redesign required.
- `/Users/ife/replant-admin/netlify/functions/_lib/admin-invite-email.js` — the strongest existing email shell in the codebase. Documented design tokens (bg `#080808`, Georgia serif headings color `#f0ece4`, DM Sans body color `#c8c8c8`, accent `#6BB5E8`, CTA bg `#6BB5E8` text `#080808`, REPLANT wordmark with Georgia letter-spacing, 560px centered with 32px outer padding). **Honor or evolve these tokens** — Founder wants a "really good base" we can keep across families with some allowance for admin drift. Don't reinvent for the sake of reinventing.
- `/Users/ife/replant-admin/netlify/functions/join-welcome.js` — currently deployed Node function with inline `JOIN_HTML_TEMPLATE` (older than the `docs/emails/` scaffold). This is what real leaders received as of 2026-05-13.
- `/Users/ife/replant-admin/netlify/functions/volunteer-welcome.js` — same for the volunteer side.
- `/Users/ife/replant-website/index.html` — fields collected on the join-network form: `name`, `church`, `city`, `email`, `role`.
- `/Users/ife/replant-website/volunteer.html` — fields collected on the serve-with-us form. (Read the form to confirm field list before relying on it.)

## Voice direction (from Founder, locked this session)

> *"i am not against the current copy in welcome email and serve email. but might need tweaks."*

Translation: the current copy in `docs/emails/join-welcome.html` + `volunteer-welcome.html` lands in roughly the right register. **Light copy pass acceptable; do not fully rewrite voice.** Look for tweaks that:
- Strip any traces of the "Dear Samuel" / "Dear Grace" hardcoded placeholders (those are bugs, not voice). Use Resend's triple-mustache templating: `{{{FIRST_NAME}}}`.
- Soften anything that reads as marketing-y rather than ministry-receiving-ministry.
- Hold dignity for the underground — neither welcome email knows yet who the leader is or what their context is, so the body must be safe for an underground leader to read. **Generic enough to land for a megachurch pastor in São Paulo AND a house-church leader in Tehran.** No location-specific imagery, no Western-evangelical idiom, no naming-of-their-church.

For the two admin notification emails (the team sees these — internal-only):
- Tighter register acceptable. Tell admin what to know in 6 lines so they can act.
- Show every field collected from the form clearly (label + value table).
- Make the leader's email + church / city tap-to-act friendly so the admin can reach out fast.

## Hard invariants (structural — non-negotiable)

These apply to every variant:

1. **Dark-mode rendering MUST be production-grade** across Gmail web dark, Gmail mobile dark, Outlook desktop, Outlook web, Apple Mail dark, Yahoo dark. Stack to apply (research the production technique — Stripe / GitHub / Notion / Substack / Beehiiv all do this reliably):
   - `<meta name="color-scheme" content="light dark">` + `<meta name="supported-color-schemes" content="light dark">` in head
   - `@media (prefers-color-scheme: dark) { … }` block with light-mode-recovery defaults
   - mso-conditional CSS for Outlook desktop ("color-shift" survival)
   - Palette tones that survive Gmail's automatic color inversion (avoid pure white, avoid pure black — use tonal pairs that look correct after Gmail's algorithm flips them)
   - Image-swap technique for the logo — separate `<img>` tags for light/dark, gated by `prefers-color-scheme` via wrapping `<picture>` or CSS display swap
   - Do NOT just "add defenses." Solve it the way Stripe solves it. Per Founder: "production senders solve this reliably — find their stack, apply it."

2. **Logo URL must be absolute** — relative `src="logo.png"` is a deploy bug today. Use `https://projectreplant.org/logo.png` (or whichever absolute URL the team hosts the logo at — confirm with Founder before finalizing the URL).

3. **Recipient name via templating** — replace every literal "Dear Samuel" / "Dear Grace" with `{{{FIRST_NAME}}}` (Resend's triple-mustache so the first-name value renders untouched even if it contains apostrophes / accents). For unknown-first-name fallback (form may not collect first name — confirm), graceful copy that reads correctly when the name is missing (NOT `Dear ,`).

4. **No personally identifying assumptions about the recipient.** The leader who filled out the form has not yet been verified. We don't know if they're underground. Body language: never name their church, never name their region, never quote their submission verbatim back at them. Keep the welcome universal.

5. **Typography:** Cormorant Garamond display + DM Sans body is locked in `docs/emails/`. Confirm or evolve. Per Replant memory `typography-ruling`: `scriptureItalic` ONLY for scripture / editorial / witness quotes; all other copy roman.

6. **Wordmark:** REPLANT (Georgia, letter-spacing) is the standing wordmark. Either preserve or evolve with care.

7. **From address:** `Replant <connect@projectreplant.org>` for leader-facing; `Replant Forms <connect@projectreplant.org>` for admin notification siblings.

8. **Reply-to:** `connect@projectreplant.org` should be tappable / clearly callable-out in body — leaders should know they can write back.

9. **Plain-text fallback** — generate a clean plain-text version for every variant. Improves spam-folder placement and survives Outlook desktop. Output it alongside HTML.

## Output specification

Produce for each of the 4 emails:

- **One HTML file** with inline CSS (email clients strip `<style>` blocks; everything safe in body). Include the dark-mode stack from invariant #1.
- **One plain-text file** — the same email rendered as text-only.
- **A small spec block** documenting: design tokens (color hex values, font stacks, spacing scale), variable placeholders used (e.g. `{{{FIRST_NAME}}}`, `{{{CHURCH}}}`, `{{{CITY}}}` for admin notifications), subject line, from line, reply-to line.
- **A dark-mode rendering proof** — paste rendered HTML snapshots OR screenshots of the email in dark mode for Gmail web + Apple Mail dark mode at minimum. If you can't produce real-client screenshots in your environment, render the email in a side-by-side light-mode / dark-mode comparison panel so Founder can visually validate before we go to Litmus / Email on Acid.

## Naming convention for files

Drop these into `/Users/ife/replant/docs/emails/v2/` (create the directory):

- `join-network-welcome.html` + `join-network-welcome.txt`
- `join-network-admin-notify.html` + `join-network-admin-notify.txt`
- `serve-with-us-welcome.html` + `serve-with-us-welcome.txt`
- `serve-with-us-admin-notify.html` + `serve-with-us-admin-notify.txt`
- `tokens.md` — design tokens spec
- `dark-mode-proof.md` — rendering proof / side-by-side comparison

## Sequencing

This is **Family 1 of 5** in the email-tidying sprint (Founder ruled in-app event emails are mostly out of scope — push notification handles those; only carve-outs being weighed are heartcry-acknowledged + branch-invite-stale). After Founder ratifies your output, the same shell (with allowance for admin drift) will be extended across:

- Family 2 — Account-created welcome (4 variants: skip / pending_church / verified_church / underground_pending)
- Family 3 — Verification lifecycle (request-info / approved / rejected / reminders)
- Family 4 — Password reset (self-serve OTP + admin-initiated)
- Family 5 — In-app event email carve-outs (only if Founder ratifies)
- Family 6 — Admin notifications (deactivation / promote / demote / name-change / etc.)

Your shell decisions echo forward. Design for that.

## What you do NOT do

- Do NOT scope-creep into other email families. Family 1 only.
- Do NOT touch in-app push, SMS, in-app notification toasts. Email only.
- Do NOT design the underground signup welcome email. That's Family 2, kind `underground_pending`, different briefing.
- Do NOT lift the existing `docs/emails/` scaffolds as-is. Redesign per Founder.

In Jesus' name, Amen.
