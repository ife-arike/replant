// KAN-21 — country-name → approximate geographic centroid lookup.
//
// Used to centre the CAL globe's initial camera on the leader's profile
// country. Source: hand-picked rough centroids ([lng, lat] degrees) for
// the countries most likely to appear in the early UAT/seed set. Unknown
// or missing values fall through to WORLD_CENTER so the camera always
// has something sensible to land on.
//
// Country names follow the values stored in public.churches.country —
// English, capitalised, no ISO codes (matches the live UAT seed convention
// e.g. "United States", "Nigeria", etc.). Expand this list as new
// countries enter the network; this is a presentation helper, not a
// canonical geography table.

export const WORLD_CENTER: [number, number] = [0, 20];

const CENTROIDS: Record<string, [number, number]> = {
  'United States':  [-98.5, 39.5],
  'United Kingdom': [-2.0, 54.0],
  'Canada':         [-106.3, 56.1],
  'Mexico':         [-102.5, 23.6],
  'Brazil':         [-51.9, -14.2],
  'Argentina':      [-63.6, -38.4],
  'Colombia':       [-74.3, 4.6],
  'Nigeria':        [8.7, 9.1],
  'Kenya':          [37.9, -0.0],
  'South Africa':   [22.9, -30.6],
  'Ethiopia':       [40.5, 9.1],
  'Ghana':          [-1.0, 7.9],
  'Egypt':          [30.8, 26.8],
  'Uganda':         [32.3, 1.4],
  'Tanzania':       [34.9, -6.4],
  'DRC':            [21.8, -4.0],
  'India':          [78.9, 20.6],
  'China':          [104.2, 35.9],
  'Indonesia':      [113.9, -0.8],
  'Philippines':    [121.8, 12.9],
  'Pakistan':       [69.3, 30.4],
  'Bangladesh':     [90.4, 23.7],
  'Vietnam':        [108.3, 14.1],
  'South Korea':    [127.8, 35.9],
  'Japan':          [138.3, 36.2],
  'Australia':      [133.8, -25.3],
  'New Zealand':    [174.9, -40.9],
  'Germany':        [10.5, 51.2],
  'France':         [2.2, 46.2],
  'Spain':          [-3.7, 40.5],
  'Italy':          [12.6, 41.9],
  'Poland':         [19.1, 51.9],
  'Russia':         [105.3, 61.5],
  'Ukraine':        [31.2, 48.4],
  'Turkey':         [35.2, 38.9],
  'Iran':           [53.7, 32.4],
  'Iraq':           [43.7, 33.2],
  'Syria':          [38.0, 34.8],
  'Lebanon':        [35.9, 33.9],
  'Israel':         [34.9, 31.0],
  'Jordan':         [36.2, 30.6],
  'Saudi Arabia':   [45.1, 23.9],
};

/**
 * Returns a [lng, lat] centroid for the given country name, or
 * WORLD_CENTER if the name is null/undefined/unknown. Case-sensitive on
 * the live names used in the UAT seed (English, capitalised).
 */
export function getCountryCentroid(
  country: string | null | undefined,
): [number, number] {
  if (!country) return WORLD_CENTER;
  return CENTROIDS[country] ?? WORLD_CENTER;
}
