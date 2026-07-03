# Cowork LEGAL — Catch-Up Cover Note (2026-07-03)

**Paste this FIRST into the cowork LEGAL session, then the two briefs.** LEGAL's last artifacts are the interim privacy policy v0.2 (2026-05-13) and the ToS scoping note v0.1 — a great deal has happened since. This one page brings the space current; the two companion briefs carry the full detail and are self-contained.

## Paste order

1. This cover note.
2. `2026-07-03-cowork-legal-privacy-v0_3-brief.md` — section-by-section verdict on v0.2 (7 KEEP · 9 CORRECT · 6 EXTEND · 9 ADD), pre-built retention + processors tables, 13 policy choices with recommendations, plus the 2026-07-03 rulings addendum.
3. `2026-07-03-cowork-legal-tos-drafting-brief.md` — all 16 sections with verified app facts, the 3 deferred decisions as structured blocks, entity facts, a recommended §17 (store-required platform terms incl. the US-embargo representation question), plus the rulings addendum.

## What happened since your artifacts (one paragraph)

A full compliance/accessibility/store-readiness audit ran 2026-07-03 (epic KAN-301): eight read-only lanes verified the app, the live database, both store policy corpora, and your draft corpus. Verdict: not submittable to either store today — seven bounded blockers, none architectural. The two briefs were produced by that audit and every factual claim in them is code- or live-DB-verified as of 2026-07-03.

## Founder rulings LEGAL must draft against (all locked)

1. **Heartcry encryption (2026-07-03):** the current model is server-side encryption at rest with audited, TOTP-gated admin access — NEVER describe it as "end-to-end" today. Replant IS committed to true E2E: it is the locked **#1 post-MVP engineering priority**, and public documents should carry a good-faith forward commitment ("we're working hard to get full end-to-end encryption as soon as we can" — Founder's intent verbatim; you own the final wording; it must not overclaim the present state).
2. **Audit/access-record retention (2026-07-03): indefinite, all classes.** The earlier 30-day age-out concept is superseded — disclose indefinite retention plainly (leader protection + accountability rationale).
3. **Mapbox telemetry: disabled (ratified 2026-07-03).** Draft processor disclosures against the telemetry-OFF posture: Mapbox receives map-tile requests and a one-shot reverse geocode as a processor serving the app's own requests; no analytics stream.
4. **Underground location truth (correcting v0.2):** UG churches store NO city, NO coordinates, NO address (DB-enforced); they DO store country (admin-only, displayed as macro-region). v0.2's "not country" sentence must not survive into v0.3 — the corrected claim is still strong, and true.
5. **Entity posture:** Replant Initiative, Inc., Georgia nonprofit, formed 2026-06-01, EIN 42-3033485, **Form 1023 not yet filed — no 501(c)(3) representation in any published document.**
6. **In-app account deletion (2026-07-03):** the Founder ruled the build unblocked — the flow (full deletion, 30-day restore window, then permanent) is being designed/built NOW, so policy/ToS may describe it as available at publication; final copy will be shared for consistency.

## Decisions LEGAL + Founder still owe (the briefs carry full context + recommendations)

1. The 3 ToS decisions: document naming (lean "Terms of Use") · onboarding acceptance-flow (checkbox-with-link vs separate consent screen) · scripture anchors per section.
2. Minimum age number (18 is the natural fit; nothing exists in-app today).
3. Privacy contact points (privacy@ mailbox, postal address — placeholders since v0.1).
4. Content-plane retention wording (messages/testimonies retained de-attributed after account deletion — a deliberate posture to state).
5. The nutrition-labels sign-off bundle + availability-by-country (store-facing; briefs §-referenced).

## One recurring obligation to calendar

Export compliance was corrected 2026-07-03: the app declares non-exempt standard encryption (mass-market, ECCN 5D992.c). **LEGAL owns the annual BIS self-classification report** (one CSV line to crypt@bis.doc.gov + enc@nsa.gov by February 1 each year), plus a one-time France/ANSSI declaration only if France is in the availability list.
