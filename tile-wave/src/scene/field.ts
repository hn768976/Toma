// Pillar-grid "valley" model.
//
// A square grid of tall pillars. Along a zig-zag (pixel-staircase) path the
// pillars sink, forming a terraced V-shaped valley that opens from a thin slit
// to a wide band, holds, then closes again. One cycle = 120 frames (4 s), the
// same loop period as the reference; the shot runs 2.225 cycles (267 frames).

export const CYCLE_FRAMES = 120;
export const GRID = 96; // GRID x GRID pillars, centred on the origin
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

const toSegs = (pts: [number, number][], depth: number, width: number): Seg[] => {
  const out: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    out.push({ ax: pts[i][0], ay: pts[i][1], bx: pts[i + 1][0], by: pts[i + 1][1], depth, width });
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

export type Cell = {
  x: number; // grid coords (u)
  y: number; // grid coords (v)
  dist: number; // distance to the nearest path segment (in cells)
  strength: number; // depth multiplier of the nearest branch
  widthMul: number;
  delay: number; // per-cell timing jitter, in cycles
  jitter: number; // small per-cell depth variation
  rnd: number; // per-cell random amplitude for the rim / pop motion
};

export const CELLS: Cell[] = (() => {
  const out: Cell[] = [];
  const half = GRID / 2;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const x = i - half + 0.5;
      const y = j - half + 0.5;
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
      out.push({
        x,
        y,
        dist: best,
        strength,
        widthMul,
        delay: hash(i, j, 1) * 0.06 + best * 0.01,
        jitter: hash(i, j, 2) - 0.5,
        rnd: hash(i, j, 3),
      });
    }
  }
  return out;
})();

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Valley opening over one cycle (phase 0..1). Rises from a slit to the full
// band, holds, then snaps shut with a springy overshoot (negative values lift
// the pillars above the surface before they settle).
export const opening = (phase: number) => {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.4) return smoothstep(0, 0.4, p);
  if (p < 0.52) return 1;
  if (p < 0.8) {
    const u = (p - 0.52) / 0.28;
    return 1 - u * u * (2.2 - 1.2 * u); // accelerating close
  }
  if (p < 0.92) {
    // Fast pop above the surface, then a quick settle.
    const u = (p - 0.8) / 0.12;
    return -0.34 * Math.sin(Math.PI * Math.pow(u, 0.6)) * (1 - 0.5 * u);
  }
  return 0;
};

// Phase offset so frame 0 starts on a freshly opening slit (as the reference does).
export const PHASE_OFFSET = 0.1;

const W_MAX = 4.1; // half width of the fully open valley, in cells
const RIM_LIFT = 5.0; // how far the crater-rim pillars rise while open
const POP_LIFT = 7.5; // overshoot height when the valley snaps shut

/** Height of a pillar top relative to the surface (negative = sunk) at `frame`. */
export const cellHeight = (c: Cell, frame: number) => {
  const phase = frame / CYCLE_FRAMES + PHASE_OFFSET - c.delay;
  const a = opening(phase);
  if (a < 0) {
    // Snap-shut overshoot: pillars near the path pop up, then settle.
    const reach = Math.max(0, 1 - c.dist / 7.5);
    return -a * POP_LIFT * reach * c.strength * (0.25 + 1.1 * c.rnd * c.rnd);
  }
  const w = a * W_MAX;
  const open = smoothstep(0, 0.1, a);
  const ring = Math.max(0, 1 - c.dist / (w + 0.6));
  const depth = MAX_DEPTH * c.strength * ring * open * (1 + 0.07 * c.jitter);
  // Crater rim: a ring of pillars just outside the valley edge rises up.
  const x = (c.dist - (w + 1.6)) / 1.8;
  const rim = RIM_LIFT * a * Math.exp(-x * x) * c.strength * (0.15 + 0.85 * Math.pow(c.rnd, 1.6));
  return rim - depth;
};
