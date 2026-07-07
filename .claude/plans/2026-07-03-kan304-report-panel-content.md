# KAN-304 — Leader-facing report mechanism: CONTENT copy set

CONTENT lane · 4-role panel (SEC / MOD / BE+ADMIN parallel) · 2026-07-03
Scope: report affordance on every UGC surface (Apple 1.2(b) + Play UGC). Copy below is verbatim-ready.

**Verdict (CONTENT): APPROVED for build.** The copy set is complete and honest on both edges — a frightened leader can raise a concern in plain words, and a falsely-reported leader is never treated as guilty by any sentence here (a report "begins a review; it never decides one"). Three lines are tagged for cross-lane coordination: `[SEC-COORD]` on the never-identified promise, `[MOD-COORD]` on the reason matrix, `[BE-COORD]` on draft preservation and the rate-limit window.

**Register match:** plain warm sentences, no exclamation marks, no scripture (functional surface class — confirmed against the KAN-205 precedent), "the Replant team" as the standing name for the humans (RequestInfoBanner register), sentence-case buttons ("I understand" family), no email surfaced anywhere in the flow (keeps UG byte-identical by construction — see §6). Jargon audit: zero — no "moderation queue", "taxonomy", "violation", "flag" (as a noun), "submit a ticket". KAN-261 tone note applied throughout: human words ("Asking for money"), never form-speak ("Financial solicitation / scam").

**Fairness spine (both edges, stated once so every lane holds it):** the reporter is protected by *audience* ("this goes only to the Replant team") and the reported is protected by *process* ("a report begins a review; it never decides one"). Every surface below keeps both promises in view.

---

## 1. Entry affordances (per surface)

**Pattern ruling: name the object — "Report this message", never bare "Report."**
Three reasons. (1) The verb aims at the thing said, not the person — a leader reports *a message*, not a brother; the grammar itself protects the falsely-reported. (2) Screen-reader users hear menu items without the visual anchor; the noun carries the context ("Report" alone is meaningless in a VoiceOver rotor). (3) One pattern survives every surface, including detail sheets where the affordance is not anchored under the finger.

| Surface | Affordance | Verbatim label |
|---|---|---|
| DM message (`DMThreadView`) | long-press menu item | **Report this message** |
| Branch message (`BranchThreadView`) | long-press menu item | **Report this message** |
| Prayer (`PrayerWallDetailSheet`) | sheet action (overflow or quiet row) | **Report this prayer** |
| Testimony (`TestimonyDetailSheet`) | sheet action | **Report this testimony** |
| Comment (`CommentThread`) | long-press menu item | **Report this comment** |
| Church profile (`ChurchProfileBottomSheet`) | existing flag icon (visible control unchanged) | a11y label: **Report this church profile** (migrates the shipped "Report a concern" — Decision 3) |

Placement note: the report item sits **last** in any long-press menu, visually quiet (muted, never red) — it is a door, not an alarm. Red is reserved app-wide for destructive-to-self actions; reporting is not destructive and must not feel like an attack.

`[MOD-COORD]` flex: if MOD's matrix adds person-level reporting from the DM header (Play "report users" leg), the same pattern extends — **Report this conversation**. Wording holds; no redesign needed.

---

## 2. The report sheet

**Title:** Report to the Replant team

Keeps the word "Report" (no evasion — this is the mechanism Apple 1.2(b) looks for) and names the receiver in the same breath, so the title itself carries the first reassurance: it goes to the team, not to the person.

**Framing line (directly under the title):**

> This goes only to the Replant team — you won't be identified to anyone involved. `[SEC-COORD — must match SEC's masking guarantee word for word]` A report begins a careful review by people. It never decides one on its own.

**Reason list** (single-select; label + small desc, the UndergroundEntryScreen row pattern). Group label: **What's the concern?**

| # | Label (verbatim) | Desc (verbatim) | Likely taxonomy merge `[MOD-COORD]` |
|---|---|---|---|
| 1 | Threats, or someone may be unsafe | Someone is being threatened or could be in danger | threats · imminent_threat · duress_signal |
| 2 | Trying to find out who or where someone is | Pressing for names, locations, or meeting places | identity_probe · location_disclosure · opsec_violation |
| 3 | Asking for money | Pressure to send money, gifts, or support | fundraising · financial_exploitation (KAN-261) |
| 4 | Pretending to be someone they're not | A false name, church, or role | new code — MOD to mint (impersonation) |
| 5 | False teaching or spiritual manipulation | Misusing Scripture or spiritual authority to control | false_teaching (manual per locked ruling) · spiritual_coercion |
| 6 | Spam | Unwanted promotion or repeated messages | spam_pattern |
| 7 | Something else | Anything not listed here | manual triage |

Order rationale: person-safety first (rows 1–2 are the persecuted-church spine — protection of life, identity, location), then money, identity-fraud, teaching, noise, catch-all. MOD owns final order and splits; every label above stands alone if reordered.

`[MOD-COORD]` flex points: (a) if MOD splits row 5 into two rows, use **False teaching** / *Teaching that contradicts the faith once delivered* and **Spiritual manipulation** / *Misusing Scripture or authority to control*; (b) if MOD adds a pastoral-concern lane (taxonomy has pastoral routing), the row is **I'm worried about them** / *They may be struggling or in distress* — one line here, scoped no further.

**Conditional fairness line — appears when row 5 is selected** (small, muted, under the row; the locked cross-tradition ruling made visible):

> Concerns about teaching are weighed by people on the Replant team, never by an automatic filter. The church spans many traditions, and we hold that with care.

**Free-text field.** Label (verbatim, per panel brief): **Anything that helps us understand — optional**. No placeholder (a placeholder duplicating the label is an a11y antipattern; the label sits above the field). No prompt to include names or locations — neutral by design on UG devices.

**No-retaliation line** (directly above the submit button — visible at the moment fear operates, before commitment; echoes the shipped UG signup register at `UndergroundEntryScreen.tsx:87`):

> This stays between you and the Replant team.

**Buttons:** primary **Send to the team** (disabled until a reason is chosen) · quiet **Cancel**.

---

## 3. Confirmation state

**Title:** It's with the team.

**Body:**

> The Replant team reviews every report. You won't be identified to anyone involved. `[SEC-COORD — same guarantee as §2; the two sentences must never drift apart]`
>
> If the team needs more from you, they'll reach out. You may not see what happens next — reviews stay quiet to protect everyone involved.

No outcome promises, no time promises. "Everyone involved" is deliberate: the quiet protects the reporter *and* the reported. **Done** button closes.

A11y: the confirmation view carries `accessibilityLiveRegion="polite"` + `accessibilityRole="alert"` so it narrates itself on appear (LoginScreen banner pattern, `LoginScreen.tsx:232-240`).

---

## 4. Reassurance lines (canonical set — reuse verbatim wherever these appear)

1. **No-retaliation:** *This stays between you and the Replant team.* (§2, above submit)
2. **Never-identified:** *You won't be identified to anyone involved.* (§2 framing + §3 confirmation — `[SEC-COORD]`, one string, two placements)
3. **False-teaching fairness:** *Concerns about teaching are weighed by people on the Replant team, never by an automatic filter. The church spans many traditions, and we hold that with care.* (§2, conditional)
4. **Report ≠ verdict:** *A report begins a careful review by people. It never decides one on its own.* (§2 framing; restated in FAQ §7 Q3)

---

## 5. Edge copy

**Rate-limited** (inline state replacing the sheet body; never scolding — a frightened leader reporting many messages is behaving correctly):

> You've sent several reports in a short time, so this one needs a short wait. Everything you've already sent is with the team.

`[BE-COORD]` if the exact window is surfaced by the backend, the second sentence may append "You can try again in a few minutes." — mechanics, not a review-time promise. Absent a surfaced window, keep as written.

**Already-reported** (shown when the leader taps Report on something they've already reported; verbatim per panel brief):

> You've already raised this — it's with the team.

Single line + **Close**. No re-submit path — the line is the receipt.

**Error state** (banner inside the sheet, LoginScreen pattern — `accessibilityLiveRegion="polite"` + `accessibilityRole="alert"`, banner narrates itself on appear):

> Your report didn't send. Check your connection and try again — what you wrote is still here.

`[BE-COORD]` the final clause requires the free-text draft to survive the failure. If BE does not preserve the draft, the line MUST shorten to "Your report didn't send. Check your connection and try again." — never claim preservation that isn't real.

---

## 6. UG-context variants

**None — by construction.** The flow surfaces no email address, no countdown, no church name, no location, and no UG-specific chrome on any state, so the surface and underground flows are byte-identical (the VerificationBanner Ruling #5 doctrine: the device could be seen by anyone). Row 2's wording ("Trying to find out who or where someone is") already serves the UG threat model without a variant.

**One flag for SEC:** the only place a variant would ever have been tempting is an "email us instead" fallback on the error state — it is omitted on ALL variants for this reason. If SEC's masking design later requires any UG-visible delta, it should be raised back to CONTENT before ship; as designed, the confirmation and every other state stay identical.

---

## 7. FAQ entries (Help surface; same register)

**What happens when I report something?**

> It goes only to the Replant team. People — not filters — read it, weigh it against the covenant this community holds, and decide what care or action is needed. Nothing happens to anyone automatically, and the person is not told you raised it.

**Will they know it was me?**

> No. You won't be identified to anyone involved. `[SEC-COORD]` Reporting stays between you and the Replant team.

**What if I was reported unfairly?**

> A report is not a verdict. Nothing changes on your account because a report was made — a person on the Replant team reviews what was raised, and if anything ever needed your attention, you would hear from the team directly. An unfair report leaves no mark on you.

`[SEC/BE-COORD]` "leaves no mark on you" must hold technically — dismissed reports must not feed any visible reputation or standing signal. If BE+ADMIN's design retains dismissed-report history for pattern detection (likely, and legitimate), the wording stands — "no mark **on you**" speaks to standing and treatment, not to log existence.

---

## 8. A11y annotations (KAN-315 semantics bar — every control)

| Control | Role | Label | Hint / state |
|---|---|---|---|
| Entry menu item (each surface) | `button` (menuitem where the menu component provides it) | "Report this message" (per-surface noun, §1) | hint: "Opens a form to report this to the Replant team" |
| Church-profile flag icon | `button` | "Report this church profile" | hint: "Opens a form to report this to the Replant team" |
| Report sheet container | modal — `accessibilityViewIsModal` | "Report to the Replant team" | focus moves to title on open |
| Sheet title | `header` | "Report to the Replant team" | — |
| Reason rows | `radio` (or `button` + `accessibilityState.selected` if no radio group component) | row label verbatim, e.g. "Asking for money" | hint: row desc verbatim; state: `selected` when chosen; group labeled "What's the concern?" |
| Free-text field | text input | "Anything that helps us understand" | hint: "Optional. Add anything that helps the team understand what happened." |
| Submit | `button` | "Send to the team" | state: `disabled` until a reason is selected; hint while disabled: "Choose a reason first" |
| Cancel | `button` | "Cancel" | hint: "Closes without sending" |
| Confirmation view | `alert` + `accessibilityLiveRegion="polite"` | narrates title + body on appear | — |
| Error banner | `alert` + `accessibilityLiveRegion="polite"` | narrates itself on appear (LoginScreen pattern) | — |
| Rate-limit / already-reported states | `alert` + `accessibilityLiveRegion="polite"` | narrate on appear | — |
| Done / Close | `button` | "Done" / "Close" | — |

Dynamic Type: all strings above survive 2-line wrap; no label depends on staying single-line.

---

## Open Founder decisions (wording forks only — CONTENT has chosen; alternatives shown)

1. **Sheet title** — chosen: **"Report to the Replant team"** · alternative: "Report a concern" (matches the shipped church-profile a11y label, but names no receiver — the title then carries no reassurance).
2. **Submit label** — chosen: **"Send to the team"** · alternative: "Send report" (colder; breaks the receiver-naming thread from title to confirmation).
3. **Church-profile a11y label migration** — chosen: migrate "Report a concern" → **"Report this church profile"** (pattern consistency across all six surfaces) · alternative: keep the shipped label as a grandfathered exception.
4. **Confirmation title** — chosen: **"It's with the team."** (echoes the already-reported line — one voice across states) · alternative: "Report sent" (plainer for a store reviewer walking the flow; colder for the leader living it).

---

*Sources: house register read in full — `ConnectScreen.tsx:181-193` gate copy, `UndergroundEntryScreen.tsx:87` UG privacy note, `VerificationBanner.tsx` (incl. UG Ruling #5 generic-chrome doctrine + RequestInfoBanner register), `CovenantStrip/Notice/Footer`, `PrayerWallLogic.ts` labels, `ChurchProfileBottomSheet.tsx:334/580` shipped stub, `LoginScreen.tsx:232-240` live-region pattern, `taxonomy-codes.ts` v1.0.0, KAN-261 tone note + locked cross-tradition false_teaching ruling (continuous spec §wordlist). No code edited; no Jira written. To God be the glory.*
