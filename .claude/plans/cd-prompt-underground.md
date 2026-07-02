# Claude Design — Replant underground flow visual asks

> **Founder note to self:** paste the section below the `---` line into Claude Design (in the CD workspace). Attach screenshots from `~/Documents/Claude/Projects/Replant/Screenshots/` of: current `RegisterIntroScreen`, current underground RegCP1 path, the existing `ParentChurchPicker` styling (for reference on reveal-modal visual language), and the existing Verification banner pattern.

---

## Pray first

Pray before starting per Replant's project rule. Reference the persecuted Church specifically — leaders in Iran, China, Eritrea, North Korea, Saudi Arabia, Afghanistan, Somalia, Libya, and every other nation where Christians meet under threat. The decisions on these screens shape what state actors can or cannot infer about the body of Christ in their jurisdiction. Petition for designs that protect generations of leaders who will use these screens while watched. End with "In Jesus' name, Amen."

## Context (codebase access)

You have access to `~/replant/`. Load before designing:

- `src/screens/onboarding/RegisterIntroScreen.tsx` — the existing 3-tile chooser. You're adding a secondary chooser screen REACHED FROM the underground tile.
- `src/screens/onboarding/RegisterChurchPage1Screen.tsx` — current underground RegCP1 path (private-name notice line ~615, RAG-Red-locked section line ~770). The brave/safe choice screen is NEW; you're designing where it sits in this flow.
- `src/components/onboarding/ParentChurchPicker.tsx` — reference for code-input field visual language (the join-by-code screen will mirror this input style).
- `src/components/home/VerificationBanner.tsx` — reference for pending-state visual language.
- `/Users/ife/replant/.claude/plans/underground-flow.md` — full architecture spec with all 33 Founder rulings locked. Read sections "What the panel locked" + "Architecture (folded)".
- Memory: `replant_continuous_spec.md` — "Underground flow — Founder rulings LOCKED (2026-06-19)" section is the canonical source.

## Replant invariants (do NOT design against these)

- iPhone Pro Max hi-fi target. Match the existing typography ruling (`scriptureItalic` for scripture/editorial only; roman everywhere else).
- No expo-blur. No CSS that doesn't translate to React Native.
- Match the existing `RegisterIntroScreen` tile + `ParentChurchPicker` visual language. Do not invent new design tokens.
- **Persecuted threat model is sacred.** The screens must not advertise underground membership to over-the-shoulder watchers. Screenshots are an attack surface — design for the assumption that any screen could be captured by an adversary holding the device.
- The word **"underground"** holds in English; localizers translate per locale.
- Display naming: when the church name renders in any locked state, render as **"Underground Church"** (this is the public-facing masked label — the literal English phrase is correct globally).
- "Build for the full end goal — global persecuted Church."

---

## Ask 1 — Secondary chooser inside the underground flow

**Context:** Founder ruling #13 — the second-leader-join entry point lives **inside** the underground flow, not on the main `RegisterIntroScreen`. The 3 main tiles stay as today (Standalone / Church branch / Underground). Tapping the Underground tile routes to this NEW secondary chooser screen.

**Two tiles:**

1. **"Register a new underground church"** → routes to the existing underground RegCP1 path (private name, hidden location, RAG-Red locked) PLUS the new brave/safe choice screen (Ask 2).
2. **"Join an existing fellowship with a code"** → routes to the new join-by-code entry screen (Ask 4).

**Why nested:** the "I have a code" surface never appears on the main intro screen. An over-the-shoulder watcher sees only "Underground" then a generic two-tile choice — no indication that the leader is joining vs registering a hidden fellowship.

**Mock:**
- The secondary chooser screen itself (3 frames: full layout, both tile states).
- Back-navigation behavior: back from this screen returns to the main 3-tile RegisterIntroScreen.

---

## Ask 2 — Brave/Safe choice screen + modal confirmation

**Context:** Founder rulings #10 + #11.

After the leader picks "Register a new underground church" and completes RegCP1's underground form (existing path: private-name notice, hidden city/address, RAG-Red locked), they reach this **new** screen before submitting.

**Wording (LOCKED):**

- **Avoid the words "brave" and "safe" entirely.** Use functional language.
- Two options:
  - **"Show our name"** — helper: *"Other leaders can see your church's name when they pray for you or connect with you. They will not see where you are."*
  - **"Keep our name hidden"** (default) — helper: *"Other leaders see 'Underground Church · {region}' instead of your name. Your region is shown so the body of Christ can still pray with you."*
- Footer note: *"This choice applies to your whole church. Take your time."*

**Modal confirmation on commit to "Show our name":**

- Title: *"Are you sure?"*
- Body: *"Once your name is shown, it cannot be hidden again — only your network changes. We will not be able to revert this from inside the app."*
- Buttons: *"Go back"* / *"I'm sure, show our name"*

**Asymmetric reversibility** (locked):
- Default state is "Keep our name hidden" (safe).
- Safe → Show our name: leader can flip within 7 days of registration, then locks.
- Show our name → Keep our name hidden: **NEVER self-reversible.** Only admin can change back via direct contact (and the modal must communicate this gravity).

**Mock:**
- Brave/Safe choice screen — default state (neither selected), "Keep our name hidden" pre-selected, "Show our name" selected.
- Modal confirmation on "Show our name" commit.
- Mock how this screen sits in the flow (after RegCP1 form completion, before final submit).

---

## Ask 3 — Join-code reveal modal (one-shot, non-dismissible)

**Context:** Founder rulings #2 + #3 + #6. After the founding underground leader is verified by admin, the next time they sign in, the app reveals their **one-shot join code** for inviting a second leader. This is shown EXACTLY ONCE and never again.

**Code format (LOCKED):** `RPL-XXXX-NNNNN` (4 letters A-Z + 5 digits). Render in monospaced font, large, copy-on-tap with haptic feedback.

**Wording (CONTENT-drafted; refine visual but hold the substance):**

- Title: *"One trusted leader at a time"*
- Body:
  > *"If God brings another leader into your fellowship who needs to be on Replant with you, give them this code in person, by hand. Anyone you give it to will be able to join your church on Replant. No one without it can."*
  >
  > *"We will show this to you once. We cannot show it to you again."*
- Code block: monospaced, large, copy-tap.
- Below code:
  > *"Write it down somewhere only you can reach. Do not save it to this phone, do not send it in a message, do not put it in email. Share it only face-to-face with someone you would trust with your life."*
- Primary button: *"I have saved this — continue"*

**Pre-dismiss confirmation modal:**

- Title: *"Are you sure?"*
- Body: *"We will not show this code again. If you lose it, you'll need to contact the Replant team directly to issue a new one."*
- Buttons: *"Show me again"* / *"Yes, I have it"*

**Non-dismissible behavior:**
- No swipe-to-dismiss.
- No back-button dismissal.
- Must tap "I have saved this — continue" + confirm in the second modal.

**Screenshot defense (if technically feasible in RN):**
- Block screenshots on this screen (`FLAG_SECURE` on Android, screen-capture detection on iOS). Founder approves if technically clean; doesn't block if it adds risk.

**Mock:**
- The reveal modal itself.
- The pre-dismiss confirmation modal.
- Visual treatment of the monospaced code block (size, weight, copy-tap affordance).
- Haptic / copy-toast confirmation feedback.

---

## Ask 4 — Join-by-code entry screen (second leader)

**Context:** Founder ruling #13 — reached from the secondary chooser's "Join an existing fellowship with a code" tile.

**Wording (CONTENT-drafted):**

- Eyebrow: *"JOIN AN EXISTING FELLOWSHIP"*
- Heading: *"Enter the code your leader gave you"*
- Body: *"If a leader you serve with has invited you to join their fellowship on Replant, enter the code they shared with you in person."*
- Field label: *"Invite code"*
- Placeholder: `RPL-XXXX-XXXXX` (format mask)
- Helper text below field: *"The code should have been given to you face-to-face. If you received it any other way, do not enter it — speak to your leader first."*
- Primary button: *"Verify code"*

**Error states (single generic string — Founder ruling #4):**

- All failure cases (invalid, expired, consumed, rate-limited, deactivated): *"That code did not match. Please check with the leader who gave it to you."*
- Rate-limit hit: *"Too many tries. Please wait a few minutes before trying again."*
- Network error: *"We couldn't reach Replant right now. Check your connection and try again."*

**On success:** routes the leader into ASP1/ASP2 (the existing account setup screens) with the underground church_id pre-attached. The leader completes their personal account details normally; on submit, the leader account attaches to the underground church.

**Mock:**
- The code entry screen itself (idle, focused, populated states).
- Error state (single generic error string).
- Rate-limit state.
- Network error state.
- Transition to ASP1 on successful code verification.

---

## Ask 5 — RAG-Red note refinement on existing underground RegCP1

**Context:** Founder ruling #33. The current RAG-Red lock note on `RegisterChurchPage1Screen.tsx` is contradictory: it says "Self-declaration. You can update this at any time from Settings" but then locks the status. CONTENT's first proposal was too dramatic. Founder picked the lighter version.

**Locked copy:** *"This is set for underground churches and can't be changed in the app."*

**Where it appears:** above the RAG-Red dot/option in the underground RegCP1 path, replacing both the current "Self-declaration" note AND the existing "Status locked" note.

**Mock:**
- The RAG section visual update — lighter, less heavy than the current red-warning treatment. It's informational, not alarming.

---

## Ask 6 — In-app verification status surfaces (underground)

**Context:** Founder ruling #5 — all status comms move in-app (no email reveals any underground status). The leader signs in and sees a banner.

**States to mock:**

1. **Pending** (after submit, before admin verifies): *"Your church is being verified. We are praying with you."*
   - Generic, applies to all church types. Underground leaders see the same chrome — no underground-specific copy that could fingerprint them in a screenshot.

2. **Verified** (one-shot toast on first sign-in post-approval): *"Welcome. You are with us now."*
   - Pastoral, not transactional. After dismissing, the leader is routed to the **join-code reveal modal** (Ask 3) on the same sign-in session.

3. **Rejected** (banner): *"We weren't able to verify your registration. Please contact the Replant team."* + link *"Contact Replant"*
   - Single string for all rejection reasons. Reasons discussed via secure thread, not surfaced in UI.

**Mock:**
- Pending banner.
- Verified toast.
- Rejected banner.
- Transition from verified toast → reveal modal.

---

## Visual / interaction notes (CD discretion)

- **Avoid red elsewhere.** The current underground RegCP1 already uses red for the locked RAG status. Per Founder ruling #33 (lighter copy), use blue or neutral tones for the new notes/copy throughout these screens. The red-warning vocabulary should be reserved for things the leader can act on (errors, dismissal warnings).
- **Modal confirmations get warmth, not panic.** "Are you sure?" modals (Ask 2 + Ask 3) should feel pastoral, not alarming. Replant is shepherding underground leaders, not interrogating them.
- **Typography:** the join-code reveal monospaced block is the visual high point of the entire underground flow. Treat it like a verse — give it air, weight, and quiet reverence. This is the moment the leader is being trusted with the lifeline of their fellowship.
- **Color of "Show our name" / "Keep our name hidden":** neither option should look "more recommended" visually. The choice belongs to the leader; the UI must not nudge.

---

## Deliverable

For each Ask:

- Mocks (iPhone Pro Max hi-fi).
- Component breakdown / RN-implementable spec (component name, props, states).
- Interaction notes (modals, haptics, transitions).
- Any spec gaps you spotted that this prompt missed.

Founder will review and ratify before any FE wire-up.

In Jesus' name, Amen.
