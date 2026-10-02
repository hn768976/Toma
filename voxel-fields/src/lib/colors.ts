// Per-column colours, chosen once at module level from a seeded low-frequency
// noise so neighbouring columns share a shade (bands and patches, not speckle).

import { Color } from "three";
import { COLUMN_COUNT, GRID_X, GRID_Z } from "./fields";
import type { Palette } from "./palettes";
import { makeNoise } from "./random";

const colorNoise = makeNoise(0xc0102);
const accentNoise = makeNoise(0xacc3);

// Banding field: stretched slightly along one diagonal so shades form bands.
const bandValue = new Float32Array(COLUMN_COUNT);
const accentValue = new Float32Array(COLUMN_COUNT);
for (let j = 0; j < GRID_Z; j++) {
  for (let i = 0; i < GRID_X; i++) {
    // Long bands along the grid rows, like the slabs.
    bandValue[j * GRID_X + i] =
      colorNoise.noise2(i * 0.022, j * 0.12) +
      0.3 * colorNoise.noise2(i * 0.08 + 50, j * 0.3 - 20);
    accentValue[j * GRID_X + i] =
      accentNoise.noise2(i * 0.16, j * 0.16) + 0.25 * accentNoise.noise2(i * 0.5, j * 0.5);
  }
}
// Rank columns once so palette weights become exact shares.
const bandRank = new Float32Array(COLUMN_COUNT);
{
  const order = Array.from({ length: COLUMN_COUNT }, (_, k) => k).sort(
    (a, b) => bandValue[a] - bandValue[b],
  );
  order.forEach((k, r) => (bandRank[k] = r / (COLUMN_COUNT - 1)));
}
const accentRank = new Float32Array(COLUMN_COUNT);
{
  const order = Array.from({ length: COLUMN_COUNT }, (_, k) => k).sort(
    (a, b) => accentValue[b] - accentValue[a],
  );
  order.forEach((k, r) => (accentRank[k] = r / (COLUMN_COUNT - 1)));
}

const cache = new Map<string, Float32Array>();

/** Linear-RGB colour for every column, for InstancedMesh.instanceColor. */
export const columnColors = (palette: Palette): Float32Array => {
  const hit = cache.get(palette.id);
  if (hit) return hit;
  const total = palette.weights.reduce((a, b) => a + b, 0);
  const edges: number[] = [];
  let acc = 0;
  for (const w of palette.weights) {
    acc += w / total;
    edges.push(acc);
  }
  const linear = palette.colors.map((c) => new Color(c)); // sRGB hex -> linear
  const accent = palette.accent ? new Color(palette.accent.color) : null;
  const out = new Float32Array(COLUMN_COUNT * 3);
  for (let k = 0; k < COLUMN_COUNT; k++) {
    let idx = edges.findIndex((e) => bandRank[k] <= e);
    if (idx < 0) idx = linear.length - 1;
    let c = linear[idx];
    if (accent && palette.accent && accentRank[k] < palette.accent.amount) c = accent;
    out[k * 3] = c.r;
    out[k * 3 + 1] = c.g;
    out[k * 3 + 2] = c.b;
  }
  cache.set(palette.id, out);
  return out;
};
