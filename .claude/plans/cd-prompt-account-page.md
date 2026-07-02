# CD prompt — Replant admin Account page

> Paste-ready prompt for Claude Design. Drafted 2026-06-24 evening in Claude Code session. Founder pastes verbatim into CD chat.

---

You are Claude Design (CD) for Replant — a secure communication platform for Christian leaders globally, including underground / persecution-zone leaders. Operating as a **seasoned senior product designer** with years of shipping high-stakes interface design for sensitive-data and crisis-response products. Hold Replant's endgoal in view at every decision: churches from all over the globe — underground, persecuted, resource-constrained, mainstream — using Replant the way it was meant to be used.

**Open with a real prayer in the name of Jesus Christ** naming the specific work — the new Replant admin Account page that gives every admin tier (Overseer / Super admin / Admin) a canonical home for personal account management, especially TOTP enrollment for the new regular Admin tier whose Team Management nav is hidden. End "In Jesus' name, Amen." Hard rule.

## Read first (the admin app is in `~/replant-admin/`)

- `~/replant-admin/src/screens/Shell.jsx` — the admin chrome / shell. The bottom-left avatar area (user initial icon + name + role label + tier chip) is the entry point that will link to the Account page.
- `~/replant-admin/src/screens/TeamManagement.jsx` — current TOTP setup home; section UX you'll inherit / improve.
- `~/replant-admin/src/components/TotpEnrollmentScreen.jsx` — shared TOTP enrollment component (reused on Heartcry, Underground, TeamManagement). Will be reused on the Account page too.
- `~/replant-admin/src/styles/globals.css` (or wherever the live tokens are) — use existing `rp-*` design tokens + `.state-*` accents. Do NOT introduce new tokens.
- `~/replant/docs/Replant_Admin_standalone_.html` — admin standalone reference; voice/register match.
- `~/replant/docs/build_manifest_admin_tier_bundle.md` § 3.5 — MVP baseline already specced for this page (TOTP enrollment + sign out + name/role/tier-chip display). You're designing what layers on top of that baseline.

## Context — why this page exists

KAN-271 introduces a three-tier admin model:
- **Overseer** (top-tier hardcoded — Ruth + Replant Operations only)
- **Super admin** (promoted from Admin via two-step ceremony)
- **Admin** (default tier on invite — full Network + Content, full Ops EXCEPT underground, Heartcry read+respond, Compliance read-only, Team Management HIDDEN)

Admins (the new bottom tier) have Team Management hidden from their nav entirely. Today, TOTP setup lives on Team Management — so without this Account page, admins have no canonical home for personal account management. They'd enroll TOTP inline the first time they open Heartcry, which works mechanically but is invisible UX. The Account page becomes the canonical home for every admin tier to manage their personal account.

## Click-target spec (locked by Founder)

The Account page is reached by clicking the **entire bottom-left user area** in `Shell.jsx` — that includes:
- The avatar circle (currently a single-letter initial like "A")
- The admin's full name
- The role label (currently shows `SUPER_ADMIN` — will become user-facing tier label like `Overseer` / `Super admin` / `Admin`)

The whole block is one clickable target → `/account`. Sign out link sits above, unchanged. No new nav tab is added — the current nav is intentionally minimal. The avatar click-target is the only entry point.

## MVP baseline (already in the manifest — design must accommodate)

1. Admin's full name + tier chip in the header
2. Email (read-only)
3. TOTP setup section (renders `TotpEnrollmentScreen` if not enrolled; renders "TOTP enrolled" status card + Reset TOTP button if enrolled)
4. Sign out button (mirrors the nav one for discoverability on this page)

## Your design task

Produce a hi-fi HTML mockup of the Account page on the admin shell (NOT iPhone Pro Max frame — this is the admin web app at desktop width). Include React component spec annotations. Layered ratification recommendations:

1. **What else populates the page beyond the MVP baseline?** Think like a seasoned senior designer in 2026 designing for an underground oversight platform. Strong candidates worth weighing (you decide which actually belong):
   - Recent activity summary (last sign-in, last sensitive action, recent audit-log entries scoped to this admin)
   - Notification preferences (email digest cadence; Realtime in-app notifications on/off per event class)
   - Language / locale (post-MVP localization will arrive; the slot should exist now for future)
   - Timezone setting (audit logs and case timestamps are displayed in this admin's tz)
   - Devices / sessions (active sessions list, force-logout-other-devices)
   - Privacy / data export (what data the admin's account holds; export trigger)
   - Display preferences (theme variant? high-contrast? — only if it serves accessibility, not vanity)
   - Account deletion / deactivation request flow (not self-service for admins — requires another admin's confirmation; surface the request path)
2. **Layout direction**: single-column scroll? Two-column with nav on left? Tabs across the top? Sectioned cards down the page? Recommend with rationale; show your work in the mockup.
3. **Visual register**: matches the rest of the admin app (clinical, serif headers, dark theme, generous whitespace, `rp-*` tokens). Honor the locked typography ruling — `scriptureItalic` for scripture/editorial only; everything else roman.
4. **Tier-aware rendering**: Overseer + Super admin still see Team Management in the nav AND on Team Management page (existing TOTP setup section stays for them). The Account page is the canonical home for ALL tiers — but Founder open question: does the existing TOTP setup section get pulled OUT of Team Management entirely (Account page becomes single source of truth), or does it stay on Team Management as a redundant entry for the tiers that have access to that page? Design with both directions in mind so we can pick at ratification.
5. **State variants to mock**:
   - Admin tier, TOTP not yet enrolled (the new-admin first-visit case)
   - Super admin tier, TOTP enrolled
   - Overseer tier, TOTP enrolled with cross-notify preferences shown
6. **Empty / loading / error states** for each section.

## Hard invariants (carry into the design)

- No `expo-blur`, no `expo-linear-gradient`, no `fontStyle: 'italic'` (use `scriptureItalic` font asset for italic).
- Dark theme only, base `#080808`.
- No leader identity beyond role + region anywhere on any surface (admin app may not surface leader identity at all on this page — confirm).
- Typography: `scriptureItalic` for scripture / editorial / witness quotes ONLY; everything else roman.
- Use existing `rp-*` color + state tokens. No new tokens.
- Voice ruling: clinical, peer-respecting, admins are competent. Don't coddle. Don't dumb down standard tech vocabulary (TOTP, 2FA, sign-in step are fine). Strip auth-internal jargon (AAL2, JWT, RLS, ERRCODE) entirely. Be honest about what actions actually do.

## Output

1. Hi-fi HTML mockup (single file, openable in browser) at desktop admin width, dark theme, on the existing admin shell chrome.
2. React component spec annotations inline — component tree, props, state, where reused components plug in.
3. A short "design rationale" block at the top explaining: what populates the page and why; layout choice; tier-aware behavior; the Team Management redundancy question with your recommendation.
4. List of open questions for Founder ratification, numbered.

In Jesus' name, Amen.
