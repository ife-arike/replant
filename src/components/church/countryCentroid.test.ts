// KAN-21 — centroid spot-checks. Guards the initial-camera contract.

import { getCountryCentroid, WORLD_CENTER } from './countryCentroid';

describe('getCountryCentroid (KAN-21)', () => {
  it('returns a [lng, lat] tuple for known countries', () => {
    const us = getCountryCentroid('United States');
    expect(us).toHaveLength(2);
    expect(us[0]).toBeGreaterThanOrEqual(-180);
    expect(us[0]).toBeLessThanOrEqual(180);
    expect(us[1]).toBeGreaterThanOrEqual(-90);
    expect(us[1]).toBeLessThanOrEqual(90);
  });

  it('returns the world default for null / undefined / unknown', () => {
    expect(getCountryCentroid(null)).toEqual(WORLD_CENTER);
    expect(getCountryCentroid(undefined)).toEqual(WORLD_CENTER);
    expect(getCountryCentroid('Atlantis')).toEqual(WORLD_CENTER);
  });

  it('is case-sensitive to match live churches.country values', () => {
    // The seed convention is capitalised English ("United States").
    // A lowercase miss falls through to world default — surfaced here
    // so a future country-source change doesn't silently break framing.
    expect(getCountryCentroid('united states')).toEqual(WORLD_CENTER);
  });
});
