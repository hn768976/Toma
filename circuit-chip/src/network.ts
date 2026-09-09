import { makeRng, type Rng } from "./rng";

// ---------------------------------------------------------------------------
// Design space. Everything below is authored in 3840x2160 units and mapped to
// the real canvas through the SVG viewBox, so a 1080p preview is an exact
// half-scale copy of the 4K render.
// ---------------------------------------------------------------------------
export const DW = 3840;
export const DH = 2160;
export const CX = DW / 2;
export const CY = DH / 2;
export const RING_R = Math.round(0.11 * DH); // 0.22 x frame height, diameter

const GRID = 14;
const MARGIN = 5 * GRID; // routes may overshoot the frame before being clipped
const COLS = Math.ceil((DW + 2 * MARGIN) / GRID);
const ROWS = Math.ceil((DH + 2 * MARGIN) / GRID);
const OFF = Math.ceil(MARGIN / GRID);

export type Pt = { x: number; y: number };

export type Route = {
  pts: Pt[];
  cum: number[]; // cumulative arc length; cum[0] = 0
  len: number;
  w: number; // stroke width in design units
  tone: 0 | 1 | 2; // colour bucket
  offFrame: boolean; // true when the route runs out of frame
};

export type Pad = { x: number; y: number; r: number; w: number };
export type Via = { x: number; y: number; r: number };
export type Comp = { x: number; y: number; w: number; h: number; sw: number };
export type Label = { x: number; y: number; marks: number[]; h: number };
export type Dust = { x: number; y: number; w: number; h: number; phase: number };

export type Pulse = {
  route: number;
  turns: number; // whole traversals across the 600-frame loop
  phase: number;
  inward: boolean;
  head: number; // head radius in design units
  tail: number; // tail length in design units
  w: number;
};

export type Network = {
  routes: Route[];
  pads: Pad[];
  vias: Via[];
  comps: Comp[];
  labels: Label[];
  dust: Dust[];
  pulses: Pulse[];
};

// Eight compass directions. Diagonals advance one grid step on both axes, which
// is what keeps every corner a true 45 degree mitre.
const DIRS: Pt[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];
const DIR_LEN = DIRS.map((d) => Math.hypot(d.x, d.y));

const cell = (x: number, y: number) => {
  const cx = Math.floor(x / GRID) + OFF;
  const cy = Math.floor(y / GRID) + OFF;
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return -1;
  return cy * COLS + cx;
};

const inFrame = (p: Pt) =>
  p.x >= -MARGIN && p.x <= DW + MARGIN && p.y >= -MARGIN && p.y <= DH + MARGIN;

class Occupancy {
  private g = new Uint8Array(COLS * ROWS);

  // Marks the segment with a one-cell clearance to either SIDE only. Marking
  // ahead of the run would block the route's own next segment.
  mark(a: Pt, d: Pt, steps: number) {
    const px = -d.y;
    const py = d.x;
    for (let i = 0; i <= steps; i++) {
      const x = a.x + d.x * GRID * i;
      const y = a.y + d.y * GRID * i;
      for (let k = -1; k <= 1; k++) {
        const c = cell(x + px * GRID * k, y + py * GRID * k);
        if (c >= 0) this.g[c] = 1;
      }
    }
  }

  // The first grid step is exempt: a 45 degree turn out of a corner would
  // otherwise collide with the clearance of the segment it just left.
  free(a: Pt, d: Pt, steps: number) {
    for (let i = 2; i <= steps; i++) {
      const c = cell(a.x + d.x * GRID * i, a.y + d.y * GRID * i);
      if (c >= 0 && this.g[c]) return false;
    }
    return true;
  }
}

const snap = (v: number) => Math.round(v / GRID) * GRID;

const measure = (pts: Pt[]) => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { cum, len: cum[cum.length - 1] };
};

// Clips the last point of an escaping route back to the frame edge + margin.
const clipToFrame = (a: Pt, b: Pt): Pt => {
  let t = 1;
  const lim = (v0: number, v1: number, lo: number, hi: number) => {
    if (v1 < lo) t = Math.min(t, (lo - v0) / (v1 - v0));
    if (v1 > hi) t = Math.min(t, (hi - v0) / (v1 - v0));
  };
  lim(a.x, b.x, -MARGIN, DW + MARGIN);
  lim(a.y, b.y, -MARGIN, DH + MARGIN);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};

type WalkOpts = { maxSegs: number; short: boolean; w: number; tone: 0 | 1 | 2; attrition: number };

const walk = (rng: Rng, occ: Occupancy, angle: number, startR: number, o: WalkOpts): Route | null => {
  let p: Pt = { x: snap(CX + Math.cos(angle) * startR), y: snap(CY + Math.sin(angle) * startR) };
  const pts: Pt[] = [p];
  const home = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  let dir = home;
  let offFrame = false;

  for (let seg = 0; seg < o.maxSegs; seg++) {
    const r = Math.hypot(p.x - CX, p.y - CY);
    const out = { x: (p.x - CX) / (r || 1), y: (p.y - CY) / (r || 1) };

    // Real boards run long on the axes and use 45 degree segments as short
    // jogs between them. Each route also remembers the compass direction it
    // left the ring on and drifts back to it, which is what carries routes out
    // to the corners instead of collapsing the whole board into a cross.
    const diag = dir % 2 === 1;
    const onHome = dir === home;
    const straight = onHome ? (r > 700 ? 0.82 : 0.6) : diag ? 0.26 : 0.55;
    const dd = (dir - home + 8) % 8;
    const toHome = dd === 0 ? 0 : dd <= 4 ? -1 : 1;

    let first = dir;
    if (!rng.chance(straight)) {
      first = dir + (toHome !== 0 && rng.chance(0.55) ? toHome : rng.chance(0.5) ? 1 : -1);
    }
    const order = [first, first === dir ? dir + 1 : dir, first === dir ? dir + 7 : dir + 1, dir + 7];

    let moved = false;
    for (const raw of order) {
      const idx = ((raw % 8) + 8) % 8;
      const d = DIRS[idx];
      // Never double back towards the ring.
      if ((d.x * out.x + d.y * out.y) / DIR_LEN[idx] < -0.05) continue;

      const nSteps =
        idx % 2 === 1
          ? rng.int(2, 8)
          : o.short
            ? rng.int(3, 9)
            : r < 520
              ? rng.int(3, 12)
              : rng.int(6, 26);

      // The crowded ring cluster is left unchecked — that congestion is the
      // point. Collision avoidance kicks in once a route has cleared it.
      if (r > RING_R * 1.9 && !occ.free(p, d, nSteps)) continue;

      const next: Pt = { x: p.x + d.x * GRID * nSteps, y: p.y + d.y * GRID * nSteps };
      occ.mark(p, d, nSteps);
      if (!inFrame(next)) {
        pts.push(clipToFrame(p, next));
        offFrame = true;
        moved = true;
        break;
      }
      pts.push(next);
      p = next;
      dir = idx;
      moved = true;
      break;
    }

    if (!moved || offFrame) break;
    // Attrition with distance: the board thins towards the edges.
    if (seg >= 3 && rng.chance(o.attrition + (r / DW) * 0.045)) break;
  }

  if (pts.length < 2) return null;
  const { cum, len } = measure(pts);
  if (len < 3 * GRID) return null;
  return { pts, cum, len, w: o.w, tone: o.tone, offFrame };
};

// ---------------------------------------------------------------------------
// Arc-length lookup. Pulse positions are a lookup into `cum`, never a re-walk.
// ---------------------------------------------------------------------------
export const pointAt = (route: Route, s: number): Pt => {
  const { pts, cum } = route;
  const d = Math.max(0, Math.min(route.len, s));
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const span = cum[lo + 1] - cum[lo] || 1;
  const t = (d - cum[lo]) / span;
  return {
    x: pts[lo].x + (pts[lo + 1].x - pts[lo].x) * t,
    y: pts[lo].y + (pts[lo + 1].y - pts[lo].y) * t,
  };
};

/** Polyline covering [s0, s1] of a route, with the original corners preserved. */
export const slice = (route: Route, s0: number, s1: number): Pt[] => {
  const a = Math.max(0, Math.min(route.len, s0));
  const b = Math.max(0, Math.min(route.len, s1));
  if (b - a < 0.5) return [];
  const out: Pt[] = [pointAt(route, a)];
  for (let i = 1; i < route.cum.length - 1; i++) {
    if (route.cum[i] > a && route.cum[i] < b) out.push(route.pts[i]);
  }
  out.push(pointAt(route, b));
  return out;
};

export const toPath = (pts: Pt[]) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

// ---------------------------------------------------------------------------
// Board generation
// ---------------------------------------------------------------------------
const QUADRANTS = 4;
const BUS_PER_QUAD = 11;
const MAIN_PER_QUAD = 24;
const STUB_PER_QUAD = 18;

const buildNetwork = (seed: number): Network => {
  const occ = new Occupancy();
  const routes: Route[] = [];
  const pads: Pad[] = [];
  const vias: Via[] = [];
  const comps: Comp[] = [];
  const labels: Label[] = [];
  const dust: Dust[] = [];

  // Each quadrant is generated independently with the same rules and density —
  // never mirrored. Near symmetry reads as engineering; exact symmetry reads as
  // a wallpaper tile.
  const rngs = Array.from({ length: QUADRANTS }, (_, q) => makeRng(seed + q * 977 + 13));
  const quadBase = (q: number) => (q * Math.PI) / 2 - Math.PI;

  // Buses are routed first, across all four quadrants, so the long hauls that
  // carry the composition out to the frame edges claim their track before the
  // finer signal routes crowd the field.
  for (let k = 0; k < BUS_PER_QUAD; k++) {
    for (let q = 0; q < QUADRANTS; q++) {
      const rng = rngs[q];
      const angle =
        quadBase(q) + ((k + 0.5) / BUS_PER_QUAD) * (Math.PI / 2) + rng.range(-0.03, 0.03);
      const startR = RING_R * (1.07 + 0.16 * (k % 3));
      const w = rng.chance(0.45) ? 7 : 4.4;
      const r = walk(rng, occ, angle, startR, {
        maxSegs: 34,
        short: false,
        w,
        tone: w > 5 ? 2 : 1,
        attrition: 0.004,
      });
      if (r) routes.push(r);
    }
  }

  for (let k = 0; k < MAIN_PER_QUAD; k++) {
    for (let q = 0; q < QUADRANTS; q++) {
      const rng = rngs[q];
      const angle =
        quadBase(q) + ((k + 0.5) / MAIN_PER_QUAD) * (Math.PI / 2) + rng.range(-0.02, 0.02);
      const startR = RING_R * (1.1 + 0.12 * (k % 4));
      const roll = rng.next();
      const w = roll < 0.5 ? 4.4 : 2.8;
      const r = walk(rng, occ, angle, startR, {
        maxSegs: 28,
        short: false,
        w,
        tone: roll < 0.5 ? 1 : 0,
        attrition: 0.02,
      });
      if (r) routes.push(r);
    }
  }

  for (let q = 0; q < QUADRANTS; q++) {
    const rng = rngs[q];
    for (let k = 0; k < STUB_PER_QUAD; k++) {
      const angle = quadBase(q) + rng.range(0.02, Math.PI / 2 - 0.02);
      const startR = RING_R * rng.range(1.06, 1.3);
      const r = walk(rng, occ, angle, startR, {
        maxSegs: 6,
        short: true,
        w: 2.8,
        tone: 0,
        attrition: 0.05,
      });
      if (r) routes.push(r);
    }
  }

  for (let q = 0; q < QUADRANTS; q++) {
    const rng = rngs[q];
    const base = quadBase(q);
    // Illegible label fragments and the fine dust field that crowds the core.
    for (let i = 0; i < 60; i++) {
      const a = base + rng.range(0, Math.PI / 2);
      const rr = RING_R * rng.range(1.15, 7.2);
      const marks = Array.from({ length: rng.int(3, 7) }, () => rng.range(6, 17));
      labels.push({ x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr * 0.72, marks, h: rng.range(4, 6) });
    }
    for (let i = 0; i < 520; i++) {
      const a = base + rng.range(0, Math.PI / 2);
      const t = rng.next() ** 1.8; // biased inward — densest around the ring
      const rr = RING_R * (1.1 + t * 9);
      dust.push({
        x: CX + Math.cos(a) * rr,
        y: CY + Math.sin(a) * rr * 0.7,
        w: rng.chance(0.35) ? rng.range(8, 22) : rng.range(3, 6),
        h: 3,
        phase: rng.next(),
      });
    }
  }

  // Pads, vias and component outlines, placed once the routes exist.
  const frng = makeRng(seed + 4441);
  for (const r of routes) {
    if (!r.offFrame) {
      const end = r.pts[r.pts.length - 1];
      pads.push({ x: end.x, y: end.y, r: r.w * (frng.chance(0.5) ? 3.1 : 2.3), w: r.w * 0.8 });
    }
    for (let i = 1; i < r.pts.length - 1; i++) {
      if (frng.chance(0.16)) vias.push({ x: r.pts[i].x, y: r.pts[i].y, r: r.w * 1.9 });
    }
    // Component rectangles straddle an axis-aligned run.
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i];
      const b = r.pts[i + 1];
      const horiz = Math.abs(a.y - b.y) < 0.5;
      const vert = Math.abs(a.x - b.x) < 0.5;
      if ((!horiz && !vert) || Math.hypot(b.x - a.x, b.y - a.y) < 150) continue;
      if (!frng.chance(0.14)) continue;
      const t = frng.range(0.3, 0.7);
      const cx = a.x + (b.x - a.x) * t;
      const cy = a.y + (b.y - a.y) * t;
      const long = frng.range(46, 92);
      const shortSide = frng.range(20, 30);
      comps.push({
        x: cx - (horiz ? long : shortSide) / 2,
        y: cy - (horiz ? shortSide : long) / 2,
        w: horiz ? long : shortSide,
        h: horiz ? shortSide : long,
        sw: 2.4,
      });
    }
  }

  // ------------------------------------------------------------------------
  // Pulses. Every pulse completes a whole number of traversals over the loop,
  // so frame 600 is bit-identical to frame 0.
  // ------------------------------------------------------------------------
  const prng = makeRng(seed + 99991);
  const carriers = routes
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.len > 420)
    .sort((a, b) => b.r.len - a.r.len);

  const pulses: Pulse[] = [];
  const outCount = Math.min(74, carriers.length);
  for (let n = 0; n < outCount; n++) {
    const { r, i } = carriers[Math.floor((n / outCount) * carriers.length)];
    pulses.push({
      route: i,
      turns: prng.pick([1, 1, 2, 2, 3]),
      phase: prng.next(),
      inward: false,
      head: Math.max(4.6, r.w * 1.5),
      tail: prng.range(200, 430),
      w: r.w * 1.25,
    });
  }
  // A smaller number of returns, so the board reads as bidirectional rather
  // than purely broadcasting.
  for (let n = 0; n < 22; n++) {
    const { r, i } = carriers[prng.int(0, carriers.length - 1)];
    pulses.push({
      route: i,
      turns: prng.pick([1, 1, 2]),
      phase: prng.next(),
      inward: true,
      head: Math.max(4, r.w * 1.25),
      tail: prng.range(130, 240),
      w: r.w * 1.05,
    });
  }

  return { routes, pads, vias, comps, labels, dust, pulses };
};

const cache = new Map<number, Network>();
export const getNetwork = (seed: number): Network => {
  let n = cache.get(seed);
  if (!n) {
    n = buildNetwork(seed);
    cache.set(seed, n);
  }
  return n;
};
