import { Assets } from "./assets";

/**
 * Natural Earth → dot fields and line segments. All deterministic.
 */

/** Regular lon/lat dot grid over land (equirectangular). Returns [lon, lat] pairs. */
export const landGrid = (
  assets: Assets,
  stepDeg: number,
  opts: { minLat?: number; maxLat?: number; stagger?: boolean } = {},
) => {
  const out: number[] = [];
  const minLat = opts.minLat ?? -60;
  const maxLat = opts.maxLat ?? 84;
  let row = 0;
  for (let lat = maxLat; lat >= minLat; lat -= stepDeg, row++) {
    const off = opts.stagger && row % 2 ? stepDeg * 0.5 : 0;
    for (let lon = -180 + off; lon < 180; lon += stepDeg) {
      if (assets.isLand(lon, lat)) out.push(lon, lat);
    }
  }
  return out;
};

/** Roughly uniform dots on the sphere over land: rows of latitude, dots ∝ cos(lat). */
export const landSphere = (assets: Assets, stepDeg: number, minLat = -62) => {
  const out: number[] = [];
  for (let lat = 88; lat >= minLat; lat -= stepDeg) {
    const n = Math.max(1, Math.round((360 / stepDeg) * Math.cos((lat * Math.PI) / 180)));
    for (let i = 0; i < n; i++) {
      const lon = -180 + (i + 0.5) * (360 / n);
      if (assets.isLand(lon, lat)) out.push(lon, lat);
    }
  }
  return out;
};

/** Ocean-or-land uniform sphere dots (for a faint full-sphere shell). */
export const sphereGrid = (stepDeg: number) => {
  const out: number[] = [];
  for (let lat = 88; lat >= -88; lat -= stepDeg) {
    const n = Math.max(1, Math.round((360 / stepDeg) * Math.cos((lat * Math.PI) / 180)));
    for (let i = 0; i < n; i++) out.push(-180 + (i + 0.5) * (360 / n), lat);
  }
  return out;
};

/** Coastline segments [lon0, lat0, lon1, lat1, ...], resampled to ~stepDeg. */
export const coastSegments = (assets: Assets, stepDeg: number, minLat = -62) => {
  const out: number[] = [];
  for (const ring of assets.rings) {
    let prev: [number, number] | null = null;
    let acc = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      if (!prev) {
        prev = p;
        continue;
      }
      acc += Math.hypot(p[0] - ring[i - 1][0], p[1] - ring[i - 1][1]);
      const last = i === ring.length - 1;
      if (acc >= stepDeg || last) {
        if (Math.abs(p[0] - prev[0]) < 90 && prev[1] > minLat && p[1] > minLat) {
          out.push(prev[0], prev[1], p[0], p[1]);
        }
        prev = p;
        acc = 0;
      }
    }
  }
  return out;
};

export const lonLatToVec = (lon: number, lat: number, r: number): [number, number, number] => {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)];
};
