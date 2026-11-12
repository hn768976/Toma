// Tile-grid "valley" model.
//
// A square grid of thin square plates. Along a zig-zag (pixel-staircase) path
// the plates sink and tip over to follow the slope, forming a terraced V-shaped
// valley of fins that opens from a thin slit to a wide band, holds, then closes
// again. One cycle = 134 frames (~4.47 s), measured from the reference, so the
// 267-frame shot runs ~2 cycles, in phase with the reference.

export const CYCLE_FRAMES = 134;
export const GRID = 136; // GRID x GRID tiles, centred on the origin
export const MAX_DEPTH = 4.0; // depth of the valley floor, in tile units

type Seg = { ax: number; ay: number; bx: number; by: number; depth: number; width: number };

// Staircase path in grid coordinates (u along the valley, v across it).
// Main branch runs through the centre; a shallower side branch splits off
// towards the lower-left, like the reference.
const MAIN: [number, number][] = [
  [-44, 4],
  [-30, 4],
  [-30, -1],
  [-23, -1],
  [-23, -8],
  [-15, -8],
  [-15, -3],
  [-8, -3],
  [-8, 4],
  [-1, 4],
  [-1, -1],
  [6, -1],
  [6, 6],
  [13, 6],
  [13, 0],
  [20, 0],
  [20, -6],
  [27, -6],
  [27, 1],
  [36, 1],
  [36, -3],
  [48, -3],
];

const BRANCH: [number, number][] = [
  [-23, -6],
  [-23, -13],
  [-30, -13],
  [-30, -19],
  [-40, -19],
];

// Path control points are authored at unit scale and enlarged here.
const PATH_SCALE = 1.4;

const toSegs = (pts: [number, number][], depth: number, width: number): Seg[] => {
  const out: Seg[] = [];
  const k = PATH_SCALE;
  for (let i = 0; i < pts.length - 1; i++) {
    out.push({ ax: pts[i][0] * k, ay: pts[i][1] * k, bx: pts[i + 1][0] * k, by: pts[i + 1][1] * k, depth, width });
  }
  return out;
};

const SEGS: Seg[] = [...toSegs(MAIN, 1, 1), ...toSegs(BRANCH, 0.62, 0.7)];

// Chebyshev distance from a cell centre to an axis-aligned segment: keeps the
// valley rings square, giving the pixel-staircase look.
const segDist = (x: number, y: number, s: Seg) => {
  const minX = Math.min(s.ax, s.bx);
  const maxX = Math.max(s.ax, s.bx);
  const minY = Math.min(s.ay, s.by);
  const maxY = Math.max(s.ay, s.by);
  const dx = Math.max(minX - x, 0, x - maxX);
  const dy = Math.max(minY - y, 0, y - maxY);
  return Math.max(dx, dy);
};

const hash = (i: number, j: number, k: number) => {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const nearest = (x: number, y: number) => {
  let best = Infinity;
  let strength = 0;
  let widthMul = 1;
  for (const s of SEGS) {
    const d = segDist(x, y, s) / s.width;
    if (d < best) {
      best = d;
      strength = s.depth;
      widthMul = s.width;
    }
  }
  return { best, strength, widthMul };
};

export type Cell = {
  x: number; // grid coords (u)
  y: number; // grid coords (v)
  dist: number; // distance to the nearest path segment (in cells)
  gx: number; // unit direction of increasing distance (away from the valley axis)
  gy: number;
  strength: number; // depth multiplier of the nearest branch
  widthMul: number;
  delay: number; // per-cell timing offset, in cycles
  jitter: number; // small per-cell depth variation
  rnd: number; // per-cell random amplitude for the rim / pop motion
  rnd2: number;
};

export const CELLS: Cell[] = (() => {
  const out: Cell[] = [];
  const half = GRID / 2;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const x = i - half + 0.5;
      const y = j - half + 0.5;
      const n = nearest(x, y);
      // Central-difference gradient of the distance field (axis aligned for
      // the Chebyshev metric, diagonal at the staircase corners).
      let gx = nearest(x + 0.5, y).best - nearest(x - 0.5, y).best;
      let gy = nearest(x, y + 0.5).best - nearest(x, y - 0.5).best;
      const gl = Math.hypot(gx, gy);
      if (gl > 1e-6) {
        gx /= gl;
        gy /= gl;
      } else {
        gx = 0;
        gy = hash(i, j, 5) < 0.5 ? 1 : -1;
      }
      out.push({
        x,
        y,
        dist: n.best,
        gx,
        gy,
        strength: n.strength,
        widthMul: n.widthMul,
        // Random per-cell jitter, a little lag away from the axis, and a
        // travelling delay along the path (the lower-left end leads).
        delay: hash(i, j, 1) * 0.05 + n.best * 0.008 + (x + half) * 0.0011,
        jitter: hash(i, j, 2) - 0.5,
        rnd: hash(i, j, 3),
        rnd2: hash(i, j, 4),
      });
    }
  }
  return out;
})();

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Valley opening over one cycle (phase 0..1), shaped after the reference:
// a ~40-frame rise from a slit to the full band, a short hold, a ~45-frame
// close, a brief springy flick as it snaps shut, then ~30 frames at rest.
export const opening = (phase: number) => {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.36) return smoothstep(0, 0.36, p);
  if (p < 0.42) return 1;
  if (p < 0.7) return 1 - smoothstep(0.42, 0.7, p);
  if (p < 0.8) {
    // Flick above the surface, then settle.
    const u = (p - 0.7) / 0.1;
    return -0.3 * Math.sin(Math.PI * Math.pow(u, 0.6)) * (1 - 0.5 * u);
  }
  return 0;
};

// Phase offset so frame 0 starts on a freshly opening slit (as the reference does).
export const PHASE_OFFSET = 0.12;

const W_MAX = 4.4; // half width of the fully open valley, in cells
const RIM_LIFT = 2.6; // how far the crater-rim tiles rise while open
const POP_LIFT = 3.0; // flick height when the valley snaps shut
const TILT_GAIN = 1.15; // exaggerates the slope -> tiles stand up as fins
const MAX_TILT = 1.1; // radians (~63 deg)

// Smooth (noise-free) height profile as a function of distance from the axis,
// used both for the height and, by finite differences, for the tile tilt.
const profile = (dist: number, a: number, strength: number) => {
  const w = a * W_MAX;
  const open = smoothstep(0, 0.1, a);
  const ring = Math.max(0, 1 - dist / (w + 0.6));
  const depth = MAX_DEPTH * strength * ring * open;
  const x = (dist - (w + 1.5)) / 1.4;
  const rim = RIM_LIFT * a * Math.exp(-x * x) * strength;
  return rim - depth;
};

export type Pose = {
  h: number; // tile top height relative to the surface (negative = sunk)
  tilt: number; // radians; positive tips the tile's top face towards the axis
  gx: number;
  gy: number;
};

/** Pose of a tile at `frame`: height plus a tilt about the axis across the slope. */
export const cellPose = (c: Cell, frame: number): Pose => {
  const phase = frame / CYCLE_FRAMES + PHASE_OFFSET - c.delay;
  const a = opening(phase);
  if (a < 0) {
    // Snap-shut flick: tiles near the path pop up and flip over, then settle.
    const reach = Math.max(0, 1 - c.dist / 7.5);
    const amt = -a * reach * c.strength;
    return {
      h: amt * POP_LIFT * (0.25 + 1.1 * c.rnd * c.rnd),
      tilt: amt * (2.2 + 2.5 * c.rnd2) * (c.rnd < 0.5 ? -1 : 1),
      gx: c.gx,
      gy: c.gy,
    };
  }
  const base = profile(c.dist, a, c.strength);
  const slope = (profile(c.dist + 0.5, a, c.strength) - profile(c.dist - 0.5, a, c.strength));
  const depthNoise = base < 0 ? 1 + 0.07 * c.jitter : 0.3 + 0.9 * Math.pow(c.rnd, 1.4);
  const h = base * depthNoise;
  const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, Math.atan(slope * TILT_GAIN) * (0.85 + 0.3 * c.rnd2)));
  return { h, tilt, gx: c.gx, gy: c.gy };
};
