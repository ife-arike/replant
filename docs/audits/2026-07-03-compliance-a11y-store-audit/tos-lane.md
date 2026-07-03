# ToS Lane Verdict — Compliance / A11y / Store-Readiness Audit (2026-07-03)

**Lane:** Terms-of-Service drafting readiness + app-fact verification for the cowork LEGAL session.
**Companion deliverable:** the paste-ready drafting brief at `.claude/plans/2026-07-03-cowork-legal-tos-drafting-brief.md`.
**Method:** every app-behavior claim the ToS must describe was verified against the repo (branch `feat/kan-296-mobile-attribution-slot`, read-only) and the live Supabase database (`jiyetphxxvyiicrnwlnx`) on 2026-07-03. Jira cite KAN-157 spot-checked live per the locked live-Jira-as-source rule (2026-05-09).

---

## Readiness verdict

**Cowork LEGAL can draft the full Terms document NOW from the brief.** Nothing discovered in fact verification blocks drafting: the entity facts are settled (Replant Initiative, Inc., Georgia nonprofit, formed 2026-06-01, EIN 42-3033485, Form 1023 unfiled), every system behavior the 16 sections must describe is verified and stated in the brief with corrected wording where source documents overclaimed, and the three deferred Founder decisions (naming, acceptance flow, scripture anchors — deferred 2026-07-02, carried in the brief as structured decision blocks) only gate *final* text in §1, the acceptance clause, and verse placement; all three can be drafted with bracketed alternatives today. What the verification DID surface is two store blockers (no acceptance/hosting surface; no in-app account deletion) that block **submission**, not drafting — the draft itself is the remedy for the first and should describe the deletion flow as it must exist at submission for the second — plus one compliance decision (minimum age) that must land before the eligibility section finalizes, and a set of accuracy corrections (underground "country" claim, heartcry "E2E" claim) that this lane caught before they could propagate into a legally binding document.

---

## Gaps found during fact verification

### G-1 · STORE BLOCKER — No Terms acceptance event and no hosted Terms/Privacy documents

- **Evidence:** No ToS acceptance mechanism or column exists anywhere (signup payload verified: `supabase/functions/create-account/logic.ts:256-278` — no terms field; live `create_account_atomic` writes only `declaration_affirmed`/`declaration_date`). Settings → About "Terms of use" and "Privacy policy" rows are placeholder toasts: "Terms of use are on the way." (`src/screens/main/SettingsScreen.tsx:765-777`). projectreplant.org hosts no terms or privacy page (`website/` contains only index/faq/next-steps/volunteer.html) — the interim privacy policy v0.2 draft (2026-05-13) was never posted.
- **Store impact:** the scoping note's own premise (2026-05-13): "Apple and Google both require a Terms of Service acceptance event for any app that processes user data. Replant cannot submit to either store without one." App Store Connect additionally requires a privacy policy URL.
- **Blocks ToS drafting?** No — drafting is the remedy. Blocks submission until: document drafted → hosted → acceptance flow built (Founder Decision 2) → Settings rows wired.

### G-2 · STORE BLOCKER — In-app account deletion not wired in the mobile app

- **Evidence:** backend is complete and live (`fn_soft_delete_my_account` / `fn_restore_my_account`, migration `20260623_0006`; Day-30 tombstone sweeper cron verified live), but neither RPC has any mobile call site (repo-wide grep, 2026-07-03), and Settings shows "Account deactivation is on the way." (`SettingsScreen.tsx:783-788`).
- **Store impact:** Apple App Review Guideline 5.1.1(v) requires in-app account deletion for apps supporting account creation. Also undermines ToS §15's "decline changes by deleting your account" right if drafted before the flow exists.
- **Blocks ToS drafting?** No — draft §10/§15 to the flow as it must exist at submission. Blocks submission until wired (FE ticket).

### G-3 · Compliance gap — No minimum age asserted or collected anywhere

- **Evidence:** column sweep of the live schema found no age/birth/DOB column; no age assertion in any onboarding screen, the signup payload, app.json, or website copy (verified 2026-07-03). Only the unposted interim privacy policy draft v0.2 (2026-05-13) states: "We do not intend the service for anyone under 18, and we do not knowingly collect information from anyone under 13."
- **Impact:** both stores require an age rating at submission; a ToS conventionally sets an eligibility age (18 is the natural fit for "verified adult Christian leaders"). Without a ruled number, ToS §2 cannot finalize.
- **Blocks ToS drafting?** Drafts with a bracketed age; **blocks §2 finalization** until Founder/LEGAL set the number. No code gate is strictly required for MVP (eligibility can be contractual + rating-based), but that is LEGAL's call to confirm.

### G-4 · Compliance gap — Privacy policy v0.2 underground claim is false on "country"

- **Evidence:** interim privacy policy v0.2 (2026-05-13) claims underground churches have "zero geographic data… Not country, not city, not address, not coordinates." Verified reality: the live CHECK constraint (`underground_no_location`) forbids only lat/lng/city; the signup validator **requires** country for all church types (`create-account/logic.ts:106`) and deliberately does not strip it on the underground path (`logic.ts:183`); live data shows **38 of 38** underground churches with country stored and all 38 with the admin-only `region_admin_only` macro-region set.
- **Impact:** if this sentence propagates into the ToS or the launch privacy policy, Replant makes a false safety representation to the exact population the platform exists to protect. The honest claim — no city, no coordinates, no address; country + admin-only macro region stored — is still strong and is what the drafting brief carries.
- **Blocks ToS drafting?** No — the brief carries the corrected fact (Part E.2.1). **Needs disclosure/correction:** privacy policy v0.2 must be corrected before posting; LEGAL should be told (it is, in the brief) never to source this claim from the v0.2 draft.

### G-5 · Compliance gap — Heartcry described as "End-to-end encrypted" in KAN-157

- **Evidence:** live KAN-157 description (verified 2026-07-03): "End-to-end encrypted, server-side decrypted at read time with audit trail." Verified reality: heartcry plaintext transits the client → TLS → edge function, which encrypts server-side via the `encrypt_heartcry_content` RPC with a Vault key before storage ("Plaintext heartcry content NEVER touches the heartcries row. Encryption happens via encrypt_heartcry_content(plaintext, key) RPC" — `submit-heartcry/index.ts:7-9`). Replant can decrypt by design through the audited `admin-open-heartcry` path. This is server-side encryption at rest, not E2E.
- **Impact:** an E2E claim in any user-facing legal document would be a material misrepresentation of the strongest kind for this audience (implies Replant *cannot* read heartcries; it can, pastorally and audited — which is also what the privacy policy v0.2 correctly says: "We can decrypt and read it pastorally; nobody else can").
- **Blocks ToS drafting?** No — brief Part E.2.2 carries the correction. **Needs disclosure:** KAN-157's description should be corrected so the E2E phrase stops propagating (it is the LEGAL-assigned international-compliance ticket; LEGAL will read it).

### G-6 · Compliance gap — Covenant/consent narrative drift across surfaces

- **Evidence (three-way mismatch):**
  1. Public FAQ (projectreplant.org, live): "Users will be informed of this [keyword review] in the community covenant at signup."
  2. Ruled implementation (Covenant draft notes, 2026-06-08): the Covenant is expressly **not** a signup click-through; it is website + hamburger + Settings→About + first/second-login banner + Board adoption.
  3. Actual app: the review notice appears before the leader's **first DM send**, not at signup ("Replant reviews messages that are flagged" — `CovenantNotice.tsx`), acknowledged by a device-local SecureStore flag (`covenant_ack`) that is **never persisted server-side**; and none of the ruled covenant surfaces exist yet (About row is a placeholder; hamburger has FAQ/Invite/Outreach/Vision screens only).
- **Impact:** the ToS moderation clause (§6) becomes the first *binding* place users are told about safety review — the brief instructs LEGAL accordingly. The FAQ needs a copy fix; server-side persistence of the first-DM acknowledgment is worth a SEC/BE look if that notice is ever leaned on as consent evidence.
- **Blocks ToS drafting?** No. Needs disclosure in-draft (ToS must state the review truthfully) + FAQ copy correction + covenant surfaces built before launch.

### G-7 · Worksheet — No emergency-services disclaimer on the Heartcry submission screen

- **Evidence:** `HeartcrySubmissionScreen.tsx` presents no "not a substitute for emergency services" language; no such disclaimer exists anywhere in-app (sweep 2026-07-03).
- **Impact:** ToS §7 will initially be the only place this is said. Persecuted-context nuance applies (police may be the threat — the brief poses the wording question to LEGAL). Consider a one-line FE addition post-ToS.
- **Blocks ToS drafting?** No.

### G-8 · Worksheet — iOS location-permission copy vs. server transit

- **Evidence:** app.json:21-22: "Replant uses your location to show verified churches nearby. Your position is never shared." The client's GPS coordinates are sent to the `get-nearby-churches` edge function to run the query (lat/lng in request body, `get-nearby-churches/index.ts:53-54`); they are not persisted or shown to other users.
- **Impact:** "never shared" is defensible as never-shared-with-others but the position does transit Replant's server. The launch privacy policy should carry the precise disclosure; ToS §8 should not repeat the permission string.
- **Blocks ToS drafting?** No.

### G-9 · Worksheet — Declaration affirmation has no version snapshot

- **Evidence:** `create_account_atomic` records `declaration_affirmed=true` + `declaration_date=now()` (live, verified) — a boolean + timestamp, no version/hash of the affirmed text. (Church registrations do store a canonical affirmation string in `state_declaration` — `RegisterChurchPage1Screen.tsx:50-51` — but user-level records don't.)
- **Impact:** if Decision 2 lands on versioned ToS acceptance (recommended in the brief), the same pattern question applies retroactively to the Declaration. Evidence-quality item, not a launch defect.
- **Blocks ToS drafting?** No — feeds LEGAL's §1/acceptance-record advice.

### G-10 · Worksheet — Scoping note's retention description now incomplete

- **Evidence:** scoping note §6/§10 (2026-05-13) describe "soft-delete pattern (D-01)" and "7d rejected / 90d deactivated" only. Verified live regime is layered: leader-initiated soft-delete → 30-day self-restore → Day-30 tombstone scrub + auth deletion (cron 03:00 UTC), **plus** the 90d/7d PII scrub crons (03:15/03:16 UTC), **plus** a rejection cascade scheduling leader hard-deletes at 30 days (migration `20260702024007`, 2026-07-02).
- **Impact:** none if LEGAL drafts from the brief (Part C §6.3 carries the layered regime); listed so nobody drafts retention clauses from the scoping note alone.
- **Blocks ToS drafting?** No.

---

## Disposition summary

| # | Severity | Blocks ToS drafting? | Blocks store submission? |
|---|----------|---------------------|--------------------------|
| G-1 | STORE BLOCKER | No (drafting is the remedy) | Yes |
| G-2 | STORE BLOCKER | No | Yes (Apple 5.1.1(v)) |
| G-3 | Compliance gap | §2 finalization only (bracket until ruled) | Yes (age rating needed) |
| G-4 | Compliance gap | No — corrected in brief | No (but blocks posting privacy policy as-is) |
| G-5 | Compliance gap | No — corrected in brief | No |
| G-6 | Compliance gap | No | No (FAQ fix + covenant surfaces pre-launch) |
| G-7 | Worksheet | No | No |
| G-8 | Worksheet | No | No |
| G-9 | Worksheet | No | No |
| G-10 | Worksheet | No | No |

**Net:** draft now; land the three deferred decisions (naming, acceptance flow, scripture) plus the G-3 age number to finalize; ship G-1/G-2 build work before submission.
