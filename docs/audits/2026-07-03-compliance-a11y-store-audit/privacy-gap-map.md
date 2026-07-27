# Privacy Gap Map — Policy-Blocking Gaps, Ranked

**Date:** 2026-07-03 · **Lane:** privacy policy v0.2 → v0.3 (compliance/a11y/store-readiness audit)
**Inputs:** v0.2 draft (2026-05-13, `~/Documents/Claude/Projects/Replant/replant-interim-privacy-policy-draft-v0.2.html`) mapped section-by-section against the master data inventory (`data-inventory.md`, this directory), with targeted code spot-checks (website forms, UG location constraint, NetworkFeed masking, church validator) on 2026-07-03.
**Companion deliverable:** paste-ready cowork LEGAL brief at `.claude/plans/2026-07-03-cowork-legal-privacy-v0_3-brief.md` (self-contained; carries the full gap map, retention table, processors table, and policy-choice questions).

**Publication dependency, stated plainly:** both Apple App Store and Google Play require a PUBLISHED privacy-policy URL at submission (Apple: App Store Connect metadata + in-app link; Google: Play Console Data Safety). v0.3 — expanded to cover the app, published at a stable URL — is a prerequisite artifact for both store submissions. Until it is published, every store lane is blocked behind this one.

## Ranked gaps

### STORE BLOCKERS

1. **No published privacy policy covering the app.** v0.2 scopes itself to the website interest list and was never published; the app's data practices (identity, church, content, heartcries, processors, retention) are described nowhere public. Blocks both store submissions outright.
2. **Contact placeholders unresolved.** The policy's privacy email and postal address are still bracketed placeholders (carried since v0.1). A policy cannot publish with placeholder contact points — publication blocker inside blocker 1.
3. **In-app account deletion entry is a ComingSoon stub (KAN-205)** while the DB lifecycle (soft-delete → 30-day restore → Day-30 hard delete) is live and verified. Apple 5.1.1(v) requires in-app deletion initiation for apps with account creation. Also constrains policy wording: "delete in the app" cannot be published until wired.
4. **iOS privacy manifest is false.** `PrivacyInfo.xcprivacy` declares zero collected data types; actual collection includes name, email, phone, location (church coords; device GPS in transit), and user content. Manifest + Apple nutrition labels + Play Data Safety form must be rebuilt from the inventory and must match the policy — a mismatched set is a rejection and misrepresentation risk.
5. **Mapbox flows contradict the shipped iOS purpose string.** "Your position is never shared" is false as written: exact device GPS goes to Mapbox geocoding on church-map open, and default SDK telemetry to events.mapbox.com is presumed active (no opt-out in code). Disable-vs-disclose decision required before submission; purpose string must change under either choice.

### Compliance gaps

6. **UG country retention contradicts v0.2's flagship claim.** "Not country, not city, not address, not coordinates" is false since KAN-13 (ruling 2026-05-19; constraint relaxed 2026-05-20): country is stored admin-only. Publishing v0.2's sentence would put a false statement in the policy's most safety-critical section. City/lat/lng enforcement (3 layers) verified intact; "no address" is UI-omission only, not constraint-enforced.
7. **"Server will not send the name" is not universally true.** Home-tab NetworkFeed masking is client-side (real first/middle/last + church name fetched to every client, masked at render; SEC panel pending). Comments, prayer wall, and heartcry-open masking are genuinely server-side. Policy must describe the mixed model honestly.
8. **No DSR access/export path** (GDPR Art. 15/20 analogues). No export function, endpoint, or admin runbook exists. Policy must not promise portability; a manual access-request runbook is the minimum to back any access promise.
9. **PII scrub gaps vs stated retention.** `scrub_user_pii` misses structured names, honorific, suffix, phone (fix in flight — land before publication so the 90-day claim is simply true). Church contact_name is never scrubbed anywhere; church contact/address/coords survive the completed deletion lifecycle and the scrub never fires on self-service deletion. Policy wording must be scoped to what is true at publication.
10. **Audit-log age-out ruled but unbuilt.** Ruling 2026-06-30: life-safety + escalated-case access records forever (must be disclosed as deliberate); cleared non-safety flag reads age out at 30 days — no cron, no function exists. Build-or-don't-promise fork for counsel; policy must state retention honestly either way.
11. **Website lead data has no lifecycle and the join form has no notice.** Join-network leads live in Netlify Forms AND a Google Sheet (Google = previously undisclosed processor); volunteer submissions in Netlify Forms; no retention rule, no purge process, no privacy notice/link on the join-network form (volunteer form has one). v0.2's "we will delete the interest list" promise is backed by no machinery.
12. **Content-plane forever-retention is an unstated policy choice.** Messages, testimonies, comments, connection requests: retained indefinitely, surviving account deletion de-attributed; `attribution_display_name` snapshots survive later anonymity toggles. Defensible ministry choice — but v0.3 must state it.

### Worksheet items

13. Step-up wording: v0.2's "re-entering their password" → tiered TOTP/MFA freshness (5-min sensitive / 90-s life-safety) — correction packaged in the brief.
14. Dashboard-side confirmations: Upstash region; Supabase auth SMTP sender; auth-log retention; Netlify form notification targets; mail provider behind connect@/info@ mailboxes (leader PII lands there).
15. `users.last_seen_at` has no writer in the mobile repo — confirm admin-side writer/purpose before disclosing.
16. `email_log` indefinite retention (low-PII); raw IP/email in Upstash key names (≤1h TTL, purposeful) — disclose as transient security processing; hash-in-key is cheap hardening.
17. Volunteer-form promise ("kept private, only used to contact you about serving") — make Netlify handling and notification routing match it.
18. Founder decisions carried since v0.1: privacy@ mailbox setup, postal address, entity-name custodian language (Georgia incorporation status), transparency-report re-commitment, 7-day vs 30-day DSR window, 18+ age-floor alignment.

## Readiness verdict

**Counsel can draft v0.3 from the brief alone.** The brief is self-contained: every v0.2 section carries a KEEP/CORRECT/EXTEND verdict with the verified present-day fact stated inline and dated (7 KEEP · 9 CORRECT · 6 EXTEND · 9 ADD), the retention and processors tables are pre-built from the verified inventory, DSR reality is stated without overclaim (no export path; deletion machinery live but entry stub; rectification split), and every open item is either a numbered policy choice with a recommendation (13 of them) or a marked VERIFY with its owner. What the brief cannot supply — and says so — are the Founder/counsel decisions themselves (contact points, entity status, Mapbox disable-vs-disclose, content-retention wording, age-out build-or-disclose) and four dashboard-side confirmations; none of these block drafting, only finalization. The binding sequence risk is not the drafting but the publication chain: decisions → v0.3 text → published URL → store forms/manifest rebuilt to match → submission.
