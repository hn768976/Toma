import type {Viewport} from '../config';

/** One closed ring, flattened as [lon, lat, lon, lat, ...]. */
export type Ring = number[];

export type LandOutline = {
  source: string;
  land: Ring[];
  lakes: Ring[];
};

type IndexedRing = {
  coords: Float64Array;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
};

export type LandMask = {
  /**
   * Samples the outline over a viewport at a given grid resolution.
   * Returns one byte per cell in row-major order, 1 where the cell is land.
   */
  sample: (viewport: Viewport, cols: number, rows: number) => Uint8Array;
};

const index = (rings: Ring[]): IndexedRing[] =>
  rings.map((ring) => {
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (let i = 0; i < ring.length; i += 2) {
      const lon = ring[i];
      const lat = ring[i + 1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return {coords: Float64Array.from(ring), minLon, maxLon, minLat, maxLat};
  });

/**
 * Collects every longitude at which the rings cross the given parallel, sorted
 * ascending. Consecutive pairs bound the inside spans under the even-odd rule,
 * which is what GeoJSON outer rings plus hole rings need.
 */
const crossings = (rings: IndexedRing[], lat: number): number[] => {
  const xs: number[] = [];
  for (const ring of rings) {
    if (lat < ring.minLat || lat > ring.maxLat) continue;
    const {coords} = ring;
    const n = coords.length;
    let x1 = coords[n - 2];
    let y1 = coords[n - 1];
    for (let i = 0; i < n; i += 2) {
      const x2 = coords[i];
      const y2 = coords[i + 1];
      if (y1 > lat !== y2 > lat) {
        xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
      }
      x1 = x2;
      y1 = y2;
    }
  }
  xs.sort((a, b) => a - b);
  return xs;
};

/** True when `lon` falls inside one of the spans described by sorted crossings. */
const inSpans = (xs: number[], lon: number): boolean => {
  // Binary search for how many crossings sit left of `lon`. Odd means inside.
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= lon) lo = mid + 1;
    else hi = mid;
  }
  return (lo & 1) === 1;
};

export const createLandMask = (outline: LandOutline): LandMask => {
  const land = index(outline.land);
  const lakes = index(outline.lakes);

  const isLand = (
    landXs: number[],
    lakeXs: number[],
    lon: number,
  ): boolean => inSpans(landXs, lon) && !inSpans(lakeXs, lon);

  return {
    sample: (viewport, cols, rows) => {
      const out = new Uint8Array(cols * rows);
      const dLon = (viewport.lonMax - viewport.lonMin) / cols;
      const dLat = (viewport.latMax - viewport.latMin) / rows;

      // Three parallels per dot row: the row centre plus the two sub-row
      // quarters. Centre alone would drop small islands, coverage alone would
      // erode single-cell features like a narrow peninsula.
      for (let r = 0; r < rows; r++) {
        const latTop = viewport.latMax - r * dLat;
        const latCentre = latTop - dLat * 0.5;
        const latUpper = latTop - dLat * 0.25;
        const latLower = latTop - dLat * 0.75;

        const centreLand = crossings(land, latCentre);
        const centreLake = crossings(lakes, latCentre);
        const upperLand = crossings(land, latUpper);
        const upperLake = crossings(lakes, latUpper);
        const lowerLand = crossings(land, latLower);
        const lowerLake = crossings(lakes, latLower);

        for (let c = 0; c < cols; c++) {
          const lonLeft = viewport.lonMin + c * dLon;
          const lonCentre = lonLeft + dLon * 0.5;
          const lonA = lonLeft + dLon * 0.25;
          const lonB = lonLeft + dLon * 0.75;

          if (isLand(centreLand, centreLake, lonCentre)) {
            out[r * cols + c] = 1;
            continue;
          }

          let covered = 0;
          if (isLand(upperLand, upperLake, lonA)) covered++;
          if (isLand(upperLand, upperLake, lonB)) covered++;
          if (isLand(lowerLand, lowerLake, lonA)) covered++;
          if (isLand(lowerLand, lowerLake, lonB)) covered++;
          out[r * cols + c] = covered >= 2 ? 1 : 0;
        }
      }

      return out;
    },
  };
};
