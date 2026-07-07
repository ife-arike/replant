# KAN-205 — In-app account deletion: CONTENT copy set

CONTENT lane · 2-role mini-panel (SEC lane parallel) · 2026-07-03
Scope: full deletion per Apple 5.1.1(v). Copy below is verbatim-ready.

**Verdict (CONTENT): APPROVED for build.** Every line is honest to the five verified facts — nothing softened, nothing overclaimed. Two lines are marked `[SEC-COORD]` and must be confirmed against the SEC lane's UG-restore findings before ship; both are written mechanism-free so they stay true under any restore design.

**Register match:** mono-uppercase eyebrows and hints (DeactivationModal), plain sentence-case titles, short sentences, no exclamation marks, no scripture (functional surface class), `accounts@projectreplant.org` rendered plain and tappable. `{church_name}` / church-vs-organization noun follows `viewerOrgCopy` (BA-para #1). Jargon audit: zero — no "soft-delete", "window period", "de-attributed", "RPC".

---

## 1. Settings row (destructive footer — replaces "DEACTIVATE ACCOUNT")

Label (mono uppercase red, existing `styles.deactivate` treatment):

> DELETE ACCOUNT

Sub-line (new; small, muted, sentence case, under the label):

> Starts a 30-day window before your account is permanently removed.

Accessibility label: `Delete account`. Hint: `Opens the account deletion steps`.

---

## 2. First confirmation screen

Eyebrow: `BEFORE YOU DECIDE`
Title: **Delete your account**
Lead line:

> Here is exactly what happens, so you can decide in peace.

Body (four short paragraphs, in this order):

> Deleting your account starts a 30-day window. During that time you can change your mind — sign back in, and you can restore everything as you left it. `[SEC-COORD — accurate for surface accounts; UG variant in §6]`
>
> After 30 days, your account is permanently deleted. Your name, email address, and phone number are removed from Replant, and you will no longer be able to sign in.
>
> What you gave to the community stays with the community. Prayers, testimonies, comments, and messages you already sent remain with the people you shared them with — no longer attached to your name.
>
> If something is wrong that we could help with, we would like to hear it before you go. Write to accounts@projectreplant.org.

Sole-leader disclosure (conditional block, visually set apart, above the buttons — required whenever the leader is the only leader of their church/organization):

> One more thing you should know. You are the only leader for {church_name} on Replant. If your account is deleted, {church_name}'s place in the network is removed with it, on the same schedule.

Buttons: **Keep my account** (safe, primary placement) · **Continue** (destructive, quiet).
Accessibility: `Keep my account and go back` / `Continue to the final confirmation`.

---

## 3. Final confirmation ceremony (both shapes — SEC lane picks)

Shared chrome — eyebrow: `FINAL CONFIRMATION` · Title: **This is the final step.**
Shared body:

> Your account closes now, and the 30-day window begins. After that, deletion is permanent.

Sole-leader echo (conditional, one line, directly under the body):

> {church_name} leaves the network with you.

**Shape 1 — type-to-confirm (CONTENT recommendation):**
- Instruction: `Type DELETE to confirm.`
- Input placeholder: `DELETE`
- Mismatch helper (muted, not scolding): `Type DELETE in capital letters to continue.`
- Confirm button (disabled until exact match): **Delete my account**
- Quiet exit: **Keep my account**
- Confirm word ruling: `DELETE` — it is the word on the row they tapped, unambiguous at an English-only MVP, and never echoes a name or church (matters for anonymous and UG leaders).

**Shape 2 — hold-to-confirm:**
- Instruction: `Press and hold the button below to confirm.`
- Button: **Hold to delete**
- During hold (mono hint): `HOLD TO CONFIRM`
- Released early (muted): `Held too briefly. Hold until the bar completes.`
- Quiet exit: **Keep my account**
- Accessibility note: holds are hard for switch-control and tremor users — if SEC picks this shape, an a11y alternative activation is required; typed shape avoids the problem.

---

## 4. Post-deletion goodbye (signed-out; floats over Login like DeactivationModal — cold-viewable, so ONE copy for all accounts, mechanism-free by design)

Eyebrow: `YOUR ACCOUNT`
Title: **Your account is closing.**
Body:

> Deletion completes in 30 days. If you change your mind before then, return within the window and your account can be restored.
>
> Thank you for the time you spent here. Go in peace — you will be welcome back.

Email centerpiece (tappable, existing treatment): `accounts@projectreplant.org`
Mono hint: `TAP TO COPY & OPEN MAIL` / `OR TAP OUTSIDE TO CLOSE`

---

## 5. Sign-in-during-window restore prompt (welcome-back ceremony; authenticated surface)

Eyebrow: `WELCOME BACK`
Title: **Your account is waiting.**
Body:

> On {date} you asked us to delete this account. {n} days remain before that becomes permanent. You can restore everything as you left it, or let the deletion finish.

Buttons: **Restore my account** (primary) · **Continue with deletion** (quiet, destructive).
After restore — inline flash (matches the Settings "Saved" flash register): `Restored`
Follow-on line (banner or first-screen note): `Your account is restored. Everything is as you left it.`
If they choose to continue — sign-out line before returning to the goodbye state:

> Deletion continues. {n} days remain, and the door stays open until then.

---

## 6. Underground variants (only where lines differ)

UG doctrine holds: generic chrome, byte-identical on any cold-viewable surface. §4 goodbye and §5 prompt need NO variant — §4 was written mechanism-free for everyone, and §5 shows only after successful sign-in.

1. §2 restore sentence, UG accounts: replace the first paragraph's second sentence with — `If you return within 30 days, your account can be restored.` `[SEC-COORD — stays true under any UG restore design; never describe the protected path on-screen, whatever SEC finds.]`
2. §2 support paragraph, UG accounts: omit entirely (precedent: VerificationBanner UG pending drops the admin email; UG contact is in-app). The absence sits on an authenticated surface, so no fingerprint.
3. §2 and §3 sole-leader lines, UG with hidden church name: `You are the only leader of your fellowship on Replant. If your account is deleted, your fellowship's place in the network is removed with it, on the same schedule.` / echo: `Your fellowship leaves the network with you.` (Brave UG with show_church_name = true renders the name per existing display rules.)

---

## 7. FAQ entries (append to FAQ_DATA; house q/a register)

1. Q: `What happens when I delete my account?`
   A: `Deletion starts a 30-day window. During that window your account is closed but can still be restored. After 30 days it is permanently deleted — your name, email address, and phone number are removed, and you can no longer sign in.`
2. Q: `Can I come back after deleting my account?`
   A: `Within 30 days, yes. Open the app and sign in, and you will be offered the choice to restore your account exactly as you left it. After 30 days the deletion is permanent, and returning means starting fresh with a new account.` `[SEC-COORD — "open the app and sign in" must hold for UG restore too, since the FAQ is one surface for everyone; if it does not, cut the middle clause to "Within 30 days, yes — your account can be restored."]`
3. Q: `What happens to what I shared?`
   A: `Prayers, testimonies, comments, and messages you already sent remain with the people you shared them with. After permanent deletion they are no longer attached to your name.`

---

## 8. Confirmation email — flagged, not resolved

Recommendation (one line): none at MVP — the goodbye screen already carries every fact; when email infrastructure matures, send a single neutral-subject confirmation, skipped or extra-plain for underground accounts, because an inbox is a paper trail.

---

## Contradiction flags (not fixed here — one line each)

1. `src/components/auth/DeactivationModal.tsx` — "Account deactivated" + appeal-to-restore copy now shares vocabulary with deletion; verification deactivation must never read as data deletion once this flow ships.
2. `src/screens/main/SettingsScreen.tsx` `handleDeactivateTap` ComingSoon copy ("Account deactivation is on the way… guided deactivation flow") — superseded; dies when this flow lands.
3. `src/components/home/VerificationBanner.tsx` amber/urgent "will be deactivated" — unchanged meaning, but needs a later sweep so "deactivated" and "deleted" stay visibly distinct terms.
4. Contact addresses diverge across adjacent surfaces — FAQ uses info@, Settings connect block uses connect@, deletion and deactivation use accounts@; needs one ruling, not fixed here.
5. FAQ "Can a pastor remain anonymous…" says identity data "is kept strictly confidential" — permanent deletion now REMOVES it; not a contradiction, but the new FAQ answers must sit consistently beside that claim.

---

## Open Founder decisions (4)

1. Confirmation email — recommend defer to post-MVP with the UG-sensitive shape above; confirm or order it built now.
2. Final ceremony shape — type-DELETE (CONTENT recommends: deliberate, accessible, English-only MVP) vs hold-to-delete; both copy sets above are build-ready.
3. First-screen safe button — "Keep my account" (CONTENT recommends: warmer, states the outcome) vs house-standard "Cancel".
4. Settings sub-line — include the 30-day mention (CONTENT recommends: honest at first glance, aids App Review discoverability) vs bare "DELETE ACCOUNT" label alone.
