# Session starter — blog.projectreplant.org

Paste this entire block into a new Claude Code session opened in `/Users/ife/replant`:

---

You're starting work on **blog.projectreplant.org** — a subdomain of the existing Replant marketing site (projectreplant.org). Pray first per `/Users/ife/replant/CLAUDE.md`, naming the specific work — this site will be how the wider church reads from the persecuted church we're building Replant for, so the prayer should hold that weight (not just "build a blog").

## What Replant is

Replant is a secure communication and prayer platform for Christian leaders globally, with a particular care for the persecuted church. The native app is in build (5-tab MVP polish in flight). The marketing site at `projectreplant.org` is static HTML — see `/Users/ife/replant/website/index.html` for the brand identity in code (CSS variables, fonts, layout patterns). The blog is a sibling surface that needs to read like it belongs to that same family.

## Before you build — confirm scope with Founder

Founder ([ruthjames08@gmail.com](mailto:ruthjames08@gmail.com)) has not specified scope. Ask her these in chat before touching code:

1. **One page or a full blog?** Is this a single landing/coming-soon page at `blog.projectreplant.org`, or a real blog with multiple posts + index + archive + RSS?
2. **Who writes?** Just Founder? Multiple authors (Replant Team)? Guest writers? Submissions from leaders in the persecuted church?
3. **Editorial frequency + voice expectations?** Weekly? Monthly? Sporadic? Long-form essays, short field updates, prayer reports, scripture meditations?
4. **CMS or in-repo?** Posts as MDX/Markdown files committed to the repo, or a headless CMS (Sanity, Contentful, Notion-as-source)? The repo path is the simplest and matches how `projectreplant.org` is already maintained.
5. **Comments / engagement?** Read-only at launch is the safest call; can be added later.
6. **Hosting?** The main site appears to be static HTML — Netlify hosting was added recently (`.netlify/` directory exists in the repo root). Confirm whether the blog should land in the same Netlify project as a subpath route OR as a separate Netlify site bound to the `blog.projectreplant.org` subdomain.

Do NOT skip these questions. The shape of the build depends on the answers. Surface them in one batched `AskUserQuestion` call.

## Brand identity (mine from existing assets — don't reinvent)

`/Users/ife/replant/website/index.html` is the authoritative brand-in-code reference. Read it before designing anything. Key tokens:

- **Palette**
  - `--sky: #6BB5E8` (accent)
  - `--sky-dim: rgba(107, 181, 232, 0.15)`
  - `--bg: #080808` (deep black)
  - `--bg2: #0f0f0f`, `--bg3: #141414`
  - `--ink: #F0EDE6` (warm white)
  - `--ink-mid: rgba(240, 237, 230, 0.45)`
  - `--ink-faint: rgba(240, 237, 230, 0.1)`
- **Fonts** (Google Fonts)
  - Serif: **Cormorant Garamond** — 300/400/600, italics 300/400 — used for headlines, scripture, editorial pull quotes
  - Sans: **DM Sans** — 300/400/500 — used for body, eyebrow labels, nav
- **Logo**: `/Users/ife/replant/assets/rp vector.svg`, `rp vector2.svg`, `design_handoff_replant_app/replant-logo.svg`
- **Voice cues from the home page**: serif headlines with italic-sky highlight on one phrase per heading; eyebrow microcopy in uppercase DM Sans tracked +0.25em; generous vertical air; subtle radial sky glow behind hero.

The blog must read as a quieter, more reading-room sibling of the marketing site. Same palette + fonts; gentler ornamentation; longer prose-friendly column width (60–72ch); slightly larger body line-height (1.7–1.85).

## Tone bars (locked across the project)

The Replant voice is consistent app + marketing + (now) blog:

- **No em dashes** in editorial copy. They flag as AI-drafted. Use commas, colons, sentence breaks, parentheses, or single hyphens with spaces ( - ) where rhythm calls for it.
- **No aesthetic-Christian prose.** No "the body is wider for your presence", no "Lord's Day" as a fashionable phrase, no inflated devotional cadence. Plain, specific, weight-bearing.
- **Scripture treatment**: italic serif (Cormorant Garamond italic), with reference + translation in small DM Sans uppercase tracked. Mirror the pattern from the marketing site's hero.
- **Vulnerable not performative.** When a post quotes a leader from the persecuted church, the quote should feel like a real person speaking, not a sermon excerpt.
- **No personal context about Founder.** She is intentionally not publicly the face of Replant. The blog speaks as "Replant" / "the Replant team", not in her first person. If a post needs an authorial byline, ask first.
- **Reference**: the existing scripture displays in the React Native app (`src/components/home/DailyScriptureStrip.tsx`) and the announcement letterhead style (`src/components/home/AnnouncementCard.tsx`) are the closest in-codebase models for editorial cadence.

## Tech stack — recommended path (confirm with Founder)

Default to **Astro** unless Founder says otherwise:

- Static-first, MDX-native, fits the marketing site's "static HTML, no JS framework" philosophy
- File-based routing → posts as `.mdx` files in `src/content/posts/`
- Built-in RSS, sitemap, image optimization, dark-mode-by-default
- Deploys cleanly to Netlify as a separate project bound to `blog.projectreplant.org`
- Edits don't require coordination with the native app's Expo/Metro build

Reasonable alternatives if she pushes back:
- **Plain HTML + a build script** if she wants the same hand-crafted feel as `projectreplant.org` and accepts manual archive index maintenance
- **11eleventy** if she wants minimal tooling but still file-based templating
- **Next.js** only if she expects to layer dynamic features (auth, comments, member-only posts) soon — overkill otherwise

Do NOT introduce a heavy CMS at v1. The 0-to-1 hosting cost should be near zero.

## Deliverable expectations for v1

Suggested phasing, assuming "full blog" not "single page":

1. **Scaffold + brand-token system** mirroring the marketing site's CSS variables; Astro project committed under `/Users/ife/replant/blog/` (separate from `/website/`)
2. **Three template surfaces**: post index (chronological), single post, "about / why we write" page
3. **One real post** drafted (with Founder; do not invent content) so the site doesn't ship empty
4. **RSS feed** at `/rss.xml`
5. **Sitemap + meta tags** (Open Graph, Twitter card, canonical URLs)
6. **Netlify deploy config** (`netlify.toml`) — but Founder owns the DNS + Netlify-project provisioning step (do not auto-create paid resources)
7. **No analytics by default** — ask before adding Plausible/GA. Persecuted-church readers may be under surveillance; the privacy posture has to be deliberate.

## Founder rules to honor

- Open every chat with prayer naming the specific work (CLAUDE.md standing rule)
- Use the engineering: skills for design (architecture, system-design) only after Founder confirms scope
- For deployment, DNS, or any action that affects the live `projectreplant.org` setup: confirm in chat before executing
- Memory at `/Users/ife/.claude/projects/-Users-ife-replant/memory/` is shared across all Replant sessions — read it on start

## Memory files worth loading on session start

In `/Users/ife/.claude/projects/-Users-ife-replant/memory/`:

- `typography_ruling.md` — scripture-italic ruling that extends to editorial quotes
- `feedback_build_philosophy.md` — build for the full end goal, never cheapen for launch
- `reference_replant_systems.md` — admin dashboard URL, mobile scheme, Supabase project ref (the blog probably does NOT need Supabase, but the architectural picture helps)
- `feedback_prayer_must_be_legitimate.md` — open with a real prayer, not "Amen."

In Jesus' name, Amen.
