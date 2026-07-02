# Handoff — 2026-06-30 morning — PR #70 MERGED + 5 follow-ups queued

## TL;DR for the next session

PR [admin#70](https://github.com/ife-arike/replant-admin/pull/70) **MERGED TO MAIN 2026-06-30** (Netlify auto-deployed to `admin.projectreplant.org`). 20+ commits, 11 KAN tickets fixed, 5 new tickets filed (3 deferred to separate PRs, 2 in TESTING).

Founder smoke confirmed all surfaces working post-merge.

**5 pre-launch follow-ups queued** ([[pending-post-team-mgmt-ug-followups]]):
1. Existing Replant leader joining admin flow
2. Admin leaves + comes back (re-onboarding)
3. Verified church action buttons (Deactivate + Edit admin notes / non-vitals)
4. Verified UG church cards — data mapping limited
5. Leader verify/reject E2E test

**Most likely next move (per [[pre-uat-admin-roadmap]]):**

Founder-locked sequence to UAT lock:
1. PR #70 wave (Team Mgmt + UG admin) — **shipped to prod**
2. 5 follow-ups from [[pending-post-team-mgmt-ug-followups]] — pickup as Founder directs
3. Content tabs — slight work needed (Founder scopes when we get there)
4. Pastoral Signal + Flagged Messages wiring + test to Connect
5. Network + Church Verification tab — final review
6. **Lock admin for UAT**

Parallel mobile workstream: KAN-274 (visibility-flip) — CD scaffolds ready at `/Users/ife/replant/docs/design_handoff_visibility_change_flow/`, ratifications locked in `[[replant-continuous-spec]]` 2026-06-28 morning entry. Untouched this session.

Held items (pre-launch, separate): Task #14 MFA mobile responsive, Task #19 Heartcry auto-logout investigation, KAN-289 post-UAT hardening.

---

## What landed on PR #70 (NOW IN PRODUCTION)

20+ commits MERGED 2026-06-30. Netlify auto-deployed to `admin.projectreplant.org`. Founder smoke confirmed.

### Bugs fixed (KAN tickets now LIVE)

| KAN | Summary |
|---|---|
| [273](https://projectreplant.atlassian.net/browse/KAN-273) | Cancel-notify removal — withdraw ≠ "action needed" |
| [276](https://projectreplant.atlassian.net/browse/KAN-276) | **PROD-BREAKING** approve+deny RPC param mismatch |
| [277](https://projectreplant.atlassian.net/browse/KAN-277) | Team table: split Requester → "Requested by" + "Requested for" |
| [278](https://projectreplant.atlassian.net/browse/KAN-278) | Sponsor justification feature (schema + RPC + textarea + display) |
| [279](https://projectreplant.atlassian.net/browse/KAN-279) | Sidebar tier badge: hide for regular + null |
| [280](https://projectreplant.atlassian.net/browse/KAN-280) | Pastoral + Flagged opened to all admins (initial gate was wrong) |
| [281](https://projectreplant.atlassian.net/browse/KAN-281) | Verification Queue opened to all admins |
| [282](https://projectreplant.atlassian.net/browse/KAN-282) | /team gated to super_admin+; super_admin POV restricted to sponsor + Invite |
| [283](https://projectreplant.atlassian.net/browse/KAN-283) | Overseer → Manager rename + copy sweep |
| [284](https://projectreplant.atlassian.net/browse/KAN-284) | approve-admin-promotion sets is_underground_admin (BOTH layers — see [[ug-flag-dual-source-bug]]) |
| [285](https://projectreplant.atlassian.net/browse/KAN-285) | Deleted orphan grant-admin.js + test + wrapper (1281 lines) |
| [287](https://projectreplant.atlassian.net/browse/KAN-287) | Granted column populates for invited admins (3 different meta keys per action) |

Plus uncategorized commits: TOTP host-pattern lift (Task #13), Scripture + Announcements relaxed, list-underground-churches gate hardened, request-step-up + 6 sister endpoints relaxed.

### Locked rulings landed this session — see continuous spec 2026-06-30 entry

- **Tier access matrix** ([[reference-admin-tier-access-matrix]]) — authoritative
- **Manager rename** ([[manager-rename-ratification]]) — never "the OTHER manager"
- **UG flag dual-source-of-truth** ([[ug-flag-dual-source-bug]]) — JWT + public.users.is_underground_admin column both required
- **Console opacity doctrine** ([[console-opacity-doctrine]]) — BE gates first; KAN-289 hardening queued

---

## Manual prod patches (recovery for users promoted pre-fix)

Both +totadmin (Test Challenge, `92529143-...`) and +sadmin (Ruth Satest, `4f319007-...`) needed manual SQL patches because they were promoted BEFORE the KAN-284 follow-up landed:

```sql
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                      || jsonb_build_object('is_underground_admin', true)
WHERE email = '...';

UPDATE public.users
SET is_underground_admin = true
WHERE auth_id = (SELECT id FROM auth.users WHERE email = '...');
```

Going forward the BE handles this automatically.

---

## Open Founder owes me + I owe Founder

**Founder owes the spec for:**
- [KAN-286](https://projectreplant.atlassian.net/browse/KAN-286) — Verification Progress event list (what events should appear in the panel). She said "we went through a whole list in a previous session" but I don't have it in memory. **She'll share when she finds it.** Until then KAN-286 stays Backlog.

**I owe Founder when she returns:**
- Backfill [[verification-progress-events]] memory file once she shares the list (memory miss flagged in spec 2026-06-30 disciplinary lessons).
- Smoke results on the final KAN-287 push (commit `db31d6e`) — granted column should now show real dates for Test Challenge, Ruth Satest, ife test.

---

## Tickets queued for separate workstreams (post PR #70 merge)

- **[KAN-286](https://projectreplant.atlassian.net/browse/KAN-286)** — Verification Progress history thread. Needs Founder spec.
- **[KAN-288](https://projectreplant.atlassian.net/browse/KAN-288)** — Broader UG endpoint audit (14+ candidates with same `is_underground_admin` JWT gate gap that list-underground-churches had).
- **[KAN-289](https://projectreplant.atlassian.net/browse/KAN-289)** — Pre-launch console opacity hardening. Gated on post-QA + post-UAT signoff.

---

## Held items (not in PR #70)

- **Task #14** — MFA enrollment mobile/tablet/desktop responsive pass. Founder direction: deeper refactor, before launch.
- **Task #19** — Heartcry first-navigation auto-logout investigation. Needs network-tab repro.
- **KAN-274 mobile work** — visibility-flip CD scaffold lift into RootNavigator + AuthProvider + 6 screens, plus DBA dispatch for relay-token mint table + state machine, plus BE dispatch for 4 new Netlify functions. **Untouched this session.** All ratifications are locked per `[[replant-continuous-spec]]` 2026-06-28 morning. CD deliverable at `/Users/ife/replant/docs/design_handoff_visibility_change_flow/`.

---

## Session disciplinary lessons (saved to spec — read before next session)

1. **Memory miss on verification progress event list** — Per [[feedback-jira-is-paper-trail]] should query Jira via tight JQL when memory is empty (broad query returned 173k chars).
2. **`is_underground_admin` JWT-vs-column trap** — When a gate uses `auth.uid()` + reads from `public.users`, BOTH layers must be synced.
3. **TOTP double-modal regression** — When introducing a new host-mounted modal, audit OTHER host-mounted guards for race interactions.
4. **Granted column query missed action coverage** — Different audit actions use different meta keys; query prod audit_log to inspect meta shape BEFORE writing the fix.

---

## Pickup order recommendation

1. **Wait for Founder smoke/merge on PR #70.** Multiple confirms still pending (granted column on commit `db31d6e`, double-modal fix on `e415556`, UG gate on `d92d2c4`).
2. **If she merges + has no new findings:** dispatch KAN-274 DBA for the relay-token mint table (next major build).
3. **If she pivots to MFA mobile or Heartcry auto-logout:** that becomes the focus.

---

## Process notes

- Open with prayer per `CLAUDE.md` hard rule — name the work the session touches.
- Per [[feedback-preview-first-deploy]]: replant-admin work goes preview → Founder smokes → SHE merges. Don't push to main.
- Per [[feedback-paste-ready-artifacts-to-file]]: handoffs go to `.md` files under `.claude/plans/`, not chat dumps.
- Per [[feedback-cd-is-not-agent-paste-only]]: do NOT dispatch CD as an Agent.
- Per [[feedback-dont-speculate-ship]]: investigate first; cap at 2 speculative tries per symptom.
- Per [[feedback-propagate-to-sister-actions]]: when changing one action, consider its twin.
- Per [[feedback-ask-before-pushing-during-smoke]]: mid-smoke bug? Ask before pushing.

---

## End-of-session state (2026-06-30)

- ✅ **PR #70 MERGED TO MAIN** — Netlify auto-deployed to admin.projectreplant.org
- ✅ Continuous spec updated with merge fact + 5 follow-up items
- ✅ 5 new memory files saved: admin tier access matrix, Manager rename, UG flag dual-source, console opacity doctrine, **pending post-team-mgmt+UG follow-ups**
- ✅ MEMORY.md index updated with all 5
- ⏳ KAN-286 verification progress — Founder owes event list
- ⏳ KAN-289 pre-launch hardening — gated on QA + UAT
- ⏳ KAN-274 mobile work — untouched this session, ready for next dispatch
- ✅ **Prior roadmap found via Founder re-share** — saved as [[pre-uat-admin-roadmap]]. Sequence to UAT: content tabs → Pastoral+Flagged wiring to Connect → Network+Verification tab review → lock admin for UAT.
- ✅ Memory discipline lesson saved as [[feedback-acknowledge-vs-saved]] — "noting for handoff" is the trigger to write the memory file, not a substitute for it. Pattern caught when prior session's acknowledgment wasn't persisted.

In Jesus' name, Amen.
