# Founder on-device VoiceOver scripts — Replant mobile

**Date:** 2026-07-03 · **Runs on:** your iPhone, production app, real accounts · **Feeds:** the KAN-34 findings registry (static + sim audits in this folder)

**House rule, stated once and honored throughout:** you are the tester. Everything the static audit computed and the sim audit observed is a hypothesis until your ears and hands rule on it. Where a script says "expected" or "hypothesis," that is what the code or the simulator suggested — your pass confirms or refutes it. Nothing below presumes a verdict.

---

## 1. VoiceOver reference card

You know your phone; this is just the cheat sheet to keep beside you.

1. **Enable/disable fast:** Settings → Accessibility → Accessibility Shortcut → VoiceOver. From then on, triple-click the side button toggles VoiceOver anywhere.
2. **Core gestures:** swipe right = next element; swipe left = previous; double-tap = activate the focused element; touch-and-drag a finger = explore what's under it; 3-finger swipe = scroll; 2-finger single tap = pause/resume speech.
3. **Rotor:** twist two fingers on screen like a dial. Turn it to **Headings** to jump by heading (flick down/up), to **Edit** for Select All / Paste inside a text field, to **Actions** where available.
4. **Escape gesture:** 2-finger scrub (draw a "z" with two fingers) = go back / dismiss. Worth trying on every sheet and modal — whether it works, and whether it works where it *shouldn't* (Script 8), are both findings.
5. **Reading focus order:** put focus on the first element (touch the top-left), then swipe right repeatedly. The sequence you hear IS the focus order — when a script asks about "order," this is the walk.
6. **Text entry:** touch a keyboard key to focus it, double-tap to type (or switch the rotor's Typing Mode to touch-typing if you prefer). **Paste:** double-tap-and-hold in the field until the edit menu appears, or rotor → Edit → Paste.
7. **Screen curtain:** 3-finger triple-tap blacks the display while VoiceOver keeps working. This is the honest "by ear alone" mode — use it for Script 1's headline question.
8. **Dynamic Type AX sizes:** Settings → Accessibility → Display & Text Size → Larger Text → switch **Larger Accessibility Sizes** ON → slider. Rightmost = AX5 (the size the sim tested). Script 11 lives here.
9. **System password prompts:** do NOT disable AutoFill/strong-password suggestions on your device. The sim had to; on device, how VoiceOver handles the Save Password / Suggest Strong Password sheets is itself an open check (sim gap §7.9) — record what happens when they appear.

---

## 2. Recording convention

1. Every check has an ID (`FD-n.m`) and names the finding it verifies — `F#` = static audit (`a11y-static.md`), `sim §x.y` = sim audit (`a11y-sim.md`). Your result lands back in the same registry under that ID.
2. Each check has a one-line PASS criterion. The general bar, unless a check narrows it: **every interactive element speaks a name, a role (sounds tappable), and its state (selected / checked / expanded / unread).**
3. Record per check: **PASS / FAIL / PARTIAL** + a note in your own words — what VoiceOver actually said is the gold evidence ("it read 'Pastor' with nothing else" beats "label missing").
4. Two global observations to note *wherever* you meet them, no dedicated script:
   1. **Double speech** (sim §2.4): does each piece of text get spoken twice as you swipe? Note which screens.
   2. **Rotor Headings**: on any long screen, does the Headings rotor find anything useful, or is it empty?

---

## 3. Before you start

1. **Accounts.** Disposables from the sim session — credentials in the session scratchpad note (`disposable-accounts.md`):
   1. the `+t16` disposable — standard church, **pending** (live-checked 2026-07-03: user pending, church pending, RAG green).
   2. the `+ugt1` disposable — underground church, **pending** (live-checked: user pending, church pending, RAG red locked, name hidden, **no join code minted, reveal not consumed**).
   3. New disposables follow the same Founder tag convention (full pattern in your scratchpad note). Add any you create to the scratchpad note.
   4. Where a script says **"a verified account of your choosing"** — that choice is yours; the scripts never assume which.
2. **Run order matters.** Scripts 2 and 7 need +ugt1/+t16 **pending**; Script 8 verifies +ugt1's church, which ends its pending state forever. Run in this order: **1 → 2 → 7 → 8**, then 3–6 and 9–12 in any order you like. +t16 stays pending through the whole pass — no script verifies it.
3. **[admin dashboard]** marks steps you perform at `admin.projectreplant.org`. They are spelled out where they occur.
4. **Production caution.** These are real prod accounts and real data. The scripts create: one fresh standard signup (+t17), optionally one UG walk-through (+ugt2), one joined UG leader (+ugjoin1), one test prayer request. Cleanup is at the end (§6) — do it only after your findings are logged.

---

## 4. Scripts

---

### Script 1 — Signup end-to-end, by ear alone

**Purpose:** the sim's headline: a VoiceOver user could not complete signup in the simulator (option controls and sticky CTAs absent from the accessibility tree). Your device pass is the verdict.
**Verifies:** sim §2.1, §2.2, §2.3, §2.6, §2.8 · static F7, F10, F15, F22.

**Set up**

1. Sign out of any account (hamburger → Log out — Home tab only carries the hamburger).
2. VoiceOver ON. For the headline question, screen curtain ON (3-finger triple-tap). If a step hard-blocks you, note it, turn the curtain off, use sight to get past it, curtain back on. **A blocker is a finding, not the end of the script** — keep going so every later step still gets tested.
3. You will create the `+t17` disposable with a fresh password — record both in the scratchpad note. Church: "A11y Audit Test Church T17", House Church, Testville, United States, Freely Operating (green).

**The walk**

1. **Welcome:** swipe through everything. Expect "Create Account" and "Sign In" to speak as buttons. Double-tap Create Account.
2. **Declaration of Faith:** swipe through the full text; expect "I Affirm This" and "Back to start" as buttons (sim: clean). Affirm.
3. **Account setup page 1 — the dense one:**
   1. Fields (First, Last, email, password, confirm): swipe to each, type. After typing, swipe away and back: does the field still tell you *what it is*, or only the value you typed? (F10/sim §2.3 — hypothesis: identity is gone once filled.)
   2. Email-exists check: type the `+t16` disposable first — is the "already registered" message *announced*, or do you only find it by hunting? Then correct to +t17.
   3. Password mismatch: deliberately mismatch confirm once — is "Passwords do not match" announced? (F15/sim §2.6.) Then fix it.
   4. **Role selector:** closed, it should speak its value ("Role: …"). Double-tap to open the sheet. **Hypothesis (sim §2.1): the 12 role rows and Done speak nothing at all.** Swipe through the open sheet — what do you hear? Also touch-explore directly on a row. Can you pick "Pastor" by ear?
   5. **Country selector:** same drill, including its filter field ("Type to filter…" — labeled?).
   6. **ANONYMOUS MODE switch** (sim §2.8): does it speak a name, or is it a bare switch?
   7. "HOW YOU'LL APPEAR" preview: reachable?
   8. **Sticky "Next" CTA** (sim §2.2 — hypothesis: not in the tree at all). Swipe to the very end: does focus ever land on Next? Also touch-explore directly on the button at the bottom of the screen. Record which method (if either) reaches it.
4. **Account setup page 2:** search field (labeled?), type "A11y" → the blue **Search** button, **Register yours →**, **Skip for now** (sim: all three absent from tree). Activate Register yours →.
5. **Register intro chooser:** three tiles. Do you hear each tile's *description* (the safety-critical copy) or only its title (sim §2.8)? Is "‹ Back" reachable? Choose **Register a standalone church**.
6. **Register church page 1:** church name/city fields; **church type** selector + its sheet (para-ministry ⓘ row); **country** selector; CITY ⓘ info icon; "Same as my account info" and "Mark as Headquarters" checkboxes — F7 hypothesis: no name, no role, no checked-state on any of them. Toggle a checkbox: can you tell, by ear, what you just asserted? Sticky CTA "Next — Confirm Status": same two-method reach test.
7. **Register church page 2:** the three **RAG status cards** (green/amber/red — hypothesis: invisible); pick Freely Operating. Textareas (placeholder-as-label?). Optional emergency-plan / collaboration chips. Sticky CTA "Register Church".
8. **Back on page 2 of account setup:** READY TO REGISTER card, "Edit church" / "Switch to a different church" (sim: properly labeled — confirm). Sticky serif CTA **"Enter Replant"** — reach test, then activate.
9. **Home, pending state:** first thing spoken? Tab bar should be exemplary ("Home, tab, 1 of 5" — sim credit). Pending banner + "Dismiss banner".

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-1.1 | sim §2.1 / F7 | Every option control (role rows, country rows, church-type rows, RAG cards, checkboxes, chips) speaks name + role + state | | |
| FD-1.2 | sim §2.2 | Every sticky CTA is reachable by swipe AND by touch-explore, and announces enabled/disabled | | |
| FD-1.3 | sim §2.3 / F10 | Every filled field still announces its identity | | |
| FD-1.4 | sim §2.6 / F15 | Validation errors are announced without hunting | | |
| FD-1.5 | sim §2.8 | Register-intro tiles speak their descriptions; anonymous switch has a name | | |
| FD-1.6 | headline | **You completed signup end-to-end by ear alone** | | |
| FD-1.7 | sim §7.9 | System password prompts (save/suggest) were operable with VO — record what appeared | | |

---

### Script 2 — Verification gates: containment and explanation

**Purpose:** the static audit's highest-priority handoff — the gates are overlays without accessibility containment; sequential VoiceOver traversal may walk *behind* the scrim into the gated UI. Touch is blocked; swipes may not be.
**Verifies:** F9 (P1) · sim §2.7 · gate copy adequacy (F9 positive note).

**Set up**

1. Sign in as the `+t16` disposable (pending — credentials in the scratchpad note). VoiceOver ON.

**The walk**

1. **Connect tab:** the gate view sits over a fully mounted Connect UI. Put focus on the gate's first element, then swipe right 15–20 times. Record *everything* you hear. Hypothesis: after the gate copy, focus continues into the covered header, an unlabeled search field, segmented tabs, maybe "Couldn't load your conversations." (sim §2.7 saw all of these in the tree). Try double-tapping anything you reach back there — does it *activate*?
2. Same tab: touch-explore the middle and top of the screen — does your finger find covered UI under the scrim?
3. While here: does the gate copy itself *explain why* you're locked out (verification pending, who confirms, the waiting window)? The copy exists in code — does VoiceOver reach it in a sensible order, gate-copy-first?
4. **The Church tab:** the same architecture over the map. The sim saw THREE layers at once here: the verification overlay + a location-required layer + a live **"Switch to At Large"** control. Swipe through: can you reach "Switch to At Large"? **If you can, double-tap it — does it actually fire while you're gated?** That is the sharpest probe in this script: an action behind a protection layer. (If it fires, undo whatever it changed and record loudly.)
5. **Persecuted tab:** locked view — sim found it clean and fully explained. Confirm by ear.
6. **Home pending banner:** does it read its full copy (limitation + window + accounts@ contact)?

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-2.1 | F9 | Swiping from the Connect gate NEVER reaches covered interactive elements | | |
| FD-2.2 | F9 | Same for The Church tab; "Switch to At Large" is NOT reachable/activatable while gated | | |
| FD-2.3 | F9 note | Each gate explains WHY, by ear, before anything else | | |
| FD-2.4 | sim §3.12 | Persecuted lock reads clean and complete | | |

---

### Script 3 — Verified Connect: lists, DM thread, send

**Purpose:** the sim never saw unlocked Connect (verified-only). Older Connect components carry the static audit's role/state gaps.
**Verifies:** F11, F13.5, F17 · sim §7.2.

**Set up**

1. Sign in with **a verified account of your choosing** that has at least one conversation. If none of your accounts has one, first create a thread between two of your accounts (Connect → find the other leader → send request → accept on the other account), then start.

**The walk**

1. Connect tab, unlocked: header, segmented tabs (do they announce selected state?), then the thread list. **Unread state:** find a conversation with unread messages (send yourself one from the other account if needed) — does the row *say* it's unread, or is that only bold text and a blue rail (F11 hypothesis: silent)?
2. Thread rows: do they sound tappable (role), or just speak a name?
3. Open a DM thread: message order by swipe (oldest→newest?), the composer field (named?), the **send button** (name + role?). Send a short message by ear. Back out (labeled Back? 2-finger scrub?).
4. Ministries/branches list: rows, Decline / "Join the branch" buttons (F11). Open any member sheet — when a sheet is up, does swiping stay inside it (F18)? Is there an unlabeled full-screen element where the dismiss scrim is (F13.5)?
5. WITHDRAW / REMOVE links (9pt mono, inside pressable rows — F17): with VoiceOver, focus + double-tap sidesteps the tiny target — confirm you can operate them. Then VoiceOver OFF for one moment: can your thumb hit REMOVE without opening the thread? Both observations count.

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-3.1 | F11 | Unread conversations announce unread (and ideally a count) | | |
| FD-3.2 | F11 | Rows/buttons in Connect lists sound tappable | | |
| FD-3.3 | — | DM thread: composer + send named, full send-by-ear works | | |
| FD-3.4 | F18/F13.5 | Sheets contain focus; scrims aren't anonymous focus stops | | |
| FD-3.5 | F17 | WITHDRAW/REMOVE operable by VO; sighted-thumb accuracy noted | | |

---

### Script 4 — Verified Prayer Wall: posting + anonymous toggle

**Purpose:** posting is verified-only; the sim only read the wall. The Prayer Wall family is the app's model surface — confirm the credit holds when you *write*, not just read.
**Verifies:** sim §7.2, §2.8 · F18 · posting flow end-to-end.

**Set up**

1. Same verified account as Script 3 (or another of your choosing).

**The walk**

1. Prayer Wall hub → Feed: card labels should read as grouped, complete announcements (church · country · age — sim credit). Segments (Feed / Testimonies / My Prayers / Revelation / Locations): do they announce *selected* (sim §2.8 hypothesis: no)?
2. Filter chips: "Filter urgent only" class labels (credit — confirm), and the clear chip.
3. Open a request detail: author, chips, **Stand in the gap** (label should flip to "You're standing in the gap" — confirm the flip is announced or at least re-readable), Connect, Close. While the detail is up, does swiping escape it (F18)?
4. **Post a request:** find the post entry point by ear. In the compose modal: "Back to Prayer Wall" (labeled — credit expected), category radios (role + selected expected — confirm), the text field, and the **anonymous Switch** — does it speak a name and its on/off state? Toggle it and listen for the attribution line ("This request will be posted anonymously on behalf of …") — announced or silent?
5. Submit by ear. Then find your request in the feed/My Prayers: does the posted card read correctly — and if you posted anonymous, does it attribute the way the rules promise ("A fellow [Role]" + church)?
6. Receive intercession: from the other account (or later), Stand in the gap on your request; back on this account, check My Prayers / journal reads the intercession state.
7. Cleanup note: remove or close the test request afterwards if you don't want it on your wall — after findings are logged.

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-4.1 | sim §2.8 | Prayer Wall segments announce selected state | | |
| FD-4.2 | — | Full post-by-ear: compose, categorize, submit | | |
| FD-4.3 | sim §2.8 class | Anonymous switch speaks name + state; attribution line reachable | | |
| FD-4.4 | F18 | Detail modal + compose modal contain focus | | |
| FD-4.5 | — | Stand-in-the-gap state flip perceivable by ear | | |

---

### Script 5 — Verified Church tab: CamlView map, pills, church list

**Purpose:** map dots are GL canvas — invisible to VoiceOver by nature. The design answer is the pull-up church list as the accessible equivalent. Statically that list omits the one thing that matters most: RAG status. Your walk decides whether the alternative genuinely works.
**Verifies:** F24, F5, F25 · static handoffs #4 and #7 · sim §7.2.

**Set up**

1. Verified account of your choosing, Church tab (own chrome, no hamburger — by design).

**The walk**

1. Top chrome first: what do you meet in order? The RAG filter chips should each speak dot + word (FREE / LIMITS / URGENT — the house-pattern credit; confirm).
2. The pills: **RE-CENTER ME** (GPS) and **MY CHURCH LOCATION** (registered coords) — named, roled, and distinguishable by ear?
3. The map surface: swipe across it. Expect the nearby-church dots to be unreachable (inherent to GL — not a defect on its own). Is your own church's marker announced ("Your church")?
4. **The pull-up church list — the crux:** can you *discover and open* it with VoiceOver at all? The sheet is drag-driven (F25); try: touch-explore for a grip/handle, double-tap it, any tap alternative. If there is no non-drag path in, that is the F25 verdict.
5. Inside the list: each row speaks name · leader · RPL · distance — **does any row speak its status (urgent/limits/free)?** (F5 hypothesis: never.) Could you, eyes closed, tell an URGENT church from a FREE one?
6. Reduce Motion cross-check (device setting ON): the sonar rings should go static and the globe should stop rotating (statically already gated — confirm the credit).

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-5.1 | — | Pills + filter chips: name/role/state all speak | | |
| FD-5.2 | F25 / handoff #7 | The church list opens without a drag gesture | | |
| FD-5.3 | F5/F24 | List rows convey RAG status by ear — the map has a true equivalent | | |
| FD-5.4 | F19 credit | Reduce Motion stills the rings/globe | | |

---

### Script 6 — Verified Persecuted tab: scenes + readers

**Purpose:** unlocked Persecuted content was outside the sim's reach. The readers are long-form — reading order and escape routes are the test.
**Verifies:** sim §7.2 · F18 class · PillTabBar credit check.

**The walk**

1. Verified account → Persecuted tab. Scene pills (Feed / Take Heart / Bear Witness / My Heartcries): role + selected state (these are the house-pattern component — confirm the credit).
2. Feed scene: witness-of-the-day card, severity tags, filter chips — grouped, sensible announcements?
3. Open each reader you use most (article reader, guidance reader, story archive, witness archive): swipe-read a few paragraphs — coherent order? Does the Headings rotor help you jump? Is Back always reachable + does 2-finger scrub exit?
4. Bear Witness / My Heartcries: walk the compose entry if present — fields named?

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-6.1 | credit check | Scene pills announce role + selected | | |
| FD-6.2 | — | Readers read in order; headings navigable; Back always reachable | | |
| FD-6.3 | — | Any compose surface here is operable by ear | | |

---

### Script 7 — Underground path: display choice + UG chrome

**Purpose:** the immutable show/hide-name choice is the highest-stakes control in signup, and the two audits *disagree* about it: the static audit found the radios properly implemented in code (role + selected + disabled); the sim saw them absent from the accessibility tree. Your device breaks the tie. Same screen carries the literal `{region}` token (sim §5.1) — in code it is a plain string, so expect to hear it; confirm on device.
**Verifies:** sim §5.1, §5.2, §5.3, §2.1 · static F7 (UG flavor) · UG chrome on +ugt1.
**Run before Script 8** (needs +ugt1 still pending).

**Part 1 — the UG signup screens (nothing gets created)**

1. Sign out. VoiceOver ON. Walk: Create Account → Declaration → account pages (you can move quickly — Script 1 covered them) → Register yours → → Register intro → **Underground church** tile.
2. **Underground entry chooser** (the deliberately quiet second screen): two paths — register new vs "Join an existing fellowship with a code." Do both rows speak name + role? Choose **register new**.
3. **UG register church page 1:** country field; the **locked RAG cards** — red is fixed for underground; is the explanation ("set for underground churches and can't be changed in the app") *spoken*? Are the locked cards announced as disabled — or invisible (sim §2.1)? Note the CTA label vs what it does: it reads "Submit Church" but should *advance*, not submit (sim §5.2 — confirm the mismatch on device). Activate it.
4. **The display-choice screen (NameVisibilityChoiceScreen):**
   1. The two options — "Show our name" / "Keep our name hidden": swipe through. **Do they exist to VoiceOver, with role radio + selected state?** (The tie-breaker check.)
   2. The helper under "Keep our name hidden": listen to exactly what is spoken where the region should be. Code shows the literal text `Underground Church · {region}` — record precisely how VoiceOver voices it (sim §5.1 confirm/refute).
   3. Is the immutability made clear by ear (this choice is one-shot per spec)?
5. **Back out now without submitting** — 2-finger scrub or Back until you're out. Account creation is atomic at the end of the flow; nothing was created. (If you'd rather complete the flow to also walk the irreversible-commit modal, use the `+ugt2` disposable, record it in the scratchpad note, and expect a second pending UG church to clean up later.)

**Part 2 — UG chrome signed in (still pending)**

1. Sign in as the `+ugt1` disposable (credentials in the scratchpad note).
2. Home: the UG pending banner ("The Replant team is praying with you and reviewing carefully") — read in full?
3. Church tab UG chrome: what does the tab offer an underground, pending leader — and does everything it offers speak? Confirm nothing on any UG screen speaks a location (there is none in the data — the invariant held in the DB; your ear checks the UI never invents one).
4. Persecuted/Connect gates as this account — quick pass; anything different from Script 2, note it.

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-7.1 | sim §5.3 vs static | Display-choice radios speak name + role + selected on device | | |
| FD-7.2 | sim §5.1 | Region helper speaks a real region — or you heard the raw token (record verbatim) | | |
| FD-7.3 | sim §2.1 UG | Locked RAG cards announced (as locked), not invisible | | |
| FD-7.4 | sim §5.2 | Page-1 CTA label matches what it does | | |
| FD-7.5 | — | UG pending Home + Church chrome fully spoken; no location ever voiced | | |

---

### Script 8 — UG join-code ceremony + join-by-code entry

**Purpose:** two protection-critical surfaces the sim could never reach: the one-shot code reveal (needs a verified UG church) and the JoinByCode entry gate (needs a live code). The code entry is static P1 F8 — a composite widget whose semantics are invisible; the paste path is the SC 3.3.8 handoff.
**Verifies:** F8 (P1), F15 · static handoff #5 · sim §7.4 · reveal-ceremony walk (new surface, no prior findings).
**Run only after Scripts 2 and 7** — this permanently ends +ugt1's pending state.

**How the ceremony works (verified in code, so you know exactly where the cliff is):**

1. The code is minted server-side at the moment of reveal, shown **exactly once**, and never stored anywhere. A second ask — any path — answers "already viewed."
2. The pre-reveal gate screen is SAFE: cancelling there consumes nothing, and the prompt returns next sign-in.
3. The cliff is one specific button: **"I'm somewhere private — show code."** Everything before it is repeatable; nothing after it is.
4. Recovery if the code is lost: an admin **rotation**, which is a two-person dashboard action (one admin initiates, a second confirms) and delivers the new code to the founding leader in-app. It exists — but treat it as lost-key recovery, not undo.

**Part 1 — verify the church [admin dashboard]**

1. Sign in at `admin.projectreplant.org`.
2. Open the **Underground** area → pending queue → **A11y Audit UG Church T1**.
3. Use **Propose verify**, then complete the confirm step the dashboard presents. Verification here is a deliberate two-step ceremony — if the confirm requires a different admin than the proposer, use your second top-tier admin account for the confirming half.

**Part 2 — the reveal (+ugt1, VoiceOver ON)**

1. Sign in as the `+ugt1` disposable. A verification outcome modal may greet you — walk it by ear (bonus containment check: it sets modal containment in code; does swiping stay inside?).
2. Home: the quiet prompt — "You're verified. You are not standing alone." + Isaiah 43:2 + **VIEW YOUR INVITE CODE ▸**. Hypothesis from code: the CTA has a name (its text) but no button role — does it sound tappable?
3. Double-tap into the reveal screen. You are on the **gate** stage — safe. Walk all of it by ear: "TRUSTED INVITE", the somewhere-private instruction, both buttons ("I'm somewhere private — show code" / "Cancel, come back later"). If you want to prove the safety valve, activate Cancel once, confirm the Home prompt survives, and come back in.
4. **⚠️ THE NEXT TAP IS THE ONE-SHOT. The code shows ONCE and can never be shown again in the app. Have pen and paper in hand. Write the code down the moment it is spoken/shown — before anything else. Do not screenshot it (the screen detects captures and will warn you — and the code is a key to a fellowship). If it is lost, the only way back is the two-admin rotation ceremony.**
5. Double-tap **"I'm somewhere private — show code."** On the shown stage:
   1. **Write the code down now.** Format: RPL-XXXX-NNNNN.
   2. How does VoiceOver read the code itself — character by character, in clear groups, ambiguous letters distinguishable (is "0" vs "O" tellable)? Could a blind founding leader capture this code accurately from speech alone? This is the heart of the check.
   3. "Copy invite code" — labeled button (credit expected in code). Double-tap it: the full code is now on your clipboard for Part 3's paste test. (Copy confirmation: haptic + "Copied" — perceivable non-visually?)
   4. The warning copy ("We will show this to you once…", write-it-down guidance) — all reachable?
   5. **Containment probe:** try the 2-finger scrub and (if you use one) the back swipe. In code, back-out is disabled once revealed. If the VoiceOver escape gesture leaves this screen anyway, that is a protection finding — record it.
6. "I have saved this — continue" → the confirm modal ("Are you sure? We will not show this code again."). Walk both options; use "Show me again" once (it only closes the modal — the code screen is still there), then **"Yes, I have it."**

**Part 3 — JoinByCode as the second leader (fresh disposable)**

1. Joining leader: the `+ugjoin1` disposable — fresh password; record both in the scratchpad note.
2. Sign out. Create Account → … → Register intro → **Underground** tile → underground entry chooser → **"Join an existing fellowship with a code."**
3. **The code widget (F8):** swipe through the INVITE CODE area. Hypothesis from code: you meet a row of unlabeled single-character cells AND an invisible unnamed text field, with a tap-target that has no role. Record what each swipe says. Can you tell, by ear, that this is where the code goes?
4. **Typing path:** double-tap the code area to focus, type the 9 body characters from your paper note (the XXXX and NNNNN parts — the RPL prefix is fixed on screen). As you type, can you tell what has been entered so far?
5. **Paste path (handoff #5, SC 3.3.8):** clear the field (rotor → Edit → Select All, delete). Paste the full code from the clipboard (double-tap-and-hold → Paste, or rotor → Edit → Paste). **Hypothesis from code:** the input keeps letters and cuts at 9 characters, and nothing strips the "RPL" prefix — so a full-code paste likely lands `R`, `P`, `L` in the first three cells and mangles the rest. Look/listen to what the cells hold. Then try pasting *only* the 9 body characters (retype them into Notes, copy, paste) — that should land clean. Record both outcomes; together they are the paste verdict.
6. **YOUR DETAILS:** first/middle/last name, email (+ugjoin1), phone, password, and the role picker (a bottom-sheet with 12 rows — same invisibility hypothesis as Script 1; check again here, it's a different instance).
7. **Error announcement (F15):** submit once with the code's last character deliberately wrong. Expected copy: "That code did not match. Please check with the leader who gave it to you." — is it *announced*? **Do this exactly once** — repeated misses rate-limit ("Too many tries…"), which would stall the happy path.
8. Correct the code → submit. Where do you land, and what is the first thing spoken? Record.
9. Hygiene: copy something harmless afterwards so the live code leaves your clipboard. Your paper note is the only copy that should exist — keep it until cleanup, then destroy it.

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-8.1 | new surface | Reveal ceremony completable by ear; code capturable accurately from speech alone | | |
| FD-8.2 | new surface | Reveal screen refuses ALL exits (incl. VO scrub) until confirmed | | |
| FD-8.3 | F8 | Code entry announces itself as a code field; typing progress perceivable | | |
| FD-8.4 | handoff #5 | Paste works — record full-code paste vs body-only paste separately | | |
| FD-8.5 | F15 | Wrong-code error announced without hunting | | |
| FD-8.6 | sim §2.1 | JoinByCode role sheet rows speak (second instance) | | |
| FD-8.7 | — | Happy-path join completes; landing state speaks | | |

---

### Script 9 — Branch registration: the parent-church picker

**Purpose:** the branch flow's parent picker has the static F13.3 gaps (mode segments without role/selected state) and was never sim-walked. Nothing is created — you back out before submitting.
**Verifies:** F13.3 · sim §7.5.

**The walk**

1. Signed out → Create Account → … → Register intro → **Register a church branch**.
2. Branch page 1: the branch-name field, then the picker. "Find the parent church" heading + helper — reachable?
3. Mode segments **"By RPL ID" / "By name"** (F13.3 hypothesis: no role, no selected state): do they sound tappable, and does switching announce which mode you're in?
4. Search row: the field (placeholder-only?) and the blue **Search** button (labeled "Search" in code — a credit to confirm).
5. **By RPL ID:** enter `RPL-30081` (Seoul Hope Pentecostal Mission — Gangnam District; verified, live-checked). Does the result row speak name + Verified badge + type/city/RPL meta? Select it → the "✓ Selected parent" card + "Change" — all spoken?
6. Tap Change → **By name:** type "Bankside" (Bankside Christian Fellowship — Southwark London, RPL-30117, verified). Same row checks. Also try a nonsense RPL ID once — is "No church matches that RPL ID…" announced (F15 class)?
7. The deferred path: "Parent church not on Replant yet? / Register your branch & link later ›" — reachable + roled? Enter it, walk the optional claim fields, then Change back.
8. **Back out of the flow entirely** — nothing submitted, nothing created.

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-9.1 | F13.3 | Mode segments speak role + selected; mode switch announced | | |
| FD-9.2 | — | RPL and name lookups completable by ear; result rows complete | | |
| FD-9.3 | F15 class | RPL-miss error announced | | |
| FD-9.4 | — | Deferred path + claim fields operable by ear | | |

---

### Script 10 — The real inbox leg: password reset end-to-end

**Purpose:** the sim couldn't click mailbox links. One honest note first: account creation pre-confirms email server-side (verified in code — `email_confirm: true` on both signup paths), so **signup sends no confirmation email**; the product's real email loop is the password reset. If your pass surfaces any *other* email the app expects you to act on, record it as a new finding.
**Verifies:** sim §7.3 · sim §2.2 (disabled-CTA variant) · SetNewPassword deep-link leg (new surface).

**The walk (VoiceOver ON throughout, including Mail)**

1. Signed out → Sign In screen → "Forgot password".
2. The email field (labeled — a static credit to confirm). **Before typing:** swipe the whole screen — is there any submit control at all? (In code the button is absent-from-tree while disabled — sim §2.2. A VO user first hears no way to submit; confirm on device.) Type the `+t16` disposable — does "Send Reset Link" *appear* to VoiceOver once the field is valid?
3. Send. Is the success state announced?
4. Open Mail (VoiceOver still ON). Find the Replant reset email — is the message body + link navigable? Activate the reset link. The app should open via its `replant://reset-password` deep link.
5. **Set-new-password screen:** the deep-link banner has a countdown — is timed content announced sensibly, or does it spam/stay silent? Two password fields + the rules list — named? rules readable?
6. Set the password to the SAME value recorded in the scratchpad note (keeps the note true). Submit by ear. Then sign in with it to close the loop.

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-10.1 | sim §2.2 | Submit control's existence/state is perceivable before AND after the field is valid | | |
| FD-10.2 | sim §7.3 | Full loop — request, inbox, deep link, new password, sign-in — by ear | | |
| FD-10.3 | new | Countdown banner announced sanely | | |

---

### Script 11 — Dynamic Type sweep at AX sizes (VoiceOver OFF — this one is visual)

**Purpose:** confirm the sim's five Dynamic Type findings on real glass, worst first, plus the sheets the sim didn't resize.
**Verifies:** sim §4.1–§4.5, §7.7 · F21.

**Set up:** Settings → Accessibility → Display & Text Size → Larger Text → Larger Accessibility Sizes ON → slider to **AX5** (rightmost). Screenshots are welcome evidence on every step here.

**The sweep**

1. **Hamburger drawer (sim CRITICAL §4.1):** Home → open menu. Do items overlap ("Log out" on "Language"; "Outreach & Missions" into the profile chip)? Does the drawer scroll at all? Count the items you can reach vs what you know is there — are Settings / FAQ / Invite reachable by ANY means?
2. **Prayer feed filter chips (§4.2):** clipped to half-height?
3. **Prayer detail header (§4.3):** does the church name truncate the country away?
4. **Login + welcome (§4.4):** wordmark mid-word wrap, tiny back chevron, welcome footer's last line.
5. **Role + country sheets at AX5 (§7.7 — never sim-tested):** open both from the signup first page. Rows usable? Done reachable? Filter field visible?
6. **Your daily-driver screens:** Home cards, Church tab, Settings, a DM thread — anything that clips, overlaps, or traps, note it (the sim found content screens scale beautifully — enjoy confirming the credit).
7. Drop to **AX3** and re-check the drawer only — does the failure ease, or is it broken there too? (Severity gradient for the fix ticket.)
8. Restore your preferred text size.

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-11.1 | sim §4.1 | Drawer at AX5: no overlap, scrolls, every item reachable | | |
| FD-11.2 | sim §4.2–4.4 | Chips/headers/wordmark degrade gracefully | | |
| FD-11.3 | sim §7.7 | Role/country sheets usable at AX5 | | |
| FD-11.4 | F21 | Your daily screens survive AX5 | | |

---

### Script 12 — Home spoken order + error-banner announcement

**Purpose:** two static handoffs that only a human ear can rule on: whether the merged Home cards read coherently, and whether iOS actually announces the login error banner (its live-region attribute is Android-only; iOS behavior is the open question).
**Verifies:** static handoffs #8 and #2 · F23 · sim §2.5 · F16 (opportunistic).

**The walk**

1. **Home cards** (an account with real feed content — a verified account of your choosing): swipe onto an announcement/article card. One stop or many? In what order do you hear eyebrow / title / body / comment count? Does it *make sense*, or is it a heap? Double-tap to expand: is the change announced or discoverable (F23: expanded state never exposed — how disorienting is that in practice? your ear rules).
2. **Daily scripture strip** (sim §2.5: absent from the tree): swipe the whole Home top — is the day's verse spoken at all?
3. **Error banner, real error:** sign out. On the sign-in screen enter any email + any password, then Airplane Mode ON. Attempt sign-in. The no-connection banner renders — **does VoiceOver announce it unprompted**, or do you only discover it by re-swiping the screen? Airplane Mode OFF afterwards.
4. Repeat once with a wrong password (network on) — same announcement question for the invalid-credentials copy.
5. **Toast (F16, opportunistic):** if a notification toast happens to appear during any session this pass, note whether it was announced before it auto-dismissed. Don't manufacture one.

**Record**

| ID | Verifies | PASS when | Result | Notes |
|---|---|---|---|---|
| FD-12.1 | handoff #8 | Home cards read coherently; expand behavior makes sense by ear | | |
| FD-12.2 | sim §2.5 | Daily scripture is spoken on Home | | |
| FD-12.3 | handoff #2 / F15 | Error banners announce themselves on iOS without hunting | | |
| FD-12.4 | F23 | Expanded/collapsed state perceivable | | |
| FD-12.5 | F16 | Any toast that appeared was announced | | |

---

## 5. TalkBack

Deferred until an Android build exists; these scripts mirror over as-is (gesture card swaps to TalkBack equivalents).

---

## 6. After your pass

1. Your per-check results go back into the findings registry in this folder, keyed by FD-ID → the static F# / sim § they verify. Confirmed findings become KAN-34 tickets — drafted and **held for your review**; nothing files itself.
2. Refuted hypotheses get closed against the static/sim docs with your device note as the ruling evidence — your pass is the final authority on every spoken-experience verdict, exactly as both audits promised.
3. **Cleanup — only after findings are logged:**
   1. [admin dashboard] Reject/remove the audit churches: A11y Audit Test Church T16, T17, UG Church T1 (+ its joined +ugjoin1 leader), and +ugt2's church if you created one. Removing the UG church retires its join code.
   2. Destroy the paper note with the join code.
   3. Update the scratchpad accounts note with what was created/removed.
4. Thank you for lending the platform your ears. The leaders who will one day hear this app instead of see it are the reason every line above exists.
