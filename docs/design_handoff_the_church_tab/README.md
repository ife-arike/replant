# The Church Tab — Design Handoff

Hi-fi prototype for The Church tab of Replant. iPhone 16 Pro Max viewport.
Open `Replant - The Church Tab.html` in any modern browser.

## What's in the box

- **CAML** (At My Location) — flat map with own-church marker, RAG dots, cluster, drag-to-pan (capped at 50 km), pull-up list with RPL Network IDs.
- **CAL** (At Large) — slow-rotating globe with orthographic projection, red-only pulse, regional slide-out panel, Global Prayer Wall pull-up.
- **Church Profile Bottom Sheet** — three sections (Identity / Posture / Contact), supports up to 2 leaders with per-leader anonymous flag, RPL ID, EAP chips, sticky action bar (Connect, Pray, Save, Share, Report).
- **My Church Profile** — same sheet from the leader's side, with inline visibility toggle and Edit CTA.
- **Profile Completion Flow** — 3 steps (Review · Optional details · Contact visibility), skippable.
- **First-time Tutorial** — 5-step coachmark overlay (auto-switches pages, spotlights the relevant element).
- **States** — Loading skeleton, Error w/ retry, Unverified gate, "first here" empty state (3 tones), Underground acknowledgment.
- **Modals + toasts** — Connect confirmation, Visibility change, "Added to your intercession list", etc.

## Tweaks panel (bottom-right toggle)

Used to navigate all states + style variants without separate files. Try:
- **View** — Normal · First-time tutorial · Empty CAML · Loading · Error · Unverified · Profile Completion
- **Marker style** — Dot / Ringed / Glow
- **Pulse speed** — slider
- **List density** — Cozy / Compact
- **Section header style** — Mono eyebrow / Serif italic / Mono ruled
- **Empty-state tone** — Pastoral / Scripture / Quiet

The tutorial demo state is wired to a `tutorial` flag; in production the host
sets this on first land after verification, then unsets it on complete/skip.

## File structure

```
Replant - The Church Tab.html         # main entry — open this
church-tab/
├── app.jsx                           # orchestration + Tweaks wiring
├── caml.jsx                          # CAML map + sheet + pan
├── globe.jsx                         # CAL globe + regional panel
├── sheets.jsx                        # profile sheet + prayer pull-up
├── completion.jsx                    # 3-step profile flow
├── tutorial.jsx                      # coachmark overlay
├── states.jsx                        # loading / error / gate / modals / toast
├── data.jsx                          # mock data (own, nearby, global, prayers)
├── styles.css                        # all CSS, brand vocabulary preserved
├── tweaks-panel.jsx                  # tweak control kit (vendored)
└── ios-frame.jsx                     # iOS frame helpers (unused — frame inlined)
```

## Key design decisions worth flagging

- **Page transition** — Cross-fade between CAML/CAL rather than a slide. The horizon line at the top still lengthens to convey the journey. A slide animation interacted badly with the long content; the horizon carries the spatial metaphor without the body slide.
- **Underground churches** are never on map or list. They surface only as: `+ 18` honor block in the CAML pull-up tail, `+18 hidden` in the CAL count chip and header subtitle, and one "a region we cannot name" intercession on the Prayer Wall.
- **RPL Network IDs** — visible in the list row (replacing the RAG label, since the colored dot conveys it), in the profile sheet head as a mono pill, and inline in prayer items. Format: `RPL-00128`.
- **Two-leader display** — list rows show short form (`Pastor Ife · Minister Daniel`); profile sheet stacks them with sky role pills and full names. Anon leaders show a muted role pill + "Name withheld" in italic serif.
- **Marker styles** — three options exposed in Tweaks. Default is **Glow**. The leader's own-church marker is always distinguished (sky halo + sky cross-fill) regardless of the global marker style.
- **Connect action** confirms with a modal (`Send a connection request to [Name] at [Church]?`). Asked because the prior pass was ambiguous on this — happy to switch to one-tap-with-undo if Ife prefers.
- **Underground tab/flow** is out of scope here per the brief — they'll never see this tab. Just wanted to make sure they're honored from the other side.

## Production notes for engineers

- The pan-to-explore on CAML is a stylized prototype of the Mapbox interaction — real implementation just uses `@rnmapbox/maps` with `maxBounds` set to a 50 km square around the leader's coords.
- The globe is SVG orthographic projection with hand-sketched continent polylines — Mapbox globe projection will replace this entirely. Per-dot pulse animation should still be limited to red markers (perf note from the brief).
- All "contact details" displays guard on `church.show_contact_on_profile`. Phone is never displayed (data layer should also enforce this).
- Anonymous leader display: `leader.anon === true` → render role pill only + "Name withheld" placeholder. Never expose the underlying name field if anon is true.
- RPL ID format is `RPL-NNNNN` (5-digit zero-padded); already in data layer.

## Open questions for product

1. Should "Pray for this church" maintain a running list users can revisit (intercession journal), or is it write-only?
2. Cluster expansion behavior — current prototype routes cluster taps to the Regional Slide-Out. Real expected behavior?
3. The Connect confirm modal — keep, or switch to one-tap with undo toast?
4. Tutorial timing — fire on first verified land, or also after profile completion flow finishes?
