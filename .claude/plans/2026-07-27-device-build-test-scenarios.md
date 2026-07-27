# Device build test scenarios — 2026-07-27 (build 495ef347, branch feat/persecuted-new)

What's new in this build and worth a device pass. Ordered by priority. The
identity-masking block (A) is the security-critical one and needs two
accounts; everything else is single-account.

## Accounts needed
- **Main / super_admin**: bb6c6385 / Maranatha (the Founder's own).
- **A plain verified leader** (NOT super_admin) — this is the one that proves masking isn't privilege-dependent. Confirm which +t# account to use before starting; do not assume.
- **The dashboard** (admin.projectreplant.org) for the approve/publish half of the content flows.

---

## A. Identity masking — THE security pass (two accounts, highest priority)

This is the whole KAN-338 wave. The point: what a leader sees must NOT depend on who is looking. Run each on BOTH accounts and compare — they must be identical.

1. **Two-account comment-thread divergence.** Open the same announcement's comment thread on the super_admin account and on the plain-leader account. Every comment's name, church line, and avatar must be byte-identical between the two. (Before this wave, admins saw real names where leaders saw a masked dot — that must be gone.)

2. **Comment masking states render right.** In a thread with mixed authors, confirm:
   - A named (non-anonymous, surface-church) leader → real name like "Pastor Ife James", square avatar with their initial, real church line.
   - An anonymous leader → "A fellow {role}", square avatar with "A", church line still shows their real (surface) church.
   - An underground leader → **round avatar with a lock**, region label (e.g. "South Asia") as the church line, never a name, never a city. This is the fix — anonymous-underground used to wrongly show the "A" square.

3. **Comment name style.** Names now render composed ("Pastor Ife James"), not a raw stored string. Confirm no bare surnames leak.

4. **Leader search masking (Connect → New message → search).** Search leaders by name. Anonymous leaders must NOT surface by their real name. Underground leaders must show role + region only, never a name, and must not be findable by name typing. Named surface leaders search normally.

5. **Feed leader-voice cards.** A "word for today" / encouragement card authored by a leader shows the frozen byline + Replant seal, identical on both accounts. No "A leader in the network" dot for a card that should carry a real byline.

---

## B. Home feed cards — the read-on regression fix + card polish (single account)

The big one here is that the fold/read-on affordance died on the last build (Fabric view-culling). Confirm it's back.

6. **Read-on / fold works.** Find a feed card with a body longer than 3 lines. It must show the "read on" cue and expand on tap, then "fold" back. Check this on several card types (leader word, encouragement, CTA, together, article). A card whose body fits in 3 lines must show NO cue.

7. **Scripture strip read-on.** Today's scripture at the top — if the verse overflows, the same read-on/fold cue works.

8. **Card colors unified.** All feed cards share one surface color now (the subtle warm/cool split is gone). Confirm nothing looks two-toned.

9. **CTA card.** A call-to-action card shows accent-colored link words + arrow, NOT a big filled blue button.

10. **Article drop cap.** An article/long-read card's opening drop-cap letter is not clipped at the top.

11. **Together card.** Renders the Replant seal + "Replant Team" (multi-author seals are post-MVP — a single seal here is correct, not a bug).

---

## C. Address the Network — compose → submit → approve → publish (single account + dashboard)

12. **Compose preview parity.** Hamburger → Address the Network → compose a "word". In "How you'll appear", the preview byline must match what actually publishes: your real name + church for "Show my name", or "A {Role} from {region}" (a real region, NOT "your region") for "Role and region". Open the full preview — it must equal what lands on the feed.

13. **Title required.** Try to submit a word with no title — it must be blocked (the submit stays disabled / errors). This is new: a titleless word used to publish as the duplicate "A word for today".

14. **Underground compose.** On an underground account, the attribution control shows ONLY "Role and region" as a locked single option (no "Show my name" choice), and the preview shows role + region, no name, no church.

15. **Submit → My Submissions.** After submitting, it appears in My Submissions with a pending status. The open-submission cap is 2 (a third should be blocked).

16. **Withdraw.** Withdraw a pending submission — it frees a slot.

17. **Approve + publish (dashboard).** In the dashboard Submissions queue, approve a "Show my name" submission. On the phone feed it must render with the leader's real name + church (not masked). Approve a role-region one — it renders "A {Role} from {region}" under the Team seal.

18. **First-run intro modal.** First entry to Address the Network shows the intro modal once.

---

## D. Admin dashboard — content surfaces (dashboard, sanity smoke)

19. **Announcements Home = wall + queue.** Live-feed posts (last 7 days) pinned + expanded at top; scheduled/drafts collapsed below; older posts only in Posted.
20. **Submissions "Leader replies" sub-tab** (renamed from "Address the Network") shows leader consent-loop returns.
21. **Approve email.** The submitter gets the "Your post is live on Replant!" email, generic copy (no doubled "your submission").

---

## E. Adjacent workstreams — smoke only (owned by their own sessions)

These rode along in the branch merge; smoke for obvious breakage, but they have their own QA.

22. **Persecuted tab** — 3 tabs, tier system, My Voice render without crash.
23. **Prayer Wall** — rebuilt wall loads, standing-in-the-gap window, journal.
24. **General app sanity** — login, 5-tab nav, Church tab, Connect all load.

---

## What is NOT in scope / expected-broken
- Dashboard-approved **show_name** posts render correctly (PR #85 deployed) — but if you approved any show_name submission during the brief interim window before #85, that one card may show masked until a recompose; new ones are fine.
- Underground leader electing to be named: no path yet (KAN-342, backlog) — expected.
- announcements.author_id column lockdown: deferred to pen-test (KAN-341) — not observable on device.
