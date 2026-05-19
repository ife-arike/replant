// KAN-83 — canonical leader display name helper (ESC-08 close, 2026-05-04).
//
// Single source of truth for how a leader's identity renders to other
// leaders in the network. Consumed by:
//   - AnonymousModeScreen (KAN-83) — preview lines on each card
//   - Eventually KAN-20, KAN-22, KAN-68, KAN-69, KAN-70 — display surfaces
//     that read `users.anonymous` and render the canonical formats.
//
// Pure function — no React/RN imports, no side effects. Testable directly
// under Jest.
//
// Format rules (Founder copy lock c.13246, 2026-05-19):
//   anonymous = false → "FirstName LastName · ChurchName"
//   anonymous = true  → "RoleLabel · ChurchName"
//
// The roleLabel is the already-resolved display label (e.g. "Ministry
// Leader"), not the snake_case enum value. Callers map via
// displayHelpers.ROLES before invoking.

export interface GetLeaderDisplayNameOpts {
  firstName: string;
  lastName: string;
  roleLabel: string;   // already resolved to display label
  churchName: string;  // "Your Church" at onboarding time; real name post-onboarding
  anonymous: boolean;
}

/**
 * Returns the display string for how a leader appears to others, depending
 * on their anonymous setting.
 *
 *   identified: "FirstName LastName · ChurchName"
 *   anonymous:  "RoleLabel · ChurchName"
 */
export function getLeaderDisplayName(opts: GetLeaderDisplayNameOpts): string {
  if (opts.anonymous) {
    return `${opts.roleLabel} · ${opts.churchName}`;
  }
  return `${opts.firstName} ${opts.lastName} · ${opts.churchName}`;
}
