// ─────────────────────────────────────────────
// regionUtils — KAN-223
//
// 8 macro-region definitions covering the full globe. Each region has a
// centre coordinate used for Haversine nearest-neighbour assignment of
// church dots and globe-camera faced-region detection.
//
// `underground` = qualitative footer shown in RegionalPanel — strictly a
// pastoral acknowledgment that there are gatherings we cannot name. It
// carries NO count because get_churches_global already excludes underground
// churches at the DB level (SECURITY DEFINER, view-level filter). The hook
// therefore never surfaces underground rows, and we must never attempt to
// derive or display a count from this code.
//
// Underground invariant: never display a count for underground regions.
// ─────────────────────────────────────────────

export const REGION_DEFS = [
  { key: 'na', name: 'North America', lat:  40, lon: -100, underground: false },
  { key: 'la', name: 'Latin America', lat: -15, lon:  -60, underground: false },
  { key: 'eu', name: 'Europe',        lat:  50, lon:   15, underground: false },
  { key: 'af', name: 'Africa',        lat:   5, lon:   20, underground: false },
  { key: 'me', name: 'Middle East',   lat:  32, lon:   50, underground: true  },
  { key: 'sa', name: 'South Asia',    lat:  22, lon:   78, underground: true  },
  { key: 'ea', name: 'East Asia',     lat:  32, lon:  115, underground: true  },
  { key: 'oc', name: 'Asia–Pacific',  lat: -10, lon:  130, underground: false },
] as const;

export type RegionKey = typeof REGION_DEFS[number]['key'];
export type RegionDef = typeof REGION_DEFS[number];

// ── Haversine great-circle distance in radians ────────────────────────
// Pure function — no external deps. Used for both church assignment and
// faced-region detection. Returns a value in [0, π]; callers compare
// directly (no conversion to km/miles needed).
function greatCircle(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLon = (bLon - aLon) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ── regionKeyForCoord ─────────────────────────────────────────────────
// Assigns a church dot (by lat/lon) to its nearest region centre.
// Called once per dot when building regionGroups in TheChurchScreen.
export function regionKeyForCoord(lat: number, lon: number): RegionKey {
  let best: RegionKey = 'na';
  let bestD = Infinity;
  for (const r of REGION_DEFS) {
    const d = greatCircle(lat, lon, r.lat, r.lon);
    if (d < bestD) {
      bestD = d;
      best = r.key;
    }
  }
  return best;
}

// ── facedRegionForCenter ──────────────────────────────────────────────
// Returns the RegionDef nearest to the camera's current centre coordinate.
// Called on every rotation tick and on map-idle to drive the region pill
// and the onFaceRegion callback. Never called more than once per tick;
// the ref-guard in GlobeView ensures onFaceRegion fires only on key change.
export function facedRegionForCenter(centerLng: number, centerLat: number): RegionDef {
  let best: RegionDef = REGION_DEFS[0];
  let bestD = Infinity;
  for (const r of REGION_DEFS) {
    const d = greatCircle(centerLat, centerLng, r.lat, r.lon);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

// ── groupByRegion ─────────────────────────────────────────────────────
// Groups an array of { lat, lng } bearing objects by nearest region key.
// Generic — works for ChurchDot (from useChurchesGlobal) or any similar
// shape. Called once in TheChurchScreen.useMemo([dots]).
export function groupByRegion<T extends { lat: number; lng: number }>(
  items: T[],
): Map<RegionKey, T[]> {
  const map = new Map<RegionKey, T[]>();
  for (const item of items) {
    const key = regionKeyForCoord(item.lat, item.lng);
    const existing = map.get(key) ?? [];
    existing.push(item);
    map.set(key, existing);
  }
  return map;
}
