// KAN-21 — watched-invariant assertions for GlobeView source.
//
// These are STATIC assertions against the source text, deliberately
// chosen over render tests for the two watched invariants the dispatch
// flagged: (a) underground exclusion lives at the view level only — no
// code-level filter to mask a regression; (b) own-church dot uses the
// registered church id/lat-lng, NEVER expo-location / live GPS. A view
// regression that started leaking underground rows would surface as a
// failing dataset assertion; a future maintainer reaching for
// expo-location would trip the GPS-source assertion at lint time.

import * as fs from 'fs';
import * as path from 'path';

const RAW = fs.readFileSync(
  path.resolve(__dirname, 'GlobeView.tsx'),
  'utf8',
);

// Strip block + line comments so explanatory prose ("No expo-blur",
// "No RAG pulse") doesn't trip the forbidden-token assertions below.
// The assertions are about *code*, not documentation.
const SRC = RAW
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

describe('GlobeView watched invariants (KAN-21)', () => {
  it('does NOT re-filter underground at the code level — exclusion stays at the view (KAN-211)', () => {
    // A future maintainer adding a defensive .filter on the dataset
    // could mask a view regression. The dispatch is explicit: keep the
    // exclusion at the view boundary, not in code.
    expect(SRC).not.toMatch(/filter\([^)]*underground/i);
    expect(SRC).not.toMatch(/\.filter\([^)]*type\s*===\s*['"]underground['"]/);
    expect(SRC).not.toMatch(/dots\.filter\(/);
  });

  it('does NOT import or reference expo-location / live GPS for the own-church dot', () => {
    expect(SRC).not.toMatch(/from\s+['"]expo-location['"]/);
    expect(SRC).not.toMatch(/getCurrentPositionAsync|watchPositionAsync/);
    // The OWN_CHURCH_COORD_SOURCE token is the documented anchor.
    expect(SRC).toMatch(/OWN_CHURCH_COORD_SOURCE\s*=\s*['"]registered_church_lat_lng_NOT_live_gps['"]/);
  });

  it('renders the own-church dot via the data-join isOwn flag, not GPS', () => {
    // The dedicated own-church CircleLayer must filter on properties.isOwn
    // (derived from id === ownChurchId in the FeatureCollection builder).
    expect(SRC).toMatch(/id="own-church-dot"/);
    expect(SRC).toMatch(/\[['"]get['"],\s*['"]isOwn['"]\]/);
    expect(SRC).toMatch(/isOwn:\s*ownChurchId\s*!==\s*null\s*&&\s*d\.id\s*===\s*ownChurchId/);
  });

  it('uses Mapbox globe projection (AC #1) and Atmosphere (AC #1: atmosphere + stars on)', () => {
    expect(SRC).toMatch(/projection=["']globe["']/);
    expect(SRC).toMatch(/<Atmosphere/);
    expect(SRC).toMatch(/starIntensity/);
  });

  it('red-dot pulse halo is scoped to red only (supersedes old AC #14 per Founder dispatch 2026-05-28)', () => {
    // Fix E (2026-05-28): the original AC #14 ("no RAG pulse on the
    // globe") is superseded by the Founder dispatch — red dots NOW get
    // a pulsing halo layer underneath. The invariant flips: the pulse
    // layer must EXIST and must filter on rag_status === 'red'; it must
    // NOT match green or amber dots.
    expect(SRC).toMatch(/id="rag-dots-red-pulse"/);
    // The pulse layer's filter must include a 'red' equality check.
    expect(SRC).toMatch(/\[['"]==['"],\s*\[['"]get['"],\s*['"]rag_status['"]\],\s*['"]red['"]\]/);
    // Defensive: no separate 'green' or 'amber' pulse layer ids slipped in.
    expect(SRC).not.toMatch(/rag-dots-(green|amber)-pulse/);
  });

  it('does NOT use expo-blur for any overlay (project convention)', () => {
    expect(SRC).not.toMatch(/expo-blur|BlurView/);
  });

  it('CD chrome strip (2026-05-28): KAN-21 corner pills removed', () => {
    // Founder ack on KAN-21 c.14810 — the original KAN-21 corner pills
    // (Back to world view, Regional view · Reset) and the bottom-right
    // "+N hidden" chip are replaced by the CD's top-row chrome that
    // lives in the host (TheChurchScreen), not in GlobeView. Asserting
    // their absence in the component source so a future maintainer
    // re-adding them gets a fast signal.
    expect(SRC).not.toMatch(/Back to world view/);
    expect(SRC).not.toMatch(/Regional view/);
    expect(SRC).not.toMatch(/hidden chip|hiddenChip/);
    expect(SRC).not.toMatch(/\+\$\{undergroundCount\}|\+\{undergroundCount\} hidden/);
  });
});
