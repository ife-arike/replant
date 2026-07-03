# Compliance + Accessibility + Store-Readiness Audit — Session Brief

**For a dedicated future session.** Founder-scoped 2026-07-02. Open the session with prayer naming this work — the audit that makes the platform lawful, accessible, and shippable to the stores that carry it to persecuted leaders. In Jesus' name, Amen.

## Founder rulings shaping this audit (locked 2026-07-02)

1. **Platform scope: iOS + Google Play** (Play follows soon after iOS launch).
2. **Timing: pre-UAT-signoff, as GAP-FINDING.** The formal compliance/legal phase stays post-UAT-signoff per the locked release pipeline; this audit runs earlier so long-lead remediation (legal drafting, the account-deletion chain) starts moving.
3. **Jira: epic KAN-301** (Compliance & Store Readiness) owns compliance + store lanes; **accessibility tickets go under epic KAN-34**.

## Read FIRST

1. This brief + [KAN-301](https://projectreplant.atlassian.net/browse/KAN-301) (epic — scope + anchors) + KAN-157 (incl. the 2026-07-02 correction comment) + KAN-34.
2. `docs/audits/2026-07-02-mvp-board-audit-gap-analysis.md` — the board-audit synthesis; several findings become store blockers here.
3. The cowork legal corpus at `/Users/ife/Documents/Claude/Projects/Replant/`: `replant-interim-privacy-policy-draft-v0.2.html` (current draft; May 13 — predates June systems), `replant-tos-scoping-note-v0.1.html` ("App Store ToS Deliverable" — 16-section structure), `replant-threat-model.html`, `replant-pre-launch-checklist.html`, bylaws/covenant/COI drafts, `replant-requirements-v2_7.html`, `replant_data_dictionary.html`.
4. Memory: `replant-continuous-spec` (always), `release_phase_pipeline`, `reference_replant_legal_cowork_artifacts`.

**LEGAL role note:** LEGAL is ACTIVE in the cowork surface (like CD — a separate surface, NOT dispatchable as an in-workspace agent). In-workspace agents produce inventories, gap maps, and paste-ready briefs FOR the cowork LEGAL session; cowork LEGAL owns the policy/ToS text. Deliver briefs as `.md` files in `.claude/plans/` and give Founder the path.

## Method — the proven house pattern

Panel briefing → checklist corpus built from the actual standards → parallel READ-ONLY lane agents (code + live-DB verified, no speculation) → ranked synthesis doc → tickets filed under KAN-301/KAN-34 → Founder device scripts. SME panel rules apply: SEC required (crypto/auth/data surfaces), CONTENT on copy-heavy surfaces, every agent prays naming the work, seasoned-expert framing, genuine verdicts (never pre-biased). Consolidate Founder ratification asks (≤5). No time estimates — stages and checkpoints only.

## Lanes (suggested 7 — adapt at session start)

1. **A11y code lane** (→ KAN-34): accessibilityLabel/Role coverage on touchables; palette contrast ratios vs WCAG 2.2 AA thresholds (check the locked brand tokens — muted-on-dark combos especially); 44pt touch targets; dynamic-type behavior; reduced-motion branches (known gap: FAQ accordion); the dropped `tabBarAccessibilityLabel` (KAN-78 residual). Map findings to WCAG success criteria.
2. **A11y device-script lane** (→ KAN-34): produce per-screen VoiceOver (iOS) + TalkBack (Android, when relevant) walkthrough scripts FOR the Founder — she is a tester; manufacture the input states each script needs (pending account, UG account, escalated thread, etc.). Do NOT mark anything passed from code alone.
3. **Data-inventory lane** (→ KAN-301): every PII field collected → where it flows (Supabase `jiyetphxxvyiicrnwlnx` · Resend · Upstash · Netlify · Mapbox) → retention vs shipped machinery (PII scrub crons, soft-delete → day-30 hard-delete, email_log) → DSR paths → cross-border posture (us-east-1 vs global users). Output feeds lanes 4–6. Live-DB spot-checks allowed (read-only; never probe audit_log with writes).
4. **Privacy-policy refresh lane** (→ KAN-301): v0.2 → v0.3 gap map against the inventory. Known-missing-from-v0.2 (postdates it): UG join-code system, escalated cases + reach-out attribution, soft-delete lifecycle, phone field, structured names, P0-2 write-model, Upstash dependency. Deliverable: paste-ready brief for the cowork LEGAL session.
5. **App Review lane (iOS)** (→ KAN-301): guideline-by-guideline sweep. Known early warnings to verify and ticket: **5.1.1(v) in-app account deletion** (KAN-205 stub; chain KAN-157 → 205 → store); **1.2 UGC requirements** — filter ✓ (taxonomy) / report ✗ (no leader-facing flag UI — KAN-261) / block users ✗ (nothing; mute is post-MVP) / published contact ✓; **placeholder/completeness risk** (KAN-254 Persecuted reader placeholders reachable; ComingSoon stubs KAN-74/205); privacy nutrition labels + `PrivacyInfo.xcprivacy` accuracy vs the lane-3 inventory; purpose strings (location — Church tab GPS); `ITSAppUsesNonExemptEncryption` export declaration (heartcry encryption, HTTPS, SecureStore — determine exemption category honestly); sign-in/session expectations; TestFlight → production metadata checklist.
6. **Google Play lane** (→ KAN-301): Data Safety form worksheet from the same inventory; Play's account-deletion requirement (in-app AND a WEB deletion path — note Replant has no web account surface today: finding, not footnote); UGC policy equivalents; target API level + permissions declarations; families/content-rating questionnaire answers.
7. **ToS lane** (→ KAN-301): collect the 3 open Founder decisions (naming — lean "Terms of Use"; acceptance-flow — checkbox-with-link alongside the Declaration of Faith vs separate first-launch consent screen; scripture anchors per section), then produce the drafting brief for cowork LEGAL against the scoping note's 16-section structure. Acceptance-flow decision also lands as a mobile onboarding ticket (FE work) once ruled.

## Deliverables

1. Ranked synthesis doc `docs/audits/<date>-compliance-a11y-store-audit.md` — severity classes: STORE BLOCKER / compliance gap / a11y defect (by WCAG criterion) / worksheet item.
2. Ticket set under KAN-301 + KAN-34 (Jira is the paper trail; spot-check cites against live Jira before locking them in).
3. Founder device scripts (VoiceOver pass, acceptance-flow smoke once built).
4. Worksheets: nutrition labels + PrivacyInfo, Play Data Safety, App Store Connect submission checklist.
5. Paste-ready cowork LEGAL briefs (privacy v0.3, ToS draft inputs) in `.claude/plans/`.

## Cautions (standing rules — do not relearn these)

1. UG invariants are sacred and this audit is READ-ONLY on them; no writes to audit_log; never assume the test account.
2. Mobile repo = LAX push; admin repo = ASK; only Founder marks Done.
3. Don't default-to-MVP the remediation recommendations — right-the-first-time posture; staged paths only where Founder explicitly rules.
4. The Jira-anchor rule (KAN-119 c.11455): live Jira is truth for key↔title↔status before locking cites into the synthesis doc.
