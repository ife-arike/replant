# Changelog

All notable changes to Replant Mobile are documented here.
Entries are appended automatically on every merge to main.

## [2026-05-16]

### Added
- Leader Church ID (RPL-XXXXX) on Settings Screen 20 (KAN-144)
- submission-created background fn — join-network → Google Sheets

### Fixed
- "Church ID" → "Network ID" relabel + AC-7 + Settings residuals (KAN-144)
- Option A Network ID row conditional on assigned code (KAN-144)

## [2026-05-14]

### Added
- admin-open-heartcry Edge Function (KAN-92)
- OPS-03 founder TOTP self-lockout break-glass procedure (KAN-162)

### Security
- AAL2 / TOTP freshness gate on admin-open-heartcry — D-52 TIER 0 (KAN-97)

### Fixed
- CORS preflight on admin-open-heartcry (KAN-92)

## [2026-05-12]

### Added
- SettingsScreen wired into navigator + gear icon on Home header (KAN-72)
- __DEV__-only sign-in form on AccountSetup1Placeholder (KAN-72)

### Fixed
- Founder QA r2 — title + subtitle font sizes (KAN-72)
- Founder QA — radio text size, spinner, badge size (KAN-72)

## [2026-05-11]

### Added
- Pastoral Notification — T1 alert + post-commit moderation_state + migration (KAN-137)
- Auto-flag keyword library — D-45 implementation (KAN-124)
- send-message Supabase Edge Function — net-new (KAN-71)

### Changed
- README — Authentication subsection + SSH-form clone (KAN-135, KAN-136)

## [2026-05-10]

### Changed
- CLAUDE.md live-Jira rule + README first-run skeleton (SM tasks #139, #140)

## [2026-05-07]

### Added
- Declaration of Faith — affirm-only, scroll-gated, wireframes-canonical text (KAN-10)
- submit-heartcry Edge Function — full rebuild from scratch (KAN-66)

### Changed
- Declaration of Faith iterative polish pass — typography, density, scripture citation, em-dash, hue/weight (KAN-10 iter 3–8)

### Fixed
- Admin link in triage notification email (KAN-66)
