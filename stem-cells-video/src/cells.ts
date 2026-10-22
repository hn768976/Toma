import { SPACE_H, SPACE_W } from "./constants";

// [x, y, radius] keyframes at t = 0, 3, 6, 9 seconds, measured from the
// reference clip in the 1192x672 layout space (y down).
type Key = readonly [number, number, number];

export type CellDef = {
  id: string;
  keys: readonly [Key, Key, Key, Key];
  // Draw order: higher = closer to the camera.
  depth: number;
  // Outer membrane radius as a multiple of the cell radius.
  membrane: number;
  // Haze toward the backdrop colour (distant cells look softer/lighter).
  haze: number;
  seed: number;
};

export const CELLS: CellDef[] = [
  // Large cell top-left, drifting up-left and out of frame.
  { id: "A", keys: [[288, 44, 128], [225, -20, 155], [130, -80, 165], [10, -150, 175]], depth: 9, membrane: 1.45, haze: 0.0, seed: 1.7 },
  // Large cell entering from the bottom-right corner.
  { id: "G", keys: [[1215, 665, 120], [1135, 640, 128], [1090, 620, 145], [1030, 610, 158]], depth: 8, membrane: 1.4, haze: 0.0, seed: 4.2 },
  // Hero cell, centre of frame.
  { id: "C", keys: [[605, 345, 112], [602, 345, 110], [600, 352, 109], [594, 356, 112]], depth: 7, membrane: 1.62, haze: 0.0, seed: 2.9 },
  // Left cell.
  { id: "B", keys: [[237, 415, 95], [226, 442, 91], [212, 467, 88], [196, 488, 90]], depth: 6, membrane: 1.5, haze: 0.0, seed: 7.3 },
  // Right cell, rising.
  { id: "D", keys: [[925, 380, 62], [928, 333, 63], [934, 286, 66], [941, 241, 71]], depth: 5, membrane: 1.65, haze: 0.02, seed: 5.5 },
  // Small cell, lower middle, sinking down-left.
  { id: "F", keys: [[800, 548, 46], [735, 580, 42], [678, 615, 39], [627, 640, 36]], depth: 4, membrane: 1.55, haze: 0.03, seed: 9.1 },
  // Small cell top-right, drifting to the corner.
  { id: "E", keys: [[992, 145, 36], [1030, 128, 42], [1073, 105, 46], [1126, 78, 50]], depth: 3, membrane: 1.6, haze: 0.04, seed: 3.3 },
  // Small cell descending from the top edge.
  { id: "H", keys: [[500, -80, 30], [425, -5, 42], [355, 75, 55], [308, 162, 56]], depth: 2, membrane: 1.55, haze: 0.03, seed: 6.6 },
];

const KEY_TIMES = [0, 3, 6, 9];

// Uniform Catmull-Rom through the four keys, extrapolating linearly past the ends.
const catmull = (p0: number, p1: number, p2: number, p3: number, u: number) =>
  0.5 *
  (2 * p1 +
    (-p0 + p2) * u +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
    (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);

export const sampleCell = (cell: CellDef, seconds: number) => {
  const k = cell.keys;
  const ext = (i: number): Key => {
    if (i < 0) return k[0].map((v, j) => 2 * v - k[1][j]) as unknown as Key;
    if (i > 3) return k[3].map((v, j) => 2 * v - k[2][j]) as unknown as Key;
    return k[i];
  };
  const seg = Math.min(2, Math.max(0, Math.floor(seconds / 3)));
  const u = (seconds - KEY_TIMES[seg]) / 3;
  const out = [0, 1, 2].map((j) =>
    catmull(ext(seg - 1)[j], ext(seg)[j], ext(seg + 1)[j], ext(seg + 2)[j], u),
  );
  // Convert to world space: origin at frame centre, y up.
  return {
    x: out[0] - SPACE_W / 2,
    y: SPACE_H / 2 - out[1],
    r: out[2],
  };
};
