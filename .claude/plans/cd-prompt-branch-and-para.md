# Claude Design — Replant signup flow visual asks (branch + para ministry)

> **Founder note to self:** paste the section below the `---` line into Claude Design (in the CD workspace). Attach screenshots from `~/Documents/Claude/Projects/Replant/Screenshots/` of: current RegCP1, current RegCP2, current ASP2 bypass card.

---

## Pray first

Pray before starting per Replant's project rule. Reference the leaders who will sign up through this flow — branch leaders attaching to a parent church (verified or pending), and leaders of para-ministry organizations (missions agencies, training schools, Christian media, campus ministry, counseling, relief & dev, advocacy) who don't pastor a Sunday-gathering congregation. End with "In Jesus' name, Amen."

## Context (so you can reach into the codebase yourself)

You have access to `~/replant/`. Load the relevant code before designing:

- `src/screens/onboarding/RegisterChurchPage1Screen.tsx` — current RegCP1, includes the church-type picker and underground-specific conditional rendering.
- `src/screens/onboarding/RegisterChurchPage2Screen.tsx` — current RegCP2.
- `src/screens/onboarding/AccountSetupPage2Screen.tsx` — current ASP2 (bypass card logic lives around lines 1063-1119).
- `src/utils/displayHelpers.ts:137-144` — current CHURCH_TYPES with display labels.
- `/Users/ife/replant/.claude/plans/branch-flow.md` — full branch architecture proposal (read sections 3.6 + 6 for the FE flow shape).
- `/Users/ife/replant/.claude/plans/para-ministry.md` — full para architecture proposal (read section 3.3 for the FE swap inventory).

Replant invariants you must honor (do NOT design against these):

- iPhone Pro Max hi-fi target. Match the existing typography ruling (`scriptureItalic` for scripture/editorial only — roman everywhere else, per memory `typography_ruling`).
- No expo-blur. No CSS that doesn't translate to React Native.
- Universal back button + universal CTA buttons exist — match the established pattern, don't reinvent.
- Persecuted / underground threat model is sacred. Underground is being REMOVED from the church-type dropdown entirely in this batch (Founder ruling 2026-06-18 #1). A separate question — "Are you registering an underground church?" — appears BELOW the type dropdown on RegCP1. Selecting YES drives the existing underground conditional behavior (RAG auto-Red, city/address hide, etc.). The full underground signup split (separate dedicated flow with brave/safe toggle) is a later workstream — this design pass only handles the entry-point change.
- Display naming: branch type is "Church branch" everywhere — drop the parens, always lead with "Church" to defuse the messaging-table nomenclature collision. Do not use "Church (Branch)" or "Branch (Church)."
- "Build for the full end goal — global persecuted Church." This isn't an MVP-feel design pass. Honor the long-term posture.

---

## Ask 1 — RegCP1 restructure (church-branch entry + underground separation)

Two changes ship together on RegCP1 in this batch — both need mocks.

### 1a. New RegCP1 dropdown structure (underground removed)

Mock the new church-type dropdown WITHOUT underground:

```
Church Type
┌──────────────────────────────┐
│ Main Campus              ▼   │
└──────────────────────────────┘
    Main Campus
    Church branch         ← display label: "Church branch" (not "Church (Branch)")
    House Church
    Ministry
    Church Without Walls
    Para Ministry                ← new (per /Users/ife/replant/.claude/plans/para-ministry.md)
```

Below the dropdown, surface the underground question:

```
┌──────────────────────────────────────────┐
│ Are you registering an underground       │
│ church?                                  │
│   ◯ Yes    ◯ No                          │
└──────────────────────────────────────────┘
```

When the leader selects YES, the type-picker should reflect the change (set to underground internally OR hide / dim — your call), and the existing underground UX kicks in (RAG auto-locks Red, city/address fields hide, the existing underground notice appears). Mock both states.

When the leader has YES selected on the underground question, the leader should NOT be able to additionally configure a Church-branch parent (no path conflict).

### 1b. Branch entry UX — A/B mockups required

For leaders selecting "Church branch" in the type dropdown, the leader needs to identify the **parent church** they are branching from. Mock TWO entry options:

#### Option A — Dedicated entry on the "Register your church" intro screen

When the leader taps the "Register Yours" pathway on ASP2 (after searching and not finding their church), surface TWO entry tiles before navigating to RegCP1:

- **"Register a standalone church"** → standard RegCP1 flow.
- **"Register a Church branch of an existing church"** → branch RegCP1 flow.

Mock the intro screen. Show what RegCP1 looks like AFTER selecting "Church branch" — the type picker probably hides (we already know it's a Church branch), and the parent-picker surface is the first prominent thing.

#### Option B — Selecting "Church branch" in the existing type dropdown

Standard RegCP1; when the leader picks "Church branch" from the dropdown, the screen REPLACES the rest of the form below with the parent-picker surface (and the eyebrow rebrands subtly — e.g., "Register Church branch · 1 of 2").

Mock both states (default vs. Church branch selected).

### Both 1b options need the parent-picker surface

Two input modes side-by-side OR stacked:

```
┌─────────────────────────────────────────┐
│ Find the parent church                  │
│                                         │
│ ◉ By RPL ID                             │
│   [_______________]                     │
│                                         │
│ ◯ By name                               │
│   [_______________]                     │
│   Results:                              │
│   ┌─────────────────────────────────┐   │
│   │ Maranatha Ministries            │   │
│   │ Lagos, Nigeria · RPL ID 5C7F2   │   │
│   ├─────────────────────────────────┤   │
│   │ Maranatha Ministries            │   │
│   │ Abuja, Nigeria · RPL ID 9A1B3   │   │
│   └─────────────────────────────────┘   │
│                                         │
│ Selected parent:                        │
│ Maranatha Ministries · Lagos, Nigeria   │
│ Verification: Pending                   │
└─────────────────────────────────────────┘
```

Show the disambiguation pattern for multi-match search (e.g., two churches with the same name in different cities). Show the "no results" empty state. Show what happens if the leader types an RPL ID that doesn't match.

Show the eyebrow / banner on RegCP1 once a parent is selected (e.g., "Registering a Church branch of Maranatha Ministries").

### Ask 1 Deliverable

- 1a: new RegCP1 dropdown + underground question mock (with YES + NO states).
- 1b: A vs B intro/RegCP1 mocks (5-7 frames each).
- Parent-picker component spec at RN-implementable detail (component name, props, states).
- Founder will pick A or B for 1b; 1a ships as designed.

---

## Ask 2 — ASP2 bypass card branch variant

The bypass card on ASP2 (currently shows "✓ Ready to Register" eyebrow with church meta) needs a branch-aware variant when the loopback church has a parent attribution. Mock:

- Standard bypass card (current — for reference).
- Branch bypass card with parent attribution surfaced: "Church branch of Maranatha Ministries · Lagos, Nigeria." Hierarchy: branch name primary, parent secondary, both visible.
- What does "Switch" / "Delete and search again" mean for a Church branch? Same modal copy or different?

---

## Ask 3 — Para ministry dropdown label + tooltip

`para_ministry` is a new church_type enum value. The dropdown label and definition need to communicate the scope clearly.

Founder definition: "All Christian non-congregational orgs — missions, training, media, campus, counseling, relief & dev, advocacy." Single bucket.

Mock candidate labels for the dropdown entry:
- "Para Ministry"
- "Para-church Organization"
- "Christian Organization"
- "Other Ministry"
- "Para-ministry / Organization"

Mock the tooltip / help-icon popover that appears when the leader taps the (?) next to the dropdown entry — the definition needs to land in 1-2 sentences without listing all 7 sub-categories every time.

Recommend the strongest label + tooltip combination.

---

## Ask 4 — Conditional "church" → "org" copy strategy

When the leader selects `para_ministry` in the RegCP1 dropdown, multiple surfaces should re-render with "org" / "organization" instead of "church":

| Surface | Standard | Para ministry |
|---------|----------|---------------|
| Step label | `REGISTER CHURCH · 1 OF 2` | `REGISTER ORG · 1 OF 2` |
| Screen title | `Church Details` | `Org Details` |
| Field: "Church Name" | `Church Name` | `Org Name` |
| Field: congregation_size_range | `Congregation Size` | `Org Size` (or similar) |
| RegCP2 review screen | (varies) | (varies) |
| ASP2 bypass card eyebrow | `Ready to Register` | (?) |
| ASP2 search-by hint | `Search by church name or Replant ID` | (?) |

Question for design: how do we visually signal the switch without making the screen feel discontinuous when the leader changes their mind and toggles back to a church type?

Three options to mock:

- **Live swap** — strings change instantly on type-change. Screen layout identical.
- **Banner reframe** — add a thin banner above the form ("Registering an organization") once para is selected. Strings change instantly. Banner offers ambient context for the leader.
- **Section header swap** — only the step label + screen title swap; field labels stay generic ("Name," "Size," etc.) so the live swap is invisible.

Pick a recommendation. Note any field labels you'd revise.

---

## Ask 5 — "Org size" field treatment

The underlying `congregation_size_range` column has discrete buckets (likely "1-25", "26-100", "101-500", "500+" or similar — check `displayHelpers.ts` or the FE picker source). For a para ministry, those buckets may not match real-world team sizes (a small missions agency might be 3-10 staff; a large publisher might be 200).

Two design questions:

- Keep the same buckets and just relabel ("Org Size") — simple, no data change.
- Show a different bucket set when type=para_ministry — e.g., "Solo / Small (1-10) / Mid (11-50) / Large (51-200) / Enterprise (200+)."

Recommend a treatment.

---

## Ask 6 — Welcome email branch / para variants (optional reach)

The welcome email today has three kinds: skip / pending_church / verified_church. Founder ruled 2026-06-18 #2: branch leaders use the **standard pending_church variant with their own 30-day clock — no exemption** (branches behave like standard pending churches). So the kind logic is unchanged. The only branch-specific design question is whether the email BODY should mention the parent ("Welcome — you've registered a Church branch of [Parent Name]"), or keep generic standard copy.

Para ministry leaders may want "church" → "organization" copy in the body.

This is a downstream ask — the CONTENT panel will rule. If you have time, mock both body variants. If not, skip and we'll revisit.

---

## Deliverable shape

For each ask, return:

- Hi-fi mockups (iPhone Pro Max, RN-specifiable, matching established Replant style).
- Component / state notes the FE engineer can use directly.
- Recommended option where multiple are mocked, with the reasoning.
- Any invariants you spotted that this 1-pager missed.

Founder will ratify before FE implementation begins.

In Jesus' name, Amen.
