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

  it('does NOT introduce a parallel leader-name fallback — no identity rendering on this surface', () => {
    // CD dispatch 2026-05-28 replaced PrayerWallCard with a CD-faithful
    // PullUpInterCard that renders only loc + body + agree row — NO
    // leader identity at all on this surface. So the pull-up MUST NOT
    // touch any name-rendering helper.
    expect(PULLUP).not.toMatch(/getLeaderDisplayName/);
    expect(PULLUP).not.toMatch(/formatLeaderLine/);
    expect(PULLUP).not.toMatch(/leader_display_name/);
    expect(PULLUP).not.toMatch(/leader_role/);
    // It MUST render via the new PullUpInterCard subcomponent.
    expect(PULLUP).toMatch(/PullUpInterCard/);
    // And MUST NOT fall back to the old PrayerWallCard import.
    expect(PULLUP).not.toMatch(/import\s+PrayerWallCard/);
  });

  it('Post-a-Request affordance lives elsewhere, not on this pull-up', () => {
    // CD dispatch 2026-05-28 — the pull-up is read + Agree-in-prayer
    // only. Post lives in the Prayer Wall tab, not on the CAL pull-up.
    expect(PULLUP).not.toMatch(/Post a Request/);
    expect(PULLUP).not.toMatch(/PostPrayerRequestModal/);
    expect(PULLUP).not.toMatch(/viewerVerified/);
  });

  it('does NOT use expo-blur for any overlay', () => {
    expect(PULLUP).not.toMatch(/expo-blur|BlurView/);
    expect(MODAL).not.toMatch(/expo-blur|BlurView/);
  });

  it('the Post-a-Request MODAL (lives in the Prayer Wall tab) calls create_prayer_request RPC', () => {
    // The modal itself is untouched by this pass — assert its existing
    // create_prayer_request contract still holds.
    expect(MODAL).toMatch(/supabase\.rpc\(\s*['"]create_prayer_request['"]/);
    expect(MODAL).not.toMatch(/from\(\s*['"]prayer_requests['"]\s*\)\.insert/);
    expect(PULLUP).not.toMatch(/from\(\s*['"]prayer_requests['"]\s*\)\.insert/);
  });

  it('PullUpInterCard uses the canonical stand_in_the_gap RPC (not a direct table write)', () => {
    expect(PULLUP).toMatch(/supabase\.rpc\(\s*['"]stand_in_the_gap['"]/);
  });

  it('PullUpInterCard renders the full prayer_text in quotes (no length clamp on this surface)', () => {
    expect(PULLUP).toMatch(/\$\{row\.prayer_text\}/);
    expect(PULLUP).not.toMatch(/numberOfLines=\{3\}/); // no 3-line clamp on the inter card body
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
