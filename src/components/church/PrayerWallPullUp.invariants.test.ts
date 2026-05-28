// KAN-22 — watched-invariant assertions for the Prayer Wall pull-up.
//
// Static assertions against the component source. Chosen over render
// tests for the four watched invariants the dispatch flagged:
//   (1) Underground masking is RPC-enforced — no code-level override of
//       church_name / country on the card-rendering path.
//   (2) Anonymous leader rendering goes through formatLeaderLine (in
//       PrayerWallCard); the pull-up MUST NOT introduce a parallel
//       fallback that could override the server's mask.
//   (3) "Post a Request" visibility is keyed off useAuth().branch, never
//       off the prayer-wall payload.
//   (4) No expo-blur — overlays are dim-only.
//
// Also asserts the canonical 8-value CATEGORIES set is consumed (no
// hard-coded 5-value list slipped in from the original dispatch).

import * as fs from 'fs';
import * as path from 'path';

const RAW_PULLUP = fs.readFileSync(
  path.resolve(__dirname, 'PrayerWallPullUp.tsx'),
  'utf8',
);
const RAW_MODAL = fs.readFileSync(
  path.resolve(__dirname, 'PostPrayerRequestModal.tsx'),
  'utf8',
);

// Strip comments so explanatory prose doesn't trip forbidden-token assertions.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const PULLUP = stripComments(RAW_PULLUP);
const MODAL  = stripComments(RAW_MODAL);

describe('PrayerWallPullUp watched invariants (KAN-22)', () => {
  it('does NOT override the RPC underground mask (no client-side "Underground Church" / country overrides)', () => {
    // The RPC masks church_name → 'Underground Church' and country → NULL.
    // The pull-up must not hardcode the string or null-out country in JS.
    expect(PULLUP).not.toMatch(/['"]Underground Church['"]/);
    expect(PULLUP).not.toMatch(/country\s*=\s*null/);
  });

  it('does NOT introduce a parallel leader-name fallback — relies on PrayerWallCard + formatLeaderLine', () => {
    // PrayerWallCard owns leader-line rendering via formatLeaderLine.
    // The pull-up should not import getLeaderDisplayName or call
    // formatLeaderLine itself (would mean the panel is touching identity).
    expect(PULLUP).not.toMatch(/getLeaderDisplayName/);
    expect(PULLUP).not.toMatch(/formatLeaderLine/);
    // It MUST render via PrayerWallCard.
    expect(PULLUP).toMatch(/PrayerWallCard/);
  });

  it('keys "Post a Request" visibility on useAuth().branch (not on the prayer-wall payload)', () => {
    expect(PULLUP).toMatch(/branch\s*===\s*['"]active['"]/);
    expect(PULLUP).toMatch(/viewerVerified\s*\?\s*\(/);
    // Should NOT branch off any payload field for verification gating.
    expect(PULLUP).not.toMatch(/row\.verification|row\.is_verified|payload\.verified/);
  });

  it('does NOT use expo-blur for any overlay', () => {
    expect(PULLUP).not.toMatch(/expo-blur|BlurView/);
    expect(MODAL).not.toMatch(/expo-blur|BlurView/);
  });

  it('uses the canonical CATEGORIES constant, not a hardcoded 5-value list', () => {
    // The original dispatch enumerated a stale 5-value list. The pull-up
    // and modal must consume the canonical CATEGORIES tuple from
    // PrayerWallLogic (Founder lock 2026-05-24).
    expect(PULLUP).toMatch(/import\s*\{[^}]*\bCATEGORIES\b[^}]*\}\s*from\s*['"]\.\.\/prayer\/PrayerWallLogic['"]/);
    expect(MODAL).toMatch(/import\s*\{[^}]*\bCATEGORIES\b[^}]*\}\s*from\s*['"]\.\.\/prayer\/PrayerWallLogic['"]/);
    // Surface a regression if the dispatch's "Other" value (dropped from
    // CATEGORIES + the RPC whitelist) creeps back in.
    expect(PULLUP).not.toMatch(/['"]Other['"]/);
    expect(MODAL).not.toMatch(/['"]Other['"]/);
  });

  it('modal calls create_prayer_request RPC (not a direct table insert)', () => {
    expect(MODAL).toMatch(/supabase\.rpc\(\s*['"]create_prayer_request['"]/);
    // Defence-in-depth: never reach for prayer_requests.insert from the FE.
    expect(MODAL).not.toMatch(/from\(\s*['"]prayer_requests['"]\s*\)\.insert/);
    expect(PULLUP).not.toMatch(/from\(\s*['"]prayer_requests['"]\s*\)\.insert/);
  });

  it('modal enforces the 300-char cap at the TextInput (blocks 301)', () => {
    // AC #12: "blocked at 301". The component must use maxLength=300 on
    // the TextInput so the 301st keystroke is physically rejected, not
    // just visually warned.
    expect(MODAL).toMatch(/maxLength=\{MAX_CHARS\}/);
    expect(MODAL).toMatch(/MAX_CHARS\s*=\s*300/);
  });

  it('modal counter color states: AMBER at 250, RED at 280 (AC #12)', () => {
    expect(MODAL).toMatch(/AMBER_AT\s*=\s*250/);
    expect(MODAL).toMatch(/RED_AT\s*=\s*280/);
  });
});
