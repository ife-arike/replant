# Account Setup — Step 2 of 2 · "Your Church" (confirmed state)

Redesign of the Step 2 confirmation screen shown after a leader either
selects or registers a church during account setup. Builds on the
existing Replant theme tokens — **no new colors, fonts, or spacing
values introduced**.

## Files

```
design_handoff_your_church_step2/
├── README.md                       # this file
├── source/
│   └── YourChurchScreen.tsx        # React Native screen (Expo / RN)
└── preview/
    └── index.html                  # standalone before/after preview
```

## Fidelity

**High fidelity for tokens and copy. Structural-spec for layout.**

Hex values, font families, weights, and spacing all reference
`Colors`, `Typography`, `Spacing`, `Radius` from `constants/theme.ts`
— do not hardcode anything. The component breakdown and prop shape
below are the contract; routing and mutations follow the codebase's
existing onboarding patterns.

## What changes vs the current screen

| Surface | Before | After |
|---|---|---|
| Header | 56 px title, "Account Setup · 2 of 2" eyebrow, 3-line body. Eats ~45% of viewport. | Unchanged copy + eyebrow. Title 48 px, body unchanged. Tightened top padding so the confirmation card sits above the fold. |
| Mistake module | Centered sub-block inside the card: "Made a mistake? Select an option below." with an outlined Edit button and a red full-width "Delete and return to search" link. Equal weight to the primary CTA. | Removed. Replaced by (a) a quiet **Edit** text affordance inside the card's ribbon row, and (b) a single text link **"Made a mistake? Switch ›"** below the card. Destructive confirmation lives inside the Switch flow, not on this screen. |
| Amber status dot | Unlabeled. User has no idea what the orange dot beside "Ministry · Test, Australia" means. | New dedicated **status row** inside the card: amber dot + "Awaiting verification" title + amber Pending tag + 1-line description ("A Replant team member will reach out within 2–3 days. Your account stays active during this window."). |
| Primary CTA | Sky-blue pill, DM Sans 19 px. | Sky-blue pill **stays** (same color as before). Label switches to Cormorant Garamond 22 px to match the title register and feel weightier. |
| Back chevron | Plain "‹ Back" sky link top-left. | Unchanged. |

## States

1. **Default — pending verification** (illustrated). Church is registered, status is `pending`. Amber dot + Pending tag + the 2–3 day copy.
2. **Verified** (post-onboarding return path). Same layout, status row shows green dot + "Verified" title + green Verified tag, description omitted.
3. **Edit pressed** — opens the existing church-edit flow (KAN-147 panel pattern). Out of scope for this screen; this screen owns the entry affordance only.
4. **Switch pressed** — opens an existing `Switch church?` confirm sheet. Confirming deletes the church link and routes back to the search screen.

## Props

```ts
type ChurchType = 'Church' | 'House Church' | 'Ministry' | 'Underground';
type VerificationStatus = 'pending' | 'verified';

type YourChurchScreenProps = {
  church: {
    id: string;
    name: string;
    type: ChurchType;
    locationLabel: string;        // "Test, Australia" — already formatted upstream
    verificationStatus: VerificationStatus;
  };

  onBack: () => void;
  onEdit: () => void;             // opens edit flow
  onSwitch: () => void;           // opens "Switch church?" confirm sheet
  onEnterReplant: () => void;     // commits onboarding, routes to Home
};
```

## Write contracts

| Action | Contract |
|---|---|
| **Enter Replant** | Commits onboarding. `PATCH /users/me` `{ onboarding_completed_at: now() }`. Router navigates to `Home`. Idempotent. No write retries here — if it fails, surface inline toast and keep the user on the screen. |
| **Edit** | Client-side route to the church edit form. No mutation fires from this button. |
| **Switch** | Opens existing confirmation sheet. On confirm: `DELETE /users/me/church_link`. On success, route back to `ChurchSearch` screen with a toast: "Church removed. Search again below." |
| **Back** | Client-side nav only. Onboarding draft state is preserved by the navigator. |

## Design tokens used

All from `constants/theme.ts`. No additions.

| Token | Value |
|---|---|
| `Colors.background` | `#080808` |
| `Colors.surface` | `#111111` |
| `Colors.surfaceElevated` | `#181818` |
| `Colors.accent` | `#6BB5E8` |
| `Colors.text` | `#F0EDE6` |
| `Colors.textMuted` | `rgba(240,237,230,0.45)` |
| `Colors.border` | `rgba(240,237,230,0.08)` |
| `Colors.amber` | `#D4A855` |
| `Colors.green` | `#5BAD7A` |
| `Typography.display` (Cormorant 600) | Title |
| `Typography.displayMedium` (Cormorant 500) | Church name, CTA label |
| `Typography.body` / `bodyMedium` (DM Sans) | Body copy, status title |
| `Typography.mono` (DM Mono) | Eyebrows, Pending tag |
| `Spacing.sm / md / lg / xl` | 8 / 16 / 24 / 32 |
| `Radius.md / lg` | 8 / 12 |

## Notes for the implementer

1. **The status row is the heart of this redesign.** If you reduce
   anything else, keep the named verification state intact — the
   unlabeled amber dot is the screen's biggest usability failure today.

2. **No new tokens. No new components.** The status row is a
   `surfaceElevated`-backed `View` with a 14 px padding, an 8 px dot,
   and a mono Pending tag. Nothing here needs to escape this screen.

3. **Edit and Switch are entry points, not flows.** This screen does
   not own the edit form or the delete confirmation. Wire them to the
   existing flows; if those flows don't exist yet, stub `onPress` to a
   `console.warn` and add a JIRA link in the prop site.

4. **Pending tag color rule.** When `verificationStatus === 'verified'`,
   the dot, tag border, tag background, and tag text all swap from
   `Colors.amber` to `Colors.green`, the title becomes "Verified",
   the description is omitted, and the row height drops accordingly
   (no vertical alignment hack — the description is just absent).

5. **Cormorant Garamond on Android.** Use `Typography.displayMedium`
   for the CTA label — do NOT apply `fontWeight: '500'` to a regular
   font asset. Same rule applies to the title (`Typography.display`
   = SemiBold 600).

6. **Safe-area insets.** Use `SafeAreaView` from
   `react-native-safe-area-context` with `edges={['top', 'bottom']}`.
   The footer CTA must sit above the home indicator with `Spacing.lg`
   bottom padding on devices without insets, falling back to the
   safe-area inset when present.

7. **Accessibility.** The status row exposes a single
   `accessibilityLabel` combining title + description so screen
   readers don't read the Pending tag separately. Edit and Switch use
   `accessibilityRole="button"`. The CTA uses
   `accessibilityHint="Completes account setup and opens the prayer wall"`.
