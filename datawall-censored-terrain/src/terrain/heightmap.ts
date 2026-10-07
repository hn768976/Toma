import { irange, mulberry32, range } from "../lib/random";

// ---------------------------------------------------------------------------------------------
// Particle Terrain field. Units are metres. x runs across, s runs along the travel direction.
//
// The dot grid is NX x NS points (600 x 1500 = 900,000). The field tiles along s with period
// TILE = NT rows, and the visible depth DEPTH = NS rows = 2 tiles. Each point keeps its terrain
// coordinate s_i = i * DS; the shader places it at distance mod(s_i - s_cam, DEPTH) in front of
// the camera, so points that pass behind the camera re-enter at the far end (inside the haze).
// The camera advances exactly one tile per loop, so frame 600 == frame 0.
// ---------------------------------------------------------------------------------------------

export const NX = 600;
export const NS = 1500;
export const NT = 750; // rows per tile
export const DX = 0.09;
export const DS = 0.05;
export const TILE = NT * DS; // 37.5 m
export const DEPTH = NS * DS; // 75 m
export const WIDTH = NX * DX; // 54 m
export const X0 = -WIDTH / 2 + DX / 2;

// ---------------------------------------------------------------- periodic gradient noise
// Lattice period along s is a whole number of cells so the field tiles exactly.
const PERM = (() => {
  const rng = mulberry32(2193421);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
})();
const GRAD = Array.from({ length: 256 }, (_, i) => {
  const a = ((PERM[i] + 0.5) / 256) * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)];
});
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const hash2 = (ix: number, iy: number) => PERM[(PERM[((ix % 256) + 256) % 256] + (((iy % 256) + 256) % 256)) & 255];

// Noise with period `py` cells along y (x is not periodic).
const pnoise = (x: number, y: number, py: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const wrap = (v: number) => ((v % py) + py) % py;
  const g = (cx: number, cy: number, dx: number, dy: number) => {
    const gr = GRAD[hash2(cx, wrap(cy))];
    return gr[0] * dx + gr[1] * dy;
  };
  const u = fade(fx);
  const v = fade(fy);
  const a = g(ix, iy, fx, fy);
  const b = g(ix + 1, iy, fx - 1, fy);
  const c = g(ix, iy + 1, fx, fy - 1);
  const d = g(ix + 1, iy + 1, fx - 1, fy - 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.4;
};

// fbm with octave periods that all divide the tile.
const fbm = (x: number, s: number, cells: number, oct: number) => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let c = cells;
  for (let o = 0; o < oct; o++) {
    sum += amp * pnoise((x / TILE) * c + o * 17.3, (s / TILE) * c, c);
    norm += amp;
    amp *= 0.5;
    c *= 2;
  }
  return sum / norm;
};

const ridged = (x: number, s: number, cells: number, oct: number) => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let c = cells;
  for (let o = 0; o < oct; o++) {
    const n = 1 - Math.abs(pnoise((x / TILE) * c + 51.7 + o * 9.1, (s / TILE) * c, c));
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    c *= 2;
  }
  return sum / norm;
};

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(Math.max((t - a) / (b - a), 0), 1);
  return x * x * (3 - 2 * x);
};

// ---------------------------------------------------------------- plateaus
export type Plateau = { x0: number; x1: number; s0: number; s1: number; level: number };

export const PLATEAUS: Plateau[] = (() => {
  const rng = mulberry32(77031);
  const out: Plateau[] = [];
  for (let k = 0; k < 16; k++) {
    const w = range(rng, 2, 6);
    const l = range(rng, 2.5, 8);
    // Snap edges to the dot grid so plateau borders are clean rows/columns.
    const cx = range(rng, -20, 20);
    const x0 = Math.round((cx - w / 2 - X0) / DX) * DX + X0 - DX / 2;
    const s0 = Math.round(range(rng, 0, TILE) / DS) * DS - DS / 2;
    out.push({ x0, x1: x0 + Math.round(w / DX) * DX, s0, s1: s0 + Math.round(l / DS) * DS, level: range(rng, 0.05, 0.9) });
  }
  return out;
})();

const plateauAt = (x: number, s: number): Plateau | null => {
  for (const p of PLATEAUS) {
    if (x < p.x0 || x > p.x1) continue;
    for (const off of [0, -TILE, TILE]) {
      const ss = s + off;
      if (ss >= p.s0 && ss <= p.s1) return p;
    }
  }
  return null;
};

// ---------------------------------------------------------------- field
// Natural height (no plateaus), periodic in s with period TILE. Returns [height, ember], where
// ember is how strongly the dot takes the ridge colour (ridges and rugged slopes).
const natural = (x: number, s: number): [number, number] => {
  const hills = fbm(x, s, 3, 3) * 0.7 + 0.4;
  const rv = ridged(x, s, 5, 4);
  const ridge = Math.pow(rv, 2.4) * 2.2;
  const rough = fbm(x, s, 12, 3) * 0.7 + fbm(x, s, 24, 2) * 0.25;
  const big = fbm(x, s, 1, 2) * 0.6;
  // A lower corridor along the flight path, rising toward the sides.
  const side = smooth(3, 18, Math.abs(x));
  const k = 0.7 + 0.3 * side;
  const h = Math.max(((hills + ridge + rough + big) * k + side * 0.8) * 0.65, -0.2);
  const patch = fbm(x + 40, s, 4, 2);
  const ember = smooth(0.62, 0.9, rv) * 0.7 + smooth(0.2, 0.5, patch) * 0.55;
  return [h, Math.min(ember, 1)];
};

export type Field = {
  // RGBA per (row, col) for one tile: height, plateau (0/1), ridge colour factor, jitter seed
  data: Float32Array;
  height: (col: number, row: number) => number;
};

export const buildField = (): Field => {
  const data = new Float32Array(NX * NT * 4);
  const hgt = new Float32Array(NX * NT);
  for (let r = 0; r < NT; r++) {
    const s = r * DS;
    for (let c = 0; c < NX; c++) {
      const x = X0 + c * DX;
      const p = plateauAt(x, s);
      const [nh, ember] = natural(x, s);
      hgt[r * NX + c] = p ? p.level : nh;
      data[(r * NX + c) * 4 + 1] = p ? 1 : 0;
      data[(r * NX + c) * 4 + 2] = p ? 0 : ember;
    }
  }
  for (let r = 0; r < NT; r++) {
    for (let c = 0; c < NX; c++) {
      const i = r * NX + c;
      const h = hgt[i];
      const hx = hgt[r * NX + Math.min(c + 1, NX - 1)] - hgt[r * NX + Math.max(c - 1, 0)];
      const hs = hgt[((r + 1) % NT) * NX + c] - hgt[((r - 1 + NT) % NT) * NX + c];
      const slope = Math.hypot(hx / (2 * DX), hs / (2 * DS));
      data[i * 4 + 0] = h;
      data[i * 4 + 2] = Math.min(data[i * 4 + 2] + Math.max(slope - 0.6, 0) * 0.3, 1);
      data[i * 4 + 3] = 0;
    }
  }
  return { data, height: (c, r) => hgt[(((r % NT) + NT) % NT) * NX + c] };
};

// ---------------------------------------------------------------- nodes, lines, dust
export type Node = { col: number; row: number; y: number; rate: number; phase: number; line: number; bright: number };

export const buildNodes = (field: Field): Node[] => {
  const rng = mulberry32(5150);
  const out: Node[] = [];
  for (let k = 0; k < 120; k++) {
    // Per tile; two tiles are visible, and roughly half land outside the frame near the camera.
    const col = irange(rng, 60, NX - 61);
    const row = irange(rng, 0, NT - 1);
    out.push({
      col,
      row,
      y: field.height(col, row) + 0.04,
      rate: irange(rng, 1, 6),
      phase: rng(),
      line: k < 44 ? range(rng, 0.8, 2.6) : 0,
      bright: range(rng, 0.6, 1.2),
    });
  }
  return out;
};

export const GRID_Y = 0.32;
export const gridColumns = (() => {
  const rng = mulberry32(31337);
  const cols: number[] = [];
  let c = irange(rng, 10, 40);
  while (c < NX) {
    cols.push(c);
    c += irange(rng, 35, 90);
  }
  return cols;
})();
export const gridRows = (() => {
  const rng = mulberry32(4242);
  const rows: number[] = [];
  let r = irange(rng, 0, 40);
  while (r < NT) {
    rows.push(r);
    r += irange(rng, 60, 140);
  }
  return rows;
})();
