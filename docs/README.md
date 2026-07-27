# Handoff: Replant — Mobile App (MVP)

## Overview

**Replant** is a mobile app that connects the global Body of Christ — local churches, house churches, ministries, churches without walls, and underground/persecuted churches — for prayer, intercession, mutual support, and coordinated outreach. The app is intentionally non-financial; support flows through prayer, resources, manpower, and presence.

This handoff covers the MVP screen set: onboarding (splash → declaration of faith → account setup → church search), Home / Local / Global / Persecuted Church / Prayer Wall / Connect tabs, church confirmation flow, region slide-out detail, direct-message thread, and the hamburger menu overlay. **18 screens total.**

## About the Design Files

The file in this bundle — `Replant Wireframes v4.html` — is a **design reference created in HTML**: a single-page wall of mobile mockups showing intended look, layout, copy, and behavior of every screen. It is **not production code to copy directly**.

Your task is to **recreate these designs in the target codebase's existing environment** (React Native, Flutter, SwiftUI / Jetpack Compose native, etc.) using its established patterns, navigation primitives, and component libraries. If no environment exists yet, choose the most appropriate cross-platform mobile framework for the project (React Native or Flutter recommended given the audience: global, low-bandwidth, underground contexts).

Open the HTML file in any browser to see all screens at once. Each phone frame is labeled at the bottom.

## Fidelity

**High-fidelity (hi-fi) mockups.** Final colors, typography, spacing, copy, and component treatments are committed. Recreate pixel-perfectly using exact values from the Design Tokens section below. Layout, copy, and information hierarchy in the mockups are intentional — do not paraphrase, reorder, or substitute "equivalent" components without consulting the design owner.

> Note: the HTML mockups render mobile screens at a downscaled 280×560 frame so many can be viewed side-by-side on desktop. Inside the mockup, font sizes are written at fractional rem values (e.g. `0.55rem`, `0.72rem`) for that visual scale. **When implementing on a real device, scale up proportionally** — see "Typography scale (production)" below for the correct production sizes.

---

## Brand & Aesthetic

- **Tone:** reverent, sober, quietly confident. Not "churchy" or twee. Closer to a serious journal or monastic interface than to a social app.
- **Mood:** dark theme with off-white type and a single sky-blue accent. Serif headlines (Cormorant Garamond) for human/scripture moments; sans (DM Sans) for UI chrome and metadata.
- **Tagline:** *"The Church, Connected."*
- **Logo:** A custom inline SVG glyph (a stylized monogram). The exact path is embedded in the HTML file as `<symbol id="rp-logo">` — extract this SVG and ship as an asset.

---

## Design Tokens

### Colors

| Token | Value | Usage |
|---|---|---|
| `--sky` | `#6BB5E8` | Primary accent, active tab, links, primary CTA fill |
| `--sky-mid` | `rgba(107, 181, 232, 0.35)` | Sky-accent borders |
| `--sky-dim` | `rgba(107, 181, 232, 0.10)` | Sky-accent fills / tinted surfaces |
| `--black` | `#080808` | Phone frame body, primary CTA text color (on sky fill) |
| `--surface` | `#111111` | Card / panel surface |
| `--surface2` | `#181818` | Input field, secondary surface |
| `--surface3` | `#1F1F1F` | Tertiary surface |
| `--off-white` | `#F0EDE6` | Primary text |
| `--muted` | `rgba(240, 237, 230, 0.45)` | Secondary / meta text |
| `--faint` | `rgba(240, 237, 230, 0.08)` | Hairline dividers, faint borders |
| `--red` | `#E05555` | Urgent / persecution / destructive / required-field asterisk |
| `--amber` | `#D4A855` | Needs-support / warning / notice |
| `--green` | `#5BAD7A` | At-peace / praise reports / testimonies / available |
| Page background | `#0D0D0D` | App background outside the phone frames |

**RAG (Red-Amber-Green) system:** every church and region carries a RAG status dot. Red = urgent / persecution. Amber = needs support / capacity issues. Green = at peace / available.

### Typography

**Font families** (already loaded from Google Fonts in the mockup):

```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
```

- `--serif: 'Cormorant Garamond', Georgia, serif;` — Used for: app name, screen titles, card titles, scripture quotes, intercession text, prayer-wall hero text, menu item labels. **Always weight 300 or 400.** Frequently set in italic for scripture and prayer requests.
- `--sans: 'DM Sans', sans-serif;` — Used for: everything else (body copy, buttons, meta text, tags, form labels).

**Typography scale (production, scale up from the rem values in the HTML):**

| Role | Production size | Weight | Letter-spacing | Notes |
|---|---|---|---|---|
| App name / hero | 28–32 px | 300 | 0.15em | Uppercase, serif |
| Screen title (top bar) | 18 px | 400 | 0.05em | Serif |
| Card title | 15–16 px | 400 | normal | Serif |
| Section label | 11 px | 500 | 0.20em | Uppercase, sans, sky-colored |
| Body / sub | 13–14 px | 400 | normal | Sans, often muted color |
| Meta / timestamp | 10–11 px | 400 | 0.05em | Sans, muted |
| Button label | 12 px | 500 | 0.10em | Uppercase, sans |
| Tag label | 10 px | 500 | 0.12em | Uppercase, sans |
| Scripture / prayer quote | 14–16 px | 300 italic | normal | Serif italic |
| Form field label | 11 px | 400 | 0.10em | Uppercase, muted |

### Spacing

The HTML uses tight padding because the frames are scaled down. Production spacing scale:

`4, 8, 12, 16, 20, 24, 32, 40, 48 px`

- Screen edge padding: **16 px** (some screens use 14)
- Section gap (scroll area): **12 px** between cards
- Card internal padding: **12–16 px**
- Form field gap: **10–12 px**

### Border radius

| Use | Radius |
|---|---|
| Phone frame (mockup only) | 36 px |
| Card / panel | 8 px |
| Input / button | 4 px |
| Tag | 2 px |
| Bottom-sheet (slide-out) | 16 px (top corners only) |
| Avatar / status dot | 50% (full circle) |

### Shadows

| Use | Value |
|---|---|
| Phone frame (mockup only) | `0 24px 60px rgba(0,0,0,0.6)` |
| Map RAG dot | `0 0 8px <dot-color>` (matches dot color — soft glow effect) |
| Globe RAG dot | `0 0 6–8px <dot-color>` |

### Borders

Most borders are **0.5 px hairlines** at `--faint`. Accent panels use **0.5 px** at `--sky-mid` or matching color. The Acknowledgement / Declaration panel uses a **1.5 px top border** in `--sky` as an emphasis device.

---

## Screens

Below is every screen in the mockup, grouped by row. For each screen, exact copy is preserved verbatim — ship it as-is unless an explicit copy edit comes from the design owner.

### Row 1 — Onboarding

#### 1. Splash / Welcome
- **Purpose:** First screen. User picks Create Account or Sign In.
- **Layout:** Centered, vertical flex. Padding 24 px.
- **Components, top to bottom:**
  1. Logo SVG (90×90, with soft sky-tinted radial glow behind it: `radial-gradient(circle, rgba(107,181,232,0.12) 0%, transparent 70%)`, inset −20 px).
  2. Wordmark "**Replant**" — Cormorant Garamond, weight 300, uppercase, letter-spacing 0.15em, 1.6 rem.
  3. Tagline "**The Church, Connected**" — sky color, uppercase, 0.58 rem, letter-spacing 0.18em.
  4. Primary button: "**Create Account**" (full width, sky fill on black text).
  5. Secondary button: "**Sign In**" (ghost; sky border, sky text, transparent fill).
  6. Footnote: "*House churches, churches without walls, and underground churches are welcome.*" — 0.5 rem muted, centered, two lines.

#### 2. Acknowledgement — Declaration of Faith
- **Purpose:** Required affirmation gate. The user must affirm the faith statement before entering.
- **Layout:** Padding 16, vertical flex, gap 10.
- **Components:**
  1. **Cross glyph** — 28×28 px, made of two 1.5 px sky-colored lines (vertical center + horizontal at 35% from top). See `.ack-cross` in CSS.
  2. Title: "**A Declaration of Faith**" — serif, 0.95 rem, weight 400, letter-spacing 0.05em.
  3. Subtitle: *"Before you enter, we ask that you affirm what we stand on."* — muted, 0.52 rem, two lines.
  4. **Declaration panel** — surface fill, 0.5 px faint border, **1.5 px sky top border**, 6 px radius, 12 px padding. Contains the verbatim declaration in Cormorant Garamond italic, weight 300, 0.68 rem, line-height 1.75:

     > *I believe that Jesus Christ is the Word of God made flesh — the Lamb of God slain for our sins. He came down from heaven, was born of a virgin, was crucified, buried, and ascended to the right hand of God, then gave to us the gift of the Holy Spirit.*
     >
     > *He is the image of the invisible God. He is our only Lord and Saviour.*
     >
     > *The Holy Bible is our only source of truth.*

     Followed by a hairline divider and the line "*By continuing, I personally affirm this testament as my own.*"
  5. Full-width primary button: "**I Affirm This**"
  6. Footnote, centered, 0.48 rem muted: "*This is not a legal agreement. This is a test of the spirits. 1 John 4:1*"

#### 3. Account Setup (Step 1 of 2)
- **Purpose:** Collect identity + church basics.
- **Top bar:** "Your Church" (serif) on the left, "Step 1 of 2" (sky) on the right.
- **Fields** (every field has an uppercase 0.5 rem muted label and a red `*` for required):
  1. **Your full name** — placeholder "Legal name — kept private"
  2. **Ministry / Church name** — placeholder "e.g. Decatur House Church"
  3. **Church type** (dropdown) — options: `Church (Main Campus) · Church (Branch) · House Church · Ministry · Church Without Walls · Underground`
  4. **City & Country** — placeholder "e.g. Lagos, Nigeria"
  5. **Your role** (dropdown) — options: `Pastor · Apostle · Prophet · Evangelist · Teacher · Psalmist · Elder · Bishop · Reverend · Intercessor · Ministry Leader · Other`
  6. **Anonymous toggle** (inside a surface card): "Appear anonymous to others?" with two segmented buttons "Yes — keep me private" (selected, primary) / "No — show my church" (surface). Footnote: *"Your real name and church are always required for security. Anonymous only affects how you appear to others."*
- **Primary CTA:** "**Enter Replant**"

#### 4. Find Your Church — Search (Step 2 of 2)
- **Purpose:** Choose an existing church or register a new one.
- **Top bar:** Back arrow + "Find Your Church" (serif). "Step 2 of 2" (sky) on the right.
- **Search input:** Full-width with a 11×11 magnifier icon inset 9 px from the left. Placeholder "Search by church name or city". Helper text below, 0.42 rem muted: "*Type at least 3 characters to search*".
- **Results header:** `RESULTS FOR "logan"` — uppercase sky label.
- **Result card structure** (3 example states shown):
  - Title (serif, 0.72 rem) + subtitle (sub, 0.62 rem) on the left, a single RAG dot on the right (top-aligned, margin-top 3 px).
  - Subtitle format: `<Church type> · <City>, <Country>`
  - **Green dot** = available to join.
  - **Amber dot** = at capacity (card opacity 0.7, amber sub-line: "At capacity — N leaders registered").
  - **Red dot** = urgent / persecution status; still available to join.
- **"Don't see your church?" CTA strip** — dashed sky border, 6 px radius, sky-dim fill, 9 px × 10 px padding. Left side: "Don't see your church?" + sub "Register yours to begin." Right side: "Register yours →" (sky link).
- **Empty state preview** (shown below the result list, labeled "— Empty state (before search) —" at opacity 0.6): a centered card with a magnifier icon, serif heading "Search by church name or city", sub "to find your church".

---

### Row 2 — Home · Local

#### 5. Home Tab
- **Purpose:** Default landing after sign-in.
- **Top bar:** Logo (22 px) + wordmark "Replant" (serif, 0.85 rem, letter-spacing 0.08em) on the left. Hamburger (three 16×1.5 px off-white bars, 3 px gap) on the right.
- **Scroll area** (gap 10 px between sections):
  1. Section label `TODAY` (uppercase, sky).
  2. **Scripture strip** — sky-dim fill, sky-mid 0.5 px border, 6 px radius, 10 × 12 padding. Serif italic quote (0.72 rem) + sky uppercase reference label (0.5 rem):
     > *"The effectual fervent prayer of a righteous man availeth much."*
     > **JAMES 5:16 · KJV**
  3. Section label `NETWORK UPDATES`.
  4. Three update **cards**, each with a serif title + tag chip on the right + sub line:
     - "Church at Nairobi" — **tag-sky** "New" — *A new ministry has joined the network. Please welcome them in prayer.*
     - "Urgent — Port-au-Prince" — **tag-red** "Urgent" — *The church at Port-au-Prince has issued a request for immediate intercession.*
     - "Replant Note" — **tag-amber** "Notice" — *At this time we do not facilitate direct financial transfers. Support may come through prayer, resources, and manpower.*
- **Bottom tab bar:** see "Bottom Tab Bar" section below. Home is active.

#### 6. Local Tab
- **Purpose:** Nearby churches + register-your-church entry point.
- **Top bar title:** "The Church at *Loganville*" (the city is in serif italic + sky color, inline within the sans title).
- **Scroll area:**
  1. **Map placeholder** — 110 px tall, surface2 fill, 0.5 px faint border, 6 px radius, with a 20 × 20 px sky-grid background pattern (two repeating linear-gradients at 1 px / 3% opacity). RAG dots positioned absolutely on it (sky / amber / green / red, with soft glow shadows). City label bottom-right: "Loganville, GA" (0.42 rem muted).
  2. **RAG legend** — small row of three 7 px dots + label pairs: "At peace" / "Needs support" / "Urgent".
  3. Section label `NEARBY CHURCHES`.
  4. Two nearby-church cards: title (serif, 0.75 rem) + sub (`<distance> · <leader> · <type>`) + RAG dot on the right. Example: "Grace Tabernacle" / "0.8 mi · Elder Johnson · House church" (green); "Anonymous Ministry" / "2.1 mi · Anonymous leader" (amber).
  5. Ghost button **"✦ Register Your Church"** (full width).
  6. **Deactivation warning strip** — surface2 fill, 6 px radius, 7 × 10 padding: *"Your account will be **deactivated in 30 days** if your church/ministry cannot be confirmed. Register to avoid interruption."* (the "deactivated in 30 days" phrase is amber.)
- **Bottom tab bar:** Local active.

#### 7. Confirm Your Church — Page 1 of 2
- **Purpose:** Long form for registering a new church (when the user couldn't find it in search). Reached from "Register Your Church" on the Local tab.
- **Top bar:** Back arrow + "Confirm Your Church" (serif). Page indicator "Page 1 of 2" (sky) on the right.
- **Sections, top to bottom:**
  1. **Info strip** (sky-dim with sky-mid border, 4 px radius) — ⓘ icon + *"One-time confirmation. Name cannot be changed after submission. Church (Branch): include full name + location."*
  2. Text input: "**Confirm church / ministry name**" (required). Placeholder "e.g. Decatur House Church".
  3. Dropdown: "**Church type**" (same options as Account Setup).
  4. Text input: "**City, Country**" — placeholder "e.g. Loganville, United States of America".
  5. Section label `DECLARATION OF STATE *`, then a surface card containing the question *"Are you free to preach the gospel, pray, and make impact in your community?"* and a 3-button segmented control: **Yes, freely** (primary) / **With limitations** (surface) / **No** (red-tinted).
  6. Text area: "Share needs or what you have in abundance..." (height 42 px, top-aligned text).
  7. Emergency-plan surface card: *"Do you have an emergency plan? Would you strategize with surrounding churches if needed?"* with two buttons: **Yes** (ghost) / **Not yet** (surface).
  8. Section label `CONTACT DETAILS *`, then a surface card with helper text *"A Replant team member will reach out to verify your church. Please provide at least one contact method."* + two inputs: **Email address** and **Phone number** (with country code). Footnote italic: "Fill in email, phone, or both."
  9. *(Note: the contact details block is duplicated in the mockup — this is an artifact of the mockup and should be implemented **once**, not twice.)*
- **Primary CTA:** "**Continue →**"

#### 8. Confirm Your Church — Page 2 of 2
- **Top bar:** Same back arrow + title. "Page 2 of 2".
- **Sections:**
  1. Section label `DECLARATION OF STATE *` — same surface card as Page 1, in case the user wants to revise.
  2. Section label `VISIBILITY PREFERENCES *` — surface card with helper text *"How should your church appear to others on Replant?"* and **3 radio options** (custom 10 × 10 px sky-bordered circles, filled with a 5 × 5 px sky dot when selected):
     - **Show church name and location** (selected, off-white)
     - **Show location only (hide church name)** (muted)
     - **Remain fully anonymous** (muted)
  3. Surface card with text-area prompt: *"Share needs, or what your church has in abundance (manpower, resources, prayer, talents):"* + an optional text input "Optional — add details...".
  4. Emergency-plan card (same as Page 1).
  5. **Sky-tinted notice strip:** *"A member of the Replant team will contact you within a few days to verify your church. Your account remains active during this window."*
- **Primary CTA:** "**Confirm & Submit**"

---

### Row 3 — Global · Persecuted Church

#### 9. Global Tab — Globe
- **Purpose:** Global view of the Body. Live prayer requests from around the world.
- **Top bar:** "Global" (serif).
- **Globe placeholder:** 200 px tall, full-bleed (no left/right padding, no radius, no border, bottom hairline at faint). Contains:
  - An SVG globe (160 × 160) drawn from 3 stylized rings + 2 axis lines, all sky-colored at 0.35 opacity, 0.5–0.8 px stroke.
  - 5 RAG dots positioned absolutely on the globe at various lat/long with soft color-matched glows.
  - Footer caption (centered, 0.45 rem muted): "Tap any region to explore".
- **Below the globe (10 px × 14 px padding):**
  - Section label `LIVE PRAYER REQUESTS`.
  - **Intercession items** (see "Intercession item" component) for each live request.
    - "Nigeria · West Africa" (red) — *"We ask for protection over our leaders..."* — `Urgent` tag + "2h ago"
    - "South Korea · East Asia" (sky) — *"Pray for wisdom in our outreach to the unreached..."* — `Ongoing` tag + "5h ago"
- **Bottom tab bar:** Global active.

#### 10. Region Slide-out Panel
- **Purpose:** Detail bottom-sheet that opens when a user taps a region on the globe.
- **Layout:** The phone screen has a dimmed black backdrop (opacity 0.7) covering the globe behind it. A bottom-anchored sheet rises with:
  - Surface fill, sky-mid 0.5 px top border, **16 px top-corner radius**, 14 px padding, vertical flex (gap 10).
  - **Drag handle** — 32 × 3 px faint pill, centered, 4 px bottom margin.
  - Row: a 7 px RAG dot (red) + serif title "**Northern Nigeria**" (1 rem, weight 400).
  - Description, 0.58 rem muted, line-height 1.65: *"Churches in this region are reporting active persecution, limited freedom of assembly, and urgent needs for prayer and support."*
  - Tag row: **Persecution** (red tag) + **Needs Support** (amber tag).
  - Hairline divider.
  - Section label `CHURCHES IN THIS REGION` (sky).
  - Two simple cards:
    - "Anonymous Ministry" — *Leader identity protected · Active since 2019*
    - "The Church at Kano" — *Elder Samuel · House church network*
  - Full-width primary button: "**Support This Region**"

#### 11. Persecuted Church Tab
- **Purpose:** Set-apart space for churches under severe persecution. Different visual treatment — red is the primary accent here.
- **Top bar:** "The Persecuted Church" (serif, **red** color).
- **Scroll area:**
  1. **Persecuted banner** — `rgba(224, 85, 85, 0.08)` fill with `rgba(224, 85, 85, 0.25)` border, 6 px radius, 8 × 10 padding. Uppercase red label "SET APART" + serif italic body: *"This section is for churches facing severe persecution — imprisonment, prohibition of fellowship, violence, and active hunting for the faith. Handle with prayer and sobriety."*
  2. **Self-identify card** — surface2 fill, 8 px radius, 12 px padding, centered. Serif title *"Are you currently undergoing persecution for the name of Jesus?"* + red-tinted full-width button "**Share Your Heartcry**".
  3. Hairline divider.
  4. Section label `HEARTCRIES FROM THE BODY`.
  5. **Intercession items with red left border** (instead of sky):
     - "Anonymous · Central Asia" (red location) — *"We have not been able to gather for three months. We ask the Body to stand with us..."* — `Active Persecution` red tag + "3 days ago"
     - "Anonymous · North Africa" — *"Two of our leaders have been detained. We need intercession urgently."* — `Urgent` red tag + "1 day ago"
  6. **Encryption notice** — sky-dim strip: *"🔒 This section is encrypted. What is shared here stays within the Replant network. Your safety is our responsibility."*
- **Bottom tab bar:** the Persecuted slot (envelope-like icon, 4th position) is active and **stroked in red** (not sky).

---

### Row 4 — Prayer Wall · Connect

#### 12. Prayer Wall Tab (Landing)
- **Purpose:** Entry point — choose to submit a request or visit the wall.
- **Top bar:** "Prayer Wall" (serif).
- **Scroll area:**
  1. Centered serif italic scripture quote (top padding 12, bottom padding 8): *"Praying always with all prayer and supplication in the Spirit..."* + uppercase sky reference "EPH 6:18".
  2. **Two large action cards** stacked, gap 10 px:
     - **Receive Intercession** — surface fill, **sky-mid border**, 8 px radius, 16 px padding, centered column.
       - 36 × 36 sky-dim circle with chat-bubble icon (16 × 16, sky stroke).
       - Serif title 0.88 rem "Receive Intercession".
       - Sub: *"Submit a prayer request to the Body. Share what your church needs intercession for."*
       - Full-width primary button: "**Submit a Request**"
     - **Make Intercession** — surface fill, faint border, otherwise same layout.
       - 36 × 36 green-tinted circle with heart icon (green stroke).
       - Serif title "Make Intercession".
       - Sub: *"Visit the prayer wall. Stand in the gap for churches and leaders across the globe."*
       - Full-width ghost button (border + text both green, 0.4 alpha): "**Go to Prayer Wall**"
- **Bottom tab bar:** Prayer Wall active (envelope icon, 4th slot — same slot used by Persecuted Church; treat these as separate destinations selected from the menu or a sub-router).

#### 13. Prayer Wall (Feed)
- **Purpose:** Browse and filter intercession requests + testimonies.
- **Top bar:** Back arrow + "Prayer Wall" (serif) on the left, "Filter" (sky) on the right.
- **Filter row** — horizontal scroll, 5 px gap, 6 × 14 px padding. Tag-style chips: **All** (active sky), **Urgent** (red), **Africa** (amber), **Asia** (sky, 0.5 opacity), **Americas** (sky, 0.5 opacity).
- **Feed (8 × 14 padding):** intercession items with metadata:
  - "Church at Lagos · Nigeria" — *"We are in need of manpower for our prison outreach this weekend..."* — `Manpower` amber tag · 1h ago
  - "Anonymous · Southeast Asia" — *"Pray for our underground congregation — our meeting place has been discovered."* — `Urgent` red tag · 4h ago
  - "Maranatha Ministries · Atlanta" — *"Intercede for our healing and deliverance services this Tuesday."* — `Healing` sky tag · 6h ago
  - "Church at Accra · Ghana" — *"We give thanks — our church building has been completed. Glory to God."* — `Praise Report` green tag · 1d ago
- Then section label `TESTIMONIES` (green).
- **Testimony items** — same shape as intercession-item but with **green left border**, `rgba(91,173,122,0.06)` fill, `rgba(91,173,122,0.2)` outer border, green location text:
  - "Anonymous · East Africa" — *"Three months ago we asked this wall for prayer over our pastor who was ill. He has fully recovered. We testify to the faithfulness of God."* — `Testimony` green tag · 2d ago
  - "Church at Manila · Philippines" — *"Our outreach reached 47 families this month. To God be the glory."* — `Testimony` green tag · 3d ago

#### 14. Connect Tab
- **Purpose:** DM-style inbox of conversations with other ministries / leaders.
- **Top bar:** "Connect" (serif) + "+ New" (sky, right).
- **Sub-tabs** (hairline divider below):
  - **Ministries** (active, sky text, 1.5 px sky bottom border) | **Leaders** (muted).
- **Inbox rows** — 8 px vertical padding, 0.5 px faint bottom border each. Each row:
  - 28 × 28 avatar circle (sky-dim by default, with monogram in sky text). Variants use green / amber tints for differentiation.
  - Name + timestamp on top row (`<Ministry name>` 0.65 rem weight 500, timestamp 0.48 rem muted, right-aligned).
  - Preview line 0.55 rem muted.
- **Example rows:**
  - "Grace Network · Lagos" — *"We are grateful for the prayer..."* — 2h
  - "Kingdom Mandate · Seoul" (green avatar) — *"Can we coordinate on the outreach?"* — 1d
  - "Anonymous Ministry" (amber avatar) — *"Thank you for standing with us..."* — 3d
- **Covenant notice** at the bottom (surface2 fill): *"Conversations within Replant are governed by our community covenant. Chats are protected within the network. Keywords flagged for review if misuse is detected."*
- **Bottom tab bar:** Connect active (chat-bubble icon, far-right slot).

---

### Row 5 — Direct Message · Hamburger Menu

#### 15. Direct Message Thread
- **Purpose:** 1:1 conversation between ministries.
- **Top bar:** Back arrow + 24 × 24 avatar + name block:
  - Name "Grace Network" (0.65 rem weight 500) + location sub "Lagos, Nigeria" (0.48 rem muted)
  - Three-dot menu icon on the right.
- **Message list** (scroll-area, gap 10 px):
  - Message row layout: 22 × 22 small avatar + bubble. Sent messages reverse to right-align with no avatar.
  - **Received bubble** — surface2 fill, 10 px radius with **2 px bottom-left** corner.
  - **Sent bubble** — sky fill, black text, 10 px radius with **2 px bottom-right** corner.
  - Max-width 75%. Timestamp `0.42 rem` muted under each bubble.
  - **Example transcript:**
    - [recv 9:14 AM] *"We received your prayer request and we are standing with you in intercession this week."*
    - [sent 9:17 AM] *"Amen, we are grateful. The Lord is faithful."*
    - [recv 9:21 AM] *"We would also like to send two of our leaders to support your prison outreach next month. Is that possible?"*
    - [sent 9:24 AM] *"That would be a blessing. Let us coordinate details."*
  - System banner mid-thread, centered: *"Conversations are protected within the Replant network"* (0.45 rem muted).
- **Input footer** (top hairline border, 8 × 12 padding, flex row):
  - Text input "Type a message..." (flex 1).
  - 28 × 28 sky-filled circular **send button** with a 12 × 12 paper-plane icon (black stroke).

#### 16. Hamburger Menu Overlay
- **Purpose:** Right-side slide-in menu opened from the top-bar hamburger.
- **Layout:** Fixed overlay. Dimmed black backdrop (`rgba(8,8,8,0.6)`) with a **2 px backdrop blur**. The menu panel anchors right, **75% screen width**, full height, surface fill, sky-mid left border, 24 × 20 padding.
- **Panel contents, top to bottom:**
  1. **Logo block** — 28 × 28 logo SVG + serif wordmark "Replant" (1 rem, letter-spacing 0.1em). Hairline divider below (16 px bottom padding, 20 px bottom margin).
  2. **Menu rows** — each is `display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 0.5px solid faint`. Each row has a 14 × 14 sky-stroked icon + serif item label (0.85 rem, weight 400):
     - ⓘ icon — **The Vision**
     - Globe icon — **Outreach & Missions**
     - Chat-bubble icon — **Language**
     - Gear icon — **Settings**
     - Question-mark icon — **FAQ**
  3. **Footer block** — top hairline border, 14 px top padding, vertical flex gap 10:
     - User card row: avatar "IF" + name "Ife · Maranatha Ministries" (0.62 rem weight 500) + location "Atlanta, Georgia" (0.5 rem muted).
     - **Log out** row — small log-out icon + label, both rendered at `rgba(240, 237, 230, 0.3)` (intentionally subdued to discourage casual sign-out).

---

## Shared Components

### Bottom Tab Bar
Used on Home, Local, Global, Persecuted Church, Prayer Wall, Connect.

- Full-width, top hairline border at faint, 8 × 4 px padding (12 px bottom safe-area), `rgba(8, 8, 8, 0.95)` fill.
- 6 evenly-spaced tab items via `justify-content: space-around`.
- Each tab item: vertical flex, gap 3 px, opacity 0.4 default → opacity 1 when active. 2 × 6 padding.
- Tab icon: 20 × 20 container with an 18 × 18 line-icon SVG (1.5 stroke). Active stroke is `#6BB5E8` (or `#E05555` on the Persecuted slot).
- Tab dot: 3 × 3 sky circle below the icon, hidden by default, **visible only on the active tab**.

**Tab order (left to right):**
1. **Home** — house icon (`<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`)
2. **Local** — sun/compass icon (circle 3 + radial lines)
3. **Global** — globe icon (circle 10 + equator + meridian curves)
4. **Persecuted Church / Prayer Wall** — envelope/letter icon (shares a slot; the active page determines which color it strokes)
5. **(reserved slot)** — book/journal icon (`M12 2v8 ... 5 22h14`) — unassigned in the current mockup
6. **Connect** — chat-bubble icon (`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5..."/>`)

> ⚠️ The tab bar in the mockup has **6 slots** but only 5 distinct destinations are wired (Home, Local, Global, Persecuted Church *or* Prayer Wall, Connect). Confirm with the design owner which icon goes in slot 5 ("book/journal") before shipping.

### Top Bar
- Flex row, space-between, 8 × 16 padding, faint bottom border.
- Left: either a logo + wordmark, a serif page title, or a back-arrow + title combo.
- Right: either a hamburger (three 16 × 1.5 bars, 3 px gap), a sky link, a meta line, or icon menu.

### Card
- `.card`: surface fill, faint 0.5 px border, 8 px radius, 10 × 12 padding.
- Card title: serif, 0.8 rem, weight 400.
- Card sub: 0.62 rem muted, line-height 1.5.

### Scripture Strip
- Sky-dim fill, sky-mid 0.5 px border, 6 px radius, 10 × 12 padding.
- Quote in serif italic. Reference label uppercase sky, 0.5 rem, letter-spacing 0.15em.

### Intercession Item
- Surface fill, faint border, **2 px sky left border** (red for persecution, green for testimonies), 0 / 6 / 6 / 0 radius, 8 × 10 padding.
- Top label: uppercase 0.5 rem sky location (or red / green per variant), letter-spacing 0.15em.
- Body: serif italic, 0.72 rem, line-height 1.4.
- Footer meta row: a small RAG/category tag on the left + timestamp (0.45 rem muted) on the right.

### Tag
- Inline pill, 0.5 rem, letter-spacing 0.12em, uppercase, weight 500, 2 × 6 padding, 2 px radius.
- Variants — fill is 0.12 alpha of the accent, text is the accent at full strength:
  - `tag-sky` (default / informational)
  - `tag-red` (urgent / persecution / active)
  - `tag-amber` (manpower / warning / notice)
  - `tag-green` (praise reports / testimonies)

### Button
- `.btn`: flex centered, 4 px radius, sans, 0.6 rem, weight 500, letter-spacing 0.1em, uppercase, 7 × 12 padding.
- `btn-primary`: sky fill, black text.
- `btn-ghost`: transparent fill, sky-mid border, sky text.
- `btn-surface`: surface2 fill, faint border, muted text.
- Red destructive variant (used in some segmented controls): `rgba(224,85,85,0.15)` fill, red text, `rgba(224,85,85,0.3)` border.

### Input
- `.input-field`: surface2 fill, faint border, 4 px radius, 7 × 10 padding, 0.62 rem, muted text (placeholder color).
- Dropdowns: same shape, the value line shows the union of options separated by `·` and a `▾` chevron at the end.

### Avatar
- Default: 28 × 28 circle, sky-dim fill, sky-mid border, 0.55 rem sky monogram, weight 500.
- Color-coded variants for differentiation: green (sky-green tints), amber. Apply when the inbox / DM benefits from quick visual ID.

### Map / Globe Placeholder
- Surface2 fill, faint border, 6 px radius.
- Gridded background: two repeating 1 px linear-gradients (vertical + horizontal) at 20 × 20 px, sky-tinted at 3% alpha. This is the "topo grid" look.

### RAG Dot
- 7 × 7 circle (3–8 px depending on context — small inline, larger on maps).
- Map / globe dots: pair the dot with a soft `box-shadow: 0 0 6–8px <dot color>` for the glow effect.
- Colors map to status: Red = urgent / persecution; Amber = needs support; Green = at peace.

### Hairline Divider
- 0.5 px tall, faint background, 4 px top/bottom margin (`.hdivider`).

---

## Interactions & Behavior

### Navigation
- The HTML mockups are static — no navigation is wired. Implement using the codebase's native router (React Navigation, Flutter Navigator 2.0, SwiftUI NavigationStack, etc).
- **Tab bar** persists across the 5 main destinations. The Onboarding flow, Confirm Your Church, Region slide-out, DM thread, and Hamburger menu are **modal / pushed routes** without the tab bar (or with the bar dimmed).
- Back arrows are top-left in the top bar — they should pop the current route.
- The hamburger opens the right-anchored overlay from any top-level screen.

### Onboarding gate
- Splash → Acknowledgement → Account Setup (Step 1) → Find Your Church (Step 2). Cannot enter the main app without affirming the Declaration and selecting / registering a church.
- "I Affirm This" is a hard requirement. The button is the only way forward; no "skip".

### RAG status
- Each church and region carries a server-driven RAG state (`red` | `amber` | `green`). This drives dot color, tag color, and (sometimes) card opacity. Persecuted regions automatically inherit `red`.

### Anonymity & visibility
- **Anonymous flag** (set on Account Setup): when true, the user's name is replaced with "Anonymous" everywhere in the network UI. Real name/church remain on the server for security/verification.
- **Visibility preference** (set per-church on Confirm page 2): three modes — name+location, location-only, fully anonymous. Card titles render based on this state.

### Search
- Find-Your-Church input requires **at least 3 characters** before firing the search. Show empty state until threshold is met.
- Results show RAG + capacity status. Cards marked "at capacity" should not allow joining; the card should be disabled or open a "request to join" route (clarify with PM).

### Forms
- Required fields marked with red `*`.
- Confirm-Your-Church name field is **one-time**: server should refuse name changes after first submission.
- Provide email **or** phone **or** both — at least one is required.

### Persecuted section
- Visually distinct (red accent throughout, including the active tab stroke).
- All entries are anonymized by default. The submit flow ("Share Your Heartcry") must strip identifying metadata before posting.
- Display the encryption notice prominently. End-to-end encryption is a **product requirement**, not just a visual claim — coordinate with backend before launch.

### Direct Messages
- Plain 1:1 messaging. The on-screen banner "Conversations are protected within the Replant network" is a real promise — implement transport encryption.
- The covenant notice on the Connect tab references keyword flagging — confirm moderation pipeline with PM before launch.
- No financial transfer affordance anywhere. The "Replant Note" on Home is explicit about this.

### Globe & region slide-out
- Tapping a RAG dot on the Global tab opens the **Region slide-out** sheet from the bottom. The globe behind dims to 0.7.
- Drag handle at the top of the sheet should swipe-to-dismiss.

### Hamburger overlay
- Slides in from the right (75% width). Backdrop is dimmed + blurred. Tap-outside to dismiss.
- "Log out" intentionally rendered at very low opacity — keep it that way to discourage accidental sign-out, but ensure it stays accessible (hit target ≥ 44 × 44, screen-reader label "Log out").

### Animations
The mockups do not commit to specific motion. Use platform defaults plus:
- Tab switches: cross-fade or no animation.
- Bottom sheet (region detail): standard spring-up from bottom, ~300 ms.
- Side drawer (hamburger): slide from right with backdrop fade, ~250 ms.
- Card taps: subtle 0.96 scale press-state.

---

## State Management

Suggested state shapes (adapt to your stack):

- **User**: `{ id, fullName, role, churchId, anonymous: boolean, churchVisibility: 'full' | 'locationOnly' | 'anonymous', verifiedAt: Date | null }`
- **Church**: `{ id, name, type, city, country, ragStatus, leaderId, leadersCount, capacity, needs, abundance, emergencyPlan, declarationOfState, contact: { email, phone } }`
- **PrayerRequest**: `{ id, churchId | anonymous, location, body, tags, ragStatus, persecutionFlag: boolean, createdAt }`
- **Testimony**: same as PrayerRequest with `kind: 'testimony'`.
- **Conversation**: `{ id, participantIds, lastMessage, lastMessageAt, kind: 'ministry' | 'leader' }`
- **Message**: `{ id, conversationId, senderId, body, createdAt }`
- **Region**: `{ id, name, ragStatus, tags, churchIds[] }`

Loading / error / empty states should follow each codebase's conventions — the mockups show one empty state (Find Your Church before typing); apply the same pattern to all feeds (Network Updates, Prayer Wall, Connect inbox, etc).

---

## Assets

The only asset is the **Replant logo SVG**, embedded as a `<symbol id="rp-logo">` near the top of the body in the HTML file. Export it as `replant-logo.svg` and ship at multiple sizes (24, 28, 32, 64, 90, 256 px). It is a custom monogram and should not be redrawn.

Everything else in the mockup is composed from line-icon SVGs that are inlined; replace with your codebase's icon library (Feather, Phosphor, SF Symbols, Material Symbols) using the closest equivalents. The current set is essentially Feather Icons stroked at 1.5 px. **No raster images** are used.

---

## Files in this handoff

- `Replant Wireframes v4.html` — the source design mockup containing every screen described above. Open in any browser to view side-by-side.
- `screenshots/` — one PNG per screen, in flow order. Use these as quick reference next to the file itself.
- `README.md` — this document.

### Screen ↔ screenshot index

| # | Screen | Screenshot |
|---|---|---|
| 1 | Splash / Welcome | `screenshots/01-splash-welcome.png` |
| 2 | Acknowledgement — Declaration of Faith | `screenshots/02-acknowledgement-declaration.png` |
| 3 | Account Setup (Step 1 of 2) | `screenshots/03-account-setup.png` |
| 4 | Find Your Church — Search (Step 2 of 2) | `screenshots/04-find-your-church.png` |
| 5 | Home Tab | `screenshots/05-home-tab.png` |
| 6 | Local Tab | `screenshots/06-local-tab.png` |
| 7 | Confirm Your Church — Page 1 of 2 | `screenshots/07-confirm-church-page-1.png` |
| 8 | Confirm Your Church — Page 2 of 2 | `screenshots/08-confirm-church-page-2.png` |
| 9 | Global Tab — Globe | `screenshots/09-global-tab-globe.png` |
| 10 | Region Slide-out Panel | `screenshots/10-region-slide-out.png` |
| 11 | Persecuted Church Tab | `screenshots/11-persecuted-church-tab.png` |
| 12 | Prayer Wall Tab (Landing) | `screenshots/12-prayer-wall-tab.png` |
| 13 | Prayer Wall (Feed) | `screenshots/13-prayer-wall-feed.png` |
| 14 | Connect Tab | `screenshots/14-connect-tab.png` |
| 15 | Direct Message Thread | `screenshots/15-direct-message-thread.png` |
| 16 | Hamburger Menu Overlay | `screenshots/16-hamburger-menu-overlay.png` |

---

## Open questions for the design owner

These were flagged while writing the handoff — please resolve before implementation begins:

1. **Tab bar slot 5** (book/journal icon): currently unassigned. What lives there?
2. **Persecuted Church vs Prayer Wall tab placement**: both share the envelope-icon slot in different screens. Confirm the final IA — are they sibling tabs, or is one nested under the other?
3. **Contact details block duplication** on Confirm-Your-Church Page 1 (mockup artifact). Confirm one block, not two.
4. **At-capacity churches**: should the user be able to "request to join" or is the card hard-disabled?
5. **Encryption** in the Persecuted section and DMs — confirm scope (transport vs E2E) with engineering before referencing it in UI copy.

