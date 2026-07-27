# Sim UAT — Logged-in Visual & Functional Pass — FINDINGS (2026-07-12)

Senior QA/UAT pass, iPhone 17 Pro sim (iOS 26.3), in-app only. Personas: senior pastor (+t5), young pastor (+t3, anonymous), org leader (+t6 fresh para-ministry signup), online-ministry initiator (+t4). Admin state changed via SQL only. **No Jira written — drafts HELD for go-ahead.**

Register of all DB changes + reverts: `.qa/2026-07-12-uat-pass-register.sql` (t5 restored to exact verified snapshot; 4 seeded announcements deactivated; +t6 left in place).

---

## FINDINGS (ranked, most severe first)

`F## | severity | lens | persona | screen | expected → observed | repro`

### P1 — blocks a core job / major UX or safety

**F1 · P1 · Readability · all · app-wide · Dynamic Type is completely ignored.**
Expected: text honors the iOS system text-size setting (WCAG 1.4.4 Resize Text). Observed: at system text size **XXL**, Home and Prayer Wall render **pixel-identical** to default. Fonts are fixed; the OS accessibility text setting has zero effect anywhere. Repro: `simctl ui <udid> content_size extra-extra-large` → reopen app → compare to default (identical). **This is the direct answer to your readability concern**: a senior pastor who has enlarged their phone text gets no larger text in Replant, on any tab. Fix is app-wide (allowFontScaling / scale tokens), so it lands once and helps every surface.

**F2 · P1 · Behavior/Privacy · t4→t3 · Connect connection-request confirmation · anonymous leader's real name leaks.**
Expected: an anonymous leader is never shown by name (anon invariant). Observed: after t4 sends a connection request to t3 (who is `anonymous=true`), the confirmation modal reads **"Your message request to Ruth James has been sent."** — her real name. Every other surface masked her correctly ("Evangelist · Blessings Abound Church" in search, DM header, thread-list). DB confirms `recipient_anon=true`. Scope: leader→leader, sender-only, one modal — but for the persecuted-Church threat model an identity leak is load-bearing. Repro: as a non-anon leader, send a first-DM/connection-request to any `anonymous=true` leader; read the "REQUEST SENT" modal body.

**F11 · P1 · Behavior/Privacy · t5 · comments + Prayer Wall · display-name preference ignored — surname shown for "first name only" users.** *(Added after initial assembly — found mid-pass, omitted from the first write-up in error.)*
Expected: `display_name_preference = 'first_name_only'` → others see "Pastor Ifeoluwa" — which is exactly what Settings → Account promises under "DISPLAY NAME SHOWN TO OTHERS." Observed: t5's Home comment renders **"Ifeoluwa Jamesarike"** (full name, no role) and her Prayer Wall card/detail renders **"Pastor Ifeoluwa Jamesarike"**. Root cause confirmed in the live DB function: `resolve_display_name`'s preference branch only suppresses the **middle** name — `v_body` unconditionally appends `p_last`, so "first name only" still gets the surname everywhere the function is used. Separately, `get_comments` returns `role` as its own column and the comment UI drops it (no "Pastor" prefix). Meanwhile the hamburger identity block and Settings preview compose "Pastor Ifeoluwa" correctly — so name rendering is not single-sourced (three different results on three surfaces for the same user). The app states a privacy expectation and then breaks it — same family as F2, and it **fails KAN-229's display-preference behavior while that ticket sits in Testing**. Repro: any `first_name_only` user posts a comment; compare against their Settings preview. Fix pointer: `resolve_display_name` (skip `p_last` when pref = first_name_only) + comment surface role prefix.

### P2 — real friction / inconsistency

**F3 · P2 (→P0 if confirmed on release build) · Behavior · t4 · Connect DM letter-composer · app froze on first entry.**
Observed: first time opening a fresh connection-request "letter" composer, the whole RN UI locked — composer, back button, and tab bar all stopped responding; the accessibility tree collapsed to a single empty node. Runtime log showed `UIManager::~UIManager()` + `Scheduler::~Scheduler()` teardown, preceded by repeated `react_native_expect failure: isMap` and `instanceHandle is null, event … will be dropped`. Recovered only on app relaunch; the same send then worked on the 2nd attempt. **Most likely a dev-client/Metro bridge teardown, not a production defect** — must be reproduced on a release build before filing as a real bug. Flagging because if it repros without Metro it's a P0 (dead screen on a core flow).

**F4 · P2 · Behavior/Copy · t5 · login after church rejected · leader sees generic "Account deactivated," not church-rejection copy.**
Observed: when a church is set to `rejected`, the leader on next cold launch is **signed out to a login lockout** with a non-dismissible "Account deactivated. …reach out to us at accounts@projectreplant.org" notice — identical framing to a deadline-expiry deactivation. The leader can't tell their *church was rejected* from their *account being deactivated* for some other reason, and there's no in-app rejection state. (Also **resolves a system-map contradiction**: diagram 01 "sign-out to Splash" is correct; diagram 08 "read-only Home + 'We were unable to verify your church' + appeal link" is **not** what happens.) Whether the generic copy is acceptable is your call.

**F5 · P2 · Copy · t6 · The Church → profile-completion Step 1 (org) · "CHURCH NAME" label on an organization.**
Expected: para-ministry copy swap ("Organization Name"). Observed: the CompletionFlow Step 1 "Is this still you?" labels the locked name field **"CHURCH NAME"** for a `para_ministry` org (value "Lighthouse Relief And Development Initiative"). The org copy-swap that the *signup* form applies correctly ("REGISTER ORGANIZATION", "Organization Name") is **not** applied in the post-verify CompletionFlow. Repro: sign up a para-ministry → verify → open The Church → CompletionFlow Step 1.

**F6 · P2 · Behavior · t6 · post-signup · welcome DM not seeded.**
Expected (KAN-217): a "Replant Team" welcome DM exists from account creation. Observed: fresh account +t6 had **0 conversations** immediately after signup **and still 0 after verification**. The Replant Team secure thread — described as the only Connect surface available pre-verified — never appeared for this account. Repro: fresh signup → Connect → Leaders (no Replant Team thread). (Contrast: existing accounts t3/t4 do have the Replant Team thread.)

### P3 — polish

**F7 · P3 · UX · t3 · Connect connection-request pre-accept preview · message truncated mid-word, no ellipsis.**
The request bubble shown to the recipient *before accepting* renders "Grace and peace to you. I lead a relief organization and **wou**" — a hard cut mid-word with no "…". Full text displays correctly after Accept. The a11y text node itself is truncated, so it's a real render clamp, not just visual clipping.

**F8 · P3 · Copy · t3 · Home comment byline · anon role lowercased.**
Comment author renders "**A fellow evangelist**" (lowercase role) while Connect renders "**Evangelist** · Blessings Abound Church" (capitalized). Minor casing inconsistency in the anon label.

**F9 · P3 · Behavior · t5 · Persecuted heartcry submission · no Replant Team thread seeded.**
Submitted heartcry landed with `thread_id = NULL`. The system map expects submission to seed a Replant Team thread with a system first message (the "Responded → open secure message" deep-link depends on it). Verify whether the thread is created lazily on admin response vs. at submission — if the former, this is intended; if the latter, it's a gap.

**F10 · P3 (a11y) · all · Connect DM thread view · empty accessibility tree.**
The DM/letter thread view intermittently exposes **no accessibility tree** (collapses to one empty node) while rendering fully — VoiceOver would find the screen unusable. Overlaps F3 (same screen); re-verify on a stable/release build.

*(Not re-flagged — carried from the 2026-07-03 a11y audit: Login "Sign in" button removed from the tree while disabled; sticky bottom CTAs absent from the a11y tree; unlabeled signup text fields. All observed again, all previously filed.)*

---

## BEHAVIORS VERIFIED WORKING (UAT can lean on these)

- **Auth/session (KAN-38/41):** email+password login with status routing; session restore across app kill→relaunch (verified 3×); logout → clean return to login; wrong-password error "Incorrect email or password." with error clearing on edit.
- **Home feed:** all 4 seeded card types render (standard / article+source_label+link / call_to_action / together); all 4 tag pills (notice/update/urgent/new); "Replant Team" attribution; daily scripture strip with tap-to-expand; pull-to-refresh; 7-day feed window.
- **Comments:** post + read; count reflects on refetch (0→1 seen by a different account); own comment appears immediately; verified users get composer, **pending users get read-only (no composer)** — gate correct.
- **Prayer Wall (KAN-258):** post request with live 300-char counter + category + urgent-toggle (rises to top); "Stand in the gap" toggles + increments (0→1 verified cross-account in DB, race-safe); My Prayers shows own post; 5-pill nav; landing hero.
- **Persecuted / heartcry:** 4 pills (Feed/My Heartcries/Bear Witness/Take Heart); submission with severity + multi-select request-type + uncapped text; own heartcry does **not** hit the public Feed (sits in My Heartcries as `new`); status pill flips `new → responded` on refetch after SQL disposition; anonymity-disclosure copy exact; success toast "Received. The Replant team has been notified and is praying for you."
- **The Church:** CAML map centers on GPS (Atlanta); RE-CENTER ME / MY CHURCH LOCATION pills; RAG-red church renders; nearby list; reset-to-CAML-on-focus (intended, not a bug).
- **Connect (KAN-166/216):** Leaders/Ministries sub-tabs; search min-2-char, no UG in results; lazy thread creation (no row until send); **full connection-request lifecycle: initiate → recipient sees masked request → accept → bidirectional DM** (both directions verified, DB-confirmed); CovenantStrip + CovenantFooter; Replant Team thread pinned with lock+Secure tag (existing accounts); unread badges; non-anon full-name display ("Elder Ruthie Jamie").
- **Settings (KAN-75/229):** structured-name fields render; hamburger + Settings preview compose "Pastor Ifeoluwa" correctly (**but comments/Prayer Wall violate the preference — see F11; KAN-229 not passing**); **Anonymous Mode reads correct DB state** (t3 On / t5 Off — toggle write-path not exercised); Privacy/Church/Language(coming-soon)/Notifications sections open; Terms + Privacy open coming-soon modals; RAG status shows red; Network ID RPL-02102 shown; change-password chevron present.
- **Verification states (KAN-35/195):** pending VerificationBanner + copy + accurate day count; per-tab gates with the locked timeline phrase "This process may take up to 30 days, but reviews are typically complete within 24-72 hours."; deactivation-lockout + rejected-lockout copy; **clean restore to verified**.
- **Signup end-to-end:** Declaration of Faith ("test of the spirits" copy); ASP1 all fields + role/country pickers + filter-as-you-type (KAN-184); **para-ministry org path** with correct copy swaps on the signup form (REGISTER ORGANIZATION / Organization Name / tooltip / no HQ checkbox); RegCP1 + RegCP2; "Same as my account info" autofill; atomic account creation; verified → CompletionFlow 3-step; **church_code assigned on verification** (RPL-02108).
- **Anon masking (correct everywhere except F2):** comment "A fellow evangelist" + squarish "A" avatar + church shown; Connect search/DM-header/thread-list "Evangelist · Blessings Abound Church"; self-view shows own name (correct).
- **UG exclusion (KAN-181):** onboarding church search for "Underground" → "No churches found."

---

## UI NOTES — what works / what doesn't, screen by screen

Consolidated visual-pass commentary from the screenshots taken across all four personas. ✓ = works, keep. ✗ = friction, consider.

### Splash / Login
- ✓ Wordmark lockup (REPLANT / THE CHURCH, CONNECTED) is quiet and confident; the welcome line ("House churches, churches without walls, and underground churches are welcome.") does real inclusion work on the first screen.
- ✓ Login error banner (red on dark-red field) is legible without shouting; error clears the moment you edit — good manners.
- ✓ Mono-uppercase field labels (EMAIL / PASSWORD) establish the app's label grammar immediately.
- ✗ "BY SIGNING IN YOU AFFIRM…" footer is very small and dim — passes at its weight, but it's the first instance of the app's ~11px dim-mono habit (see cross-cutting).

### Home
- ✓ The scripture strip is the best reading surface in the app: roman serif ~20px, generous leading, tap-to-expand/collapse works beautifully and the expanded state survives navigation. This is the Home baseline you approved — confirmed deserved.
- ✓ The card system genuinely differentiates: article cards get the large serif title treatment, together cards get the green pill + "— held in prayer —" flourish, urgent gets the red pill. A leader can read the feed's rhythm at a glance.
- ✓ "Replant Team" attribution row with the rootball glyph is consistent on every card; comments expand inline so you never lose feed context.
- ✗ The pinned TODAY + scripture header permanently claims ~a fifth of the screen while scrolling the feed. On the senior lens that's a real reading-window cost — worth considering collapsing the strip to one line on scroll.
- ✗ "read on" / "fold" is so dim it reads as decoration, not a control. First-time users may never discover card expansion.
- ✗ Tag pill "Network update" renders inside a section already headed NETWORK UPDATES — redundant labeling, and the pill label for tag `update` saying "Network update" doubles the confusion.
- ✗ A call_to_action card without a `link_url` renders visually identical to a standard card — the card type promises an action it doesn't show (D3 demonstrated this).
- ✗ Comment composer sits flush against the tab bar when the keyboard is closed; the Post button renders partially clipped.
- ✗ "1 comments" pluralization; same-timestamp cards reshuffle between sessions (feed order tie-break).

### The Vision / Outreach & Missions (hamburger statics)
- ✓ The Vision is the strongest typographic page in the app: eyebrow → display serif with the italic accent line ("Sewn Back Together") → italic standfirst → left-bordered scripture block → roman body → "Replant Initiative, Inc. · Est. 2026" footer. Textbook hierarchy; nothing to change.
- ✓ Outreach & Missions is a real surface, not a static: localized "OUTREACH NEAR YOU — Loganville", instructive empty states ("As leaders post needs across the network, they'll appear here."), four scripture-anchored category tiles.
- ✗ The "Restricted" chip on ACROSS THE NETWORK is unexplained — a senior reader has no way to know restricted by whom or why.

### Hamburger menu
- ✓ Slide-in with rgba dim (no blur — invariant held); clear icon+label rows; identity block at the bottom ("Pastor Ifeoluwa · Regent Kingdom Church…") grounds the session; Log out separated at the very bottom with a confirm dialog.
- ✗ "Invite to Replant" is the only sky-highlighted item — if that emphasis is deliberate (growth nudge) it works, but confirm it's a choice and not a stray active-state.
- ✗ Identity block truncates the city ("· Logan…"); avatar shows two-letter initials (IJ) while comment avatars show one (I) — small identity-system inconsistency.
- ✗ Menu state doesn't persist across a destination visit — back from The Vision returns to Home with the menu closed, so browsing multiple menu items costs a reopen each time.

### Prayer Wall
- ✓ The landing hero (LIVE pill, rotating urgent previews, ENTER THE PRAYER WALL) is a strong entry moment — it makes intercession feel alive before you're in the list.
- ✓ Detail sheet is a model interaction: plain roman body (noticeably easier than the card italic — the locked ruling proves itself side-by-side), red "Stand in the gap" flipping to the outlined "You're standing in the gap" confirmed state, Connect CTA beneath.
- ✓ The post form is the best form in the app: live counter (176/300), category chips, urgent + anonymous toggles with honest helpers ("Your church will still be shown."), and "Lift It Up" as the CTA — perfect voice.
- ✓ Filter pills + urgent-first ordering read instantly; My Prayers under the James 5:16 header with a kebab for own-content actions is clean.
- ✗ The card stack carries five text registers per card (mono-caps church name · muted author line · italic body · colored pills · counts+timestamp). At list density this is the noisiest composition in the app — and it's the tab where leaders read longest. The italic body is the biggest single contributor (readability verdict below).
- ✗ Wide-tracked mono-caps church names wrap badly on long names — a three-line "HOUSTON BIBLE BELIEVERS…" header before the request even starts.
- ✗ "Tap to open" hint repeats on every card — useful once, noise thereafter.
- ✗ The prayed-count heart is ~12px — small to see and to hit for older hands (the whole card opens, so functional, but the glyph under-signals).
- ✗ Toggles don't respond to row taps, only the small thumb — a senior-lens miss on every switch in the app (post form, settings).

### Persecuted
- ✓ The red register is held with total discipline — title, pills, chips, CTA outline, status dots. The tab *feels* heavier than the others, which is exactly right.
- ✓ Trust strip up front ("🔒 ENCRYPTED · NO LOCATION STORED · REGION ONLY") is the right promise at the right moment; "A HELD SPACE" intro copy lands.
- ✓ The heartcry form's severity helpers are the best microcopy in the app ("Persistent persecution, not currently escalating."); the feed-share toggle's disclosure ("your continent only, never your name or church") is honest and precise.
- ✓ The RECEIVED → SEEN → RESPONDED tracker with color-stepped dots is the best micro-visualization in the app — instantly legible.
- ✗ This tab also has the smallest, dimmest text in the app: "A VOICE" eyebrows, region + date meta at ~10–11px dim mono on near-black. For the tab serving leaders under the most stress, the meta layer is the hardest to read.
- ✗ My Heartcries card replaces the leader's own words with the state line "Being held and prayed over." — she can't re-read what she sent, and tapping the card does nothing (F9-adjacent). A card that shows neither content nor responds to touch reads as dead.

### The Church
- ✓ "The Church at *Atlanta*" header device (italic GPS city) is charming and orienting; the humanized legend (FREE / LIMITS / URGENT) beats color jargon; "DRAG TO EXPLORE" hint; the bottom sheet labels itself ("5 CHURCHES NEAR YOU · SWIPE TO SEE MORE").
- ✓ Nearby rows compose correctly: church name · leader lines in role+first-name register ("Psalmist Ruth · Evangelist Ifeoluwa") · RPL id in mono · distance in miles.
- ✗ The dark Mapbox tiles are extremely low-contrast — street geometry is barely visible. Moody and on-brand, but a senior pastor trying to actually read geography will squint. Worth one notch of tile lightness or label contrast.
- ✗ Legend chips + MY CHURCH LOCATION pill crowd the map's top edge; with RE-CENTER ME also present (after panning) the top strip gets busy.

### Connect
- ✓ The letter framing for first contact is the single best voice moment in the app: lock glyph, "Where two or three are gathered…" (Matthew 18:20), "A letter to a fellow leader. Let your words be with grace." — it turns a DM composer into a covenant act.
- ✓ Replant Team thread is properly distinct (pinned, lock icon, SECURE tag); PENDING chip + "Awaiting their reply" is honest state communication; the recipient's accept gate ("Reply opens when you accept") is exactly the right control; covenant footer persists on both sub-tabs.
- ✓ Sent/received bubble split (sky right / dark left) reads instantly; the accepted-event system line ("YOU ACCEPTED …'S REQUEST TO CONNECT · TODAY 5:21 PM") anchors the thread's history.
- ✗ This screen family is also where the app's worst moments live: the composer froze once (F3), its a11y tree vanishes (F10), and the confirmation modal leaked an anon name (F2).
- ✗ The send paper-plane sits at the extreme right edge, partially into the margin; the attachments paperclip is a visible control that only says "coming soon" when tapped — a dead affordance inside the app's most sacred composer.
- ✗ Tab badge says 10+ while the visible rows show 1 and 1 — whatever the math, the leader can't reconcile it (KAN-216's exact territory).

### Settings
- ✓ Numbered serif section headers (01 Account … 06 About) make a long page scannable; the live "DISPLAY NAME SHOWN TO OTHERS — Pastor Ifeoluwa" preview is excellent (it's also what exposed the name bug); RAG radio with colored dot + plain-language descriptions; the foundation block (mark, John 17:21, VERSION 1.0.0) closes the page with grace; DEACTIVATE ACCOUNT in red mono is appropriately sober.
- ✗ The hamburger's "Language" item deep-links to Settings but lands with every section collapsed — the promise isn't kept.
- ✗ Italic sky "Not set ›" values (Honorific/Suffix) are slightly ambiguous as tappable controls; helper text runs ~12px dim.

### Onboarding (signup → org registration → completion)
- ✓ Declaration of Faith is the strongest single screen in the product — the creed blocks, John 14:6-7, and "This is not a legal agreement. This is a test of the spirits." No notes.
- ✓ The HOW YOU'LL APPEAR live preview card ("Minister Deborah · Your Church") gives immediate identity feedback; the three-tile chooser frames standalone/branch/underground with real threat-model language; the org copy-swap on the signup form is thorough; the draft card ("READY TO REGISTER" + PENDING chip + "A Replant team member will reach out within a few days. Your account stays active during this window.") sets expectations honestly; the CompletionFlow's "three quiet steps" and the FOR LEADERS IN RESTRICTED CONTEXTS note are the best safety copy in the app.
- ✗ ASP1 is one very long scroll with no progress anchor beyond the "1 OF 2" eyebrow — a senior filling seven fields plus pickers has no sense of remaining distance.
- ✗ Auto-capitalization title-cases conjunctions in org names ("Relief And Development"); the standalone tile copy never says "organization," so a para-ministry leader may not self-identify into the right tile; CITY placeholder still says "church" on the org path (F5 family).

### Cross-cutting
- ✓ One committed dark register, held everywhere (and correctly indifferent to the OS light-mode toggle); mono-uppercase eyebrows as a consistent navigation grammar; scripture anchors on nearly every surface that never feel decorative; empty states that instruct with CTAs instead of apologizing; rgba-dim overlays only (no blur) — invariant intact.
- ✗ Four systemwide habits carry most of the friction: (1) fixed type that ignores Dynamic Type (F1 — the multiplier on every other readability note); (2) italic body at scroll-length on the two heaviest reading tabs (Prayer Wall, Persecuted); (3) ~11px dim-mono meta as the default for timestamps/eyebrows/footers — atmospheric, but it's the layer seniors lose first; (4) affordances that look interactive but aren't (attachments "coming soon", CTA cards without links, the responded heartcry card, "read on" that doesn't look tappable in the other direction).

---

## SYSTEM-MAP AMBIGUITIES RESOLVED (observed truth for the Lucid map)

| # | Question | Observed |
|---|---|---|
| 1 | Rejected leader: sign-out (doc 01) vs read-only Home (doc 08)? | **Sign-out to login lockout** — doc 01 correct, doc 08 wrong. |
| 3 | Deactivated: sign-out vs gated shell? | **Login lockout**, non-dismissible notice; not an in-app shell. |
| 5 | Pending Home: full gate vs banner+feed? | **Banner + full feed** (Home never fully gates). |
| 10 | Post-MVP hamburger items placeholder vs absent? | **Invite to Replant is BUILT + functional** (generates a real invite link `projectreplant.org/join?ref=…`), not a placeholder. |

---

## BACK-BEHAVIOR CONTINUITY MATRIX (Founder mandate)

| Surface | Affordance | Returns to | Consistent? |
|---|---|---|---|
| Onboarding steps (ASP1/2, RegCP1/2, chooser) | top-left "‹ Back" / "Back to start" | previous step / splash | ✅ within onboarding |
| Settings + static screens (Vision, Outreach) | top-left "‹" chevron | Home | ✅ |
| Bottom sheets (church profile, prayer detail) | X top-right **+** tap-outside **+** swipe-down | underlying tab | ✅ (3 ways, all work) |
| Prayer Wall feed detail | "**← Back to Prayer Wall**" (arrow) **+** X | landing | ⚠️ arrow vs chevron |
| DM thread | top-left "‹" chevron | Connect list | ✅ (but froze once — F3) |
| Modals (Terms coming-soon, invite, sign-out, heartcry received) | explicit button (Got it / Close / Cancel / Done) | dismiss | ✅ |
| Comment thread (inline expand) | tap "N comments" chevron to collapse | in place | ✅ |

**Continuity note:** three different back affordances coexist — "‹" chevron (onboarding/settings/DM), "←" arrow (Prayer Wall detail), and X/tap-outside (sheets). Each is individually predictable, but a leader moving between tabs meets a different back control each time. Worth a single consistency ruling (chevron everywhere for pushed screens; X for sheets) — not a bug, a polish call.

---

## READABILITY VERDICT (each tab vs the approved Home baseline)

Home is the approved baseline (scripture ~20px serif, card titles ~19px serif, body ~15px sans — comfortable). Against it:

- **Prayer Wall — your concern is founded.** Card + hero body is `scriptureItalic` ~16px. Italic serif at scroll-length is measurably more tiring than Home's roman body; a leader working a long request list will fatigue faster than on Home. The hero preview rows ("Our fellowship has carried three funerals…") are italic too. *Option for your call:* roman body for long-list cards (reverses the 2026-06-05 italic ruling — your decision, not something to change unilaterally).
- **Persecuted** — heartcry cards italic + red-on-near-black; the "A VOICE" eyebrow and region labels are ~11px dim mono — the smallest, lowest-contrast text in the app.
- **Connect** — thread previews ~15px, fine; CovenantFooter ~11px dim.
- **Settings** — section bodies fine; some helper text ~12px dim.
- **Overriding point:** none of the above scales with Dynamic Type (F1), so a low-vision leader has **no** recourse on any tab. Fix F1 and the per-tab concerns soften considerably.

---

## HELD JIRA DRAFTS (nothing written until go-ahead)

| Finding | Proposed action | Ticket touchpoint |
|---|---|---|
| F1 Dynamic Type | New bug under KAN-34 (a11y) — app-wide font scaling | KAN-34 |
| F2 Anon name leak in request confirmation | New bug — anon invariant; SEC-adjacent | new; relates KAN-69/anon rules |
| F3 DM composer freeze | **Do NOT file yet** — reproduce on release build first | (holding) |
| F4 Rejected → generic deactivation copy | Ruling needed (intended?) then bug/copy ticket | verification lifecycle |
| F5 Para "CHURCH NAME" in CompletionFlow | Copy bug — extend para swap into CompletionFlow (KAN-213) | KAN-213 |
| F6 Welcome DM not seeded | Bug — KAN-217 welcome DM on fresh signup | KAN-217 |
| F7 Request preview mid-word truncation | Polish — add ellipsis / word-boundary clamp | KAN-69 area |
| F8 Anon role lowercase in comment | Polish — casing consistency | role-humanisation |
| F9 Heartcry thread_id NULL | Verify intended vs gap | heartcry flow |
| F10 DM view empty a11y tree | Re-check on stable build; likely same root as F3 | KAN-34 |
| F11 display-name preference ignored (surname always shown) | Bug — `resolve_display_name` first_name_only branch + comment role prefix; **blocks KAN-229 Done** | KAN-229 |
| Map drift #1/#8-realtime | Reconcile diagram 08 rejected-state + Settings coverage | Lucid map |

**Ticket dispositions (executed 2026-07-12 under Founder Done-grant, after live-Jira spot-check of each):**
- **Moved to Done (9), each with a QA-evidence comment:** KAN-38, KAN-41, KAN-258, KAN-184, KAN-181, KAN-231, KAN-236, KAN-35, KAN-195.
- **HELD in Testing (7), with reasons:** KAN-229 (F11 fails its display-preference AC — surname shown for first_name_only users), KAN-75 (F2 breaks its "no name on any leader-facing surface" AC on the request-confirmation modal; toggle write-path unexercised), KAN-216 (its exact subject — unread-count precision — has the open 10+-tab-badge vs 1/1-row-badges question), KAN-166 (the one-time CovenantNotice modal never displayed — device covenant_ack likely pre-acknowledged from prior sessions, so its copy AC is unverifiable on this sim without an app-data reset), KAN-192 (three AC deltas: "Skip for now" appears only after a search, not always; results-cards-with-status-dots never exercised; empty-state copy differs from AC string), KAN-206 (partial — the join-existing-verified-church path was not run; t6 registered a new org instead), KAN-232 + KAN-207 (not exercised; KAN-207 deliberately skipped to avoid reproducing the orphan bug on prod).

## Coverage (single device — iPhone 17 Pro; a second device type is a later pass by your ruling)

| Surface | t5 senior | t6 org | t4 online-min | t3 young | Notes |
|---|---|---|---|---|---|
| Login/session | ✅ deep | ✅ signup | ✅ | ✅ | restore verified 3× |
| Home + comments + hamburger | ✅ deep | ✅ | ✅ | ✅ anon | full walk |
| Prayer Wall | ✅ post+urgent | — | — | ✅ pray+cross-acct | KAN-258 |
| Persecuted + heartcry | ✅ submit+live-fire | gate | gate | gate | |
| The Church | ✅ | ✅ org+CompletionFlow | ✅ | — | |
| Connect | — | ✅ | ✅ initiate | ✅ accept+DM | full lifecycle |
| Settings | ✅ deep | — | — | ✅ anon-mode | |
| Verification matrix | ✅ SQL S8 | — | — | — | pending/deact/reject/restore |
| Onboarding | — | ✅ full para | — | — | |

Out of scope this pass (unchanged): Underground surfaces, admin dashboard, push, offline, 2nd device.
