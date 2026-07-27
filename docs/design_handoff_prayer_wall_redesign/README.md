# Replant — Prayer Wall Redesign · RN Spec

## Overview
Redesigned Prayer Wall tab with pill-based horizontal navigation. Six surfaces: **Feed**, **Testimonies**, **My Prayers**, **Revelation** (new), **Locations** (coming soon).

---

## Global Tokens

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--black` | `#080808` | Screen background |
| `--surface` | `#121214` | Card backgrounds |
| `--surface2` | `#18181B` | Elevated surfaces, menus |
| `--surface3` | `#1F1F23` | Menu hover states |
| `--off-white` | `#F0EDE6` | Primary headings |
| `--cream` | `#E6E1D5` | Body/verse text |
| `--muted` | `rgba(240,237,230,0.55)` | Secondary text |
| `--muted-2` | `rgba(240,237,230,0.32)` | Tertiary text |
| `--faint` | `rgba(240,237,230,0.08)` | Borders, dividers |
| `--faint-2` | `rgba(240,237,230,0.14)` | Active borders |
| `--sky` | `#6BB5E8` | Primary accent (links, active pills, CTAs) |
| `--sky-mid` | `rgba(107,181,232,0.35)` | Active borders |
| `--sky-dim` | `rgba(107,181,232,0.12)` | Active pill background |
| `--red` | `#D9594F` | Persecuted accent, delete actions |
| `--green` | `#6B9E7A` | Testimony accent, Rejoice action |
| `--green-mid` | `rgba(107,158,122,0.35)` | Green borders |
| `--green-dim` | `rgba(107,158,122,0.12)` | Green backgrounds |

### Typography
| Role | Family | Weight | Size | Letter-spacing | Transform |
|------|--------|--------|------|---------------|-----------|
| Scripture / verse | Cormorant Garamond | 300 italic | 15–22px | 0.01em | — |
| Section title (serif) | Cormorant Garamond | 400 | 17–26px | 0.01–0.02em | — |
| Body text | DM Sans | 400 | 12–13px | 0.01em | — |
| Button label | DM Sans | 500 | 11.5px | 0.14em | uppercase |
| Eyebrow / chip / mono | DM Mono | 400 | 8.5–10px | 0.16–0.28em | uppercase |
| Mono bold (numbers) | DM Mono | 500 | 9–10px | 0.14–0.18em | uppercase |

### Motion
| Transition | Duration | Easing |
|-----------|----------|--------|
| Pill switch | 200ms | `cubic-bezier(.3,.7,.4,1)` |
| Panel / screen transition | 300ms | `cubic-bezier(.3,.7,.4,1)` |
| Hover states | 150ms | ease |
| Live dot pulse | 2000ms | ease-in-out infinite |

---

## Layout — iPhone Pro Max

- **Device**: 430×932pt native (rendered at 402×874px in mockup)
- **Safe area top**: 56px (status bar + dynamic island)
- **Safe area bottom**: 34px (home indicator)
- **Content padding**: 22px horizontal throughout
- **Tab bar height**: ~62px (10px top padding + content + 28px bottom for home indicator)

---

## Pill Navigation Bar

| Property | Value |
|----------|-------|
| Container padding | 12px 0 14px (inside 22px horizontal screen padding) |
| Bottom border | 0.5px solid `--faint` |
| Pill gap | 6px |
| Overflow | horizontal scroll, hidden scrollbar |
| **Pill (inactive)** | |
| Font | DM Mono 400, 10px, ls: 0.18em, uppercase |
| Padding | 7px 14px |
| Border radius | 100px (full pill) |
| Border | 0.5px solid `--faint` |
| Color | `--muted` |
| Background | transparent |
| **Pill (active)** | |
| Color | `--sky` |
| Border | 0.5px solid `--sky-mid` |
| Background | `--sky-dim` |

**Pill order**: Feed → Testimonies → My Prayers → Revelation → Locations

---

## Screen 1: Feed (Default)

### Make Intercession Hero Card
| Property | Value |
|----------|-------|
| Margin | 8px 0 20px |
| Padding | 24px 22px |
| Background | `linear-gradient(180deg, rgba(107,181,232,0.04), --surface)` |
| Border | 0.5px solid `--sky-mid` |
| Border radius | 10px |
| Eyebrow | DM Mono 400, 9px, ls: 0.28em, `--sky` |
| Title | Cormorant Garamond 400, 24px, `--off-white` |
| Subtitle | DM Sans 400, 13px, `--muted` |
| CTA button | Full-width, 12px 16px padding, `--sky` bg, `--black` text, radius 6px |

### Prayer Preview Row
| Property | Value |
|----------|-------|
| Padding | 11px 12px |
| Background | `rgba(8,8,8,0.45)` |
| Border | 0.5px solid `--faint`, radius 6px |
| Gap | 10px (dot to body) |
| Dot | 5px circle, `--sky`, `box-shadow: 0 0 5px --sky` |
| Text | Cormorant Garamond 300 italic, 14.5px, `--cream`, single-line ellipsis |
| Meta | DM Mono 400, 8.5px, ls: 0.16em, `--muted` |

### Receive Intercession (Locked)
| Property | Value |
|----------|-------|
| Padding | 16px 18px |
| Background | `--surface` |
| Border | 0.5px solid `--faint`, radius 10px |
| Layout | flex row, gap 14px |
| Lock glyph | 32px circle, `--surface2` bg, `--faint-2` border |
| Title | Cormorant Garamond 400, 17px |
| Badge | DM Mono 400, 8.5px, ls: 0.18em, pill shape |

### Testimony Carousel
| Property | Value |
|----------|-------|
| Scroll | horizontal snap, `scroll-snap-type: x mandatory` |
| Card width | `calc(100% - 44px)`, snap: center |
| Card gap | 14px |
| Card left border | 2px solid `--sky` |
| Scroll dots | 22×3px bars, 6px gap, active = `--sky` |

---

## Screen 2: Testimonies

### Scripture Banner (bare, no card)
| Property | Value |
|----------|-------|
| Margin | 12px 0 22px |
| Eyebrow | DM Mono 400, 9px, ls: 0.24em, `--green` |
| Verse | Cormorant Garamond 300 italic, 16px, `--cream`, max-width 300px |

### Testimony Card (green variant)
| Property | Value |
|----------|-------|
| Background | `--surface` |
| Border | 0.5px solid `--faint` |
| Left border | 2px solid `--green` |
| Border radius | 0 8px 8px 0 |
| Padding | 16px 18px |
| Card gap (list) | 14px |
| Head | DM Mono 400, 9px, ls: 0.18em, `--green` |
| Dot | 6px circle, `--green` |
| Leader | DM Sans 400, 12px, `--muted` |
| Text | Cormorant Garamond 300 italic, 15.5px, `--cream` |
| Rejoice action | `--green`, DM Mono 8.5px, shofar icon 28×28px |
| Count | DM Mono 8.5px, `--muted` |

### Pagination
| Property | Value |
|----------|-------|
| Page dot | 28px circle, DM Mono 10px |
| Active | `--green` text, `--green-mid` border, `--green-dim` bg |

---

## Screen 3: My Prayers

### Header
| Property | Value |
|----------|-------|
| Title | Cormorant Garamond 400, 20px, `--off-white` |
| Sub | DM Mono 400, 9px, ls: 0.18em, `--muted` |

### Prayer Card
| Property | Value |
|----------|-------|
| Padding | 16px 0 |
| Divider | 0.5px solid `--faint` |
| Dot | 5px circle, `--sky` with glow |
| Text | Cormorant Garamond 300 italic, 15.5px, `--cream` |
| Meta | DM Mono 400, 9px, ls: 0.16em, `--muted` |
| Interceding count | `--sky` |

### Overflow Menu
| Property | Value |
|----------|-------|
| Background | `--surface2` |
| Border | 0.5px solid `--faint-2`, radius 8px |
| Shadow | `0 8px 24px rgba(0,0,0,0.4)` |
| Min width | 160px |
| Item padding | 10px 14px |
| "Mark as Praise" | `--sky` |
| "Delete" | `--red` |

---

## Screen 4: Revelation — Archetype List

### Intro
| Property | Value |
|----------|-------|
| Eyebrow | DM Mono 400, 9px, ls: 0.24em, `--sky` |
| Body | Cormorant Garamond 300 italic, 15px, `--cream` |

### Archetype Card
| Property | Value |
|----------|-------|
| Background | `--surface` |
| Border | 0.5px solid `--faint`, radius 8px |
| Padding | 18px 18px 16px |
| Gap (list) | 10px |
| Layout | flex row: number + body + chevron, gap 14px |
| Number | DM Mono 400, 9px, ls: 0.18em, `--muted-2` |
| Condition | Cormorant Garamond 400, 20px, `--off-white` |
| City | DM Mono 400, 9px, ls: 0.18em, `--muted` |
| Brief | DM Sans 400, 13px, `--muted` |
| Reference | DM Mono 400, 8.5px, ls: 0.18em, `--sky` |
| Voices count | DM Mono 400, 8px, ls: 0.14em, `--muted` |
| **Affirming (Philadelphia)** | left border 2px `--sky` |
| **Links out (Smyrna)** | left border 2px `--red`, chevron `--red` |

---

## Screen 5: Revelation — Archetype Detail (Lukewarm/Laodicea)

### Detail Header
| Property | Value |
|----------|-------|
| Back row | DM Mono 400, 9.5px, ls: 0.22em, `--muted`, chevron `--sky` |
| Condition | Cormorant Garamond 300, 30px, `--off-white` |
| City | DM Sans 400, 14px, `--muted` |
| Reference | DM Mono 400, 9.5px, ls: 0.22em, `--sky` |

### Scripture Sections
| Property | Value |
|----------|-------|
| Section gap | 24px margin-bottom + 24px padding-bottom |
| Divider | 0.5px solid `--faint` |
| Label | DM Mono 400, 9px, ls: 0.22em, `--sky` |
| Verse text | Cormorant Garamond 300 italic, 16px, `--cream` |

### Promise Card (elevated)
| Property | Value |
|----------|-------|
| Background | `linear-gradient(135deg, --surface, rgba(107,181,232,0.04))` |
| Border | 0.5px solid `--sky-mid`, radius 10px |
| Padding | 20px 18px |

### Compose Prompt ("Speak to the church here…")
| Property | Value |
|----------|-------|
| Padding | 14px 16px |
| Background | `--surface` |
| Border | 0.5px dashed `--sky-mid`, radius 8px |
| Font | Cormorant Garamond 300 italic, 14px, `--muted` |
| Icon | 14px, `--sky` |

### Type Selector Chips
| Property | Value |
|----------|-------|
| Font | DM Mono 400, 8.5px, ls: 0.16em |
| Padding | 5px 10px |
| Border | 0.5px solid `--faint`, radius 100px |
| Color | `--muted-2` |

### Leader Insight Card
| Property | Value |
|----------|-------|
| Background | `--surface` |
| Border | 0.5px solid `--faint`, left 2px `--sky` |
| Border radius | 0 8px 8px 0 |
| Padding | 14px 16px |
| Type badge | DM Mono 400, 7.5px, ls: 0.2em, pill shape |
| — Warning | `--red` text, `--red-mid` border |
| — Prophecy | `--sky` text, `--sky-mid` border |
| — Scripture | `--cream` text, `--faint-2` border |
| — Commentary | `--muted` text, `--faint` border |
| Leader name | DM Mono 500, 9px, `--sky` |
| Location | DM Mono 400, 9px, `--muted` |
| Time | DM Mono 400, 9px, `--muted-2` |
| Text | Cormorant Garamond 300 italic, 15px, `--cream` |

---

## Screen 6: Locations (Coming Soon)

| Property | Value |
|----------|-------|
| Container | dashed border `--faint-2`, radius 10px, `rgba(8,8,8,0.4)` bg |
| Padding | 60px 24px 50px |
| Title | Cormorant Garamond 400, 22px, `--off-white` |
| Badge | DM Mono 400, 9px, ls: 0.22em, `--muted-2` |
| Body | DM Sans 400, 13px, `--muted`, max-width 260px |
| Scripture | Cormorant Garamond 300 italic, 14px, `--cream` |
| Reference | DM Mono 400, 8.5px, ls: 0.22em, `--muted-2` |

---

## Assets
- `rejoice-icon.png` — Shofar icon for Rejoice action (render at 28×28px, green `#6B9E7A`)

## Notes
- All screens share bottom tab bar (5 tabs: Home, The Church, Persecuted, Prayer, Connect)
- Prayer tab is active (index 3), accent `--sky`
- Revelation detail is a push navigation from within the Revelation pill — back button returns to list
- Smyrna (Persecuted archetype) links out to the Persecuted tab rather than opening a detail view
