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

  it('does NOT pulse RAG dots on the globe (AC #14 — pulse scoped to local only)', () => {
    // Any animated stroke/scale on rag-dots would smuggle a pulse in.
    expect(SRC).not.toMatch(/pulse/i);
  });

  it('does NOT use expo-blur for any overlay (project convention)', () => {
    expect(SRC).not.toMatch(/expo-blur|BlurView/);
  });
});
