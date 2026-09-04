import { clamp, intRange, lerp, makeRng, range, Rng } from "./rng";

/**
 * The board is generated once, at module scope, in "width units": x = 0 is the
 * left edge of the frame, x = 1 the right edge, and y runs 0..ASPECT top to
 * bottom. Nothing here knows about pixels, so a 1080p preview and a 4K render
 * are the same picture at different sample rates.
 */
export const ASPECT = 2160 / 3840;

/** Extra board generated outside the frame so the camera has somewhere to drift. */
export const OVERSCAN = 0.05;

export const X0 = -OVERSCAN;
export const Y0 = -OVERSCAN;
export const X1 = 1 + OVERSCAN;
export const Y1 = ASPECT + OVERSCAN;

/** Routing lattice pitch. Traces sit one cell apart, which is what sets the
 *  fine parallel-bus look. */
const PITCH = 0.0052;
const COLS = Math.round((X1 - X0) / PITCH);
const ROWS = Math.round((Y1 - Y0) / PITCH);

/** Trace width tiers: thin signal lines, signals, and thicker buses. */
export const TIER_WIDTH = [0.00085, 0.00125, 0.00205] as const;

export type Pt = { x: number; y: number };

export type Trace = {
  pts: Pt[];
  /** Cumulative arc length; cum[0] === 0, cum[n-1] === len. */
  cum: number[];
  len: number;
  tier: number;
  /** Hue-bucket index, resolved from the trace centroid at build time. */
  hx: number;
  hy: number;
};

export type Line = { x1: number; y1: number; x2: number; y2: number; w: number };
export type RectPart = {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  lw: number;
};
export type CirclePart = { x: number; y: number; r: number; lw: number };
export type DashPart = Line & { dash: number };

/** Anything a pulse can briefly light up when it passes. */
export type Lightable =
  | { kind: "via"; x: number; y: number; r: number }
  | { kind: "pad"; x: number; y: number; w: number; h: number; r: number };

export type Board = {
  traces: Trace[];
  lines: Line[];
  rects: RectPart[];
  circles: CirclePart[];
  dashes: DashPart[];
  lightables: Lightable[];
  /** Uniform grid over the board for nearest-lightable queries. */
  lightGrid: { cell: number; cols: number; rows: number; buckets: number[][] };
};

// ---------------------------------------------------------------------------
// Density field — decides where the board is crowded and where it goes dark.
// ---------------------------------------------------------------------------

type Blob = { x: number; y: number; r: number; amp: number };

const makeDensity = (rng: Rng, hotspots: Pt[]) => {
  const blobs: Blob[] = [];
  for (let i = 0; i < 9; i++) {
    blobs.push({
      x: range(rng, X0, X1),
      y: range(rng, Y0, Y1),
      r: range(rng, 0.1, 0.32),
      amp: range(rng, -0.55, 0.45),
    });
  }
  return (x: number, y: number): number => {
    let v = 0.76;
    for (const b of blobs) {
      const dx = (x - b.x) / b.r;
      const dy = (y - b.y) / b.r;
      v += b.amp * Math.exp(-(dx * dx + dy * dy));
    }
    // Crowd the areas around components.
    for (const h of hotspots) {
      const dx = (x - h.x) / 0.11;
      const dy = (y - h.y) / 0.11;
      v += 0.42 * Math.exp(-(dx * dx + dy * dy));
    }
    return clamp(v, 0.03, 1);
  };
};

// ---------------------------------------------------------------------------
// Occupancy grid
// ---------------------------------------------------------------------------

const idx = (c: number, r: number) => r * COLS + c;
const cellX = (c: number) => X0 + (c + 0.5) * PITCH;
const cellY = (r: number) => Y0 + (r + 0.5) * PITCH;

/** Manhattan + 45°: the only eight moves a trace may make. */
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

type Pin = { c: number; r: number; d: number };

type BuildCtx = {
  rng: Rng;
  occ: Uint8Array;
  lines: Line[];
  rects: RectPart[];
  circles: CirclePart[];
  dashes: DashPart[];
  lightables: Lightable[];
  pins: Pin[];
};

const blockRect = (
  occ: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  const c0 = Math.max(0, Math.floor((x - w / 2 - X0) / PITCH));
  const c1 = Math.min(COLS - 1, Math.ceil((x + w / 2 - X0) / PITCH));
  const r0 = Math.max(0, Math.floor((y - h / 2 - Y0) / PITCH));
  const r1 = Math.min(ROWS - 1, Math.ceil((y + h / 2 - Y0) / PITCH));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) occ[idx(c, r)] = 1;
  }
};

const nearestCell = (x: number, y: number): [number, number] => [
  clamp(Math.round((x - X0) / PITCH - 0.5), 0, COLS - 1),
  clamp(Math.round((y - Y0) / PITCH - 0.5), 0, ROWS - 1),
];

/**
 * A quad-flat-pack footprint: body outline, an inner ring, and a comb of fine
 * pins on each requested edge. The comb is the feature that sells the IC, so
 * the pins are drawn individually rather than as a hatched block.
 */
const addIc = (
  ctx: BuildCtx,
  cx: number,
  cy: number,
  w: number,
  h: number,
  sides: string,
  pinCount: number,
  /** Open packages are drawn as pin combs around routable board, the way the
   *  big centre footprint reads on a real photographed board. */
  open = false,
) => {
  const { rects, lines, occ, pins } = ctx;
  if (open) {
    rects.push({ x: cx, y: cy, w, h, r: w * 0.03, lw: 0.001 });
  } else {
    rects.push({ x: cx, y: cy, w, h, r: w * 0.035, lw: 0.0016 });
    rects.push({
      x: cx,
      y: cy,
      w: w - 0.018,
      h: h - 0.018,
      r: w * 0.03,
      lw: 0.0009,
    });
    // Die outline, so a package body isn't a plain void.
    rects.push({
      x: cx,
      y: cy,
      w: w * 0.52,
      h: h * 0.52,
      r: w * 0.02,
      lw: 0.0008,
    });
    ctx.circles.push({
      x: cx - w * 0.34,
      y: cy - h * 0.34,
      r: Math.min(w, h) * 0.045,
      lw: 0.001,
    });
  }

  const pinLen = 0.03;
  const pinW = 0.0017;

  const bank = (side: "l" | "r" | "t" | "b") => {
    const horizontal = side === "t" || side === "b";
    const span = (horizontal ? w : h) - 0.03;
    const n = pinCount;
    const step = span / (n - 1);
    const outward = side === "l" || side === "t" ? -1 : 1;
    const bankDepth = pinLen + 0.006;

    // Outline around the comb, as on the reference board.
    if (horizontal) {
      rects.push({
        x: cx,
        y: cy + outward * (h / 2 + bankDepth / 2),
        w: span + 0.012,
        h: bankDepth,
        r: 0.004,
        lw: 0.0009,
      });
    } else {
      rects.push({
        x: cx + outward * (w / 2 + bankDepth / 2),
        y: cy,
        w: bankDepth,
        h: span + 0.012,
        r: 0.004,
        lw: 0.0009,
      });
    }

    for (let i = 0; i < n; i++) {
      const t = -span / 2 + i * step;
      let x1: number, y1: number, x2: number, y2: number;
      if (horizontal) {
        x1 = cx + t;
        y1 = cy + outward * (h / 2);
        x2 = x1;
        y2 = y1 + outward * pinLen;
      } else {
        x1 = cx + outward * (w / 2);
        y1 = cy + t;
        x2 = x1 + outward * pinLen;
        y2 = y1;
      }
      lines.push({ x1, y1, x2, y2, w: pinW });
      // Every other pin seeds a route, so traces fan out of the package.
      if (i % 2 === 0) {
        const [c, r] = nearestCell(x2, y2);
        const d = horizontal ? (outward < 0 ? 6 : 2) : outward < 0 ? 4 : 0;
        pins.push({ c, r, d });
      }
    }
  };

  for (const s of sides) bank(s as "l" | "r" | "t" | "b");

  // Keep routes out of the package body and out from under the combs.
  if (!open) blockRect(occ, cx, cy, w + 0.002, h + 0.002);
  for (const s of sides) {
    const horizontal = s === "t" || s === "b";
    const outward = s === "l" || s === "t" ? -1 : 1;
    const d = pinLen + 0.006;
    if (horizontal) {
      blockRect(occ, cx, cy + outward * (h / 2 + d / 2), w + 0.014, d);
    } else {
      blockRect(occ, cx + outward * (w / 2 + d / 2), cy, d, h + 0.014);
    }
  }
};

const addPad = (ctx: BuildCtx, x: number, y: number, w: number, h: number) => {
  const r = Math.min(w, h) * 0.28;
  ctx.rects.push({ x, y, w, h, r, lw: 0.0013 });
  ctx.lightables.push({ kind: "pad", x, y, w, h, r });
  blockRect(ctx.occ, x, y, w + 0.004, h + 0.004);
};

const addVia = (ctx: BuildCtx, x: number, y: number, r: number) => {
  ctx.circles.push({ x, y, r, lw: 0.0011 });
  ctx.lightables.push({ kind: "via", x, y, r });
};

const addTwoPad = (ctx: BuildCtx, x: number, y: number, vertical: boolean) => {
  const len = range(ctx.rng, 0.012, 0.021);
  const pw = 0.0055;
  const dx = vertical ? 0 : len / 2;
  const dy = vertical ? len / 2 : 0;
  addPad(ctx, x - dx, y - dy, vertical ? pw * 1.6 : pw, vertical ? pw : pw * 1.6);
  addPad(ctx, x + dx, y + dy, vertical ? pw * 1.6 : pw, vertical ? pw : pw * 1.6);
  ctx.lines.push({
    x1: x - dx,
    y1: y - dy,
    x2: x + dx,
    y2: y + dy,
    w: 0.0011,
  });
};

// ---------------------------------------------------------------------------
// Route walker
// ---------------------------------------------------------------------------

const buildTrace = (pts: Pt[], tier: number): Trace | null => {
  // Drop collinear vertices so arc-length lookup stays cheap.
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  if (out.length < 2) return null;

  const cum = [0];
  let len = 0;
  for (let i = 1; i < out.length; i++) {
    len += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
    cum.push(len);
  }
  if (len < 0.03) return null;

  let sx = 0;
  let sy = 0;
  for (const p of out) {
    sx += p.x;
    sy += p.y;
  }
  return {
    pts: out,
    cum,
    len,
    tier,
    hx: sx / out.length,
    hy: sy / out.length,
  };
};

/** One straight run of a route: a direction plus how many cells it covers. */
type Move = { dir: number; steps: number };

/**
 * Walk a route across the lattice in Manhattan/45° steps, biased hard toward
 * continuing straight so runs cover real ground before bending.
 *
 * Passing `script` replays an earlier route's move list instead of choosing
 * moves at random, which is how parallel bus bundles are built: the same turn
 * sequence started one cell to the side.
 */
const walk = (
  rng: Rng,
  occ: Uint8Array,
  density: (x: number, y: number) => number,
  startC: number,
  startR: number,
  startDir: number,
  script?: readonly Move[],
): { pts: Pt[]; moves: Move[] } | null => {
  if (startC < 0 || startR < 0 || startC >= COLS || startR >= ROWS) return null;
  if (occ[idx(startC, startR)]) return null;

  let c = startC;
  let r = startR;
  let dir = startDir;
  const pts: Pt[] = [{ x: cellX(c), y: cellY(r) }];
  const marked: number[] = [idx(c, r)];
  occ[idx(c, r)] = 1;

  const moves: Move[] = [];
  const maxTurns = script ? script.length : intRange(rng, 7, 24);
  const maxCells = script ? 100000 : intRange(rng, 90, 400);
  let cells = 0;
  let stalls = 0;

  for (let turn = 0; turn < maxTurns && cells < maxCells; turn++) {
    if (script) dir = script[turn].dir;

    // Long runs: a trace should cover real ground before it bends.
    let run: number;
    if (script) {
      run = script[turn].steps;
    } else {
      run = 5 + Math.floor(rng() * 22);
      if (rng() < 0.32) run += 26;
    }

    let stepped = 0;
    for (let s = 0; s < run && cells < maxCells; s++) {
      const nc = c + DIRS[dir][0];
      const nr = r + DIRS[dir][1];
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) break;
      if (occ[idx(nc, nr)]) break;
      c = nc;
      r = nr;
      occ[idx(c, r)] = 1;
      marked.push(idx(c, r));
      stepped++;
      cells++;
    }

    if (stepped > 0) {
      pts.push({ x: cellX(c), y: cellY(r) });
      moves.push({ dir, steps: stepped });
      stalls = 0;
    } else if (++stalls >= 2) {
      break;
    }

    // A bus sibling that hit an obstruction stops rather than improvising.
    if (script) {
      if (stepped < run) break;
      continue;
    }

    // Thin out where the board is meant to be sparse.
    if (rng() > density(cellX(c), cellY(r)) * 0.72 + 0.42) break;

    // Turn by 45°, occasionally 90°.
    const options =
      rng() < 0.84 ? [1, -1] : rng() < 0.62 ? [2, -2] : [1, -1, 2, -2];
    if (rng() < 0.5) options.reverse();
    let turned = false;
    for (const o of options) {
      const nd = (dir + o + 8) % 8;
      const nc = c + DIRS[nd][0];
      const nr = r + DIRS[nd][1];
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      if (occ[idx(nc, nr)]) continue;
      dir = nd;
      turned = true;
      break;
    }
    if (!turned) break;
  }

  if (cells < 12) {
    for (const m of marked) occ[m] = 0;
    return null;
  }
  return { pts, moves };
};

// ---------------------------------------------------------------------------
// Board assembly
// ---------------------------------------------------------------------------

export const buildBoard = (seed: number): Board => {
  const rng = makeRng(seed);
  const occ = new Uint8Array(COLS * ROWS);
  const ctx: BuildCtx = {
    rng,
    occ,
    lines: [],
    rects: [],
    circles: [],
    dashes: [],
    lightables: [],
    pins: [],
  };

  // The centre-left package, the frame's anchor: four fine pin combs with the
  // board still routed through the middle.
  addIc(ctx, 0.385, 0.285, 0.185, 0.185, "lrtb", 26, true);
  // Supporting packages.
  addIc(ctx, 0.79, 0.1, 0.075, 0.115, "lr", 16);
  addIc(ctx, 0.115, 0.455, 0.105, 0.06, "tb", 18);
  addIc(ctx, 0.655, 0.475, 0.085, 0.055, "tb", 14);
  addIc(ctx, 0.965, 0.375, 0.07, 0.09, "lr", 13);

  const hotspots: Pt[] = [
    { x: 0.385, y: 0.285 },
    { x: 0.79, y: 0.1 },
    { x: 0.115, y: 0.455 },
    { x: 0.655, y: 0.475 },
    { x: 0.965, y: 0.375 },
  ];
  const density = makeDensity(rng, hotspots);

  // Neat rows of pads on the right, as on the reference board.
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      addPad(
        ctx,
        0.845 + col * 0.042,
        0.215 + row * 0.05,
        range(rng, 0.02, 0.029),
        range(rng, 0.024, 0.032),
      );
    }
  }
  for (let col = 0; col < 5; col++) {
    addPad(ctx, 0.2 + col * 0.036, 0.045, 0.024, 0.018);
  }

  // Scattered pads, two-pad parts and dashed segments.
  for (let i = 0; i < 26; i++) {
    const x = range(rng, X0 + 0.02, X1 - 0.02);
    const y = range(rng, Y0 + 0.02, Y1 - 0.02);
    if (rng() > density(x, y)) continue;
    addPad(ctx, x, y, range(rng, 0.012, 0.03), range(rng, 0.01, 0.026));
  }
  for (let i = 0; i < 46; i++) {
    const x = range(rng, X0 + 0.02, X1 - 0.02);
    const y = range(rng, Y0 + 0.02, Y1 - 0.02);
    if (rng() > density(x, y)) continue;
    addTwoPad(ctx, x, y, rng() < 0.4);
  }
  for (let i = 0; i < 34; i++) {
    const x = range(rng, X0 + 0.04, X1 - 0.04);
    const y = range(rng, Y0 + 0.02, Y1 - 0.02);
    if (rng() > density(x, y)) continue;
    const len = range(rng, 0.03, 0.09);
    const vertical = rng() < 0.35;
    ctx.dashes.push({
      x1: x,
      y1: y,
      x2: vertical ? x : x + len,
      y2: vertical ? y + len : y,
      w: 0.0013,
      dash: range(rng, 0.004, 0.009),
    });
  }

  // ---- Routing -----------------------------------------------------------
  const traces: Trace[] = [];
  const pins = ctx.pins.slice();
  // Shuffle pins so fan-out isn't in package order.
  for (let i = pins.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pins[i], pins[j]] = [pins[j], pins[i]];
  }

  const tierFor = (): number => {
    const t = rng();
    return t < 0.64 ? 0 : t < 0.91 ? 1 : 2;
  };

  /**
   * Route once from (c, r), then replay the same turn sequence from cells
   * offset perpendicular to the start direction. That is what produces the
   * parallel bundles a real board is full of.
   */
  const routeWithBus = (c: number, r: number, d: number, busBias: number) => {
    const first = walk(rng, occ, density, c, r, d);
    if (!first) return;
    const tier = tierFor();
    const head = buildTrace(first.pts, tier);
    if (head) traces.push(head);

    if (rng() > busBias) return;
    const siblings = intRange(rng, 1, 7);
    const perp = DIRS[(d + 2) % 8];
    const sign = rng() < 0.5 ? 1 : -1;
    for (let i = 1; i <= siblings; i++) {
      const sib = walk(
        rng,
        occ,
        density,
        c + perp[0] * i * sign,
        r + perp[1] * i * sign,
        d,
        first.moves,
      );
      if (!sib) break; // bundle is blocked from here outwards
      const t = buildTrace(sib.pts, tier);
      if (t) traces.push(t);
    }
  };

  // Pass 1 - long backbone runs across an empty board. Going first is what
  // lets these travel a good fraction of the frame before terminating.
  for (let attempt = 0; attempt < 900; attempt++) {
    const c = Math.floor(rng() * COLS);
    const r = Math.floor(rng() * ROWS);
    if (occ[idx(c, r)]) continue;
    const d = [0, 0, 0, 4, 4, 4, 1, 3, 5, 7][Math.floor(rng() * 10)];
    routeWithBus(c, r, d, 0.62);
  }

  // Pass 2 - routes that start on a package pin, fanning out of the packages.
  for (const pin of pins) {
    let c = pin.c;
    let r = pin.r;
    // Step off the pin until we clear the package keep-out.
    for (let s = 0; s < 5 && occ[idx(c, r)]; s++) {
      c += DIRS[pin.d][0];
      r += DIRS[pin.d][1];
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) break;
    }
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS || occ[idx(c, r)]) continue;
    routeWithBus(c, r, pin.d, 0.25);
  }

  // Pass 3 - free routes fill the rest of the board.
  for (let attempt = 0; attempt < 30000; attempt++) {
    const c = Math.floor(rng() * COLS);
    const r = Math.floor(rng() * ROWS);
    if (occ[idx(c, r)]) continue;
    if (rng() > density(cellX(c), cellY(r))) continue;
    // Favour horizontal and diagonal starts, as real routing does.
    const d = [0, 0, 4, 4, 1, 3, 5, 7, 2, 6][Math.floor(rng() * 10)];
    routeWithBus(c, r, d, attempt < 9000 ? 0.55 : 0.3);
  }

  // Vias where routes end or turn hard.
  const viaR = 0.0033;
  for (const t of traces) {
    if (rng() < 0.34) addVia(ctx, t.pts[0].x, t.pts[0].y, viaR);
    if (rng() < 0.34) {
      const e = t.pts[t.pts.length - 1];
      addVia(ctx, e.x, e.y, viaR);
    }
    for (let i = 1; i < t.pts.length - 1; i++) {
      if (rng() < 0.05) addVia(ctx, t.pts[i].x, t.pts[i].y, viaR * 0.85);
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = range(rng, X0, X1);
    const y = range(rng, Y0, Y1);
    if (rng() > density(x, y)) continue;
    addVia(ctx, x, y, range(rng, 0.0022, 0.004));
  }

  // ---- Spatial index for pulse-lit components ----------------------------
  const cell = 0.03;
  const gCols = Math.ceil((X1 - X0) / cell);
  const gRows = Math.ceil((Y1 - Y0) / cell);
  const buckets: number[][] = Array.from({ length: gCols * gRows }, () => []);
  ctx.lightables.forEach((l, i) => {
    const gc = clamp(Math.floor((l.x - X0) / cell), 0, gCols - 1);
    const gr = clamp(Math.floor((l.y - Y0) / cell), 0, gRows - 1);
    buckets[gr * gCols + gc].push(i);
  });

  return {
    traces,
    lines: ctx.lines,
    rects: ctx.rects,
    circles: ctx.circles,
    dashes: ctx.dashes,
    lightables: ctx.lightables,
    lightGrid: { cell, cols: gCols, rows: gRows, buckets },
  };
};

// ---------------------------------------------------------------------------
// Arc-length lookup
// ---------------------------------------------------------------------------

/** Index of the segment containing arc length s. */
export const segmentAt = (t: Trace, s: number): number => {
  const cum = t.cum;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  return lo;
};

export const pointAt = (t: Trace, s: number, out: Pt): Pt => {
  const c = clamp(s, 0, t.len);
  const i = segmentAt(t, c);
  const span = t.cum[i + 1] - t.cum[i];
  const u = span > 0 ? (c - t.cum[i]) / span : 0;
  out.x = lerp(t.pts[i].x, t.pts[i + 1].x, u);
  out.y = lerp(t.pts[i].y, t.pts[i + 1].y, u);
  return out;
};
