# Appendix B — Expected-Behavior Sheet from Requirements v2_7 (extracted 2026-07-12)

Companion to `2026-07-12-sim-uat-logged-in-visual-pass.md`. Source: `docs/replant-requirements-v2_7.html` ("Living Requirements Document V4.0", frozen 2026-06-18). Refs use the doc's anchors (§NN / Screen NN / D-NN).

**Reconciliation rule:** the doc is frozen at 2026-06-18. Where it conflicts with a LATER locked ruling, the later ruling wins and the doc line is calibration only. Known supersessions: hamburger = Home tab ONLY (doc says every screen); verified-gate copy = 2026-06-22 locked timeline phrase (supersedes Habakkuk gate copy variants); Home comments EXIST (post-freeze); `ministry_leader`/`other` → "Minister" display is BY RULING (doc's "never fall through to Minister" concerns the 10 titled roles defaulting accidentally); prayer journal + pill nav shipped post-freeze. The doc's own drift audit lives at `docs/audits/_working/requirements-2_7-drift.md`.

## 0. Session / post-login routing

- EXPECT: Returning user with valid, active session bypasses Splash + Declaration and lands on Home; status check (active | pending | deactivated) runs before routing [Screen 01]
- EXPECT: Status check runs on EVERY app launch — a valid JWT alone never suffices [Screen 06]
- EXPECT: Login routing — verified+active → Home; pending within deadline → Home with countdown banner; deactivated/past-deadline → signOut() + deactivation popup [Screen 06]
- EXPECT: Deactivation popup non-dismissible — "Close" calls signOut(); appeal email shown; copy varies by recovery_path [Screen 05c, KAN-36 v2]
- EXPECT: No mid-session lockout on deadline expiry — fires on next auth-status-check [Screen 05c]
- EXPECT: days_remaining FLOOR rounding; 0-days banner ≠ deactivation; predicate is `deadline <= now()` server-side [Edge 2]
- EXPECT: Pending leader on VERIFIED church = NO countdown (leader banner variant; admin owns transition) [Edge 4]
- EXPECT: Skip-flow leader (no church): "No church linked / You have 7 days from account creation…" locked register variant [Screen 05c, Edge 3a]
- EXPECT auth error copy: invalid creds "Incorrect email or password. Please try again." (identical wrong-password vs unknown-email); network "No connection. Check your internet and try again."; rate-limit "Too many attempts. Please wait a few minutes and try again."; status-check failure signOut + "Something went wrong. Please sign in again." [Screen 06]

## 1. Home tab

- EXPECT: top bar (REPLANT wordmark left, hamburger right) → verification banner (unverified only) → daily scripture strip → network feed → 5-tab bar [Screen 07]
- EXPECT: Scripture = one verse per UTC day (date-keyed), stable across reloads; Cormorant Garamond display + DM Sans reference [D-06]
- EXPECT: Verification banner pending-only; dismissible per session; returns next login; gone on verify [Screen 07]
- EXPECT banner bands: >7d neutral "Verification pending — [X] days remaining. Your church is visible but limited until verified by Replant."; ≤7d amber "Verification due soon — [X] days remaining. Contact connect@projectreplant.org if you've submitted."; ≤1d red "Verification expires tomorrow. Contact connect@projectreplant.org immediately." (0-day copy was already marked for change — diff, don't assume) [Screen 07]
- EXPECT: Feed newest-first, 20/page infinite scroll, pull-to-refresh, no filters; unverified read full feed read-only [Screen 07]
- EXPECT feed items: church_verified "[Church Name] joined the network in [City, Country]" (UG: "A new church joined the network", no name/location); prayer_submitted "A prayer request was submitted in [Region]" (UG: no region); admin announcements. DM activity / heartcries / individual user activity NEVER in feed [Screen 07]
- EXPECT: Announcements attributed "Replant Team" or no byline — never an admin name [D-56]
- EXPECT: Feed shows only `is_active AND published_at <= now()` announcements [D-54/55]
- EXPECT hamburger destinations: Vision · Outreach & Missions · Language (→ coming-soon) · Settings · FAQ (accordion, one open at a time) · Logout (bottom, separated, confirm dialog) [Screen 21] *(post-freeze: + Invite to Replant per a11y audit walk; Home tab only)*
- EXPECT: Hamburger shows user location "City, Country"; static screens portrait-locked [Screen 21]
- EXPECT: Encouragement section does NOT exist at MVP [Screen 07, §15]

## 2. Prayer Wall

- EXPECT filters: Category All · Healing · Protection · Provision · Unity · Other; Urgency All · Urgent-only; client-side, no second network call [Screen 12]
- EXPECT: urgent-first then newest; 20/page; pull-to-refresh [Screen 12]
- EXPECT: UG requests render "Underground Church" + null country [D-23]
- EXPECT: "Post a Request" verified-only (hidden otherwise); full sub-screen not modal [Screen 12/13]
- EXPECT post form: text required, live count amber at 250 / red at 280 / hard max 300; category required; urgent toggle optional → surfaces at top [Screen 13]
- EXPECT: success toast "Your request has been lifted to the wall." (3s) [Screen 13]
- EXPECT empty state (verified): "No prayer requests yet. Be the first to lift one up." [Screen 12]
- EXPECT: pray-for = stand_in_the_gap RPC race-safe — double-tap must not double-register [§07]
- EXPECT: testimony poster-only gate (only requester creates testimony for own request); testimony surfaces sky-blue carousel [§07]
- EXPECT: edit own request (own-and-open gate); delete = soft withdraw, never hard delete [§07, D-01]
- EXPECT: no live wall updates at MVP — fetch on open [§15]

## 3. The Church tab

- EXPECT: horizon-line switcher CAML "At My Location" (default) ↔ CAL "At Large" globe; page indicator [D-34]
- EXPECT CAML: Mapbox ~55% height, zoom 13, centers on GPS; denied → profile country; load failure → "Map unavailable. Check your connection and try again." + retry, list loads independently [Screen 08]
- EXPECT dots: user sky #6BB5E8 largest; verified green/amber/red by rag_status; pending amber pulsing ring (≤15 concurrent); UG never rendered [Screen 08, D-16]
- EXPECT: clusters count-only [D-18]
- EXPECT nearby list: 50km default, auto-expand 100km when <3 results + label "Showing churches within 100km."; distance asc, alpha tiebreak; miles for US locale, km otherwise [D-14/17/20]
- EXPECT unverified on CAML: map + dots + list OK, church names structurally ABSENT from API (server-side masking); profile tap blocked with toast "Verify your account to view church details."; no Register button [D-22]
- EXPECT: profile = half-screen bottom sheet, map interactive behind, swipe-down/tap-outside dismiss, fetched on tap with loading state [D-19]
- EXPECT: profile leader display "Pastor James" (first name + role) unless leader chose full name; surname never a standalone API field; profile read-only, no DM button at MVP [D-15] *(post-freeze: Connect CTA ruled wire-pre-UAT per KAN-260 item 3 — presence check)*
- EXPECT: verified leader with church: no Register button; empty state "No other churches found nearby." no CTA [Screen 09]
- EXPECT: Church tab gate is SOFT (UnverifiedGateView + skeleton + retry) vs Connect/Persecuted hard walls [§05] *(gate copy superseded 2026-06-22 — locked timeline phrase)*
- EXPECT: profile completion flow re-triggers on EVERY Church tab entry until Step 3 done; per-step saves persist; second leader on completed church = Intro only; show_contact_on_profile init ON [D-59/60]
- EXPECT CAL: globe + atmosphere/starfield, initial center = profile country continental zoom; sky dot = REGISTERED church (not GPS); cluster flyTo; same profile sheet; "Back to world view" after zoom; globe pauses under overlays / on CAML [Screen 11]
- EXPECT: Prayer Wall pull-up on globe — 3 snap points (handle / 50% / 85%); fetched on open; verified-only post via modal INSIDE panel [Screen 11]
- EXPECT unverified on CAL: globe full + dots OK; dot-tap blocked modal; pull-up read-only [Screen 11]
- EXPECT: RAG truthfulness — leader-declared (or unexpired admin override); UG always Red where visible [D-24/25/57]

## 4. Connect tab

- EXPECT: pending users → full-screen non-dismissible ConnectGateView; two variants: church-pending "Your account is being verified." / leader-pending "Your access is being confirmed." [Screen 16 v3.3] *(gate copy: 2026-06-22 locked phrase supersedes scripture box)*
- EXPECT: sub-tabs Ministries | Leaders (default Leaders); compose = pencil (Leaders) / + (Ministries) [Screen 16]
- EXPECT: "Replant Team" pinned first with lock icon + "Secure" tag; leader can reply, never delete/archive; header "Replant Team — Secure Message"; no filler welcome — first message is admin's actual response [Screens 16/18] *(post-freeze: welcome DM seeds the thread at account creation per KAN-217/220)*
- EXPECT thread rows: getLeaderDisplayName (anon = "RoleLabel · ChurchName"; identified = "FirstName LastName · ChurchName"), preview 60-char truncate, relative timestamp, unread badge unclipped; pinned first then last_message_at DESC [Screen 16]
- EXPECT: thread search min 2 chars, matches leader OR church name only — NEVER message content; UG matches only "Underground Church" [Screen 16]
- EXPECT empty states: Leaders "No conversations yet. Find a leader in the network and start one." + CTA; Ministries "What would you like to start today?" + Start-a-branch + John 15:5 [Screen 16]
- EXPECT: CovenantFooter at bottom of both lists: "Conversations within Replant are governed by our community covenant. Chats are protected within the network. Keywords flagged for review if misuse is detected." [Screen 16]
- EXPECT leader search: autofocus, min 2 chars, ~250ms debounce, verified+active only, self excluded; empty "No leaders found matching that search." [Screen 17]
- EXPECT: lazy thread creation — tapping searched leader creates NO row; thread materializes on first send; existing contact opens existing thread [Screen 17]
- EXPECT: cross-church DM requires connection request (REQUEST_REQUIRED); same church_id = ONLY bypass; shared branch does NOT bypass [D-64]
- EXPECT requests: duplicate pending blocked; recipient sees request card above threads (Realtime); accept seeds opening message + opens thread; decline = DeclineRequestModal with 30-day cooldown disclosure; sender can withdraw; pending expires at 30 days (re-send allowed) [Connection Request Flow]
- EXPECT DM thread: sent right sky bubbles / received left dark; timestamps per 5-min window; Realtime on open; optimistic send + rollback + tap-to-retry; 30 messages/page scroll-up [Screen 18]
- EXPECT: DELIVER-ALWAYS — flagged-keyword message delivers identically, zero sender-visible difference [D-45 clause 3]
- EXPECT: flag taxonomy invisible to leaders; NO leader-facing flag/report UI in DM threads (KAN-304 unbuilt — do-not-flag list) [D-45/46]
- EXPECT: CovenantNotice one-time modal on first-ever DM (Leaders only), requires "I understand", SecureStore covenant_ack, never again [Screen 18]
- EXPECT: CovenantStrip above EVERY composer: "Protected within the network · flagged keywords are reviewed" [Screen 18]
- EXPECT Ministries rows: branch name + amber "Forming" tag + "{N} ministries · {M} leaders" sky mono; invited sorts above active; amber invite-consent card with Decline (confirm modal) / Join [Screen 16]
- EXPECT start-a-branch: name ≤48 chars; host chip locked; invite ≤6 more ministries (7 total); creates "forming" [Screen 17, D-61]
- EXPECT: forming branch locked — amber banner "{joined} of {total} leaders have joined. Messages open once every leader accepts."; composer disabled until ALL consent [D-61]
- EXPECT: full-ministry decline → host sees "{Ministry} declined this branch." Cancel / Continue; stalled forming stays stalled (no timeout) [D-62]
- EXPECT branch thread: sender name (sky) + ministry (muted mono) on received, omitted for consecutive same-sender; system events centered mono; members sheet consent badges Joined/Invited/Declined; same DELIVER-ALWAYS [Branch Group Thread View]
- EXPECT: NO read receipts, typing indicators, edit/delete, archive, mute, media at MVP [§15]

## 5. Persecuted tab

- EXPECT: pending users → hard wall "This section is available to verified leaders only. Verification confirms your place in the network and protects every voice here." + OK [Screen 14]
- EXPECT v2: 4 pills Feed · My Heartcries · Bear Witness · Take Heart; red accent NEVER sky; "Together" feature-flagged OFF (<5k leaders) [§08]
- EXPECT anchors: Hebrews 13:3 scripture; intro "This space is for you. What you share here goes directly and securely to the Replant team — no other leader in the network will see it. We receive it, we pray over it, and we will respond."; Psalm 34:4 footer; "SET ASIDE FOR YOU" eyebrow; threshold body displayRegular (NOT italic), heartcry card text italic [Screen 14, §08]
- EXPECT: Submit a Heartcry = full sub-screen [Screen 14]
- EXPECT: non-dismissible anonymity disclosure, locked verbatim: "Your heartcry goes directly and privately to the Replant team. No other leader will ever see it. The Replant team will know which church it came from so they can respond — no one else will." [D-33]
- EXPECT: heartcry text NO character limit; severity required (Active Persecution · Urgent · Serious · Ongoing · Informational); request type optional multi (Prayer · Practical support · Guidance · Just to be heard) [Screen 15, D-30]
- EXPECT: submit CTA "Send My Heartcry"; success toast "Received. The Replant team has been notified and is praying for you." (4s) [Screen 15]
- EXPECT: multiple submissions unrestricted [D-31]
- EXPECT: status tracker (most recent only): Received · Seen · Responded; Responded tappable → Connect DM [Screen 14, D-28]
- EXPECT: response arrives as secure DM + notification "The Replant team has responded — check your secure messages." + Connect badge [D-27/28]
- EXPECT: Take Heart carries EAP Branch CTA deep-linking to Connect Ministries; My Heartcries "Open Secure Message" deep-links to conversation [§08]
- EXPECT: Take Heart guidance library = 4 docs (digital security, raid, arrest, prohibition) [§08]
- EXPECT: heartcry content encrypted before DB write; never in feed, never visible to other leaders [Screen 15]

## 6. Settings + profile

- EXPECT: reached from hamburger only, pushed full-screen; DEV gear not a production affordance (KAN-139) [§11]
- EXPECT: email read-only [Screen 20 §01]
- EXPECT: display-name preference radio "First name + role" (default) / "Full name + role" + italic-serif live preview; optimistic write, revert on error; role ALWAYS shows [D-15]
- EXPECT: change password = chevron → existing reset flow [Screen 20 §01]
- EXPECT: anonymous toggle OFF default; helper "When on, others see your role and church only — never your name."; optimistic write + revert [Screen 20 §02, D-63]
- EXPECT: RAG radio Green/Amber/Red, colored word as swatch; verified-only writable (read-only pending); optimistic, no confirm, no Leader-2 notify [Screen 20 §03]
- EXPECT: Language = coming-soon italic-serif placeholder [Screen 20 §04]
- EXPECT: About — Declaration · Terms · Privacy chevron rows (read-only in-app); connect@projectreplant.org italic serif — tap copies AND opens mail composer (address IS the action) [Screen 20 §05]
- EXPECT: foundation block — rp mark 28px, John 17:21 KJV, DM Mono citation, version stamp [Screen 20]
- EXPECT: destructive footer — Sign out (confirm → login); Deactivate account → step-up reauth → consequence screen → audit + 90-day PII scrub window [Screen 20, D-42/09]

## 7. Cross-cutting

- EXPECT: name rendering single-sourced from BE resolve_display_name; FE never prepends role; role+name appears EXACTLY ONCE per surface (double-prefix was a fixed bug) [Screen 03]
- EXPECT: 10 titled roles show their titles; ministry_leader/other → "Minister" (by ruling); masked-null-role → "A leader in the network" [A-01 + 2026-06-02 ruling]
- EXPECT: anon = role + church everywhere, never name; unverified-visible name masking is SERVER-side (field absent), never FE-hidden [D-22]
- EXPECT: UG churches = exactly "Underground Church", no location anywhere, never on maps, never name-searchable [§01, D-16/23]
- EXPECT church type display: "Church (Main Campus)" · "Church (Branch)" [post-freeze ruling: "Church branch"] · "House Church" · "Ministry" · "Church Without Walls" · "Underground Church" · [post-freeze: "Para-ministry / Organization"] [§01]
- EXPECT: timestamps stored UTC, displayed local [§01]
- EXPECT: soft-delete everywhere; nothing user-deletable hard-deletes [D-01]
- EXPECT: no likes/followers/algorithms/engagement metrics/channels/media [§01]
- EXPECT typography: Cormorant Garamond scripture display · DM Sans body · DM Mono meta; italic serif = scripture/editorial only; Persecuted red accents, Prayer Wall sky; tokens #080808 bg · #0F0F0F surface · #141414 elevated · #6BB5E8 sky · #F0EDE6 text · #5BAD7A/#D4A855/#E05555 RAG [§01]
- NOTE: doc has NO mobile font-size / dynamic-type / contrast requirements — a11y expectations come from the 2026-07-03 audit, not this doc.

## Drift-risk list (agent QA judgment — freeze 2026-06-18 → today; several already confirmed)

1. "Read-only" feed + no comments — comments SHIPPED post-freeze (confirmed); re-baseline Home expectations.
2. Announcement rendering — card types + tag pills shipped post-freeze (confirmed); publish-flip semantics change ordering story.
3. Prayer Wall shape — journal + 5-pill nav shipped post-freeze (confirmed); category set may exceed locked 5+Other; post-modal vs sub-screen may have changed.
4. Locked-tab modal copy — generic "[X] days remaining" modal likely dead; capture what pending users actually see per tab (S8).
5. Hamburger placement — Home-only ruling supersedes; destinations grew (Invite to Replant seen in a11y walk).
6. Verbatim copy set — KAN-222 copy sweep pending at freeze; DIFF every quoted string, don't assume.
7. Connect leader search keying — RPL-ID search upgrade was open at freeze; name/church matching rules may be stale (KAN-215 relevant).
8. Feed event types — network_updates ruled event-log/skip-seeding; feed may be announcements-only in practice; changes empty-state story.
9. Settings growth — ESC-08 anon-mode meaning, RAG field naming, KAN-213 additions.
10. Persecuted v2 fine print — pill set, Together flag state, tracker placement most likely to differ.
