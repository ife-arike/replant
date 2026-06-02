# CD Session — Replant · Notification Banners & Top-of-Screen Moments

## Step 1 — Pray first

Before opening any file, pray. A real intercession in the name of Jesus Christ — name the work: you are designing the banners and notification moments that leaders will see when something urgent or significant demands their attention. Let every alert feel weighted but not anxious, present but not distracting. These leaders carry real responsibility. Ask for clarity and pastoral wisdom in the design choices. End with "In Jesus' name, Amen." Hard rule.

---

## Step 2 — Read before designing

```
/Users/ife/replant/src/components/home/VerificationBanner.tsx
/Users/ife/replant/src/screens/main/HomeScreen.tsx
/Users/ife/replant/src/constants/theme.ts
```

Also look at the current live app screenshots for full context:
```
/Users/ife/Documents/Claude/Projects/Replant/Screenshots for app ref/IMG_6251.png
/Users/ife/Documents/Claude/Projects/Replant/Screenshots for app ref/IMG_6252.png
/Users/ife/Documents/Claude/Projects/Replant/Screenshots for app ref/IMG_6253.png
```

The existing VerificationBanner sits between the top bar and the scripture strip. It was built against an older visual language — the boxed, bordered style. The Home tab has now been redesigned to be open, unboxed, warm. The banner needs to match.

---

## Step 3 — What you're designing

One hi-fi HTML file. iPhone 15 Pro Max frame (430×932pt, Dynamic Island). Every screen has a React Native spec panel. Multiple options per deliverable — minimum 2. Real copy throughout, no lorem ipsum.

All colours from `src/constants/theme.ts` only. No new colours.

---

## Deliverable 1 — Verification Banner (3 urgency states)

The existing banner covers **pending church verification** — a 30-day window during which a newly registered church must be verified by the Replant team. Three states:

| State | Trigger | Current colour |
|---|---|---|
| Neutral | > 7 days remaining | No colour |
| Amber | ≤ 7 days remaining | `Colors.amber` |
| Urgent | ≤ 1 day remaining | `Colors.red` |

The 0-day copy is currently wrong ("expires tomorrow") — this is a known bug deferred to the copy sweep. Design for the correct copy: "expires today."

**Redesign brief:**
- Must feel cohesive with the new open Home tab aesthetic — no heavy border boxes
- Still clear and actionable — leaders must understand what it means and what to do
- The neutral state should feel informational, not alarming
- The urgent state must feel urgent without being panicked — these leaders are under real pressure, the UI must not add anxiety
- Contact line: "connect@projectreplant.org" — present in all states
- Persistent (cannot be permanently dismissed per Founder ruling) but must not feel punishing
- Show all 3 urgency states side by side for comparison

Show **2 design directions** across all 3 states — e.g. one that is more integrated with the page (feels like a gentle notice, not a banner), one that is more visually distinct.

---

## Deliverable 2 — Unverified Leader Banner (if different from church)

A **second leader** added to a church that has already been verified still needs their own verification acknowledgement. Is the banner different? What does a leader-specific verification state look like vs a church-level one?

If the states are the same — say so and skip. If they need different copy or visual treatment — design it.

---

## Deliverable 3 — In-app notification moments (top-of-screen)

These are **transient in-app banners** that appear at the top of the screen (below the status bar, above the current screen content) — not push notifications, not modal alerts. They appear, linger briefly, and dismiss. Think: a letter slipping under the door.

Design the following notification types. For each: show the banner at rest (auto-dismiss countdown visible or not — your call), and show how it dismisses (swipe up? fade?).

**a. New DM received**
"Minister Ruth sent you a message." Tapping navigates to Connect.

**b. Verification status changed — approved**
"Your church has been verified. Welcome to the network." Warm, significant. Not a party — a quiet confirmation of something weighty.

**c. Verification status changed — rejected**
"Your verification was not approved. See the reason in your profile." Handled with pastoral care — no harsh language.

**d. Prayer wall activity — someone stood with your prayer**
"A leader is interceding for your church." Understated. Sacred.

**e. New network announcement**
"A new update from Replant Team." Neutral. Doesn't oversell it.

**f. Security / system alert**
"Unusual login activity detected. Tap to review." Uses `Colors.red` register but does not panic. Calm and firm.

**g. [Your call]**
What other notification moment have we not considered? A leader being added to a branch. A heartcry response. A daily scripture being seeded. You have creative license here — propose one or two that would genuinely serve leaders.

---

## Voice

These are not notification badges. They are not push alerts designed to pull a user back. They are moments — brief, purposeful, earned. A leader should see one and feel informed, not managed. Design from that register.

Quiet. Clear. Authoritative. Replant.
