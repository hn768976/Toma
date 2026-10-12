import { simplex4 } from "../lib/noise";
import { hash01, hashString, mulberry32 } from "../lib/random";

/** Scene constants shared by every version. One world unit = one cell pitch. */
export const LOOP = 600; // frames: 20 s at 30 fps
export const COLS = 60;
export const ROWS = 40;
export const PITCH = 1.0;
export const CUBE = 0.9; // gap 0.1
export const CUBE_RADIUS = 0.08;
export const PLATE_COLS = 16;
export const PLATE_ROWS = 6;
export const PLATE_W = PLATE_COLS * PITCH - 0.25;
export const PLATE_D = PLATE_ROWS * PITCH - 0.25;
export const PLATE_H = 0.3;
export const PLATE_TOP = 0.95; // world y of the plate's top face
export const ICON_SIZE = 0.56;
export const ACCENT_SHARE = 0.12;
export const RIPPLE_AMP = 0.35;
export const STATIC_JITTER = 0.08;
export const FLARES_PER_LOOP = 100; // ≈ 5 per second
export const FLARE_FRAMES = 6;
/** rows over which the field colour runs from A (far) to B (near / frame bottom) */
export const GRADIENT_ROWS: [number, number] = [3, 28];

export type CubeCell = {
  x: number;
  z: number;
  row: number;
  col: number;
  /** 0 = far / top edge, 1 = near / bottom edge */
  gradientT: number;
  /** atlas slot (base icons 0..n-1, accent = n) */
  slot: number;
  accent: boolean;
  jitter: number;
  /** ripple damping near the plate (0.4 at the plate edge → 1 further out) */
  calm: number;
  /** frame at which this cube's icon flares, or -1 */
  flareStart: number;
  /** small per-cube icon brightness variation */
  shimmer: number;
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Is this cell inside the hole left for the plate? */
export const inPlateHole = (col: number, row: number) => {
  const c0 = (COLS - PLATE_COLS) / 2;
  const r0 = (ROWS - PLATE_ROWS) / 2;
  return col >= c0 && col < c0 + PLATE_COLS && row >= r0 && row < r0 + PLATE_ROWS;
};

/**
 * Per-cube static data. Everything comes from seeded hashes of (col, row, word),
 * so each composition's field is stable across threads and renders.
 */
export function buildLayout(word: string, baseIconCount: number): CubeCell[] {
  const seed = hashString(word);
  const cells: CubeCell[] = [];
  // near rows first: cubes are drawn front-to-back so early-z skips hidden pixels
  for (let row = ROWS - 1; row >= 0; row--) {
    for (let col = 0; col < COLS; col++) {
      if (inPlateHole(col, row)) continue;
      const x = (col - (COLS - 1) / 2) * PITCH;
      const z = (row - (ROWS - 1) / 2) * PITCH;
      const hA = hash01(col, row, seed);
      const hB = hash01(col + 101, row + 37, seed ^ 0x9e3779b9);
      const hC = hash01(col + 7, row + 911, seed ^ 0x85ebca6b);
      const hD = hash01(col + 59, row + 13, seed ^ 0xc2b2ae35);
      const accent = hA < ACCENT_SHARE;
      const slot = accent ? baseIconCount : Math.min(baseIconCount - 1, Math.floor(hB * baseIconCount));
      // distance (in cells) from the plate's rectangle
      const dx = Math.max(0, Math.abs(x) - PLATE_W / 2);
      const dz = Math.max(0, Math.abs(z) - PLATE_D / 2);
      const dist = Math.hypot(dx, dz);
      cells.push({
        x,
        z,
        row,
        col,
        // A → B across the rows the camera actually sees (far edge → bottom of frame)
        gradientT: smoothstep(GRADIENT_ROWS[0], GRADIENT_ROWS[1], row),
        slot,
        accent,
        jitter: (hC * 2 - 1) * STATIC_JITTER,
        calm: 0.4 + 0.6 * smoothstep(0.5, 6, dist),
        flareStart: -1,
        shimmer: 0.85 + 0.3 * hD,
      });
    }
  }
  // Twinkle schedule: FLARES_PER_LOOP flares, each on a cube at a frame in
  // [0, LOOP). Evaluated modulo LOOP, so every schedule is a whole cycle.
  const rand = mulberry32(seed ^ 0x7f4a7c15);
  for (let i = 0; i < FLARES_PER_LOOP; i++) {
    const idx = Math.floor(rand() * cells.length);
    const start = Math.floor(rand() * LOOP);
    if (cells[idx].flareStart < 0) cells[idx].flareStart = start;
  }
  return cells;
}

/**
 * Cube height at a frame: two broad noise waves whose time axis runs around a
 * circle (so frame LOOP == frame 0), damped near the plate, plus a static jitter.
 */
export function cubeHeight(cell: CubeCell, frame: number): number {
  const theta = ((frame % LOOP) / LOOP) * Math.PI * 2;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const w1 = simplex4(cell.x * 0.075, cell.z * 0.075, c * 0.9, s * 0.9);
  const w2 = simplex4(cell.x * 0.16 + 31.7, cell.z * 0.16 - 12.3, c * 0.75 + 5.1, s * 0.75 - 8.4);
  // simplex output rarely leaves ±0.5: stretch and soft-clip into ±1
  const wave = Math.tanh(1.9 * (0.68 * w1 + 0.42 * w2));
  return wave * RIPPLE_AMP * cell.calm + cell.jitter;
}
