# Replant — Session handoff (paste into a new Claude Code session opened in `/Users/ife/replant`)

You're resuming after a hard session (2026-06-14). Open with prayer per `/Users/ife/replant/CLAUDE.md` — actual intercession naming the work at hand, not a perfunctory sign-off. The previous session went sideways: a Netlify env-var MCP call leaked four production secrets into the transcript and triggered an emergency rotation of six secrets total (Supabase service_role JWT, Supabase anon JWT, Resend API key, JWT_SECRET, WELCOME_DM_INTERNAL_TOKEN, Google service account key). That work is done. The work Founder originally sat down to do — finalizing signup, tidying the form welcome emails, testing the interest form for church calls — never happened. She trusted prior AI guidance on Netlify env-var configuration that turned out to be wrong, paid a multi-hour rotation tax, and chose grace anyway. Hold that posture.

## Read these first (in order)

1. `/Users/ife/.claude/projects/-Users-ife-replant/memory/MEMORY.md` — auto-loaded; spot the four entries added 2026-06-14.
2. `/Users/ife/.claude/projects/-Users-ife-replant/memory/reference_netlify_env_var_dev_context_leak.md` — Netlify "Local development (CLI)" context is plaintext-readable by design.
3. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_dont_pull_netlify_env_vars_via_mcp.md` — don't repeat the leak that caused yesterday's pain.
4. `/Users/ife/.claude/projects/-Users-ife-replant/memory/project_email_templates_pending.md` — full state of the welcome-email work that's still in flight.
5. `/Users/ife/.claude/projects/-Users-ife-replant/memory/reference_projectreplant_netlify_deploy.md` — `projectreplant.org` is NOT auto-deployed from GitHub; every change requires `netlify deploy --prod` from `~/replant`.
6. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_chase_founder_hypothesis_first.md` — she has the device and signal you don't.
7. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_dont_speculate_ship.md` — cap speculative fixes at 2 per symptom.

## What's already done — do NOT redo

All six rotations are live:

- Supabase legacy `service_role` JWT → migrated to `sb_secret_…`, legacy keys disabled.
- Supabase legacy `anon` JWT → migrated to `sb_publishable_Gpwkg-q8oDAYL0ejtjJnwg_99n9IDOl`. Admin Netlify + mobile `.env.local` + sim + physical device all updated.
- `RESEND_API_KEY` rotated; new key in admin Netlify env vars + `~/.zshrc` for the local MCP plugin; old `re_RuhfjCNM…` revoked.
- `JWT_SECRET` rotated via `openssl rand -base64 32` → admin Netlify production / branch-deploy / deploy-preview / preview-server contexts; Local development context intentionally left blank.
- `WELCOME_DM_INTERNAL_TOKEN` rotated via `openssl rand -hex 32` → admin Netlify env + Supabase Vault (`welcome_dm_internal_token`) via `vault.update_secret(...)`.
- `GOOGLE_SERVICE_ACCOUNT_JSON` rotated; old key (`6c09e9db…`) deleted in Google Cloud Console; new key live in projectreplant Netlify env. The `submission-created.js` background function (which was MISSING from production) was redeployed via `netlify deploy --prod` from `~/replant`. Sheets writes are working again.

Locked commits from the prior multi-session sprint (don't touch):
- `2498827 fix(settings): KAN-229 — chevron gap on Honorific + Suffix rows`
- `1cd5b9d fix(settings): KAN-229 — Radius import + HAIRLINE namespace collision`
- `e94d451 feat(settings): KAN-229 name-fields fix + hamburger expansion`
- `f3bc0e5 feat(5-tab): empty-state polish + Founder device-pass rulings`
- `7277851 feat(signup): Sessions 3-4 polish (KAN-192, over-scroll, register-church-delete)`

## CRITICAL OPEN — Priority #1

### Founder couldn't complete the signup flow yesterday

She said: *"right now i cant even complete the sign up flow"*. That regression blocks every other workstream that involves a real signup. Investigate first, before touching the email template work.

Likely candidates given recent changes:
- The mobile app picked up a new `EXPO_PUBLIC_SUPABASE_ANON_KEY` (now `sb_publishable_…`) — verify the Supabase client init in `src/lib/supabase.ts` works with the new key format. Most Supabase SDK versions accept both legacy JWT and `sb_publishable_` formats, but if the SDK is pinned to an older version it may not parse the new format.
- The legacy `anon` JWT was disabled at the Supabase project level. Anything still using the cached old key gets 401.
- The mobile app launched on the iPhone 17 Pro sim via `build_run_sim` after the rotation — that build has the new key compiled in. But the previous build on her physical device (the one she's been doing the signup pass on) may NOT have been rebuilt.

Recommended starting investigation:
1. Ask Founder which device she's signing up on (sim or physical iPhone). Per `feedback_never_assume_test_account` — don't guess.
2. Confirm she's on the rebuilt app — splash should appear within the last 24h of build timestamps.
3. Walk the signup flow and observe where it breaks. If it 401s on a Supabase call, the SDK isn't accepting the new key format → upgrade `@supabase/supabase-js`. If it breaks at a specific UI step, it's likely a pre-existing signup-sprint bug.

Prior signup-sprint state for context:
- Session 4 over-scroll fix on ASP2 + RegCP1 is in main (`AccountSetupPage2Screen.tsx` + `RegisterChurchPage1Screen.tsx`). Three-rule pattern: NO KeyboardAvoidingView, footer in flex flow, ScrollView with `automaticallyAdjustKeyboardInsets={false}` + `contentInsetAdjustmentBehavior="never"`.
- ASP2 has temporary `console.log('[ASP2] offsetY=', ...)` instrumentation in the ScrollView's onScroll handler from earlier diagnostics. If the over-scroll bug doesn't recur this session, ask Founder to confirm and strip the instrumentation.

## Priority #2 — Form welcome emails (church calls)

Founder needs the welcome emails tidied before pointing churches at the form. The full state is in `project_email_templates_pending.md`. Short version:

1. The deployed welcome HTML (last send 2026-05-13) is OLDER than the local upgrade at `~/replant/docs/emails/join-welcome.html` and `volunteer-welcome.html`.
2. The local upgrades have three blockers:
   - Hardcoded "Dear Samuel" / "Dear Grace" → replace with Resend triple-mustache `{{{FIRST_NAME}}}`.
   - Relative `src="logo.png"` → absolute URL (probably `https://projectreplant.org/logo.png` once you host it there; or CID/base64 embed).
   - Color-shift defenses: bump body `#c8c8c8` → `~#9a9a9a`, footer `#333333`/`#444444` → `~#777`, border `#1e1e1e` → `~#2a2a2a`; add `@media (prefers-color-scheme: light)` block; replace `linear-gradient` top hairline with a solid 1px sky (Outlook desktop can't render gradients).
3. The function that actually sends the email lives in the **admin Netlify site** (replant-admin), NOT in this repo. The webhook target is `https://admin.projectreplant.org/.netlify/functions/join-welcome` (Founder confirmed via screenshot). Ask Founder: where is the source code for the `replant-admin` Netlify project? Separate repo? Direct uploads? Find it before tweaking the deployed HTML.
4. Once you have the source, swap the deployed HTML with the tidied version and deploy. Smoke-test by submitting a real form on projectreplant.org/#join and confirming the designed welcome lands in Gmail without a color shift.

Open Founder rulings needed before shipping:
- **Role dropdown on `website/index.html`** has 6 options (Senior Pastor / Associate Pastor / Elder ÷ Deacon / Ministry Leader / Intercessor / Other). App canonical 12 from `src/utils/displayHelpers.ts`. Three paths: (a) match app exactly, (b) keep simpler 6, (c) hybrid. Founder hasn't ruled. Ask before touching.
- **`connect@projectreplant.org`** stays as the welcome-email From address until funds/capacity to change (Founder ruling 2026-06-14).

## Priority #3 — Loose ends

- **Welcome DM smoke test (#4.5 from rotation):** WELCOME_DM_INTERNAL_TOKEN was rotated yesterday but the actual welcome DM send wasn't verified. Next time a leader is approved via admin, confirm a DM lands in their Connect tab. KAN-217.
- **Connect GitHub to projectreplant Netlify:** the marketing site is currently manual-deploy-only. Every `website/` or `netlify/functions/` change requires `netlify deploy --prod` from `~/replant`. This is a foot-gun (yesterday it hid that `submission-created` had fallen out of production for who knows how long). File as a follow-up; once GitHub is connected, commits auto-deploy.
- **Audit the four exposed secrets for downstream use you might've missed.** The rotation closed the immediate exposure, but anywhere a script, a Make/Zapier flow, a local `.env`, a teammate's machine, or a doc holds the OLD value will silently fail. Founder should walk through anything that might've used any of: the old Resend `re_RuhfjCNM…` key, the legacy Supabase service_role JWT (now disabled at the project level), the old JWT_SECRET, the old WELCOME_DM_INTERNAL_TOKEN, or the old Google service-account key ID `6c09e9db…`.

## Founder rulings to honor (locked)

- `connect@projectreplant.org` is the welcome-email From (until further notice).
- All agent dispatches must include a real intercessory prayer naming the specific work, ending "In Jesus' name, Amen." Memory: `feedback_agents_must_pray`.
- Only Founder marks Done in Jira — don't transition to Done autonomously.
- Modal copy + Founder-locked strings are quoted verbatim; don't paraphrase.
- Don't strip protection-layer modals without asking (memory: `feedback_confirm_before_removing`).
- Never assume which test account she's using (memory: `feedback_never_assume_test_account`).
- "Build for the full end goal" — global persecuted Church, not the MVP cheap path (memory: `feedback_build_philosophy`).
- Don't pull Netlify env vars via MCP. Use the dashboard UI for inspection (memory: `feedback_dont_pull_netlify_env_vars_via_mcp`).

## Starting move

1. Pray properly per CLAUDE.md — name the signup-flow blocker, the church calls, the leaders trying to come into the network, the cost of yesterday. Not generic.
2. Read the memory files above in the order listed before any code.
3. Open by asking Founder: "Which device are you signing up on, and what specifically breaks?" Don't speculate.
4. Investigate the signup-flow blocker (Priority #1). Apply `feedback_dont_speculate_ship` — verify on her actual device or get a diagnostic, don't pile speculative fixes.
5. Once signup is working, pivot to the email-template tidy and the church-call readiness work.

If at any point the work strays toward "pull env vars via MCP to see what's configured" — STOP. Use the dashboard UI. The whole reason this session exists in this state is because we didn't.

In Jesus' name, Amen.
