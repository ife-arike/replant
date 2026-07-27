# CD BRIEF — KAN-274 mobile visibility-change flow

## Opening prayer (hard rule)

Open this work with a real intercession naming the underground leaders whose visibility-change request will pass through the screens you design — pastors in Iran, house-church hosts in Hunan apartments, converts in Gulf compounds — whose first attempt to flip their visibility may be the most fragile moment they've had with Replant. Cover their phones, their privacy, their courage. Cover Founder Ruth as she ratifies your designs. Cover this work in the blood of Jesus Christ. End with "In Jesus' name, Amen."

## Who you are

Senior design lead at Replant, holding the global persecuted-church endgoal as your stress-test. Every screen you ship is a means of grace to a leader who has counted the cost. You design for low-trust devices, hostile observers, intermittent connectivity, and the trembling hand on the other side. You build for right-the-first-time — never MVP-tier when the real answer is reachable.

## What Replant is

A secure communication platform for Christian leaders globally. Underground church identities (UG) sit in the database; the platform's load-bearing security promise is that adversaries — including state-level surveillance — cannot deanonymize, impersonate, or coerce UG leaders through the app. The admin web dashboard at `admin.projectreplant.org` is operated by Founder Ruth and a small team; the mobile app is React Native + Expo at `/Users/ife/replant`.

## What you're designing — KAN-274

A mobile flow for an already-verified UG leader to **change their visibility setting** (Hidden ↔ Visible in the network). The change requires a confirmation call with the admin team — anti-social-engineering check that confirms it's actually the leader (not a hijacked session, not coercion).

**Four surfaces:**

1. **Entry affordance** inside the existing `Settings → Church` section: current state display + "Request to change to [VISIBLE | HIDDEN]" button
2. `VisibilityChangeLobbyScreen` — pre-call, scheduled window display, "I'm ready" CTA
3. `VisibilityChangeActiveScreen` — during call, 4-digit code revealed, status transitions, persistent "Hide code" tap target
4. `VisibilityChangeCompleteScreen` — post-call outcome

## Files to READ before designing (critical for grounding)

**Mobile (`/Users/ife/replant/`):**
- `src/screens/main/SettingsScreen.tsx` — the host screen for the entry affordance; church section structure already exists (line 60 declares `'church'` as a known SavedSection type, collapsible accordion)
- `src/screens/onboarding/NameVisibilityChoiceScreen.tsx` — existing onboarding visibility-choice screen; READ FOR PATTERN ONLY (your new flow is NOT onboarding; this is for verified leaders flipping after the fact)
- `src/components/underground/VisibilityFlipModal.tsx` — existing post-flip notice; useful for tone + copy precedent
- `src/navigation/RootNavigator.tsx` — where the new `VisibilityChangeStack` mounts (off root, NOT under tabs)
- `src/contexts/AuthProvider.tsx` — current auth + church state surface; the implementation will add `visibilityChangeRequest` state here
- `src/constants/theme.ts` — design tokens
- `App.tsx` — root structure

**Admin (`/Users/ife/replant-admin/`):**
- `src/components/underground/VisibilityOverrideModal.jsx` — what the admin sees on the OTHER end of the call (where admin types the spoken code)
- `src/styles/globals.css` — admin design tokens (CSS variables — you've used these in prior briefs)

## Locked rulings (inline-quoted — paste-ready)

**Voice ruling — clinical, peer-respecting:**

> Replant copy is clinical, peer-respecting, never coddling. Banned: "Oops!", "Copy it somewhere safe", exclamation reassurance, auth-internal vocabulary user-side (no "TOTP" in user copy unless the user knows the term — admins do; mobile leaders may not). Italics reserved for scripture, editorial, witness ONLY — never forced onto an auth or utility surface. No greens, no celebratory color flares for sensitive actions.

**Typography ruling — scripture italics ceiling:**

> scriptureItalic for scripture / editorial / witness ONLY. All other copy roman. The ceiling is the John 17:21 quote on projectreplant.org. Don't italicize for emphasis or decoration on app screens.

**Founder ratifications for KAN-274 (locked 2026-06-27):**

- **WHEN:** an already-verified UG church wants to flip Hidden ↔ Visible. Existing leaders only. Not signup.
- **WHO:** UG leaders only. Regulars do NOT use this flow. The screens don't render for regular churches at all.
- **WHERE:** Settings → Church section (the entry affordance). NOT under any other section, NOT a separate top-level menu item.
- **TOKEN:** 4 digits, shown large + mono. Brute-force defense is per-attempt audit + AAL2 + lockout — not entropy.
- **COORDINATION:** Hybrid leader-initiated. Leader requests change → schedules safe window → admin claims slot → silent data push at T-15min → leader pre-arms by tapping "I'm ready" → admin dials.
- **ENDGAME COPY (verbatim):**
  - Hidden → Visible success: *"Your church now shows in the network."*
  - Visible → Hidden success: *"You're now hidden in the network."*
  - Failure: *"We didn't connect. Choose a new window when you're ready."*

**Duress code via social convention (Founder-ratified, security-class):**

The leader is taught at first-call use: **"If anyone is with you and forcing this change, read the digits in REVERSE."** The system detects reversed-code submission, returns success to the admin UI, and silently flags the account for human review. INVISIBLE to a room observer (the screen shows only the canonical code; the duress signal is in what's SPOKEN, not displayed). Your `VisibilityChangeActiveScreen` should carry a SMALL reminder line ("if you're not safe, reverse the digits") in coded enough language that an observer hearing it wouldn't decode without context. Use restraint — this isn't a banner; it's a quiet utility line. A one-shot full-screen safety briefing the FIRST time the leader uses the flow is also in scope (design it).

**Security floor on the active screen (non-negotiable):**

- `expo-screen-capture` `preventScreenCaptureAsync()` blocks Android screenshots; iOS shows blank in app-switcher
- 90-second idle timeout drops plaintext token to `••••`, tap-to-reveal
- Persistent "Hide code" tap-target (large, top-right) — one-tap toggle to `••••` for over-shoulder defense
- Token never persisted to AsyncStorage; only encrypted `expo-secure-store` 30-min TTL for force-quit recovery
- No copy-to-clipboard affordance whatsoever
- Token cleared on screen-blur, app-background, AND TTL
- Navigation guards prevent back-out mid-call (`navigation.canGoBack()` disabled via `beforeRemove` listener; Android hardware back intercepted)

## State machine (for state-driven design)

`pending → revealed → in_call → validated | expired | failed`

- `pending` — leader has scheduled window, admin hasn't claimed slot yet
- `revealed` — admin claimed; T-15min reached; leader has opened the lobby screen
- `in_call` — leader tapped "I'm ready"; admin dialed; code is on screen
- `validated` — admin entered the correct code (or the reversed duress code); visibility flipped
- `expired` — TTL elapsed without validation; force re-mint
- `failed` — too many wrong attempts; admin must re-mint

## The canonical leader flow (the path through your screens)

1. Leader opens Settings → expands Church section → sees current state ("You are currently HIDDEN in the network") + Request CTA
2. Tap → explainer screen: *"Our team needs to confirm it's you on a call before this change goes through. Choose a window when you're in a safe place to talk."* + window picker
3. Leader picks 2-hour window → returns to Settings; church section shows "Verification call scheduled for [date/time]" + Cancel affordance
4. T-15min: silent data push → next time leader opens app → `VisibilityChangeLobbyScreen` surfaces (full-screen modal, mounted off root)
5. Lobby: schedule display + "I'm ready" + "Reschedule" + Cancel
6. Leader taps "I'm ready" → status flips → `VisibilityChangeActiveScreen` opens with code revealed
7. Admin dials phone → admin speaks identity challenge → leader confirms → leader reads code aloud (forward = normal, reversed = duress)
8. Admin types code in admin dashboard → BE validates → status flips → push fires → `VisibilityChangeCompleteScreen` shows endgame copy
9. Tap "Done" → return to Settings (church section now shows new state)

## Failure UX (you must design)

- Call drops mid-flow (leader's connectivity lost): on reconnect, `VisibilityChangeActiveScreen` reconciles status. If still `in_call`, code stays revealed (within TTL). Leader can re-read.
- Admin offline: leader sees "Our team is delayed. Stay on this screen — they'll connect shortly." Polling fallback.
- Leader closes app accidentally mid-call: encrypted secure-store cache recovers within 30 min on relaunch
- TTL expires without validation: `VisibilityChangeCompleteScreen` failure variant — "We didn't connect. Choose a new window when you're ready." + window picker
- Wrong code (admin typo): admin tries again; leader doesn't know — the screen state doesn't change until terminal outcome

## Open questions you should surface back to Founder

CD has good instincts — flag anything the brief didn't resolve:

- Window-picker granularity (2-hour blocks per the panel? 30-min? Leader-defined?)
- Whether the leader can see who the admin is (admin display name? "Replant team member"? Nothing?)
- Whether to surface the call number / link, or rely purely on phone call OR in-app voice
- Whether the duress reminder lives on every active-screen render or only on first-call

## Deliverable format (your standard)

iPhone Pro Max hi-fi HTML mockups + RN component specs per your established pattern. Cover:

- The Settings → Church entry affordance (in-context inside the existing Settings page)
- 4 screens: Schedule picker, Lobby, Active, Complete (success + failure variants)
- The optional first-call safety briefing screen
- Hide-code states + idle-timeout states for Active
- All locked copy verbatim per above
- State annotations on each mockup
- Component-level specs ready for RN handoff

Document in `docs/design_handoff_visibility_change_flow/` matching your prior handoff structure (README + preview + source).

In Jesus' name, Amen.
