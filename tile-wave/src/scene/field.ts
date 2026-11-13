// Tile-grid "valley" model.
//
// A square grid of thin square plates. Along a zig-zag (pixel-staircase) path
// the plates sink and tip over to follow the slope, forming a terraced V-shaped
// valley of fins that opens from a thin slit to a wide band, holds, then closes
// again. One cycle = 134 frames (~4.47 s), measured from the reference, so the
// 267-frame shot runs ~2 cycles, in phase with the reference.

export const CYCLE_FRAMES = 132;
export const GRID = 136; // GRID x GRID tiles, centred on the origin
export const MAX_DEPTH = 4.0; // depth of the valley floor, in tile units

type Seg = { ax: number; ay: number; bx: number; by: number; depth: number; width: number };

// Deterministic PRNG for the path layout.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Staircase ("lightning") path in grid coordinates: runs of 6-9 tiles along
// u alternate with steps of 3-5 tiles along v, always climbing the same way,
// so the band zig-zags along the tile grid while running diagonally to it.
const staircase = (u0: number, v0: number, uEnd: number, seed: number, dirU: 1 | -1, dirV: 1 | -1, short = 1) => {
  const rnd = mulberry32(seed);
  const pts: [number, number][] = [[u0, v0]];
  let u = u0;
  let v = v0;
  while (dirU > 0 ? u < uEnd : u > uEnd) {
    u += dirU * Math.round((11 + Math.floor(rnd() * 4)) * short);
    pts.push([u, v]);
    v += dirV * (6 + Math.floor(rnd() * 3));
    pts.push([u, v]);
  }
  return pts;
};

// Along-band / across-band coordinates in grid space (band direction ~ (7, 4)).
const BAND = { x: 0.868, y: 0.496 };
export const alongBand = (x: number, y: number) => x * BAND.x + y * BAND.y;
export const acrossBand = (x: number, y: number) => -x * BAND.y + y * BAND.x;

const MAIN = staircase(-74, -44, 74, 7, 1, 1);
// Shorter side branch splitting off the main band towards the lower-left.
const BRANCH = staircase(-30, -16, -74, 11, -1, -1, 0.8);

const toSegs = (pts: [number, number][], depth: number, width: number): Seg[] => {
  const out: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    out.push({ ax: pts[i][0], ay: pts[i][1], bx: pts[i + 1][0], by: pts[i + 1][1], depth, width });
  }
  return out;
};

const SEGS: Seg[] = [...toSegs(MAIN, 1, 1), ...toSegs(BRANCH, 0.7, 0.75)];

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
  colRnd: number; // per-column random: which columns form long blades
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
        delay: hash(i, j, 1) * 0.04 + n.best * 0.006 + (alongBand(x, y) + half) * 0.0007,
        jitter: hash(i, j, 2) - 0.5,
        rnd: hash(i, j, 3),
        rnd2: hash(i, j, 4),
        colRnd: hash(i, 77, 9),
      });
    }
  }
  return out;
})();

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Valley opening over one cycle (phase 0..1), fitted to the reference's
// colour curve: a steady opening from a slit (~42 frames), a short hold that
// keeps widening slowly, a gradual close (~48 frames), then a brief rest.
export const opening = (phase: number) => {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.34) return 0.92 * smoothstep(0.0, 0.34, p);
  if (p < 0.59) return 0.92 + 0.08 * smoothstep(0.34, 0.59, p);
  if (p < 0.95) return 1 - smoothstep(0.59, 0.95, p);
  return 0;
};

// Phase offset so frame 0 lands about a quarter of the way into an opening,
// as in the reference.
export const PHASE_OFFSET = 0.25;

const W_MAX = 6.0; // half width of the fully open valley, in cells
const RIM_LIFT = 2.6; // how far the crater-rim tiles rise while open
const POP_LIFT = 1.2; // flick height when the valley snaps shut
const TILT_GAIN = 1.15; // exaggerates the slope -> tiles stand up as fins
const MAX_TILT = 1.1; // radians (~63 deg)

// Smooth (noise-free) height profile as a function of distance from the axis,
// used both for the height and, by finite differences, for the tile tilt.
const profile = (dist: number, a: number, strength: number) => {
  const w = a * W_MAX;
  const open = smoothstep(0, 0.1, a);
  const ring = Math.max(0, 1 - dist / (w + 0.6));
  const depth = MAX_DEPTH * strength * ring * open;
  const x = (dist - (w + 1.0)) / 1.0;
  const rim = 0.6 * RIM_LIFT * a * Math.exp(-x * x) * strength;
  return rim - depth;
};

export type Pose = {
  h: number; // tile top height relative to the surface (negative = sunk)
  tilt: number; // radians; positive tips the tile's top face towards the axis
  gx: number;
  gy: number;
  blade: number; // 0..1: how far the tile is drawn out into a long blade
};

// While the valley closes, tiles around the path are drawn out into long,
// shingled blades across the band (as in the reference), then relax.
const bladeEnv = (p: number) => {
  const q = ((p % 1) + 1) % 1;
  // Closing: blades grow as the valley narrows, then relax during the rest.
  const closing = smoothstep(0.66, 0.8, q) * (1 - smoothstep(0.9, 1.0, q));
  // Opening slit: the first tiles to tip are drawn out too.
  const w = q > 0.5 ? q - 1 : q;
  const opening = Math.exp(-Math.pow((w - 0.04) / 0.07, 2));
  return Math.max(closing, opening);
};
const BLADE_REACH = 7.0; // cells from the axis that form blades
const BLADE_TILT = 0.2; // radians
const BLADE_ROT = 0.24; // radians
const BLADE_COS = Math.cos(BLADE_ROT);
const BLADE_SIN = Math.sin(BLADE_ROT);

// Blades all point straight across the band (as in the reference); tiles
// blend from their local slope direction towards that as they are drawn out.
const bladeDir = (c: Cell, blade: number): [number, number] => {
  const side = Math.sign(acrossBand(c.gx, c.gy)) || (c.rnd < 0.5 ? -1 : 1);
  // Rotated off the grid-space normal so that, after the camera's
  // foreshortening, the slats read perpendicular to the band on screen.
  const ax = (-BAND.y * BLADE_COS - BAND.x * BLADE_SIN) * side;
  const ay = (BAND.x * BLADE_COS - BAND.y * BLADE_SIN) * side;
  const k = Math.min(1, blade * 8);
  const x = c.gx + (ax - c.gx) * k;
  const y = c.gy + (ay - c.gy) * k;
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

/** Pose of a tile at `frame`: height plus a tilt about the axis across the slope. */
export const cellPose = (c: Cell, frame: number): Pose => {
  const phase = frame / CYCLE_FRAMES + PHASE_OFFSET - c.delay;
  const a = opening(phase);
  const reachB = Math.max(0, 1 - c.dist / BLADE_REACH) * c.strength;
  // Rows stay in step: a gentle per-row variation only.
  // Whole columns across the band are drawn out together, so neighbouring
  // tiles overlap into one long shingled strip; the columns between stay flat.
  const colSel = smoothstep(0.6, 0.68, c.colRnd);
  const blade = bladeEnv(phase) * Math.pow(reachB, 0.7) * colSel * (0.75 + 0.25 * c.rnd2);
  if (a < 0) {
    // Snap-shut: tiles near the path lift and roll over together, then settle.
    const reach = Math.max(0, 1 - c.dist / 7.5);
    const amt = -a * reach * c.strength;
    return {
      h: amt * POP_LIFT * (0.35 + 0.3 * c.rnd),
      tilt: BLADE_TILT * blade + amt * (0.6 + 0.3 * c.rnd2),
      gx: bladeDir(c, blade)[0],
      gy: bladeDir(c, blade)[1],
      blade,
    };
  }
  // The band edge breathes: its width swells and shrinks in waves that travel
  // along the band, so the open shape reads organic and never holds still.
  const al = alongBand(c.x, c.y);
  const dist = c.dist - a * (0.9 * Math.sin(al * 0.16 - phase * 2 * Math.PI * 1.4) + 0.5 * Math.sin(al * 0.37 + phase * 2 * Math.PI * 2.1 + 1.3));
  const base = profile(dist, a, c.strength);
  const [bx, by] = bladeDir(c, blade);
  const slope = (profile(dist + 0.5, a, c.strength) - profile(dist - 0.5, a, c.strength));
  const depthNoise = base < 0 ? 1 + 0.16 * c.jitter : 0.8 + 0.3 * c.rnd;
  // The valley floor keeps bobbing gently while open (no dead hold).
  const bob = base < 0 ? 0.3 * a * Math.sin(2 * Math.PI * (phase * 3.0 + c.rnd)) : 0;
  // Blades are lifted so they stand proud of the surface as pale slats
  // instead of dipping into the coloured layers.
  // While shut, the tiles along the seam stay tipped on edge, so the closed
  // band reads as a dashed dark line (every other tile).
  const q = ((phase % 1) + 1) % 1;
  const seamEnv = (q > 0.5 ? smoothstep(0.78, 0.9, q) : 1 - smoothstep(0.03, 0.12, q)) * (1 - smoothstep(0.05, 0.3, a));
  const seam = seamEnv * Math.exp(-Math.pow(c.dist / 1.1, 2)) * c.strength * (c.rnd < 0.4 ? 1 : 0);
  const h = base * depthNoise + bob + 0.5 * blade - 0.35 * seam;
  // Rim cards keep fluttering while the band is open (the reference never holds still).
  const rimMask = Math.exp(-Math.pow((dist - (a * W_MAX + 1.0)) / 2.2, 2)) * c.strength;
  const flutter = 0.32 * a * rimMask * Math.sin(2 * Math.PI * (phase * 2.6 + c.rnd));
  // In the valley tiles follow the slope; on the rim they stand up as cards
  // all leaning in towards the axis, like overlapping scales.
  const rimF = Math.exp(-Math.pow((dist - (a * W_MAX + 1.0)) / 1.0, 2)) * a * c.strength;
  const slopeTilt =
    (base < 0 ? Math.atan(slope * TILT_GAIN) * (0.55 + 0.9 * c.rnd2) : rimF * (0.85 + 0.15 * c.rnd2)) + flutter;
  // Standing slats keep swaying slightly while they lie back down.
  const sway = 0.12 * blade * Math.sin(2 * Math.PI * (phase * 2.2 + c.rnd2));
  const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, slopeTilt + BLADE_TILT * blade + sway + 0.6 * seam * (0.8 + 0.4 * Math.sin(2 * Math.PI * (phase * 1.5 + c.rnd2)))));
  return { h, tilt, gx: bx, gy: by, blade };
};
