# Replant Privacy Policy v0.2 → v0.3 Refresh Brief (for LEGAL, cowork surface)

**Date:** 2026-07-03
**Prepared by:** Privacy-program analyst pass (compliance/a11y/store-readiness audit session, mobile workspace)
**You are drafting:** v0.3 of the Replant interim privacy policy, superseding DRAFT v0.2 (dated 2026-05-13).
**This brief is self-contained.** You see nothing of the Replant repos, Jira, or engineering memory. Every fact below was verified against the codebase and the live production database on 2026-07-02/03 by a data-protection engineering pass, and each carries its verification basis inline. Where a fact is a Founder-locked ruling rather than code, the ruling and its date are quoted. Where something is unverified, it is marked VERIFY. Do not soften a marked gap and do not overclaim past a marked gap.

---

## 1. Opening context — what changed since 2026-05-13

v0.2 was drafted for a pre-launch interest list, when the app was pre-production and the policy's app-facing section ("What protects you inside the Replant app") described roughly seven protections as they stood in mid-May. Since then: the platform entered production posture (first real leader account created 2026-06-28); an underground join-code system shipped; an escalated-cases workflow with tier-gated admin access and attributed admin reach-outs shipped (locked 2026-06-30); a full self-service deletion lifecycle shipped (soft-delete → 30-day restore → Day-30 hard delete); optional phone and structured name fields (first/middle/last + honorific/suffix) shipped at signup; admin privilege columns were locked against client writes (P0-2, closed); an Upstash Redis rate-limit/idempotency dependency was added (re-provisioned 2026-07-01); underground churches were ruled to retain **country** for internal categorisation (KAN-13 ruling 2026-05-19, database constraint updated 2026-05-20 — this directly contradicts a sentence v0.2 still carries); and a master data inventory (2026-07-03) verified against live production surfaced facts v0.2 predates: Google (Sheets + Fonts) is an undocumented processor on the website, website form leads have no retention story, Mapbox receives device GPS and (presumed) default SDK telemetry against the app's own iOS permission copy, the Supabase region is confirmed AWS us-east-1, audit-log retention was ruled (2026-06-30) but the age-out machinery is unbuilt, and the message/testimony/comment content plane is retained forever, surviving account deletion in de-attributed form.

**How to use this brief:** Section 2 walks v0.2 section by section with a verdict — KEEP (accurate as written), CORRECT (now wrong; the wrong sentence is quoted and the true fact stated), EXTEND (true but incomplete), ADD (new section needed). Section 3 lists the new sections v0.3 needs and the facts each must carry. Sections 4 and 5 are a ready-to-use retention table and processors table — do not re-derive these. Section 6 is the open policy-choice list for you and the Founder, each with a recommendation. Section 7 is the facts-not-to-rely-on list. A store-readiness note closes the brief: **both Apple and Google require a published privacy-policy URL at app submission, and this policy — expanded to cover the app — is the artifact that must be published at a stable URL before either store submission can proceed.**

---

## 2. Section-by-section gap map of v0.2

### 2.1 Header / title / scope line — CORRECT
1. v0.2 scopes itself: *"For the pre-launch interest list at projectreplant.org."*
2. True present fact: v0.3 must also govern the app's data practices. The app is in production posture with real leader accounts (first: 2026-06-28), heading to UAT, and both app stores require a published privacy-policy URL covering the app's actual data practices at submission. The two-surface structure v0.2 already has is the right skeleton; the scope line and effective-date mechanics must say the policy covers both projectreplant.org and the Replant app.

### 2.2 "A word before the policy" — KEEP
1. Accurate and in the right register. One-word-level touch-up: the opening list ("your name, your role, perhaps your city, an email") should include "your church," since the form requires church or ministry name (see 2.4). Not a correction of substance.

### 2.3 "Two surfaces, one promise" — EXTEND
1. The two-surface framing is right and should stay.
2. Incomplete: the website now has **two** forms — the join-network interest form and a volunteer form ("Serve With Us" at /volunteer, collecting first/last name, email, optional phone, city + country, a Local/Remote/Both preference toggle, and role-interest checkboxes). v0.2 describes only one form.
3. Incomplete: the website's providers are now known and enumerable (Netlify hosting + form storage; Google Sheets + Google Fonts; see 2.6 and Section 5).
4. Tense: the app protections are no longer forward-looking. The app exists in production; describe protections in the present tense with the corrections in 2.9.

### 2.4 "What we collect right now" — CORRECT
1. Wrong: *"Your contact information (email, and any phone number or city you choose to provide)."* The join-network form has **no phone field** (verified in the form markup 2026-07-03). Phone is collected only on the volunteer form, where it is optional. City on the join-network form is **required**, not optional.
2. Wrong: *"The role you selected (Pastor, Apostle, Prophet, Evangelist, Teacher, Elder, Bishop, Reverend, Intercessor, Psalmist, Ministry Leader, Other)."* That is the app's 12-value role enum, not the website form. The join-network form offers exactly six options: Senior Pastor, Associate Pastor, Elder / Deacon, Ministry Leader, Intercessor, Other (verified 2026-07-03).
3. Wrong: *"Any additional message you choose to send us."* The join-network form has no message or free-text field.
4. Omitted: the form collects **church or ministry name** (required). Actual complete field list: name, church or ministry name, city, email, role — all required.
5. Omitted (storage/flow disclosure): submissions are stored in **Netlify Forms**, and each join-network submission is also appended — name, church, city, email, role, and an Eastern-time timestamp — to a **Google Sheet** via a serverless function using a Google service account (verified in the function code 2026-07-03). Google is therefore a processor of interest-list data and must be disclosed (see Section 5).
6. Omitted: the site loads **Google Fonts remotely on all pages**, which sends visitor IP addresses to Google. This is not an advertising tracker, but it is a third-party data flow the current text's silence implies does not exist.
7. KEEP within this section: *"We do not currently run third-party advertising trackers, social-media pixels, or behavioral analytics on the website"* — verified still true 2026-07-03 (no analytics found on the site or the blog; the blog is fully static). The hosting-logs sentence is also accurate (Netlify standard logs).
8. Omitted: the volunteer form's fields (see 2.3.2) belong in this section too.

### 2.5 "How we use what you give us" — KEEP
1. The four uses and the four never-do commitments remain accurate and are the right promises. No corrections.

### 2.6 "Who has access to your information" — EXTEND
1. The access framework (founder, small team under written confidentiality, service providers under instruction-bound terms) stands, but the service providers are now known and must be named or described concretely: Netlify (hosting + form storage), Google (Sheets — lead rows; Fonts — visitor IPs), and the email service used to write to the interest list.
2. VERIFY with Founder: which email provider will send interest-list follow-ups (this was open in v0.2's founder notes and remains unresolved), and which mail provider hosts the team mailboxes (connect@, info@ at projectreplant.org) — leader personal data lands in those inboxes via app notifications, so that provider is part of the real access surface.
3. VERIFY with Founder: that written confidentiality agreements with team members actually exist as the policy asserts.
4. The Georgia-incorporation custodian paragraph: retain, but confirm current incorporation status before publication (carry-forward from v0.2 notes).

### 2.7 "How long we keep it" — CORRECT
1. Wrong in effect, not in intent: *"We keep your interest-list information until Replant launches and you have either joined the network or told us you no longer wish to be contacted. If Replant does not launch within a reasonable time, we will delete the interest list…"* There is **no retention or deletion machinery of any kind** on either store of interest-list data — Netlify Forms or the Google Sheet (verified 2026-07-03). The promise is currently backed by nothing. Either a documented manual purge process covering BOTH stores is created (recommended — see Section 6.4), or the sentence must be weakened. Do not publish a deletion promise that has no operational path.
2. Now answerable: *"Once you become a verified leader inside the Replant app, a different and more detailed retention policy will govern the data the app handles. That policy will be published in full before you accept it."* v0.3 is where that happens. The full retention table is Section 4 of this brief.

### 2.8 "About this website's security — being honest with you" — KEEP
1. Accurate, honest, and the right register. No corrections.

### 2.9 "What protects you inside the Replant app" — verdicts per protection

**2.9.a Server-side identity masking — CORRECT.**
1. Wrong as a universal claim: *"We did not write this as 'the screen will hide the name'… We wrote it as 'the server will not send the name.' Other leaders, including the curious or the careless, cannot leak what they never receive."*
2. True present facts (verified in code 2026-07-03): the masking model is **mixed**. On announcement comments, the prayer wall, and heartcry admin-open, masking is genuinely server-side (masked authors' real identities are resolved to NULL at the SQL layer and never leave the server). But on the Home-tab network feed, masking is applied **in the app**: the client fetches the author's real first/middle/last name, church name and type, and anonymity flag, then decides at render time whether to display "A fellow [role]." The real name is delivered to every client device on that surface. An internal security review of that surface is pending.
3. Also stale framing: v0.2 frames masking around **unverified** users. The present model (decoupled 2026-06-21) is two independent axes: (a) a user-controlled **anonymous** flag masks the leader's display name to "A fellow [role]" while the church name stays real; (b) underground church status masks the **church's** identity (name shown only if the church opted in at signup — the "brave" setting). Verification status gates access to the network at all, rather than driving display masking.
4. Drafting guidance: describe masking as real and enforced, name the server-side surfaces plainly if desired, and do not claim "the server never sends the name" as a platform-wide architectural fact. A truthful formulation: masking is enforced on every surface; on the most sensitive surfaces it is enforced by the server itself, and we are converging the remaining surface to the same standard.

**2.9.b Underground churches: zero geographic data — CORRECT.**
1. Wrong: *"Replant collects, stores, and transmits zero geographic information about that church. Not country, not city, not address, not coordinates."*
2. True present facts: **country IS retained for underground churches.** Product ruling KAN-13 (2026-05-19): "country is retained for internal categorisation only — never shown publicly." The database constraint was amended 2026-05-20 to permit country while still forcing city, latitude, and longitude to NULL. So: no city, no coordinates — enforced in three verified layers (shared validator, edge-function strip, database CHECK constraint). Country — stored, admin-only, never surfaced to other leaders.
3. Nuance on address: underground signup collects no address, but the "no address" guarantee is by UI omission only — neither the server validator nor the database constraint forces address to NULL for underground churches (verified 2026-07-03). Do not describe address as constraint-enforced.
4. Suggested truthful formulation: "If a church registers as Underground, Replant stores no city, no address, and no coordinates for it — the database itself refuses city and coordinates. We keep only the country, solely so our team can serve that region, and it is never shown to anyone in the network. To other leaders the church appears simply as an underground church, unless its leaders chose at signup to show its name."
5. Related but separate: device GPS and Mapbox (see Section 3, new Location & Maps section, and Section 6.2). The v0.2 sentence "your geographic information will not exist in our systems" remains true of church registration data, but the app's map features send device GPS to a third party, so the claim must be scoped to what Replant stores.

**2.9.c Heartcry encryption — EXTEND (accurate; can now say more, with one precision).**
1. Verified accurate: heartcry content is encrypted at submission (PGP symmetric encryption; the ciphertext is all that is stored; plaintext never touches the database row).
2. Precision: v0.2 says the key "sits in a vault separated from the application database." The key lives in **Supabase Vault**, a managed secrets store within the database platform — it is separated from application tables and unreadable through normal application paths, but "separate vault system" slightly overstates. Say: "held in a managed secrets vault, not in the application's tables."
3. New strengths v0.3 can truthfully add (all verified live 2026-07-03): decryption happens only through a single privileged routine; **two audit records — including the administrator's IP address and browser identity — are committed before the plaintext is ever returned**; opening a heartcry requires the administrator to have re-verified with a second factor within the previous 5 minutes; the notification email announcing a new heartcry contains zero personal data (a static alert only); and heartcries survive account deletion in de-attributed, still-encrypted form.

**2.9.d Asymmetric data retention — CORRECT.**
1. Directionally right, now wrong in scope and superseded in part. The 90-day (deactivated) and 7-day (rejected) scrub windows exist and run nightly (verified live cron 2026-07-03). But:
2. Wrong by omission: *"contact information is scrubbed 90 days later"* — the user scrub currently clears **email and the combined display name only**. The structured name fields (first/middle/last), honorific, suffix, and phone number — all added after the scrub was built — survive it. **A fix is in flight.** The policy should state the intended posture (all identity fields scrubbed at 90 days), and counsel must not certify current behavior in any dated representation until the fix ships. Verify shipped before publication.
3. Wrong by omission: the church-record scrub clears the contact person's email and phone but **never clears the contact person's name**, and it fires only on admin deactivation or rejection — never on self-service account deletion (see 2.9.h and Section 4, row 6).
4. Superseded in part: v0.2 describes deactivation and rejection as the retention story. There is now a full **self-service deletion lifecycle** (see new section, 3.5): soft delete → 30-day restore window → hard delete on Day 30.

**2.9.e Audit log — EXTEND.**
1. Verified accurate: every sensitive admin action is recorded in an append-only audit log; mutation-blocking database triggers make it unable to be edited or deleted by anyone, including the founder (verified live 2026-07-03).
2. Must now be extended with retention truth (Founder ruling 2026-06-30): audit records of **life-safety access** (heartcry reads, escalated-case access) are retained **forever** — deliberately, so admin access to the most sensitive data is permanently accountable. Records of routine flag reviews that were cleared as non-safety matters were ruled to age out after 30 days — **but the age-out machinery does not exist yet** (verified against the live scheduler 2026-07-03). This is a build-or-don't-promise fork for you: either the machinery ships before publication and the policy states the 30-day age-out, or the policy states that audit records are currently retained indefinitely with life-safety records permanently retained by design. Recommendation in Section 6.3.

**2.9.f Step-up reauthentication — CORRECT.**
1. Wrong: *"An administrator cannot read a heartcry… without re-entering their password."*
2. True present fact: step-up is by **multi-factor re-verification (TOTP), not password re-entry**, on a locked tiered-freshness model: sensitive admin actions require a second-factor verification within the previous 5 minutes; life-safety actions within the previous 90 seconds. The heartcry-open 5-minute requirement is verified in code. Say "recently re-verify with their second factor" rather than "re-enter their password."

**2.9.g Deliver-always message flagging — KEEP.**
1. Verified accurate end to end (2026-07-03): keyword detection writes a review flag only and never gates, holds, or delays delivery; the message inserts on the same path as any other; message content is never written to logs. The v0.2 paragraph, including its reasoning, can stand as written.

**2.9.h Missing from the protections block — see ADD list (Section 3):** underground join codes, escalated cases and admin reach-out attribution, the deletion/restore lifecycle, the quiet client (no analytics/tracking SDKs), and admin privilege-column lockdown.

### 2.10 "For leaders in sensitive jurisdictions" — CORRECT (one load-bearing paragraph; rest KEEP)
1. The pastoral framing, alternate-channel invitation, and intermediary path: KEEP — this is the best section of the document.
2. Wrong (consequence of 2.9.b): *"Your geographic information will not exist in our systems to be exposed, lost, leaked, subpoenaed, or stolen."* As written this is false for country. Rewrite scoped to the truth: city, address, and coordinates will not exist in Replant's systems (city and coordinates refused by the database itself); country is kept admin-only for internal categorisation and never surfaced in the network. Given this paragraph's audience — leaders deciding whether contact is safe — precision here is a safety matter, not a drafting nicety. The subpoena implication changes when country exists: a compelled disclosure could reveal "an underground church exists in country X with these leaders," and the policy should not imply otherwise.
3. Also scope: Replant's map features send device GPS to Mapbox (a processor) when a leader opens the church map. Underground users are blocked server-side from the nearby-churches feature before their coordinates are even parsed (verified — genuinely good), but the Mapbox geocoding call and SDK telemetry are separate client-side flows not specific to underground users. See Section 6.2 before finalizing this section's language.

### 2.11 "Your rights" — EXTEND
1. For the interest list, the four rights (access, correction, deletion, pause) are honorable today by manual work in Netlify and the Google Sheet; the 7-day response window is a Founder commitment to consciously reaffirm (Section 6.5).
2. Must be extended for app-scope honesty (all verified 2026-07-03):
   a. **Access/export: no consolidated access or export mechanism exists** — no export function, no endpoint, no admin tooling. The policy must not promise data portability or one-click access. It may promise fulfilment of written requests only if a manual admin runbook is created (Section 6.6).
   b. **Rectification: partial.** Self-serve today: display-name preference, name order, include-middle-name, honorific, anonymous flag, church profile fields (city/country/address/coordinates/website/language/denomination/size), church risk status. Not self-serve (contact-us path): first/middle/last name, email, phone, role. Password: reset-by-email works; in-app change is not yet available.
   c. **Deletion: the machinery is real and live** (soft delete → 30-day restore → Day-30 hard delete, verified), **but the in-app entry point is not yet wired** — today a user cannot reach deletion from inside the app; it is fulfilled by request. Apple's review guideline 5.1.1(v) requires in-app deletion initiation for apps with account creation, so the entry point must ship before App Store submission; the policy should describe deletion as available in-app only once that is true.
   d. Restriction/objection: no formal mechanism; the anonymous flag restricts display, not processing. Policy wording should offer the contact-us path.
   e. Withdrawal of consent: deletion is the withdrawal path (with (c)'s caveat).

### 2.12 "Where we are based, and what that means" — EXTEND
1. The US-legal-process posture (produce the minimum, challenge overbroad requests, notify when lawful, publish a transparency report from launch): KEEP — reaffirm the transparency-report commitment consciously; it is a real operational obligation (Section 6.11).
2. Extend with now-confirmed facts: all server-side personal data resides in **AWS us-east-1 (N. Virginia, USA)** — Supabase project region verified live 2026-07-03. The user base is global by design, so for every non-US leader, use of Replant is a cross-border transfer of personal data to the United States. All identified processors are US-based (Upstash region unverified — VERIFY). No data-residency or localization machinery exists. DPA/SCC status with each processor is a legal-side item this brief cannot verify — obtain or confirm processor DPAs before publication.
3. Special-category note for this section or a new one: **every Replant account inherently discloses religious affiliation** — the platform is exclusively for Christian leaders and signup requires an explicit declaration of faith (stored with its date as a covenant record). Under GDPR Article 9 and analogues, effectively all user records are special-category. The declaration is the natural anchor for an explicit-consent basis; framing is counsel's call, but the policy must not treat this as ordinary contact data.

### 2.13 "Children" — KEEP
1. Accurate. Optional tightening for store alignment (ratings will be 17+/18+): consider stating 18+ uniformly. Counsel's call; no factual error.

### 2.14 "Changes to this policy" — KEEP
1. Accurate and appropriate. The 30-days-notice commitment for the launch policy carries into v0.3 mechanics.

### 2.15 "How to contact us" — CORRECT (publication blocker)
1. Both contact placeholders (privacy email, postal address) are still unresolved from v0.1. A privacy policy cannot be published with placeholder contact points, and the store-submission URL depends on publication. Recommend privacy@projectreplant.org (as v0.2's notes proposed) and the Georgia registered-agent address once formation completes. This is a Founder decision to force before v0.3 ships.

### 2.16 "A word at the close" — KEEP
1. Keep as written.

**Tally: KEEP 7 · CORRECT 9 · EXTEND 6 · ADD 9 (Section 3).**

---

## 3. New sections v0.3 needs (ADD), with the facts each must carry

1. **What the Replant app collects.** Identity: first, middle (optional), last name; optional honorific and suffix; email; optional personal phone (fallback contact, added at signup; never emailed, never used in rate-limit keys); role (12-value ministry enum or free text); a declaration of faith with date (covenant record, not editable by design); display preferences and the anonymous flag. Church data: name, type, country, city, address, map coordinates (never city/coordinates for underground), a named contact person with email/phone (often the leader's own details), risk status, needs/resources, profile fields. Content: direct and branch messages, connection-request messages, prayer requests, testimonies, comments, heartcries. Technical: IP addresses processed transiently for rate-limiting and abuse prevention (held at most 1 hour in a rate-limit store; only non-reversible hashes appear in logs). State plainly what is NOT collected — the client is unusually quiet and this is a verified strength: no analytics SDK, no crash reporter, no advertising or tracking SDKs, no push tokens, no contacts access, no photo access, no avatars. Sessions on the device are encrypted at rest with hardware-keychain-held keys and cleared at sign-out.
2. **Underground data posture.** No city, no address, no coordinates stored (city/coordinates refused by the database; see 2.9.b for exact framing); country retained admin-only for internal categorisation (KAN-13 ruling 2026-05-19); underground join codes: generated only when a founding leader chooses to reveal one, stored only as a strong one-way hash (bcrypt), single-use (redeeming clears it), plaintext shown exactly once; underground welcome emails are deliberately information-free (no name, role, church, country, or the word underground); underground applicants are kept out of the general verification queue in a separate track; underground evidence files live in the platform's only storage bucket, which is private, with unconfirmed uploads auto-deleted after 1 hour and envelope-encryption fields in place; underground users are blocked from the nearby-churches feature server-side before their coordinates are parsed; on full account deletion, even the audit trail records only a one-way hash of the email address.
3. **Admin access and escalated cases (transparency section).** Facts: certain message flags in underground contexts auto-open an escalated case; escalated-case content is visible only to a restricted admin tier, on a propose/approve model in which no single administrator — including the platform's most senior — can act alone (approval ceremony locked 2026-06-30; the most senior admin never self-approves); opening life-safety content requires a recorded justification and a fresh second-factor check (5 minutes for sensitive actions, 90 seconds for life-safety actions), and every open is audit-logged before content is shown; when the team reaches out to a leader about a case, the outreach arrives as a normal direct message clearly attributed as "[Admin Name] from Replant Team" — the team does not contact leaders under ambiguous identities; escalated-case records and access logs are retained permanently (ruling 2026-06-30) because they are life-safety records. Also state who can modify account data: privilege and status columns are writable only by the server, never by any app client (privilege-column lockdown, P0-2, closed).
4. **Account deletion and restore (lifecycle section).** A leader's deletion request soft-deletes the account immediately; a 30-day restore window follows (restorable including for underground accounts); on Day 30 a nightly process hard-deletes: every name field is tombstoned, phone/honorific/suffix cleared, the email replaced with a non-identifying tombstone address, and the login record itself deleted. Content the leader posted (messages, prayer requests, testimonies, comments, heartcries) survives in de-attributed form — see Section 6.1 wording choice. Known gap counsel must not paper over: the church record's contact person name, email, phone, address, and coordinates are NOT cleared by this lifecycle today (the church scrub fires only on admin deactivation or rejection) — either the fix ships or the policy's deletion description stays scoped to account data. The in-app deletion button is not yet wired (2.11.2.c).
5. **Retention.** Use the table in Section 4.
6. **Processors / service providers.** Use the table in Section 5. Google and Mapbox were not disclosed in v0.2 and must be.
7. **Your data rights vs what exists (DSR honesty).** Content per 2.11.2. No export path exists; in-app deletion UI pending; rectification split between self-serve and by-request. Promise only fulfilment paths that exist or will exist at publication.
8. **Location and maps.** Facts: the app requests location permission only for the church-map feature; device GPS is never stored on Replant's servers; when the map opens, coordinates are sent (a) to Replant's nearby-churches service transiently (underground users refused before coordinates are parsed) and (b) once to **Mapbox** (a mapping processor) to reverse-geocode a city label; map tiles are fetched from Mapbox, which necessarily sees viewport coordinates and device IP; the Mapbox SDK's default usage telemetry is presumed ACTIVE (no opt-out found in the code as of 2026-07-03) — a disable-vs-disclose decision is pending (Section 6.2), and the iOS permission string currently reads "Your position is never shared," which cannot stand as-is alongside these flows. Do not finalize this section until 6.2 is decided.
9. **Security processing (rate-limiting) disclosure.** IPs and signup email addresses are used in rate-limit keys in a Redis store (Upstash) with time-to-live of at most 1 hour; idempotency caches hold only internal identifiers (verified: the signup payload itself is not cached); application logs carry only non-reversible hashes of IPs/emails, never raw values. Short section or a paragraph inside "What the app collects."

---

## 4. Retention table (ready to use — verified 2026-07-02/03 unless marked)

| # | Data class | Where held | Retention as verified today | Policy wording guidance |
|---|---|---|---|---|
| 1 | Interest-list leads (name, church, city, email, role) | Netlify Forms AND a Google Sheet | Indefinite — no deletion machinery on either store | State a retention rule only after a manual purge runbook exists (Section 6.4); otherwise say "until you ask us to delete it" and honor manually |
| 2 | Volunteer submissions (name, email, optional phone, city/country, preferences) | Netlify Forms | Indefinite — no machinery | Same as row 1; the form already promises "kept private and only used to contact you about serving" — handling must match |
| 3 | Account identity (names, email, optional phone, honorific/suffix, role, declaration) | App database (Supabase) | Life of account. Deletion: soft-delete → 30-day restore → Day-30 hard delete (all name fields tombstoned; phone/honorific/suffix cleared; email tombstoned; login record deleted; underground deletions audited by email hash only) | Describe the 30-day restore window explicitly — it is user-protective and true |
| 4 | Deactivated (not deleted) accounts | App database | Email + display name scrubbed 90 days after deactivation. GAP: structured first/middle/last, honorific, suffix, phone currently survive the scrub — fix in flight | State the intended "all identity fields at 90 days" only if the fix has shipped at publication; VERIFY then |
| 5 | Rejected applicants | App database | Church contact email/phone scrubbed 7 days after rejection. GAP: contact person's NAME is never scrubbed | State 7-day scrub of contact details; do not enumerate "name" as scrubbed until fixed |
| 6 | Church records (name, country, city, address, coordinates, contact person) | App database | Life of church. Contact email/phone scrubbed on admin-deactivation+90d or rejection+7d only. GAP: nothing scrubbed on self-service deletion; address/coordinates/contact name survive hard delete | Scope deletion language to account data, or ship the church-scrub fix first |
| 7 | Direct + branch messages | App database (plaintext at the column level; access-controlled; keyword flags only — content never logged) | Indefinite; survive account deletion de-attributed. The sender display-name snapshot on each message persists as sent (later anonymity changes do not rewrite history) | Policy-choice wording — Section 6.1 |
| 8 | Connection requests (incl. message) | App database | Pending requests expire (status) at 30 days; rows retained indefinitely | Disclose within content retention |
| 9 | Prayer requests | App database | Until author soft-deletes (self-serve); survive account deletion de-attributed | Note the self-serve removal |
| 10 | Testimonies, comments | App database | Indefinite; no deletion machinery (comment deletion is on the roadmap, not shipped) | Section 6.1 wording |
| 11 | Heartcries | App database, encrypted at rest (key in managed vault) | Indefinite (encrypted); every decryption audited before content returns; survive deletion de-attributed | Disclose plainly: retained encrypted; access permanently logged |
| 12 | Escalated cases, underground verification records | App database | Indefinite — life-safety class, retained by locked ruling 2026-06-30 | Disclose as deliberate |
| 13 | Underground evidence files | Private storage bucket | Unconfirmed uploads auto-deleted after 1 hour; confirmed files indefinite | Disclose |
| 14 | Underground join codes | App database | Hash only at rest (bcrypt); cleared on redeem/rotate; plaintext shown once at reveal | May state "we cannot read your join code" |
| 15 | Audit logs (incl. admin IP + browser identity on sensitive reads) | App database, append-only (trigger-enforced, verified) | Life-safety + escalated-case access records: FOREVER (ruling 2026-06-30). Cleared non-safety flag-review records: 30-day age-out RULED 2026-06-30 but machinery NOT BUILT | Build-or-don't-promise fork — Section 6.3 |
| 16 | Email send log (recipient id, template, dates, provider id) | App database | Indefinite; low personal content (recipients are internal team addresses; welcome emails not logged here) | Optional one-line disclosure |
| 17 | Rate-limit + idempotency keys (raw IP, signup email in key names) | Upstash Redis | TTL at most 1 hour; response caches hold internal IDs only | Disclose as transient security processing |
| 18 | Device-local data (encrypted session, preferences) | User's device only | Until sign-out (keys and ciphertext both deleted) | One line |
| 19 | Auth platform logs (IPs, sign-in timestamps) | Supabase platform | Platform-managed, plan-dependent — VERIFY in dashboard | Generic platform-logs sentence until verified |

---

## 5. Processors table (ready to use — all flows verified 2026-07-02/03)

| # | Processor | Location | Personal data received | Purpose | Notes for policy |
|---|---|---|---|---|---|
| 1 | Supabase (infrastructure on AWS) | us-east-1, USA (verified live) | Everything server-side: identity, church, content, heartcries (encrypted), logs | Database, authentication, server functions, file storage, secrets vault | System of record; name it or describe as "our database and authentication provider (US)" |
| 2 | Netlify | USA | Website form submissions (both forms); visitor IPs in standard server logs | Website hosting, form storage, serverless functions | v0.2's unnamed "web host" — now concrete |
| 3 | Google | USA | Sheets: join-network lead rows (name, church, city, email, role, timestamp) via service account. Fonts: visitor IPs from all site pages | Lead tracking spreadsheet; web fonts | PREVIOUSLY UNDISCLOSED processor — must appear in v0.3 (or be engineered away first; Section 6.4) |
| 4 | Resend | USA | Welcome email: recipient address + first name (underground variant deliberately content-free). New-church team notification: leader full name + email (suppressed for underground). Heartcry triage ping: zero personal data. Pastoral digest: counts only | Transactional email | Retains sent-mail content/metadata per its own policy; the discipline here is genuinely strong — the policy can say ops emails are engineered to carry minimal or no personal data |
| 5 | Upstash | Region UNVERIFIED — check dashboard | Raw IP + signup email inside rate-limit key names (TTL ≤ 1 hour); one internal user ID in a pastoral-alert cap key (1 hour) | Rate-limiting, idempotency, abuse prevention | Transient by design; verified the signup payload is NOT cached |
| 6 | Mapbox | USA | Map tile requests (viewport coordinates + device IP); one reverse-geocode call with exact device GPS per church-map open; presumed-active default SDK telemetry (no opt-out found in code) | Maps and geocoding in the church-map feature | Decision pending (Section 6.2) — do not finalize this row's telemetry cell until decided |

Additional access surfaces to acknowledge internally (not necessarily table rows): (a) Apple/Google app stores receive nothing (no push, no purchases, no tracking SDKs — verified); (b) the mail provider hosting the team mailboxes (connect@, info@) receives leader names/emails via team notifications — VERIFY which provider and add if it is a distinct company; (c) DPA/SCC status for every row is a legal-side task — none verifiable from engineering.

---

## 6. Open policy choices for counsel + Founder (each with a recommendation)

1. **Content-plane forever-retention wording.** Messages, testimonies, comments, and connection requests are retained indefinitely and survive account deletion de-attributed; there is no purge machinery. This may be the right ministry choice (shared prayer and testimony are communal records), but it must be a stated choice. Recommendation: disclose with wording like "content you share into the network — messages you have sent, prayer requests, testimonies, comments — remains after account deletion, with your identity removed," and note that the name shown on already-sent messages is a snapshot from the moment of sending. Alternative (build): a content-purge path — larger decision, not required for honesty.
2. **Mapbox telemetry: disable vs disclose.** The map SDK's default telemetry to Mapbox is presumed active, and the iOS permission string says "Your position is never shared" — which is already inaccurate because the geocoding call sends exact GPS to Mapbox regardless of telemetry. Recommendation: DISABLE telemetry in the app (aligns with the platform's threat model and the permission copy), amend the permission string to something true (e.g., "Your position is used to show churches near you and is never stored by Replant"), and disclose Mapbox as a maps processor. Disclosure-only is the weaker posture and still requires changing the permission string. Either way, policy, permission string, and store data-safety forms must end up telling the same story.
3. **Audit-log age-out: build or don't promise.** Ruling of 2026-06-30: life-safety and escalated-case access records retained forever; cleared non-safety flag-review records age out at 30 days. The age-out is unbuilt. Recommendation: ship the age-out (it was already ruled) and let v0.3 state the two-tier truth. If it will not ship by publication, v0.3 must say records are retained indefinitely today, with life-safety records permanent by design.
4. **Website forms: notice + retention + the Google Sheet.** The join-network form carries NO privacy notice or policy link (the volunteer form has an inline sentence). Recommendation: (a) add a one-line notice + policy link to the join-network form at publication; (b) adopt a stated lead-retention rule backed by a documented manual purge runbook covering BOTH Netlify Forms and the Google Sheet; (c) consider retiring the Google Sheet mirror entirely — it removes a processor from the table and shrinks the disclosure. If the Sheet stays, Google is disclosed (Section 5, row 3).
5. **DSR response window.** v0.2 promises action within 7 days. Recommendation: keep 7 days for the interest list (small, manual); for app-scope rights use "within 30 days, and usually much faster" to stay inside GDPR's one-month norm without over-committing at scale.
6. **Access/export.** Nothing exists. Recommendation: do not promise export/portability in v0.3; promise that written access requests will be answered (and create a minimal internal runbook so that promise is real). Revisit automated export post-MVP.
7. **In-app deletion.** Machinery live; entry point unwired; Apple 5.1.1(v) requires in-app initiation. Recommendation: wire the existing entry point before App Store submission; until then the policy says deletion is available on request, and switches to "in the app or on request" when wired. Do not publish "delete in the app" before it is true.
8. **v0.3 scope and publication.** Recommendation: one policy, two-surface structure retained (website + app), published at a stable public URL — this same URL is what both store submissions will reference. Splitting into two documents doubles maintenance and invites drift.
9. **Contact points + entity status.** privacy@projectreplant.org (recommended in v0.2 notes, still unset) and a postal address are publication blockers; the "Replant Initiative" vs "Replant Initiative, Inc." custodian language depends on Georgia incorporation status. Force these decisions with the Founder before layout.
10. **Children/age floor.** Recommendation: state 18+ uniformly (matches "verified adult Christian leaders" and the store age ratings) while keeping the under-13 deletion commitment sentence.
11. **Transparency report.** v0.2 commits to one from launch. Recommendation: reaffirm deliberately — it is a real recurring obligation, and withdrawing later reads badly; but it should be a conscious re-commitment, not an inherited sentence.
12. **Underground country disclosure.** Recommendation: disclose it plainly (per 2.9.b wording). The alternative — staying silent about country retention — would leave the policy technically false in its most safety-critical section.
13. **Identity-scrub fix timing.** The structured-name/phone scrub gap (Section 4, row 4) is a small fix already in flight. Recommendation: land it before publication so the 90-day statement is simply true, rather than drafting around it.

---

## 7. Facts not to rely on (stale as of 2026-07-03)

1. Any v0.2 statement that the interest form collects a phone number or a free-text message — it collects neither; and its role list is six options, not twelve.
2. "Not country, not city, not address, not coordinates" for underground churches — country is retained (admin-only) since 2026-05-20.
3. "The server will not send the name" as a universal masking claim — one production surface masks client-side; server-side enforcement is per-surface.
4. "Re-entering their password" for admin step-up — it is second-factor (TOTP) freshness on a tiered model.
5. "Contact information is scrubbed 90 days later" as a complete description — structured names, honorific, suffix, and phone currently survive the scrub (fix in flight), and church contact names are never scrubbed.
6. Deactivation/rejection scrubs as the whole deletion story — the soft-delete → 30-day restore → hard-delete lifecycle now exists and is the primary user-facing deletion path.
7. The iOS location permission string "Your position is never shared" — inaccurate while device GPS flows to Mapbox; slated for reconciliation (Section 6.2).
8. Any implication that the website has no third-party data flows — Netlify Forms, a Google Sheet, and Google Fonts all receive data; only the "no advertising trackers / no behavioral analytics" sentence survives verification.
9. "The encryption key sits in a vault separated from the application database" — directionally true; use the precise formulation in 2.9.c.
10. Any pre-June description of who can modify account data — privilege/status columns are now server-only (P0-2 closed); admin actions on escalated content require multi-admin approval (locked 2026-06-30).
11. v0.2's founder-notes assumption that the form provider and analytics posture were unknown — both are now verified (Netlify Forms + Google Sheet; no analytics).
12. Do not cite this brief for Jira ticket statuses; where tickets are named (KAN-13, KAN-205, P0-2), the operative fact is stated inline and was verified against code or ruling, not against live Jira.

---

## 8. Store-readiness dependency (state plainly in your draft plan)

1. Apple App Store and Google Play both require a **published privacy policy URL** at submission — Apple in App Store Connect metadata (and the app must also carry an in-app link), Google in the Play Console Data Safety section. v0.3, published at a stable URL and covering the app's actual practices, is therefore a prerequisite artifact for BOTH store submissions. No policy URL, no submission.
2. The store data-safety declarations (Apple privacy nutrition labels + `PrivacyInfo.xcprivacy`, Google Data Safety form) must be rebuilt from the same inventory behind this brief — the iOS privacy manifest currently declares zero collected data types, which is false and is being handled as a separate store-readiness item. Counsel's concern: the policy, the labels, and the manifest must tell one consistent story.
3. In-app deletion (Section 6.7) is an Apple review requirement independent of the policy text.

— End of brief. Every numbered decision in Section 6 is awaiting Founder/counsel input; everything else is drafting from verified fact.

---

## Addendum — Founder rulings 2026-07-03 (binding for v0.3 drafting)

1. **Heartcry encryption language.** Describe the CURRENT model truthfully — TLS in transit; encrypted at rest server-side with a Vault-held key; admin access is deliberate, audited before any plaintext is released, and TOTP-gated — and never call it "end-to-end." ADD a good-faith forward commitment: Replant is actively working toward full end-to-end encryption for heartcry as its highest post-MVP engineering priority ("we're working hard to get full E2E encryption as soon as we can" — Founder's intent verbatim). Counsel drafts the exact public wording; it must not overclaim the present state.
2. **Audit-log retention fork RESOLVED: indefinite retention for ALL audit classes.** The 30-day age-out for cleared non-safety reads will NOT be built (Founder superseded that element 2026-07-03: "it's best we protect the data and keep it indefinitely"). Disclose plainly that access/audit records are retained indefinitely for leader protection and accountability.
3. **Mapbox telemetry: disable RATIFIED.** Draft the processor disclosure against the telemetry-OFF posture — Mapbox receives tile requests and a one-shot reverse geocode as a processor serving the app's own requests; no analytics event stream.
