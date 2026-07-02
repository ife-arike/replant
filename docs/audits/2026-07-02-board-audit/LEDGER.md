# Board audit ledger — 2026-07-02
Format: KAN-n | verdict | lane before → after | comment id | notes

## Pre-agent central work
- KAN-96 | BUILT (deployed) | Backlog → DONE | c.16011 + c.16012 | mandatory admin MFA delivered; recovery-codes A/C superseded by OPS-03
- KAN-142/151/152/190/226/275 | post-mvp label added | lanes unchanged | c.16005-16010 | skip set

## settings cluster (verdicts/settings.md)
- KAN-73 | PARTIAL | To Do → In Progress | c.16013 | missing: verified-gate render, override note, UG radio hide
- KAN-74 | NOT_BUILT | To Do (stays) | c.16014 | ComingSoon stub
- KAN-75 | BUILT (superseded format, stronger enforcement) | Backlog → TESTING | c.16015 | 2-account device smoke to close
- KAN-138 | PARTIAL | In Progress (stays) | c.16016 | blocker = Founder sign-off; "few more things" never itemized
- KAN-205 | PARTIAL (DB done, UI stub) | Backlog (stays) | c.16017 | blocked by KAN-157 legal

## prayerwall cluster (verdicts/prayerwall.md)
- KAN-224 | NOT_BUILT | Backlog (stays) | c.16018 | Revelation "Voices" backend absent; FE placeholder only
- KAN-225 | NOT_BUILT | Backlog (stays) | c.16019 | ⚠ tester-facing disabled Edit control ships
- KAN-258 | BUILT | Backlog → TESTING | c.16020 | ticket stale at filing; device pass list posted
- KAN-260 | PARTIAL | Backlog (stays) | c.16021 | item1 superseded; item2 untouched; item3 inert Connect CTA ⚠ tester-facing

## auditlog-data-content cluster (verdicts/auditlog-data-content.md) — ALL NOT_BUILT, all stay Backlog
- KAN-131 | NOT_BUILT | Backlog | c.16022 | whitelist now 45 actions; validator absent
- KAN-133 | NOT_BUILT | Backlog | c.16023 | COO DEFER governs
- KAN-134 | NOT_BUILT | Backlog | c.16024 | jest not vitest; NO PR CI in either repo
- KAN-136 | NOT_BUILT | Backlog | c.16025 | 🔴 NEW: mobile repo hooksPath override = ZERO gitleaks coverage on PUBLIC repo
- KAN-156 | NOT_BUILT | Backlog | c.16026 | 4 gaps undiagnosed; ~490 i18n strings
- KAN-157 | NOT_BUILT | Backlog | c.16027 | launch-gating legal; scrub_church_pii() anchor stale
- KAN-222 | NOT_BUILT | Backlog | c.16028 | Founder-gated copy sweep; pre-launch critical

## Key flags for gap analysis
1. 🔴 Mobile repo (PUBLIC) has zero gitleaks coverage — hooksPath override bypasses global hook (KAN-136)
2. ⚠ Neither repo has PR-triggered test CI at all (KAN-134 finding; matches audit §18 roadmap)
3. ⚠ Tester-facing dead controls before UAT: disabled Edit (KAN-225), inert Connect CTA on prayer cards (KAN-260), Password + Deactivate ComingSoon stubs (KAN-74/205 — intentional)
4. Notification-on-intercession-hold never designed (KAN-258 scope bullet) — split if wanted for MVP
5. KAN-157 legal + KAN-222 copy sweep + KAN-136 = pre-launch-critical Backlog items to pull when phase opens

## Awaiting clusters
signup-fe, onboarding-be-auth, underground-signup, underground-admin, admin-core, escalated-pastoral, sec-infra, emails-website, connect-moderation, fe-tabs
