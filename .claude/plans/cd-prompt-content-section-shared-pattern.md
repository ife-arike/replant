# CD BRIEF — Content Section shared pattern + per-surface applications (Announcements, Scripture, Outreach & Missions)

## Opening prayer (hard rule)

Open this work with a real intercession naming the leaders whose feeds these Content surfaces feed into — the pastor in Wenzhou who reads today's scripture in the 90 seconds before house-church prayer, the widow in Enugu who checks the announcements on her way home from market, the church planter in the Iranian diaspora who scrolls the missions feed at 2am looking for one prayer partner. Cover Ruth and her curator team — that the surfaces they build here don't drown them in scroll or bury the one leader-submitted testimony that needs their eyes today. Cover the seat of curator itself; it is the tone-setter of the app for hundreds of thousands who will read what lands here, and it deserves reverence. Cover this work in the blood of Jesus Christ. End with "In Jesus' name, Amen."

## Who you are

Senior design lead at Replant, holding the global persecuted-church endgoal as your stress-test. You design admin surfaces that curators work in for HOURS — publishing scripture, drafting announcements, reviewing leader submissions, coordinating with partner orgs. You carry [[feedback-replant-admin-copy-voice]]'s register — clinical, peer-respecting, never coddling. Words like "audit-logged" are features, not warnings. Honest about mechanism over reassurance. The curator sees dozens of drafts a week; your surfaces let her move fast without ever accidentally publishing a typo to 5,000 leaders.

## What Replant is

A secure communication platform for Christian leaders globally, including underground/persecution-zone leaders. The admin dashboard at `admin.projectreplant.org` is operated by Ruth and a small team across three tiers: `regular` (line admins), `super_admin` (middle tier — promoted from regular via two-eyes ceremony), `Manager` (top tier; display rename from `top_tier` enum). The Content section is the curator-facing surface where day-to-day content operations happen — daily scripture, announcements, and the soon-to-ship Outreach & Missions surface.

## What you're designing

**The shared Content pattern PLUS three surface applications:**

1. **The shared pattern (design once, apply to all Content surfaces)** — tabs, card collapse, multi-select, filters, publish-lock, preview, test send, duplicate, version history, pagination, submissions review queue.
2. **Announcements** — retrofitted onto the shared pattern + column reconciliation + Witness of the Day sibling tab.
3. **Daily Scripture** — retrofitted onto the shared pattern + theme + translation picker + reflection field + related-scripture linking.
4. **Outreach & Missions (NEW surface)** — Phase 1 content page using the shared pattern. Also imagine Phases 2 (partner CRM) + 3 (missions marketplace) as concept work so Phase 1 doesn't paint us into a corner.

## Files to READ before designing (critical for grounding)

**Existing Content admin surfaces — read for current state (what's being retrofitted):**

- `/Users/ife/replant-admin/src/screens/Announcements.jsx` — current announcement curator screen (card scroll, source_label + tag_type + card_type visible)
- `/Users/ife/replant-admin/src/screens/Scripture.jsx` — current daily scripture curator screen
- `/Users/ife/replant-admin/netlify/functions/post-announcement.js` — announcement POST endpoint (title/body/source_label/tag_type/card_type validation)
- `/Users/ife/replant-admin/netlify/functions/update-announcement.js` — announcement UPDATE endpoint (KAN-199 tag_type patch pattern)
- `/Users/ife/replant/supabase/migrations/20260602000000_home_comments_announcement_enrichment.sql` — author_type enum origin (admin/leader)
- `/Users/ife/replant/supabase/migrations/20260602000004_announcements_card_type_v1.sql` — card_type enum origin (standard/article/long_read/leader_word/encouragement/together/call_to_action)

**Pattern donors — read for design language + primitives to mirror:**

- `/Users/ife/replant-admin/src/screens/PastoralQueue.jsx` — the shared tab bar pattern (`q-tabs` + `q-tab.active`) + row-expand drawer + table treatment
- `/Users/ife/replant-admin/src/screens/EscalatedCases.jsx` — 4-tab admin surface + section headers + Coming Soon post-MVP stub register
- `/Users/ife/replant-admin/src/screens/ChurchManagement.jsx` — mega-dropdown filter drawer + applied-filter pills + sticky filter bar
- `/Users/ife/replant-admin/src/components/FilterPrimitives.jsx` — `FiltersTrigger`, `DropdownPanel`, `DropdownRow` primitives to reuse
- `/Users/ife/replant-admin/src/screens/Queue.jsx` — tab-count badges (`.tcount` register) — mirror for Home/Drafts/Posted tab counts
- `/Users/ife/replant-admin/src/components/Shell.jsx` — admin sidebar `NAV_SECTIONS`; the "Content" section already exists, Outreach & Missions gets added there
- `/Users/ife/replant-admin/src/styles/globals.css` — admin design tokens

**Copy voice — LOAD-BEARING:**

- Read [[feedback-replant-admin-copy-voice]] — SEC register, banned phrases, keep-when-literally-true list. Every string on every surface conforms.
- Read [[typography-ruling]] — scriptureItalic reserved for scripture / editorial / witness. All else roman.

## Locked rulings (paste-ready — inline-quoted from [[content-section-architecture]])

### Voice register (LOAD-BEARING)

> Replant admin copy is clinical, peer-respecting, never coddling. Banned phrases: "Are you sure?" / "Oops!" / "Heads up!" / "Don't worry, this can be undone" / "Please" before action verbs in CTAs / "Permanently" used loosely. Em dashes inside button labels read apologetic — avoid. Keep heavy phrases when literally true: "audit-logged" (Founder-stamped feature), "destructive" (when literally so), "cannot be undone" (when literally so). Trust curators to be competent — the confirm modal IS the "are you sure"; don't repeat the question inside it.

### Typography register

> scriptureItalic font asset reserved for scripture / editorial / witness quotes ONLY. All other copy roman. Don't italicize for emphasis or decoration on admin screens.

### Shared Content pattern (Founder-locked 2026-07-01 evening)

Every Content surface uses these primitives. Design once, apply to all three surfaces (Announcements, Scripture, Outreach & Missions) plus every future Content surface.

- **Tabs — every surface has three:** `Home` (default landing — today's + next-scheduled, curated) / `Drafts` (WIP with edit still available) / `Posted` (archive, read-only + correction affordance).
- **Card default: collapsed.** On `Home`, only today's card + next-scheduled card render expanded. All other cards collapsed. Chevron affordance click-to-expand. Same on `Posted`.
- **Multi-select** — row-level checkbox + a bulk-action bar that surfaces on selection > 0. Actions: `Delete` / `Archive` / `Publish now` / `Reschedule`. Bulk operations audit-logged per row.
- **Post-publish edit: FULL-LOCK + add-correction pattern.** Once a post is published, it is IMMUTABLE. If a correction is needed, the curator drafts a new "Correction to [Original title]" post that threads to the original via `correction_of` FK. The correction renders in the leader feed as a follow-up card. Audit log carries the correction chain. This isn't a technical limitation — it's a discipline: what leaders read yesterday, we don't retroactively rewrite.
- **Filters** — right-side filter drawer mirroring the CM mega-dropdown. Facets: State (draft/scheduled/published/archived) · Author · Date range · plus surface-specific facets (Source / Topic / Badge for Announcements; Book / Theme / Translation for Scripture). Sticky at top while scrolling.
- **Pagination: 10 per page** — for Content pages only. Other admin surfaces keep their own pagination. `Posted` supports infinite-load-on-demand for archive browsing.
- **Preview mode** — curator toggles a preview panel that renders the mobile card exactly as leaders will see it. Uses the SAME mobile card components rendered by the leader app (`AnnouncementCard`, `LeaderWordCard`, `ScriptureCard`, etc.).
- **Test send** — curator sends the post to a specific leader (usually themselves via email/account) BEFORE broadcasting. Prevents "5,000 recipients + one typo" moments. Test sends do NOT count toward analytics; they carry a `test=true` flag.
- **Duplicate / copy from existing** — curator picks an existing post as a template. New draft pre-fills title/body/source/tag from the parent. Audit records the parent post id.
- **Version history** — for DRAFTS only (pre-publish-lock). Curator can see the last N revisions of a draft before it locks. Post-lock, history freezes; corrections are separate posts.
- **Analytics per post (post-MVP)** — opens / reactions / saves per post. Not in this CD pass; leave affordance ghost in the design so a future card can slot the number in.

### Copy tone examples (paste for CD to lift):

- Publish action label: `Publish` (not `Post it!` or `Send`)
- Correction verb: `Draft a correction` (not `Edit` or `Fix`)
- Bulk-action bar: `3 selected · Delete · Archive · Publish now · Reschedule` (chip counts + verb list, no exclamation)
- Draft state pill: `Draft` (neutral gray)
- Scheduled state pill: `Scheduled · Jul 3 · 9am UTC` (calm sky)
- Published state pill: `Published Jun 30` (muted; no color)
- Publish-lock cue on Posted row (after click): `Published Jun 30 · Locked. Corrections thread to this post.`
- Empty Home state: `Nothing scheduled for today. Draft what leaders read this week.`

## Surface 1 — Announcements

### Column reconciliation (Founder-locked after DB audit 2026-07-01)

The Announcements schema already carries 4 fields that overlap around "source" + "tag" concepts. The reconciliation retires the overlap and adds a new topic column. CD's design should surface these as CLEAN concepts to the curator, not the underlying migration mess.

| Concept | Column | Type | Vocab | What it means |
|---|---|---|---|---|
| **Source** | `author_type` (extended) | dropdown enum | admin / leader / partner / blog | Who authored it. Drives approval flow. |
| **Byline** | `source_label` (kept) | free text ≤30 | e.g., "From a bishop · West Africa" | Optional display byline. Cap at 30 for card real estate. |
| **Topic** | `topic` (NEW) | dropdown enum | prayer / event / update / testimony / correction / word_from_family / … | What the post is about. Drives filter + card decoration. |
| **Badge** | `badge` (was `tag_type`, renamed + trimmed) | dropdown enum | urgent / new / none | Visual badge on the leader-side card. Small vocab. |
| **Card type** | `card_type` (unchanged) | dropdown enum | standard / article / long_read / leader_word / encouragement / together / call_to_action | Mobile rendering router. |

**Curator UX for these five fields:**

- **Source dropdown** — first thing in the editor. Selection drives which downstream fields appear + which approval flow fires. (Selecting `partner` might show a required "Partner org" field; selecting `leader` might show a leader-search field.)
- **Byline text input** — one-line, 30-char cap. Placeholder: `Optional byline — "From a pastor · Central Asia"`. Live char count.
- **Topic dropdown** — required. Pick from curated enum. Filter facet on the surface.
- **Badge dropdown** — optional, default `none`. Tiny selector.
- **Card type dropdown** — advanced (hidden behind "Show more" or below-fold). Default `standard`. Curator changes it when the content shape calls for it.

### Sibling tabs at surface level (mirrors PastoralCare pattern)

Announcements surface has TWO top-level tabs at the SAME LEVEL as the Home/Drafts/Posted workflow tabs. Structure:

```
[Content section]
  └─ Announcements  ← this admin surface
       ├─ Top-level tab:  Announcements       ← default
       │   └─ Workflow tabs: Home / Drafts / Posted
       └─ Top-level tab:  Witness of the Day
           └─ Workflow tabs: Home / Drafts / Posted
```

CD's task: design the top-level tab bar + workflow tabs in a way that reads clearly without becoming a tab-in-tab confusion. Consider using the `q-tabs` register for the workflow tabs (existing pattern) and a lighter chip-style or segmented control for the top-level tab.

### Witness of the Day — data model

Witnesses' distinct fields (name, region, era, martyrdom details, primary source) are different from announcements. Witnesses table lives in the DB per [[persecuted-365-witnesses-plan]] (seed content ready). Curator UX for a witness row is:

- **Name** (text, required)
- **Region** (multi-region dropdown, optional)
- **Era** (dropdown: pre-Constantinian / Constantinian / Medieval / Reformation / Modern / Contemporary)
- **Life dates** (year-range picker)
- **Testimony** (long-form text — the story)
- **Primary source** (text or URL)
- **Scripture reference** (optional; renders as inline chip)

Design this as its own editor, distinct from the announcement editor.

### Leader / Partner / Blog submissions review queue

Ties into [[postmvp-address-the-network-hamburger]] (top post-launch priority). When leaders/partners/blog cross-posts drop into the submissions queue, curators triage. Design a queue row that surfaces:

- Source pill (Leader / Partner / Blog)
- Author name / org
- Draft title + first line
- Submission timestamp
- Action affordances: `Approve` (publishes) · `Approve with edits` (opens the editor pre-loaded) · `Decline` (with required reason) · `Send to another curator` (routing)

The submissions queue is a sub-surface OR a filter view — CD's call. Founder open to either.

### Announcements-specific features CD designs into the pattern:

- **Rich embeds** — image upload + scripture reference auto-linking (Scripture ref detected in body → renders as tap-through chip in the leader app).
- **Recipient targeting** — segment picker (Verified only · Region multi-select · Role multi-select). Default: all leaders.
- **Push notification toggle** per post (default OFF; curator opts-in per-post).

## Surface 2 — Daily Scripture

Simpler than Announcements — no source/topic/badge reconciliation. Applies the same shared pattern. Additions:

- **Theme dropdown (NEW column)** — curated enum: Perseverance / Suffering / Joy / Boldness / Faith / Grace / Endurance / Hope / …. Curator picks per post. Filter facet on the surface.
- **Translation picker** — column `translation` already exists on `daily_scripture` (audit confirmed). Curator picks per post: KJV / ESV / NIV / NASB / NKJV / … Filter facet on the surface. Consider allowing multi-translation per date (leader-side picker: same date, multiple translations).
- **Companion reflection field** — long-form text next to the verse. Optional. Leader sees it below the reference in-app.
- **Reflection prompt** — a short "reflect on…" prompt (one line, 200 chars) leaders see under the reflection. Optional.
- **Related-scripture linking** — curator attaches 1-N related verses. Leader browses via `See related →` chip on the mobile card.

### Editor UX

- Two-column editor: verse on left, reflection + related on right.
- Scripture reference field with autocomplete (Book chapter:verse).
- Preview panel shows mobile scripture card exactly as leader sees it.

## Surface 3 — Outreach & Missions

### Phase 1 (SHIPS pre-launch)

Content page — curated outreach + missions content, same shared pattern as Announcements/Scripture. What curators post here is what leaders see on the Outreach & Missions tab in the mobile app. Row shape is similar to Announcements (title, body, source, topic, byline, card type) with mission-specific additions:

- **Mission type** — dropdown: Short-term trip / Long-term mission / Church plant / Support opportunity / Prayer coverage / Testimony
- **Location** — text or country/region picker (or "Global" or "Unspecified")
- **Duration / dates** — for trips: start + end date
- **Contact / apply URL** — how leaders express interest
- **Coordinating org** — the partner org running the opportunity (optional; ties into Phase 2)

### Phase 2 concept work (post-launch)

Design (do not build) the partner org CRM + application intake flow. Partner orgs (VOM etc.) apply to be featured on Replant. Application intake queue: like the leader submissions queue, but for org-level applications. Fields per app: org name / org profile / mission fit / contact / evidence. Curator reviews + approves → org gets `partner` badge and can start posting content.

Include mockups of:
- Application intake row (in a queue view like leader submissions)
- Partner org profile page (admin sees + edits)
- "Featured Partner" leader-side experience (short mock)

### Phase 3 concept work (post-launch)

Design (do not build) the missions marketplace. Trip listings + interest signals + prayer coverage + feedback loops. Enable curator to see:
- List of open trips (across all partner orgs)
- Interest counts + prayer coverage counts per trip
- Feedback / testimony post-trip

Include mockups of:
- Trip listing (curator view)
- Interest signal aggregation
- Prayer coverage widget

## Deliverables

**Return in the same shape as the Escalated Cases CD pack (hi-fi HTML mockups in iPhone Pro Max viewport + RN specs where mobile-side, PLUS admin browser mockups for the curator-facing side).**

1. **Shared Content pattern reference sheet** — a single mockup showing the shared primitives (tabs / card collapse / multi-select bar / filter drawer / preview panel / test send button / duplicate action / version history drawer / publish-lock cue / correction pattern / pagination footer). ONE page, curator-side.
2. **Announcements — 5 mockups:**
   - Home tab (today's + next scheduled expanded, rest collapsed)
   - Drafts tab (multi-select active, 3 rows selected, bulk-action bar visible)
   - Posted tab (publish-lock cue on one row, "Draft a correction" affordance active on another)
   - Editor screen (all 5 fields visible + preview panel toggled ON)
   - Witness of the Day sibling tab (Home view of witness cards)
3. **Announcements — Submissions review queue** — 1 mockup showing Leader / Partner / Blog submissions rows with `Approve · Approve with edits · Decline · Send to another curator` affordances.
4. **Daily Scripture — 3 mockups:**
   - Home tab (today's scripture expanded with theme/translation visible)
   - Editor screen (two-column: verse left, reflection + related right, preview toggled)
   - Filter drawer with Theme + Translation + Book facets open
5. **Outreach & Missions Phase 1 — 3 mockups:**
   - Home tab (curator view)
   - Editor for a mission listing
   - Concept: mobile leader view of the Outreach tab (how what's curated shows up)
6. **Outreach & Missions Phase 2 concept — 2 mockups:**
   - Partner application intake queue row
   - Partner org profile (admin edit)
7. **Outreach & Missions Phase 3 concept — 1 mockup:**
   - Trip listing with interest + prayer coverage indicators

**Total deliverable: ~15 mockups + 1 pattern reference sheet.** Not every mockup is a novel screen — many are the same shell with different content, which reinforces the "design once" thesis.

### Format conventions for CD returns

- Hi-fi HTML files in iPhone Pro Max viewport dimensions where the mock includes mobile-side (leader) rendering.
- Admin surfaces at desktop viewport (curator browser).
- CSS variables from `globals.css` — don't invent new tokens.
- Copy tone locked to admin voice register above.
- Every mockup includes a footer note: `Field / column mapping` — which DB columns each visible field corresponds to. Grounds implementation.

## Constraints — do NOT design

- Post-publish edit UI (LOCKED behavior; only "Draft a correction" affordance renders on posted rows)
- Any new data tokens or CSS colors (use `--rp-amber`, `--rp-red`, `--rp-sky`, `--rp-muted-*`, etc.)
- Localization / i18n picker (post-MVP)
- Analytics widgets (post-MVP; ghost slot only)
- Comment moderation (out of scope for this pass)
- Sub-account permissions per surface (out of scope; three-tier admin gates apply as-is)

## Open questions to CD (surface in your review, don't guess)

1. **Top-level tab bar visual** — segmented control vs pill row vs q-tabs. Which one reads clearest when nested with the Home/Drafts/Posted workflow tabs?
2. **Preview panel placement** — right-side slide-in vs modal vs bottom sheet. Which balances "always-available" with "not-in-the-way"?
3. **Filter drawer facet order** — State first (as the workflow anchor) vs Source first (as the categorical anchor). Consistency across all 3 surfaces.
4. **Correction pattern surface** — where does the correction affordance live on the Posted row? Inline button, or in the row's expand drawer?
5. **Submissions review queue placement** — is it a sub-nav under Announcements, or its own top-level under Content section?

## Related memories (context for CD)

- [[content-section-architecture]] — full locked architecture spec (this brief is derived from it)
- [[postmvp-address-the-network-hamburger]] — leader submissions workflow (Announcements submissions review queue)
- [[future-word-from-family]] — Word from Family tag context
- [[persecuted-365-witnesses-plan]] — witness of the day seed content plan
- [[feedback-replant-admin-copy-voice]] — copy voice register (LOAD-BEARING)
- [[typography-ruling]] — scriptureItalic use rules

---

In Jesus' name, Amen.
