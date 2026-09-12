// Typed, draw-ready view over the baked geodata.
//
// scripts/build-geo-data.mjs emits plain JSON; this module converts it once at
// module load into typed arrays and bucketed dot lists so the per-frame draw
// loop never allocates or re-sorts.

import raw from "./data/map-data.json";

export type City = { n: string; w: number; x: number; y: number };
export type Route = { a: number; b: number; c: number; p: number };

export const DOT_BUCKETS = 6;

const data = raw as unknown as {
  meta: { scale: number; center: [number, number]; dotSpacing: number };
  coast: number[][];
  borders: number[][];
  graticule: number[][];
  dots: number[];
  cities: City[];
  routes: Route[];
};

export const DOT_SPACING = data.meta.dotSpacing;

export const coast: Float32Array[] = data.coast.map((r) => new Float32Array(r));
export const borders: Float32Array[] = data.borders.map((r) => new Float32Array(r));
export const graticule: Float32Array[] = data.graticule.map((r) => new Float32Array(r));
export const cities: City[] = data.cities;
export const routes: Route[] = data.routes;

/**
 * Land dots, split by brightness bucket. Each bucket is a flat [x, y, ...]
 * array in map units, letting the renderer set one fill per bucket instead of
 * per dot.
 */
export const dotBuckets: Float32Array[] = (() => {
  const counts = new Array<number>(DOT_BUCKETS).fill(0);
  const src = data.dots;
  for (let i = 2; i < src.length; i += 3) counts[src[i]]++;

  const out = counts.map((n) => new Float32Array(n * 2));
  const cursor = new Array<number>(DOT_BUCKETS).fill(0);
  for (let i = 0; i < src.length; i += 3) {
    const b = src[i + 2];
    const j = cursor[b];
    out[b][j] = src[i] * DOT_SPACING;
    out[b][j + 1] = src[i + 1] * DOT_SPACING;
    cursor[b] = j + 2;
  }
  return out;
})();

/** Precomputed per-city animation phases, so twinkle/pings look uncorrelated. */
export const cityPhase: Float32Array = (() => {
  const out = new Float32Array(cities.length);
  let seed = 0x9e3779b9;
  for (let i = 0; i < cities.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out[i] = seed / 4294967296;
  }
  return out;
})();
