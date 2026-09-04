import { BASE_H, BASE_W, GRID, OVERSCAN } from "./constants";
import { bucketOf } from "./color";
import { between, intBetween, mulberry32, type Rng } from "./random";

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

const COLS = Math.round((BASE_W + OVERSCAN * 2) / GRID) + 1;
const ROWS = Math.round((BASE_H + OVERSCAN * 2) / GRID) + 1;
const DIAG = GRID * Math.SQRT2;

const gx = (c: number) => c * GRID - OVERSCAN;
const gy = (r: number) => r * GRID - OVERSCAN;
const toC = (x: number) => Math.round((x + OVERSCAN) / GRID);
const toR = (y: number) => Math.round((y + OVERSCAN) / GRID);
const snap = (v: number) => Math.round(v / GRID) * GRID;

// E, NE, N, NW, W, SW, S, SE — in canvas space, where y grows downward.
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1],
];
// Unit-length versions, so a diagonal doesn't out-score an axis move purely
// because its raw components are longer.
const DIRN = DIRS.map(([dx, dy]) => {
  const m = Math.hypot(dx, dy);
  return [dx / m, dy / m] as const;
});

// Manhattan plus 45 degrees only: every turn is a 45 or 90 degree change of
// heading. 45 is heavily favoured, which is what gives real routed copper its
// characteristic mitred look.
const TURNS = [1, -1, 2, -2] as const;
const TURN_BIAS = [0.6, 0.6, 0.0, 0.0] as const;

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

/** A point on a trace that lights up when a pulse passes it. */
export type BoardNode = { s: number; x: number; y: number; r: number };

export type Trace = {
  xs: Float32Array;
  ys: Float32Array;
  /** Cumulative arc length at each vertex; cum[n-1] === length. */
  cum: Float32Array;
  length: number;
  tier: number;
  bucket: number;
  nodes: BoardNode[];
};

export type IcSpec = {
  cx: number;
  cy: number;
  half: number;
  pinTip: number;
  pins: number;
  pinW: number;
  bucket: number;
};

export type PadSpec = { x: number; y: number; w: number; h: number; r: number; bucket: number };
export type ChipSpec = { x: number; y: number; w: number; h: number; padW: number; vertical: boolean; bucket: number };
export type DashSpec = { x: number; y: number; len: number; vertical: boolean; bucket: number };
export type Mottle = { x: number; y: number; r: number; a: number };

export type Pulse = {
  trace: number;
  /** Whole traversals of its path per 480-frame loop — the loop guarantee. */
  traversals: number;
  phase: number;
  tail: number;
  intensity: number;
  widthScale: number;
  hot: boolean;
};

export type Board = {
  traces: Trace[];
  ics: IcSpec[];
  pads: PadSpec[];
  chips: ChipSpec[];
  dashes: DashSpec[];
  mottle: Mottle[];
  pulses: Pulse[];
};

type Seed = {
  c: number;
  r: number;
  dir: number;
  tier: number;
  prefX: number;
  prefY: number;
  maxLen: number;
  minLen: number;
  rngSeed: number;
};

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export const buildBoard = (seed: number, pulseCount: number, hotFraction: number): Board => {
  const rnd = mulberry32(seed);
  const occ = new Uint8Array(COLS * ROWS);

  const blockRect = (x0: number, y0: number, x1: number, y1: number) => {
    const c0 = Math.max(0, toC(x0));
    const c1 = Math.min(COLS - 1, toC(x1));
    const r0 = Math.max(0, toR(y0));
    const r1 = Math.min(ROWS - 1, toR(y1));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) occ[r * COLS + c] = 1;
    }
  };

  const boxes: number[][] = [];
  const fits = (x0: number, y0: number, x1: number, y1: number, pad = 26) => {
    if (x0 < -OVERSCAN + 40 || y0 < -OVERSCAN + 40) return false;
    if (x1 > BASE_W + OVERSCAN - 40 || y1 > BASE_H + OVERSCAN - 40) return false;
    for (const b of boxes) {
      if (x0 - pad < b[2] && x1 + pad > b[0] && y0 - pad < b[3] && y1 + pad > b[1]) return false;
    }
    return true;
  };
  const claim = (x0: number, y0: number, x1: number, y1: number) => {
    boxes.push([x0, y0, x1, y1]);
    blockRect(x0 - 6, y0 - 6, x1 + 6, y1 + 6);
  };

  // --- density field ------------------------------------------------------
  // Low-frequency blobs make the board uneven: some regions crowd, others are
  // left almost bare. Components add their own crowding on top.
  const blobs: { x: number; y: number; r: number; amp: number }[] = [];
  for (let i = 0; i < 10; i++) {
    blobs.push({
      x: between(rnd, -200, BASE_W + 200),
      y: between(rnd, -200, BASE_H + 200),
      r: between(rnd, 430, 1050),
      amp: i < 6 ? -between(rnd, 0.2, 0.44) : between(rnd, 0.12, 0.3),
    });
  }
  const density = (x: number, y: number) => {
    let d = 0.76;
    for (const b of blobs) {
      const dx = (x - b.x) / b.r;
      const dy = (y - b.y) / b.r;
      d += b.amp * Math.exp(-(dx * dx + dy * dy));
    }
    return Math.max(0.1, Math.min(1, d));
  };
  const crowd = (x: number, y: number, r: number, amp: number) =>
    blobs.push({ x, y, r, amp });

  const seeds: Seed[] = [];
  const pushPinSeeds = (
    pins: { x: number; y: number; dir: number }[],
    tierWeights: readonly number[],
  ) => {
    let i = 0;
    while (i < pins.length) {
      const size = intBetween(rnd, 3, 7);
      const group = pins.slice(i, i + size);
      i += size;
      // Whole bundles route or don't. Leaving some pins unconnected is what
      // real boards look like, and it keeps the bus runs contiguous.
      if (rnd() > 0.66) continue;
      // Everything in a bundle shares a routing seed and a preferred heading,
      // so the group turns together and reads as a parallel bus.
      const rngSeed = Math.floor(rnd() * 1e9);
      const tier = tierWeights[Math.floor(rnd() * tierWeights.length)];
      const base = DIRN[group[0].dir];
      const ang = between(rnd, -0.85, 0.85);
      const prefX = base[0] * Math.cos(ang) - base[1] * Math.sin(ang);
      const prefY = base[0] * Math.sin(ang) + base[1] * Math.cos(ang);
      const maxLen = between(rnd, 900, 3100);
      const minLen = rnd() < 0.2 ? 260 : 620;
      for (const p of group) {
        seeds.push({
          c: toC(p.x), r: toR(p.y), dir: p.dir,
          tier, prefX, prefY, maxLen, minLen, rngSeed,
        });
      }
    }
  };

  // --- the large IC, centre-left ------------------------------------------
  const ics: IcSpec[] = [];
  const addIc = (cx: number, cy: number, half: number, pinTip: number, pins: number, pinW: number) => {
    ics.push({ cx, cy, half, pinTip, pins, pinW, bucket: bucketOf(cx / BASE_W) });
    claim(cx - pinTip, cy - pinTip, cx + pinTip, cy + pinTip);
    crowd(cx, cy, half * 2.6, 0.34);
    const pinPins: { x: number; y: number; dir: number }[] = [];
    const off = (i: number) => (i - (pins - 1) / 2) * GRID;
    for (let i = 0; i < pins; i++) pinPins.push({ x: cx - pinTip, y: cy + off(i), dir: 4 });
    for (let i = 0; i < pins; i++) pinPins.push({ x: cx + pinTip, y: cy + off(i), dir: 0 });
    for (let i = 0; i < pins; i++) pinPins.push({ x: cx + off(i), y: cy - pinTip, dir: 2 });
    for (let i = 0; i < pins; i++) pinPins.push({ x: cx + off(i), y: cy + pinTip, dir: 6 });
    return pinPins;
  };

  // Body half-width 330 plus a 50px pin, so pin tips land exactly on the grid.
  const bigPins = addIc(snap(BASE_W * 0.3), snap(BASE_H * 0.5), 330, 380, 27, 8);
  pushPinSeeds(bigPins.filter((_, i) => i % 4 !== 3 || rnd() < 0.7), [0, 0, 1, 1, 2]);

  for (let k = 0; k < 2; k++) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const cx = snap(between(rnd, BASE_W * 0.55, BASE_W * 0.92));
      const cy = snap(between(rnd, BASE_H * 0.15, BASE_H * 0.85));
      if (!fits(cx - 150, cy - 150, cx + 150, cy + 150, 120)) continue;
      pushPinSeeds(addIc(cx, cy, 110, 150, 9, 7), [0, 0, 1]);
      break;
    }
  }

  // --- pads ---------------------------------------------------------------
  const pads: PadSpec[] = [];
  const addPad = (x: number, y: number, w: number, h: number) => {
    pads.push({ x, y, w, h, r: Math.min(w, h) * 0.34, bucket: bucketOf(x / BASE_W) });
    claim(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
    return [
      { x: snap(x - w / 2 - GRID), y: snap(y), dir: 4 },
      { x: snap(x + w / 2 + GRID), y: snap(y), dir: 0 },
    ];
  };

  // A few neat rows, the way a connector footprint or a resistor array sits.
  for (let row = 0; row < 7; row++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const vertical = rnd() < 0.45;
      const n = intBetween(rnd, 5, 9);
      const pitch = 60;
      const x = snap(between(rnd, 120, BASE_W - 120));
      const y = snap(between(rnd, 120, BASE_H - 120));
      const span = (n - 1) * pitch;
      const x1 = vertical ? x : x + span;
      const y1 = vertical ? y + span : y;
      if (!fits(x - 40, y - 40, x1 + 40, y1 + 40, 70)) continue;
      const rowPins: { x: number; y: number; dir: number }[] = [];
      for (let i = 0; i < n; i++) {
        const px = vertical ? x : x + i * pitch;
        const py = vertical ? y + i * pitch : y;
        rowPins.push(...addPad(px, py, vertical ? 38 : 20, vertical ? 20 : 38));
      }
      crowd((x + x1) / 2, (y + y1) / 2, span + 320, 0.28);
      pushPinSeeds(rowPins, [0, 0, 1]);
      break;
    }
  }

  // Scattered singles.
  const loosePins: { x: number; y: number; dir: number }[] = [];
  for (let i = 0; i < 62; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = snap(between(rnd, 40, BASE_W - 40));
      const y = snap(between(rnd, 40, BASE_H - 40));
      if (rnd() > density(x, y) + 0.25) continue;
      const w = rnd() < 0.5 ? 36 : 20;
      const h = w === 36 ? 20 : 36;
      if (!fits(x - w / 2, y - h / 2, x + w / 2, y + h / 2, 34)) continue;
      loosePins.push(...addPad(x, y, w, h));
      break;
    }
  }
  pushPinSeeds(loosePins, [0, 0, 0, 1]);

  // --- two-pad components and silkscreen dashes ---------------------------
  const chips: ChipSpec[] = [];
  for (let i = 0; i < 30; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const vertical = rnd() < 0.5;
      const x = snap(between(rnd, 60, BASE_W - 60));
      const y = snap(between(rnd, 60, BASE_H - 60));
      const w = vertical ? 22 : 54;
      const h = vertical ? 54 : 22;
      if (rnd() > density(x, y) + 0.2) continue;
      if (!fits(x - w / 2, y - h / 2, x + w / 2, y + h / 2, 30)) continue;
      chips.push({ x, y, w, h, padW: 15, vertical, bucket: bucketOf(x / BASE_W) });
      claim(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
      break;
    }
  }

  const dashes: DashSpec[] = [];
  for (let i = 0; i < 14; i++) {
    const vertical = rnd() < 0.5;
    dashes.push({
      x: snap(between(rnd, 60, BASE_W - 220)),
      y: snap(between(rnd, 60, BASE_H - 220)),
      len: between(rnd, 70, 190),
      vertical,
      bucket: bucketOf(between(rnd, 0, 1)),
    });
  }

  // --- fill routing -------------------------------------------------------
  // Seeds sampled against the density field, so the sparse regions stay sparse.
  for (let i = 0; i < 320; i++) {
    let x = 0;
    let y = 0;
    let ok = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      x = snap(between(rnd, -OVERSCAN + 60, BASE_W + OVERSCAN - 60));
      y = snap(between(rnd, -OVERSCAN + 60, BASE_H + OVERSCAN - 60));
      if (rnd() < density(x, y)) { ok = true; break; }
    }
    if (!ok) continue;
    const dir = Math.floor(rnd() * 8);
    const ang = between(rnd, -0.6, 0.6);
    const base = DIRN[dir];
    seeds.push({
      c: toC(x), r: toR(y), dir,
      tier: [0, 0, 0, 1, 1, 2][Math.floor(rnd() * 6)],
      prefX: base[0] * Math.cos(ang) - base[1] * Math.sin(ang),
      prefY: base[0] * Math.sin(ang) + base[1] * Math.cos(ang),
      maxLen: between(rnd, 1000, 3400),
      minLen: 700,
      rngSeed: Math.floor(rnd() * 1e9),
    });
  }

  // --- run the router -----------------------------------------------------
  const traces: Trace[] = [];
  for (const s of seeds) {
    const path = route(occ, mulberry32(s.rngSeed), s, density);
    if (path) traces.push(finishTrace(path.xs, path.ys, s.tier, rnd));
  }

  const mottle: Mottle[] = [];
  for (let i = 0; i < 22; i++) {
    mottle.push({
      x: between(rnd, -OVERSCAN, BASE_W + OVERSCAN),
      y: between(rnd, -OVERSCAN, BASE_H + OVERSCAN),
      r: between(rnd, 500, 1500),
      a: between(rnd, 0.05, 0.17),
    });
  }

  return { traces, ics, pads, chips, dashes, mottle, pulses: buildPulses(rnd, traces, pulseCount, hotFraction) };
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const route = (
  occ: Uint8Array,
  rnd: Rng,
  s: Seed,
  density: (x: number, y: number) => number,
): { xs: number[]; ys: number[] } | null => {
  let c = s.c;
  let r = s.r;
  let d = s.dir;
  let total = 0;
  const xs = [gx(c)];
  const ys = [gy(r)];
  const claimed: number[] = [];

  for (let run = 0; run < 90 && total < s.maxLen; run++) {
    // Long runs: a trace should cover a good fraction of the frame before it
    // terminates, turning only a handful of times on the way.
    const runCells = 3 + Math.floor(Math.pow(rnd(), 1.7) * 34);
    let stepped = 0;
    for (let k = 0; k < runCells; k++) {
      const nc = c + DIRS[d][0];
      const nr = r + DIRS[d][1];
      if (nc < 1 || nc >= COLS - 1 || nr < 1 || nr >= ROWS - 1) break;
      const idx = nr * COLS + nc;
      if (occ[idx]) break;
      occ[idx] = 1;
      claimed.push(idx);
      total += DIRS[d][0] !== 0 && DIRS[d][1] !== 0 ? DIAG : GRID;
      c = nc;
      r = nr;
      stepped++;
      if (total >= s.maxLen) break;
    }
    if (stepped > 0) {
      xs.push(gx(c));
      ys.push(gy(r));
      if (rnd() > 0.72 + density(gx(c), gy(r)) * 0.26) break;
    }
    if (total >= s.maxLen) break;

    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < TURNS.length; i++) {
      const nd = (d + TURNS[i] + 8) & 7;
      const nc = c + DIRS[nd][0];
      const nr = r + DIRS[nd][1];
      if (nc < 1 || nc >= COLS - 1 || nr < 1 || nr >= ROWS - 1) continue;
      if (occ[nr * COLS + nc]) continue;
      const score =
        TURN_BIAS[i] + (DIRN[nd][0] * s.prefX + DIRN[nd][1] * s.prefY) * 1.35 + rnd() * 0.85;
      if (score > bestScore) {
        bestScore = score;
        best = nd;
      }
    }
    if (best < 0) break;
    d = best;
  }

  if (total < s.minLen) {
    for (const idx of claimed) occ[idx] = 0;
    return null;
  }
  return { xs, ys };
};

const finishTrace = (xs: number[], ys: number[], tier: number, rnd: Rng): Trace => {
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    if (i > 0 && xs[i] === xs[i - 1] && ys[i] === ys[i - 1]) continue;
    px.push(xs[i]);
    py.push(ys[i]);
  }
  const n = px.length;
  const cum = new Float32Array(n);
  let sumX = 0;
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]);
  }
  for (let i = 0; i < n; i++) sumX += px[i];

  // Vias sit where a trace terminates and at some of its corners.
  const viaR = 5.4 + tier * 1.1;
  const nodes: BoardNode[] = [{ s: 0, x: px[0], y: py[0], r: viaR }];
  for (let i = 1; i < n - 1; i++) {
    if (rnd() < 0.17) nodes.push({ s: cum[i], x: px[i], y: py[i], r: viaR });
  }
  nodes.push({ s: cum[n - 1], x: px[n - 1], y: py[n - 1], r: viaR * 1.15 });

  return {
    xs: Float32Array.from(px),
    ys: Float32Array.from(py),
    cum,
    length: cum[n - 1],
    tier,
    bucket: bucketOf(sumX / n / BASE_W),
    nodes,
  };
};

// ---------------------------------------------------------------------------
// Pulses
// ---------------------------------------------------------------------------

// Whole traversals per loop. Because every pulse completes an integer number
// of passes over DURATION_IN_FRAMES, frame 480 is identical to frame 0 with no
// re-seeding needed. Trace lengths differ widely, so identical traversal counts
// still read as very different speeds.
const TRAVERSALS = [1, 1, 1, 1, 1, 2, 2, 2, 3, 4, 6] as const;

const buildPulses = (rnd: Rng, traces: Trace[], count: number, hotFraction: number): Pulse[] => {
  if (traces.length === 0) return [];
  // Longer traces are more likely to be busy; plenty of traces get nothing at
  // all and stay dark for the whole loop.
  const cumWeight = new Float64Array(traces.length);
  let total = 0;
  for (let i = 0; i < traces.length; i++) {
    total += Math.pow(traces[i].length, 1.3);
    cumWeight[i] = total;
  }
  const pickTrace = () => {
    const t = rnd() * total;
    let lo = 0;
    let hi = traces.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumWeight[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const used = new Map<number, number>();
  const pulses: Pulse[] = [];
  for (let i = 0; i < count; i++) {
    let trace = -1;
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = pickTrace();
      if ((used.get(candidate) ?? 0) < 2) {
        trace = candidate;
        break;
      }
    }
    if (trace < 0) continue;
    used.set(trace, (used.get(trace) ?? 0) + 1);
    const traversals = TRAVERSALS[Math.floor(rnd() * TRAVERSALS.length)];
    pulses.push({
      trace,
      traversals,
      phase: rnd(),
      tail: between(rnd, 240, 640) * (1 + traversals * 0.13),
      intensity: between(rnd, 0.62, 1),
      widthScale: between(rnd, 1, 1.7),
      hot: rnd() < hotFraction,
    });
  }
  return pulses;
};
