# Registration Entry — Branch · Underground · Para-ministry

CD pass for three changes that ship in one batch on the church-registration
entry point (ASP2 → RegisterIntro → RegCP1 → RegCP2 → ASP2 bypass). Builds on
the existing Replant theme tokens — **no new colors, fonts, or spacing values
introduced**.

**Founder rulings source:** 2026-06-18 sequencing call + CD review session.
**Related plans:** `.claude/plans/branch-flow.md`, `.claude/plans/para-ministry.md`.

## Files

```
design_handoff_branch_para_underground/
├── README.md                        # this file
├── source/
│   ├── RegisterIntroScreen.tsx      # NEW — "How are you registering?" 3-tile chooser
│   ├── ParentChurchPicker.tsx       # NEW — RPL ID / name parent lookup component
│   └── displayHelpers.changes.ts    # CHURCH_TYPES + is_headquarters + para copy swap
└── preview/
    └── index.html                   # standalone interactive CD doc (all sections, live)
```

> The **preview** is the source of truth for visual + interaction intent. Every
> phone in it is interactive — open the sheets, tap the tiles, search a parent,
> toggle the Tweaks panel. The `source/*.tsx` files are RN spec scaffolds: the
> component breakdown, prop shape, and copy are the contract; routing and
> mutations follow the codebase's existing onboarding patterns.

## Fidelity

**High fidelity for tokens and copy. Structural-spec for layout.** Hex values,
font families, weights, and spacing all reference `Colors`, `Typography`,
`Spacing`, `Radius` from `constants/theme.ts` — do not hardcode anything.

---

## The three changes

### 1 · Underground leaves the form entirely

Underground is **removed from the church-type dropdown AND from the standalone
RegCP1 form**. It becomes a **third entry tile** on a new "How are you
registering?" chooser (`RegisterIntroScreen`), a peer of Standalone and Church
branch. Tapping it routes to the dedicated, secure underground flow (the
existing underground RegCP1 behavior: private-name notice, hidden city/address,
RAG locked Red, "Submit Church" CTA).

- The `'underground'` enum value is **unchanged** — BE still accepts it. Only
  the registration *entry point* moved.
- This is the FE entry-point change only. The full underground signup split
  (brave/safe toggle, RPL-ID identifier, threat-model copy) remains its own
  scheduled workstream — this batch just gives it a clean front door.

### 2 · Church branch gets a real parent identity

A leader registering a **Church branch** identifies the parent church via
`ParentChurchPicker` (RPL ID lookup OR search-by-name). Selection writes
`OnboardingContext.branchOfChurchId`, threaded through `register-church` (validate)
and `create-account` (atomic insert with `branch_of_church_id` FK).

- **Entry pattern: Option A (Founder pick).** Branch is a dedicated tile on the
  chooser; the branch RegCP1 **hides the type picker** (we already know it's a
  branch) and leads with the parent-picker. (Option B — inline in the dropdown —
  is documented in the preview as the lighter alternative but was not selected.)
- Branch carries its **own leader-cap** (not counted against the parent's) and
  its **own 30-day verification clock** — no exemption based on parent status.
- Branches may attach to **unverified (pending) parents**.
- **Deferred parent (NEW — see Open Questions):** if the parent isn't on Replant
  yet, the leader can still register the branch now and link later.

### 3 · Para-ministry — the non-congregational bucket

New `para_ministry` church type for Christian orgs that aren't local churches
(missions, training, media, campus, counseling, relief & development, advocacy).

- **Label: "Para-ministry / Organization."** A tap-reveal ⓘ pill on that dropdown
  row toggles the scope tooltip (it is hidden by default, not always-on).
- When selected, RegCP1 copy swaps **Church → Organization** (eyebrow "Register
  Organization", "Organization Name", "Organization Type", "Organization Size").
- RAG status is **not** shown for para. Branch attachment is **blocked** (para
  can't be a branch, and can't be a parent).

### Plus: Headquarters is a flag, not a type

**Removed `headquarters` as a church type.** Any church (Main Campus, Ministry,
etc.) can also be a headquarters, so it's a boolean **`is_headquarters`** flag —
a "Mark as Headquarters" checkbox under the type picker. Surfaces as a blue
**HQ** badge on the expanded church card in the Replant network (and on HQ
parents in the picker results).

---

## Screen-by-screen changes

| Surface | Before | After |
|---|---|---|
| **ASP2 "Register Yours"** | Routes straight to RegCP1. | Routes to new `RegisterIntroScreen` chooser first. |
| **RegisterIntroScreen** (NEW) | — | Three tiles: **Standalone church** → standard RegCP1; **Church branch** → branch RegCP1 (parent-picker first, type picker hidden); **Underground church** → secure underground flow. Back returns here. |
| **RegCP1 type dropdown** | 6 types incl. `Church (Branch)` + `Underground`. | Standalone picker = 5 types: Main Campus, House Church, Ministry, Church Without Walls, **Para-ministry / Organization**. `branch` excluded (own tile); `underground` removed; `headquarters` is not a type. Label `branch` → **"Church branch"**. |
| **RegCP1 — HQ** | — | **Mark as Headquarters** checkbox appears under the picker once a (non-para) type is chosen. Sets `is_headquarters`. |
| **RegCP1 — branch path** | Same fields as a standalone. | Eyebrow "Register Church branch · 1 of 2", title "Branch Details". Name field → **"Your Branch Name"** + helper. `ParentChurchPicker` replaces type/location fields. Parent banner once selected. |
| **RegCP1 — para path** | — | Church → Organization copy swap; no RAG; no branch attach. |
| **RegCP1 — address** | Optional. | **Required for Church branch and Main Campus** (see Required-fields note). |
| **ASP2 bypass card** | Generic "Ready to Register" + name + type · city. | Branch variant adds **"Church branch of [Parent] · [City] · RPL ID"** attribution row; status row notes the branch's own 30-day clock. |

---

## `ParentChurchPicker` — states

1. **idle** — empty field, no output.
2. **results** — name-match list: name + HQ badge (if parent is HQ) + verification
   badge; meta line = type · city · country · RPL ID.
3. **empty** — "No churches found" dashed card (name search, no match).
4. **rplMiss** — inline error → "search by name instead" (RPL lookup, no match).
5. **selected** — parent card + verification row + **Change**.
6. **deferred** — parent not on Replant yet → amber "Parent to be linked" card;
   branch registers now, links later.

**Layout (CD-tweakable):** segmented `By RPL ID | By name` (default) or stacked
radio cards. Disambiguator order for same-name matches: **Type, City, Country,
RPL ID**, then verification badge.

---

## Backend contracts (from branch-flow.md / para-ministry.md)

| Layer | Change |
|---|---|
| **Schema** | `ALTER TABLE churches ADD COLUMN branch_of_church_id uuid NULL REFERENCES churches(id) ON DELETE RESTRICT` + CHECK `(type='branch') = (branch_of_church_id IS NOT NULL)` + BEFORE INSERT/UPDATE trigger (no nesting; no para/underground parent). `ALTER TYPE church_type ADD VALUE 'para_ministry'`. **NEW: `ADD COLUMN is_headquarters boolean NOT NULL DEFAULT false`.** |
| **RPC** | `find_church_by_rpl_id(p_rpl_id)` — one row or zero, excludes `branch`/`para_ministry`/`underground`; `anon` grant + rate limit (SEC). `find_parentable_churches(p_query)` (or a flag on existing search). `create_account_atomic` gains `p_branch_of_church_id uuid DEFAULT NULL`. |
| **register-church v8** | Accepts `branchOfChurchId`; validates parent exists + eligible; rejects `branchOfChurchId` when `type='para_ministry'`; skips `find_similar_churches` for branches (already in v7). |
| **create-account v7** | Accepts `branchOfChurchId`; passes to RPC. Error map: `parent_not_found` (400), `parent_not_eligible` (400), `LEADER_CAP_EXCEEDED` (409). |
| **Welcome email** | Branch = standard `pending_church` kind, 30-day clock (branch's own status; no parent-status read). |
| **Branch display name** | Leader types the branch's own name; system **auto-appends `— [City]`** server-side to distinguish. Parent attribution line is composed at display time from `branch_of_church_id` — not baked into `name`. |

---

## Design tokens used

All from `constants/theme.ts`. No additions.

| Token | Value | Use |
|---|---|---|
| `Colors.background` | `#080808` | Page / phone bg |
| `Colors.surface` | `#111111` | Inputs, pickers, tiles |
| `Colors.surfaceElevated` | `#181818` | Sheets, modals |
| `Colors.accent` | `#6BB5E8` | Interactive, HQ badge, branch accents |
| `Colors.text` | `#F0EDE6` | Primary text |
| `Colors.textMuted` | `rgba(240,237,230,0.45)` | Secondary text |
| `Colors.amber` | `#D4A855` | Pending, deferred-parent |
| `Colors.green` | `#5BAD7A` | Verified |
| `Colors.red` | `#E05555` | Underground accents, RAG Red |
| `Typography.display` (Cormorant 600) | Titles, sheet titles |
| `Typography.displayMedium` (Cormorant 500) | Names, tile titles |
| `Typography.body` / `bodyMedium` (DM Sans) | Body, labels |
| `Typography.mono` (DM Mono) | Eyebrows, RPL IDs, badges |
| `Spacing.sm/md/lg/xl` | 8 / 16 / 24 / 32 | — |
| `Radius.md/lg/xl` | 8 / 12 / 20 | — |

---

## Open questions for the SME panel

1. **Deferred parent (DBA + BE) — diverges from `branch-flow.md` §3.1.** That plan
   makes `branch_of_church_id` `NOT NULL` under a `branch ⇔ has parent` CHECK.
   Supporting "register now, link later" needs one of: **(a)** nullable FK + a
   `pending_parent` holding state with an auto-link step when the parent joins;
   or **(b)** a lightweight "claimed parent" record (the name + city the leader
   typed) that resolves to a real FK later. Founder asked for this path; needs a
   ruling before the schema lands.
2. **`is_headquarters` (DBA + ADMIN).** New boolean column. Confirm no type-list
   CHECK collisions; decide whether admin verification surfaces filter/sort on it.
3. **Required fields (BA) — build later.** Address is required for **Church branch**
   and **Main Campus**. Logged so the required/optional validation pass doesn't
   miss it (field validation is being handled last).
4. **Branch switch-modal copy (CONTENT).** Branch-specific variant chosen: deletes
   the Church branch **and unlinks it from [Parent]**. Confirm final string.
5. **Para "org" vs "organization" (CONTENT).** Resolved to **"Organization"** in
   full (not abbreviated "Org") across the swap.

---

## Notes for the implementer

1. **No new tokens. No new components beyond `RegisterIntroScreen` and
   `ParentChurchPicker`.** Everything else is edits to existing screens
   (`RegisterChurchPage1Screen`, `AccountSetupPage2Screen`) + `displayHelpers`.

2. **Underground = its own flow, not a branch of RegCP1 state.** Entry is the
   chooser tile only. There is no underground option in the dropdown and no
   inline prompt on the standalone form. From inside the underground flow there
   is no parent-picker; from inside the branch flow there is no underground flag.
   The three entry paths are mutually exclusive — no path collision, no
   accidental exposure.

3. **Cormorant Garamond on Android.** Use the named `Typography.*` families — do
   NOT apply `fontWeight` to a regular font asset (separate assets; synthetic
   weight breaks Android rendering).

4. **Branch leader gets their own 30-day clock.** No exemption based on parent
   status. Welcome-email kind selection reads the branch's own
   `verification_status` (always `pending` at creation).

5. **`ON DELETE RESTRICT`** on `branch_of_church_id` prevents orphaning — a parent
   with active branches can't be deleted. The ASP2 bypass "Switch" only clears
   `OnboardingContext.loopbackChurch` (no DB orphan risk).

In Jesus' name, Amen.
