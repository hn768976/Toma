import landPoints from "./land-points.json";

export type SpherePoint = {
  /** Unit-sphere position at zero rotation. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
};

const toUnit = (lonDeg: number, latDeg: number) => {
  const lon = (lonDeg * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  const cosLat = Math.cos(lat);
  // +Y is screen-down, so latitude is negated here.
  return { x: cosLat * Math.sin(lon), y: -Math.sin(lat), z: cosLat * Math.cos(lon) };
};

/** Fine lat/lon mesh over the whole sphere — the hologram "wireframe". */
export const buildMesh = (): SpherePoint[] => {
  const out: SpherePoint[] = [];
  // Every candidate is a divisor of 360 AND a multiple of the 4° base step,
  // so coarser bands stay a strict subset of the equatorial meridians and the
  // vertical lines still read as lines.
  const LON_STEPS = [4, 12, 20, 40, 60, 90, 180];
  for (let lat = -88; lat <= 88; lat += 2) {
    const cosLat = Math.max(0.04, Math.cos((lat * Math.PI) / 180));
    const need = 4 / cosLat;
    const step = LON_STEPS.find((c) => c >= need) ?? 180;
    for (let lon = -180; lon < 180; lon += step) {
      out.push({ ...toUnit(lon, lat), size: 1 });
    }
  }
  return out;
};

/** Brighter dotted latitude circles every 15°, incl. the equator. */
export const buildRings = (): SpherePoint[] => {
  const out: SpherePoint[] = [];
  for (let lat = -75; lat <= 75; lat += 15) {
    const steps = 300;
    for (let i = 0; i < steps; i++) {
      out.push({ ...toUnit(-180 + (360 * i) / steps, lat), size: lat === 0 ? 1.7 : 1.3 });
    }
  }
  return out;
};

/** Continents, baked from Natural Earth land polygons by scripts/gen-land-points.mjs. */
export const buildLand = (): SpherePoint[] =>
  (landPoints as [number, number][]).map(([lon, lat]) => ({
    ...toUnit(lon, lat),
    size: 1.5,
  }));
