# The Church Tab — Design Handoff (v3)

Hi-fi prototype for The Church tab of Replant. iPhone 16 Pro Max viewport.
Open `Replant - The Church Tab.html` in any modern browser.

## What's new in v3

| Surface | Change |
|---|---|
| CAML cluster tap | Now zooms in (~2.4×) on the cluster center and breaks it apart into 5 individual pins (Option A). A "Back to area view" pill appears at the top to reset. The Regional Slide-Out is no longer triggered by cluster taps — it's reserved for labeled-region entry points. |
| CAML map drag | Now bounded by `±50%` of the canvas (≈ 50 km radius in this stylized space). Hint pill: rest → "Drag to explore · up to 50 km", mid-drag → "X km from home", at-limit → "50 km — the edge of your local view" (amber). The sky-target chip in the filter row recenters & resets zoom. |
| CAL globe rotation | Pauses on touch / drag / wheel zoom. After ~3.5s of stillness, a subtle "Resuming" cue chip appears at the bottom of the globe (sky-tinted, rotating refresh glyph) for 600ms, then rotation gently resumes. Drag manually pans longitude. |
| CAL globe zoom | Wheel (trackpad pinch) and two-finger touch pinch both work. Globe scales `1.0×–2.4×`. Above 1.9× a "Regional view · Reset" pill replaces the percent readout to signal transition into a denser, regional zoom level. In production this would hand off to Mapbox's globe→flat transition. |
| Profile sheet head | Padded the rag-pill / RPL-pill row away from the close button so the X never touches the RPL ID. |

Everything else from v1/v2 carries forward — two-leader display, RPL Network IDs in lists / cards / prayer items, underground honor block, first-time tutorial overlay, profile completion flow, error/loading/unverified states.

## Files

```
Replant - The Church Tab.html   # entry point
church-tab/
├── app.jsx                     # orchestration + Tweaks wiring
├── caml.jsx                    # CAML map · drag · cluster zoom-expand · phantom pins
├── globe.jsx                   # CAL globe · pause/resume/zoom · regional pill
├── sheets.jsx                  # profile sheet + global prayer wall
├── completion.jsx              # 3-step profile flow
├── tutorial.jsx                # first-time coachmark overlay
├── states.jsx                  # loading / error / gate / modals / toast
├── data.jsx                    # mock data (own, nearby, global, prayers, counts)
├── styles.css                  # all CSS, v4-brand vocabulary preserved
└── tweaks-panel.jsx            # tweak control kit (vendored)
```

## Tweaks panel (bottom-right toggle)

- **View** — Normal · First-time tutorial · Empty CAML · Loading · Error · Unverified · Profile Completion
- **Marker style** — Dot / Ringed / Glow
- **Pulse speed** — slider (red dot pulse cycle, seconds)
- **List density** — Cozy / Compact
- **Section header style** — Mono eyebrow / Serif italic / Mono ruled
- **Empty-state tone** — Pastoral / Scripture / Quiet

## Interaction contracts (for engineering)

### CAML cluster (Option A behavior)

```
on cluster tap
  zoom to cluster center @ 2.4× (or whatever break-apart level Mapbox picks)
  pan-and-center so cluster lands at viewport middle
  reveal individual church pins from the cluster
  show "Back to area view" pill at top of map

on "Back to area view" tap
  zoom out to 1×, pan to (0,0), full nearby pins return
```

### CAML map pan

```
limit: 50 km radius from home (mapBounds in Mapbox)
recenter chip:
  position 0,0
  zoom 1×
  hide cluster expansion
your-church marker:
  always rendered; tapping opens My Church Profile (NOT the recenter chip)
```

### CAL globe

```
on pointerdown anywhere on globe:
  setPaused(true), clear resume timer
on pointermove (single finger / mouse):
  rotate longitude by dx
on pointerup:
  start 3.5s timer
  after timer: show "Resuming" cue (600ms), then setPaused(false)

on wheel / two-finger pinch:
  setPaused(true), update zoom (clamped 1.0–2.4)
  on pinch end: same 3.5s resume timer

zoom > 1.9 → show "Regional view · Reset" instead of percent
"Reset" pill snaps zoom back to 1.0
```

### Two-leader display

```
leaders: [
  { role, name, anon: boolean },
  { role, name, anon: boolean }?     // up to 2
]

list row short form:
  named  → "{Role} {LastName}"
  anon   → "{Role}"
  joined with " · "  (e.g. "Pastor Ife · Minister Daniel")

profile sheet head stack:
  for each leader:
    [role pill — sky tint]  {name}
  anon:
    [role pill — muted gray]  "Name withheld" (italic serif)
```

### Tutorial timing

Fires once, after the leader has fully landed on The Church tab with no gates
and no flows open. Specifically: verified, Profile Completion Flow completed
or skipped, no modals open. If they skip the Completion Flow it still fires
on that first clean land. Never re-fires (`church_tab_tutorial_seen=true`).

### Connect confirmation

Modal confirmation (kept as designed). `Send a connection request to {targetLabel}?`
where targetLabel picks the first non-anon leader, falling back to the first
leader's role + church name. Confirm → toast "Connection request sent".

### Underground

- Never on map, never on globe, never in list, never in regional panel.
- Counted in `COUNTS.underground` (currently 18).
- Surfaces only as: CAML pull-up tail block, CAL count chip (`+18 hidden`),
  CAL header subtitle, one curated "a region we cannot name" entry in the
  Global Prayer Wall (`rpl: null`).

## Production notes

- The pan-to-explore + cluster zoom on CAML are stylized prototypes of the
  Mapbox interaction; ship with `@rnmapbox/maps` configured with
  `maxBounds` ≈ 50 km square + native cluster expansion on tap.
- Globe SVG orthographic projection + hand-sketched continent polylines will
  be replaced wholesale by the Mapbox globe projection. The pause-on-touch /
  resume-after-3.5s / 600ms cue is the canonical motion contract — please
  preserve it in the real implementation.
- Per-dot pulse stays scoped to red markers only (`rag === 'r'`).
- Phone contact field is never rendered even when `show_contact_on_profile`
  is true — only email + address.

## What's still open

- Auto-rotation resume cue: built a subtle rotating refresh glyph as a default,
  but I'm open to a different cue if Ife wants to try a few options.
- Cluster expansion (CAL): the prototype assumes Mapbox-native clustering at
  globe scale; haven't fabricated a discrete cluster pin on the globe because
  individual dots already separate at the zoomed-in level.
- Tutorial body copy is provisional — happy to iterate on language with you.
