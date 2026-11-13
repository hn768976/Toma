import { mulberry32 } from "../random";

/**
 * Choreography of the data-core landscape, keyed to the reference clip:
 *  0.0–1.2 s  foreground fin groups glow, panels drift
 *  1.6–3.1 s  a stacked glass/plate "core" block rises behind the hero panel
 *  2.8–4.4 s  bright white slab flare-up (luminance peak of the reference)
 *  4.0–7.3 s  tall dark data blocks rise on the right, panels re-arrange
 * Background cells rise/fall and flicker continuously.
 */

export const GRID_X = 9; // cells from -GRID_X..GRID_X along the rows (X)
export const GRID_Z = 9; // rows from -GRID_Z..GRID_Z (Z)
export const CELL = 1.0; // cell pitch
export const PLATES_PER_CELL = 26;
export const PLATE_SPACING = 0.038; // rows read as continuous combs of teeth
export const PLATE_THICKNESS = 0.015;
export const PLATE_DEPTH = 0.74;

const easeInOut = (x: number) =>
  x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/** Trapezoid envelope with eased ramps. */
const envelope = (t: number, t0: number, hold: number, ramp: number) => {
  if (t < t0 || t > t0 + ramp * 2 + hold) return 0;
  if (t < t0 + ramp) return easeInOut((t - t0) / ramp);
  if (t < t0 + ramp + hold) return 1;
  return 1 - easeInOut((t - t0 - ramp - hold) / ramp);
};

type HeightEvent = { t0: number; hold: number; ramp: number; h: number };
type GlowEvent = { t0: number; hold: number; ramp: number; g: number; wave: number };

export type Cell = {
  ix: number;
  iz: number;
  base: number;
  heights: HeightEvent[];
  glows: GlowEvent[];
  phase: number;
  /** background cell: its random glows follow the global light rhythm */
  bg: boolean;
  /** alternate plates glow less, so a lit stack reads as separate layers */
  stripe?: boolean;
};

const key = (ix: number, iz: number) => `${ix},${iz}`;

const buildCells = () => {
  const rnd = mulberry32(1678653);
  const cells = new Map<string, Cell>();
  for (let iz = -GRID_Z; iz <= GRID_Z; iz++) {
    for (let ix = -GRID_X; ix <= GRID_X; ix++) {
      const tallRow = rnd() < 0.18;
      const c: Cell = {
        ix,
        iz,
        base: tallRow ? 0.3 + rnd() * 0.2 : 0.14 + rnd() * 0.1,
        heights: [],
        glows: [],
        phase: rnd() * Math.PI * 2,
        bg: true,
      };
      // background life: random rises and glows
      const nRise = rnd() < 0.35 ? 1 + Math.floor(rnd() * 2) : 0;
      for (let k = 0; k < nRise; k++) {
        c.heights.push({
          t0: rnd() * 7.0 - 1.0,
          hold: 0.8 + rnd() * 2.5,
          ramp: 0.45 + rnd() * 0.4,
          h: 0.6 + rnd() * 0.9,
        });
      }
      if (rnd() < 0.68) {
        c.glows.push({
          t0: rnd() * 8 - 2.5,
          hold: 1.5 + rnd() * 4.0,
          ramp: 0.25 + rnd() * 0.3,
          g: 0.5 + rnd() * 0.6,
          wave: rnd(),
        });
      }
      cells.set(key(ix, iz), c);
    }
  }

  const at = (ix: number, iz: number) => cells.get(key(ix, iz))!;
  const clearNear = (ix: number, iz: number) => {
    const c = at(ix, iz);
    c.heights = [];
    c.glows = [];
    c.base = 0.17;
    c.bg = false;
  };
  // keep the hero area deterministic
  for (let iz = -2; iz <= 2; iz++) for (let ix = -2; ix <= 4; ix++) clearNear(ix, iz);

  // 0–1.2 s: foreground glowing fin groups
  for (const [ix, iz, g] of [
    [-1, 1, 1.0],
    [0, 1, 0.9],
    [-2, 1, 0.7],
    [1, 2, 0.8],
    [2, -1, 0.75],
  ] as const) {
    at(ix, iz).glows.push({ t0: -0.6, hold: 0.85, ramp: 0.4, g: g * 0.85, wave: 0.3 });
    at(ix, iz).base = 0.26;
  }
  // 1.6–3.1 s: hero core block rises
  at(1, 0).heights.push({ t0: 1.55, hold: 1.0, ramp: 0.55, h: 1.35 });
  at(1, 0).glows.push({ t0: 2.1, hold: 1.4, ramp: 0.45, g: 0.75, wave: 0.0 });
  at(1, 0).stripe = true;
  // 2.8–4.4 s: white slab flare-up
  for (const [ix, iz, g] of [
    [2, 0, 1.1],
    [1, 1, 0.9],
    [-1, 0, 0.8],
    [0, -1, 0.75],
    [3, -1, 0.7],
  ] as const) {
    at(ix, iz).glows.push({ t0: 2.3, hold: 1.1, ramp: 0.5, g, wave: 0.6 });
    at(ix, iz).stripe = true;
  }
  at(2, 0).heights.push({ t0: 2.7, hold: 1.0, ramp: 0.4, h: 0.62 });
  // 4.0–7.3 s: tall dark blocks rise on the right
  for (const [ix, iz, t0, h] of [
    [3, 1, 4.0, 1.5],
    [3, 0, 4.3, 1.25],
    [2, 2, 4.6, 1.45],
    [4, 1, 4.2, 1.6],
    [2, -2, 5.0, 1.3],
  ] as const) {
    at(ix, iz).heights.push({ t0, hold: 9, ramp: 0.7, h });
  }
  // late glows (left foreground) ~5–7 s
  at(-1, 1).glows.push({ t0: 5.0, hold: 3.0, ramp: 0.4, g: 0.9, wave: 0.2 });
  at(-2, 0).glows.push({ t0: 5.3, hold: 3.0, ramp: 0.4, g: 0.7, wave: 0.4 });
  // continuous foreground/mid-ground activity: staggered fin-stack rises
  for (const [ix, iz, t0, h, g] of [
    [-2, -1, 0.2, 0.7, 0.0],
    [0, -2, 0.7, 0.85, 0.0],
    [-1, 2, 1.2, 0.65, 0.0],
    [3, -1, 1.6, 0.9, 0.0],
    [-2, 2, 2.2, 0.75, 0.0],
    [0, 2, 2.9, 0.8, 0.45],
    [4, -2, 3.3, 0.95, 0.0],
    [-1, -2, 4.6, 0.7, 0.55],
    [4, 0, 4.4, 0.85, 0.0],
    [1, 2, 4.9, 0.7, 0.55],
    [-2, -2, 5.4, 0.8, 0.0],
    [2, 1, 5.9, 0.6, 0.0],
  ] as const) {
    at(ix, iz).heights.push({ t0, hold: 1.4, ramp: 0.55, h });
    if (g > 0) at(ix, iz).glows.push({ t0: t0 + 0.2, hold: 1.2, ramp: 0.4, g, wave: 0.5 });
  }
  return { cells: [...cells.values()], at };
};

export const CELLS = buildCells();

export const cellHeight = (c: Cell, t: number) => {
  let h = c.base;
  for (const e of c.heights) h = Math.max(h, c.base + (e.h - c.base) * envelope(t, e.t0, e.hold, e.ramp));
  return h;
};

/**
 * Global light rhythm of the background stacks, keyed to the reference's
 * luminance curve: bright opening, dark 1–2 s, peak 3–4 s, settle, dim end.
 */
const ambient = (t: number) => {
  const k = (t0: number, t1: number, x: number) => easeInOut((x - t0) / (t1 - t0));
  let a = 0.8;
  a -= 0.2 * (1 - k(1.9, 2.35, t)); // calmer opening
  a -= 0.22 * k(0.45, 0.95, t) * (1 - k(1.9, 2.35, t)); // dark section
  a += 0.3 * k(2.2, 2.65, t) * (1 - k(3.9, 4.4, t)); // flare section
  a += 0.3 * k(3.6, 4.2, t); // settle above the opening level
  a -= 0.12 * k(5.8, 6.6, t); // dim ending
  return a;
};

/** Glow of a plate (0..~1.3), with a soft wave travelling through the stack. */
/**
 * Exposure multiplier lifting the troughs of the light rhythm (1–2.4 s,
 * 4.2–6 s, end) so the overall brightness swing matches the reference.
 */
export const exposureLift = (t: number) => {
  const k = (t0: number, t1: number, x: number) => easeInOut((x - t0) / (t1 - t0));
  return (
    1 +
    0.25 * k(0.7, 1.1, t) * (1 - k(2.2, 2.6, t)) +
    0.22 * k(4.0, 4.4, t) * (1 - k(5.6, 6.2, t)) +
    0.15 * k(6.5, 7.0, t)
  );
};

export const plateGlow = (c: Cell, plate: number, t: number) => {
  let g = 0;
  for (const e of c.glows) {
    const delay = e.wave * plate * 0.025;
    g = Math.max(g, e.g * envelope(t - delay, e.t0, e.hold, e.ramp));
  }
  if (c.stripe) g *= plate % 2 === 0 ? 1.0 : 0.3;
  if (c.bg) g *= ambient(t);
  // subtle living shimmer
  return g * (0.85 + 0.15 * Math.sin(t * 5 + c.phase + plate * 0.7));
};

// ----------------------------------------------------------------- panels
export type PanelKey = { t: number; x: number; y: number; z: number };
export type Panel = {
  keys: PanelKey[];
  w: number;
  h: number;
  glyph: number;
  opacity: number;
  /** panels that ride on top of a rising cell */
  rideCell?: Cell;
};

const panelPos = (p: Panel, t: number) => {
  const k = p.keys;
  if (t <= k[0].t) return { ...k[0] };
  for (let i = 0; i < k.length - 1; i++) {
    if (t <= k[i + 1].t) {
      const e = easeInOut((t - k[i].t) / (k[i + 1].t - k[i].t));
      return {
        t,
        x: k[i].x + (k[i + 1].x - k[i].x) * e,
        y: k[i].y + (k[i + 1].y - k[i].y) * e,
        z: k[i].z + (k[i + 1].z - k[i].z) * e,
      };
    }
  }
  return { ...k[k.length - 1] };
};

export const panelPose = (p: Panel, t: number) => {
  const pos = panelPos(p, t);
  if (p.rideCell) pos.y += cellHeight(p.rideCell, t) - p.rideCell.base;
  // gentle hover
  pos.y += 0.012 * Math.sin(t * 1.3 + p.glyph * 1.7);
  return pos;
};

const buildPanels = (): Panel[] => {
  const rnd = mulberry32(219);
  const panels: Panel[] = [];
  const P = (
    keys: [number, number, number, number][],
    opts: Partial<Panel> = {},
  ) =>
    panels.push({
      keys: keys.map(([t, x, y, z]) => ({ t, x, y, z })),
      w: 0.98,
      h: 1.02,
      glyph: Math.floor(rnd() * 4),
      opacity: 1,
      ...opts,
    });

  // hero panel (centre) – slides one cell forward, then back
  P([
    [0, -0.5, 0.18, 0.0],
    [1.4, -0.5, 0.18, 0.0],
    [2.1, -0.5, 0.42, 1.0],
    [4.4, -0.5, 0.42, 1.0],
    [5.3, -0.5, 0.2, 0.0],
    [6.2, -0.5, 0.2, 0.0],
    [6.9, -1.5, 0.35, 0.0],
  ]);
  // upper-left panel pair
  P([
    [0, -1.5, 0.62, -1.0],
    [1.0, -1.5, 0.62, -1.0],
    [1.8, -1.5, 0.45, 0.0],
    [4.5, -1.5, 0.45, 0.0],
    [5.4, -1.5, 0.3, 1.0],
  ]);
  P([
    [0, 1.5, 0.5, -2.0],
    [2.5, 1.5, 0.5, -2.0],
    [3.4, 1.5, 0.75, -1.0],
  ]);
  // foreground left (out of focus)
  P([
    [0, -2.5, 0.1, 1.0],
    [3.0, -2.5, 0.1, 1.0],
    [3.8, -2.5, 0.25, 0.0],
    [5.0, -2.5, 0.25, 0.0],
    [5.8, -2.5, 0.55, 0.0],
  ]);
  // right side / back panels
  P([
    [0, 2.5, 0.62, -1.0],
    [1.2, 2.5, 0.62, -1.0],
    [2.0, 2.5, 0.4, 0.0],
  ]);
  P([[0, 3.5, 0.3, 1.0]], { rideCell: CELLS.at(3, 1) });
  P([[0, 4.5, 0.32, 1.0]], { rideCell: CELLS.at(4, 1) });
  P([[0, 2.5, 0.3, 2.0]], { rideCell: CELLS.at(2, 2) });
  P([[0, 3.5, 0.3, 0.0]], { rideCell: CELLS.at(3, 0) });
  // mid-ground panels around the focal plane
  P([[0, 1.5, 0.28, 1.0], [0.6, 1.5, 0.28, 1.0], [1.4, 1.5, 0.48, 1.0], [3.2, 1.5, 0.48, 1.0], [3.9, 1.5, 0.3, 0.0], [4.9, 1.5, 0.3, 0.0], [5.7, 2.5, 0.45, 1.0]]);
  P([[0, -0.5, 0.55, -1.0], [1.0, -0.5, 0.55, -1.0], [1.8, -0.5, 0.35, -1.0], [2.4, -0.5, 0.35, -1.0], [3.1, 0.5, 0.6, -1.0], [5.2, 0.5, 0.6, -1.0], [6.0, 0.5, 0.3, -2.0]]);
  P([[0, 0.5, 0.25, 2.0], [1.0, 0.5, 0.25, 2.0], [1.7, -0.5, 0.3, 2.0], [3.5, -0.5, 0.3, 2.0], [4.3, -0.5, 0.55, 2.0], [6.1, -0.5, 0.55, 2.0], [6.9, 0.5, 0.3, 2.0]]);
  P([[0, -1.5, 0.22, 1.0], [0.3, -1.5, 0.22, 1.0], [1.1, -1.5, 0.42, 1.0], [2.6, -1.5, 0.42, 1.0], [3.3, -1.5, 0.22, 1.0], [4.6, -1.5, 0.22, 1.0], [5.3, -1.5, 0.45, 1.0]]);
  P([[0, -2.5, 0.45, -1.0], [1.5, -2.5, 0.45, -1.0], [2.2, -2.5, 0.25, -1.0], [3.6, -2.5, 0.25, -1.0], [4.3, -2.5, 0.2, -2.0], [5.6, -2.5, 0.2, -2.0], [6.3, -1.5, 0.4, -2.0]]);
  // background panels
  for (let i = 0; i < 14; i++) {
    const ix = Math.floor(rnd() * 12) - 3;
    const iz = -2 - Math.floor(rnd() * 6);
    const t1 = 0.2 + rnd() * 2.6;
    const t2 = t1 + 1.2 + rnd() * 2.2;
    const y = 0.25 + rnd() * 0.6;
    const x2 = ix + 0.5 + (rnd() < 0.5 ? 1 : -1);
    const y2 = y + (rnd() - 0.5) * 0.5;
    const z2 = iz + (rnd() < 0.5 ? 1 : 0);
    P([
      [0, ix + 0.5, y, iz],
      [t1, ix + 0.5, y, iz],
      [t1 + 0.9, x2, y2, z2],
      [t2, x2, y2, z2],
      [t2 + 0.9, x2, y2 + (rnd() - 0.5) * 0.4, z2 + (rnd() < 0.5 ? -1 : 0)],
    ]);
  }
  // stacked glass plates of the rising core block
  const core = CELLS.at(1, 0);
  for (let s = 0; s < 7; s++) {
    P([[0, 0.62 + s * 0.06, -1.25, 0.0]], {
      rideCell: core,
      opacity: 0.75,
      h: 1.05,
      w: 0.9,
    });
  }
  return panels;
};

export const PANELS = buildPanels();
