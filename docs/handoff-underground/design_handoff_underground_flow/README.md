# Underground Flow — Branch · Join-Code · Status surfaces

CD pass for the six underground-registration surfaces, locked against the 33
Founder rulings (2026-06-19). Builds on the existing Replant theme tokens —
**no new colors, fonts, spacing, or radii introduced**.

**Rulings source:** `.claude/plans/underground-flow.md` + 2026-06-19 ratification.
**Threat model is sacred:** every screen assumes it could be captured by an
adversary holding the device. Screenshots are an attack surface.

## Founder-final visual choices (locked from CD tweak rail)

| Surface | Choice |
|---|---|
| §1 Secondary chooser | **List rows** (not large tiles) |
| §2 Name-visibility | **Stacked radio** (not cards) |
| §3 Code block | **Quiet** (underlined, no box) |
| §3 Reveal weight | **Full-screen** takeover (not sheet) |
| §4 Join-code entry | **Segmented cells** (not single field) |
| §5 RAG note tone | **Soft blue** informational (not neutral grey) |
| §6 Verified copy | **"You're verified. You are not standing alone."** |

The `source/*.tsx` files below are written to these choices. The other layout
variant for each is preserved as a commented `// CD-ALT:` note so the fork is
recoverable without re-deriving it.

## Files

```
design_handoff_underground_flow/
├── README.md                          # this file
├── source/
│   ├── UndergroundEntryScreen.tsx     # NEW — Ask 1 · nested secondary chooser (list rows)
│   ├── NameVisibilityChoice.tsx       # NEW — Ask 2 · show/hide name + irreversible-commit modal
│   ├── JoinCodeReveal.tsx             # NEW — Ask 3 · one-shot reveal, non-dismissible, screenshot defense
│   ├── JoinByCodeScreen.tsx           # NEW — Ask 4 · second-leader code entry (segmented cells)
│   ├── RegisterChurchPage1.ragNote.tsx# EDIT — Ask 5 · RAG-Red note refinement (soft-blue, single line)
│   └── VerificationBanner.underground.tsx # EDIT — Ask 6 · pending / verified takeover / rejected
└── preview/
    └── index.html                     # standalone interactive CD doc (all 6 sections, live)
```

> The **preview** is the source of truth for visual + interaction intent —
> every phone is interactive. The `.tsx` files are RN spec scaffolds: component
> shape, props, states, and copy are the contract; navigation + mutations
> follow the codebase's existing onboarding patterns.

---

## The six Asks

### Ask 1 · Secondary chooser, nested (Ruling #13)
The three main tiles on `RegisterIntroScreen` are unchanged. The **Underground**
tile routes to a NEW `UndergroundEntryScreen` with two options: *register a new
underground church* → underground `RegCP1`; *join an existing fellowship with a
code* → `JoinByCodeScreen`. **Back returns to the 3-tile intro.** The "I have a
code" surface never appears on the main intro — an over-the-shoulder watcher
sees only "Underground," then a generic starting/joining choice.

### Ask 2 · Name-visibility choice (Rulings #10 + #11)
After the underground form, before submit. Functional language — **no "brave"
/ "safe."** Default = **Keep our name hidden**. Asymmetric reversibility:
- hidden → shown: leader self-serve **within 7 days**, then locks.
- shown → hidden: **never self-reversible** — admin-only via direct contact
  (#25), audit-logged with `meta.channel`. The commit-to-show modal carries
  that gravity.

Neither option is visually nudged — identical chrome, only a quiet *Default*
pill. Writes `churches.show_church_name` (DEFAULT **false**, migration A).
Single bit governs church name AND leader name on RPL-ID lookup (#30). When
hidden, displays `Underground Church · {region}` — region never withheld (#31).

### Ask 3 · Join-code reveal (Rulings #2 + #3 + #6)
After admin verification, first sign-in reveals the one-shot code **exactly
once**. Format LOCKED: `RPL-XXXX-NNNNN` (4 A–Z + 5 digits), monospaced, large,
**quiet treatment** (underlined, no box), copy-on-tap with success haptic.
**Non-dismissible** — no swipe, no back; "I have saved this — continue" then a
second confirm modal. Screenshot defense: **Android `FLAG_SECURE`** blocks
capture; **iOS can only detect** (`userDidTakeScreenshotNotification`) →
red warning state. MFA leverage prompt (#19) surfaces here.

### Ask 4 · Join-by-code entry (Rulings #4 + #13)
Second leader enters the code given **face-to-face**, in **segmented cells**.
Every failure → one generic string (#4): "That code did not match…". Rate-limit
and network errors are distinct (a connection problem isn't an enumeration
signal). On success → ASP1/ASP2 with underground `church_id` pre-attached.

### Ask 5 · RAG-Red note (Ruling #33)
Replaces the contradictory dual note with a single **soft-blue** informational
line: **"This is set for underground churches and can't be changed in the
app."** RAG behavior unchanged (`rag_status='red'` forced server-side; Green/
Amber muted). Red is reserved for things the leader can act on — the lock is a
fact, so it reads quiet.

### Ask 6 · In-app status surfaces (Ruling #5)
All status comms in-app; **no email reveals underground status**. Generic chrome
across all church types — nothing a screenshot can fingerprint.
- **Pending:** "Your church is being verified. We are praying with you."
- **Verified:** one-shot pastoral takeover → auto-routes to `JoinCodeReveal`.
  Copy: **"You're verified. You are not standing alone."** (the original
  "Welcome. You are with us now." was cut — read as in-group/cultish for people
  who fled coercive groups). Quiet, attributed *Isaiah 43:2* under the head.
- **Rejected:** "We weren't able to verify your registration. Please contact
  the Replant team." — single string for all reasons; specifics via secure thread.

---

## Backend contracts (from underground-flow.md)

| Layer | Change |
|---|---|
| **Migration A (ships first)** | `ALTER COLUMN show_church_name SET DEFAULT false` + backfill 31 underground rows. Standalone safety fix. |
| **Migration B** | `churches` += `underground_join_code_hash`, `_issued_at`, `_revealed_at`, `_rotated_at`. `join_code_only_underground` CHECK. Partial UNIQUE on hash. |
| **create-account v7** | Reused for underground founder signup (payload-driven). Idempotency key required (#28). Force `rag_status='red'`. Welcome-email kind `underground_pending` — no church/role/region/"underground" reference (#5). |
| **join-underground-church (NEW)** | `verify_jwt=false`. Body `{ idempotencyKey, joinCode, leader }`. Constant-time. Returns `{ userId, churchId }` or generic `invalid_or_consumed_code`. |
| **redeem_underground_join_code (NEW RPC)** | Anon-grantable. Constant-time bcrypt across underground rows. `SELECT FOR UPDATE` for cap-of-2 race. Generic error. |
| **auth-status-check (EXTEND)** | Optional `underground_join_code` field, backed by `consume_underground_join_code_reveal(p_user_id)` — atomic, plaintext only on first call. |
| **rotate_underground_join_code (NEW super_admin RPC)** | Lost code → rotate-only, never re-reveal (#26). |
| **Rate limits (#27)** | `join-underground-church`: 5/hr per IP; lifetime cap 10/code then admin-rotate. Fail-closed on Upstash error. |

---

## Design tokens used

All from `constants/theme.ts`. No additions.

| Token | Value | Use |
|---|---|---|
| `Colors.background` | `#080808` | Page / phone bg |
| `Colors.surface` | `#111111` | Inputs, cells, rows |
| `Colors.surfaceElevated` | `#181818` | Sheets, modals |
| `Colors.accent` | `#6BB5E8` | Interactive, code accent, soft-blue note |
| `Colors.text` | `#F0EDE6` | Primary text, code glyphs |
| `Colors.textMuted` | `rgba(240,237,230,0.45)` | Secondary text |
| `Colors.amber` | `#D4A855` | Rate-limit, pending dot |
| `Colors.green` | `#5BAD7A` | Verified, copy-success |
| `Colors.red` | `#E05555` | Underground accent, RAG-Red, screenshot warning, bad-code |
| `Typography.display / displayMedium` | Cormorant 600 / 500 | Titles, code... see note |
| `Typography.scriptureItalic` | Cormorant 300 Italic | Isaiah 43:2 verse line ONLY |
| `Typography.body / bodyMedium` | DM Sans | Body, labels |
| `Typography.mono` | DM Mono | **Join code**, RPL IDs, eyebrows, cells |
| `Spacing.sm/md/lg/xl` | 8 / 16 / 24 / 32 | — |
| `Radius.md/lg/xl` | 8 / 12 / 20 | — |

---

## Open questions for Founder / SME

1. **Forced verified → reveal route.** Built as forced (no dismiss until the
   code is seen), matching the one-shot gravity. Confirm it shouldn't be
   skippable — a leader who can't write it down *right now* has no second chance
   inside the app (lost code = admin rotation).
2. **iOS screenshot reality.** iOS cannot block capture — only detect after the
   fact. The reveal carries a detection-warning state, not a guarantee. Confirm
   that's acceptable, or gate the reveal behind an explicit "I'm somewhere
   private" tap first.
3. **`scriptureItalic` on the verified takeover.** Adds one scripture line to a
   non-home surface. Confirm CONTENT is OK extending the verse voice here.
4. **Quiet code block + screenshot.** The quiet (underlined) treatment is the
   least screenshot-legible at a glance — intentional, but confirm it reads
   clearly enough for a leader copying by hand under stress.

---

## Notes for the implementer

1. **No new tokens. Two edited files, four new components.** `RegisterChurchPage1`
   (RAG note) and `VerificationBanner` (underground states) are edits; the rest
   are new screens/components.

2. **Cormorant on Android.** Use named `Typography.*` families — never apply
   `fontWeight`/`fontStyle` to a regular asset (separate assets; synthetic
   weight/italic breaks Android). The verse line uses the native
   `scriptureItalic` (300 Light Italic) asset.

3. **Join code register = DM Mono.** Every code surface (reveal block, entry
   cells, RPL IDs) uses `Typography.mono`. The code is the visual high point —
   give it air; do not crowd it.

4. **Non-dismiss is a real interaction contract**, not just visual. Android:
   intercept hardware back on the reveal route. iOS: disable the
   interactive-pop gesture (`gestureEnabled: false` on the route) — there is no
   nav back affordance, only the two-step continue + confirm.

5. **Generic chrome is the safety mechanism**, not a copy nicety. The underground
   leader's pending/rejected banners are byte-identical to a standalone leader's.
   Do not add underground-specific copy, icons, or color anywhere a screenshot
   could capture it.

In Jesus' name, Amen.
