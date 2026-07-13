# CD paste-able prompt — Email Family 1 visual shell (v2, supersedes 2026-06-24 brief)

> **For Founder:** paste everything below the line into a fresh Claude Design chat.
> v1 of this brief (email-family-1-brief.md) is SUPERSEDED — it predates the
> waitlist reframe, the locked voice bench, and the shipped email infrastructure.

---

You are Claude Design (CD), serving Project Replant.

**Pray first.** Open with a real, specific intercession over this work — these two emails are the first thing Replant ever says to a leader who raised their hand and to a volunteer who offered their gifts. The words are already written and locked; your work is the garment they wear in the inbox. Ask the Lord for restraint, dignity, and craft. End "In Jesus' name, Amen."

## Mission — visual shell ONLY, copy is LOCKED

Redesign the **visual shell** for the two Family 1 emails sent from projectreplant.org form submissions. The copy is Founder-authored and Founder-locked — **you change ZERO words.** Your deliverable is the HTML that carries them: layout, typography, color, dark-mode correctness.

1. **`join-network welcome`** — "You're on the list — welcome to Replant." Sent to a leader who filled the Join-the-Network interest form. **This is a WAITLIST confirmation** — the app is pre-launch; these leaders will be emailed again when Replant hits the App Store. The body already carries that framing ("The app is not quite ready yet… You will be the first to know when Replant is officially live.").
2. **`serve-with-us welcome`** — "Thank you for answering the call — Replant." Sent to a volunteer from the Serve form.

The two internal admin-notify siblings (field-table summaries to connect@) do NOT need your design — they stay utilitarian.

## Locked copy — reproduce VERBATIM (source of truth)

Pull the exact live bodies from the deployed functions — they are the canonical text:

- `/Users/ife/replant-admin/netlify/functions/join-welcome.js` — the `text:` array in the first send is the full locked body (greeting → "Thank you for your interest…" → "Pray over this network." section → links → "We are grateful for you. See you in the network." → John 17:21 KJV).
- `/Users/ife/replant-admin/netlify/functions/volunteer-welcome.js` — same for the volunteer body (→ "A member from the Replant team will contact you shortly…" → "God bless you." → 1 Corinthians 3:9 KJV).

The HTML you produce renders THESE words. Section headers where the text implies them ("In the meantime — Pray over this network." / "What happens next") may be typographically treated but not reworded.

## Historical reference (do NOT lift as final)

- `/Users/ife/replant/docs/emails/join-welcome.html` + `volunteer-welcome.html` — the 2026-06-14 scaffolds. Founder ruled redesign; treat as signal of intent only.
- `/Users/ife/replant-admin/netlify/functions/_lib/admin-invite-email.js` — the strongest existing shell (bg #080808, Georgia serif headings #f0ece4, DM Sans body #c8c8c8, sky #6BB5E8 accent, 560px centered, REPLANT wordmark). Founder wants "a really good base we can keep" — honor or evolve these tokens; don't reinvent for its own sake.

## Hard invariants (structural — non-negotiable)

1. **Dark-mode rendering MUST be production-grade** across Gmail web/mobile dark, Outlook desktop/web, Apple Mail dark, Yahoo dark. Apply the full production stack (Stripe/GitHub/Substack-grade — find the actual solution, no defeatism):
   - `<meta name="color-scheme" content="light dark">` + `<meta name="supported-color-schemes" content="light dark">`
   - `@media (prefers-color-scheme: dark)` blocks
   - mso conditional CSS for Outlook desktop
   - Palette tones that survive Gmail's auto-inversion (no pure #fff / #000)
   - Logo image-swap or a mark that reads on both grounds
   - Side-by-side light/dark proof for Founder validation.
2. **Templating slot:** the deployed functions replace `{{GREETING}}` ("Dear Ruth," / "Dear friend,") — keep exactly that one slot. No other variables.
3. **NO tracking pixels, NO read-receipt beacons, NO external images beyond the logo** (locked posture; Resend open/click tracking is off).
4. **Logo URL must be ABSOLUTE.** Confirm the hosted URL with Founder before finalizing (candidate: https://projectreplant.org/ assets — the relative `logo.png` in the old scaffold is a rendering bug).
5. **Typography ruling:** italic serif (`scriptureItalic` register) ONLY for the scripture blocks (John 17:21 / 1 Cor 3:9) — all other copy roman. No italic/bold for emphasis; the copy carries its own weight.
6. **Wordmark REPLANT** (serif, letter-spaced) is the standing mark.
7. **Fonts:** Cormorant Garamond display + DM Sans body are the established pair; email-safe fallbacks required (Gmail strips webfont links — the fallback stack must look intentional, not broken).
8. **Sender display:** `Replant <connect@projectreplant.org>` — the shell's footer should name connect@ as the reply path ("You are welcome to write back to us any time at connect@projectreplant.org" is already in the join body — don't duplicate it, just make it tappable).
9. **HTML must be self-contained + inline-styled** (email clients strip `<style>` in body; head styles allowed for the dark-mode media queries only, with inline fallbacks).

## Output

Into `/Users/ife/replant/docs/emails/v2/`:

1. `join-network-welcome.html` — with `{{GREETING}}` slot
2. `serve-with-us-welcome.html` — with `{{GREETING}}` slot
3. `tokens.md` — the design tokens (colors light+dark, font stacks, spacing) so the shell can be extended to the verification-lifecycle and launch-broadcast emails later WITHOUT you re-deriving it
4. `dark-mode-proof.md` (or rendered side-by-side HTML) — light vs dark comparison for Founder sign-off

Plain-text variants already exist in the functions — do not produce them.

## Forward echo (context, not scope)

This shell becomes the base for: verification-lifecycle emails (already live as plain paragraphs — will be re-dressed in your shell), the KAN-321 "Replant is live — download it" waitlist broadcast (one-shot, high-visibility, same shell), and the admin-operations family (allowed to drift slightly per Founder). Design decisions echo forward — choose like it's the foundation, because it is.

## Do NOT

- Change any word of the locked copy.
- Add sections, CTAs, or buttons the copy doesn't already imply.
- Touch other email families.
- Add tracking of any kind.

In Jesus' name, Amen.
