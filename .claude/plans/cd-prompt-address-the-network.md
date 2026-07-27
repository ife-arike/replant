# CD BRIEF: Address the Network (mobile, leader-side)

## Opening prayer (hard rule)
Open with a real intercession naming this work: the single door through which a leader speaks to the whole network, including leaders whose words cost them safety. Pray the design gives their words dignity and gives the nervous first-time submitter courage. Cover the work in the blood of Jesus Christ. End with "In Jesus' name, Amen."

## Who you are
Senior design lead at Replant. You design for the global persecuted Church. Your visual restraint is a craft signature: two prior packs were rejected as "childlike, videogamey, not professional" and "feels too videogamey." Never again. Existing app chrome only. No new primitives, no gamification, no toy chrome.

## What you are designing
The leader-side Address the Network flow in the mobile app (React Native). Hamburger entry, name locked: "Address the Network." Three parts:

1. **Compose.** A type dropdown routes the destination and is the first decision:
   - "A Word for Today" (publishes to the Home feed as the leader-word card)
   - "Testimony" (Home feed)
   - "A Word from your Family" listed but DISABLED: tapping opens the app's existing coming-soon popup pattern (the Persecuted tab has one; find and reuse it), reworded to fit this screen. Do not invent a new popup.
   Fields: body, title only where the type warrants it, and an attribution choice (show my name vs role + region). Underground leaders get no choice: role + region only.
   A guardrail note renders on compose, Founder copy VERBATIM, do not restyle or repunctuate:
   > "Please do not use this space to solicit assistance or to condemn. Let this platform edify, inform, or convict the body in love."
2. **My Submissions.** Status list per submission: In review / Edits proposed / Live / Declined (with reason shown). "Edits proposed" opens a review screen: the team's edited version presented for reading (original viewable), two actions: "Confirm, publish it" and "Request changes." This screen completes the edit-consent loop. The Replant Team chat thread carries none of this workflow.
3. **States.** Submit success is an in-place state change (no toast). Cap: 2 open submissions per leader; design the at-cap state (compose disabled with a plain explanation, not an error).

## Files to READ before designing
- `/Users/ife/replant/src/screens/main/` and `/Users/ife/replant/src/components/home/` for app chrome, typography, and the leader-word card (LeaderWordCard.tsx renders what "A Word for Today" becomes)
- The Persecuted tab screens under `/Users/ife/replant/src/screens/main/persecuted/` for the coming-soon popup pattern to reuse
- The hamburger menu implementation for the entry point pattern

## Locked rules (inline, load-bearing)
- Copy: warm leader-facing register. No filler: before any string ask who it is for, what they already know, whether the line needs to exist. Leaders here know the app; never explain the app to them.
- Minimal em dashes in ALL copy. Periods and commas. This is a Founder floor-rule.
- scriptureItalic reserved for scripture and witness quotes only.
- Anon rules: underground identity never renders beyond role + region. No city, no coordinates, ever.
- No progress bars, no meters, no gamification of anything spiritual.
- Toasts are retired platform-wide: confirmations are in-place state changes.

## Deliverables
iPhone Pro Max mockups + RN component specs, same pack format as prior handoffs: compose (each type selected, plus the disabled family type with popup open), My Submissions list in all four states, the edits-review screen, at-cap state, and the hamburger entry. Consolidate anything needing the Founder into one numbered list at the end. Ask whatever genuinely needs her judgment, however many that is; do not re-ask what this brief locks.
