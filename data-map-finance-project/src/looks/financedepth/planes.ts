import { makeRand } from "../../lib/random";

// The field: planes placed in one repeating block of depth L. The camera
// travels exactly N * L per loop (N = 1), so the field repeats seamlessly.

export const LOOP = 600;
export const BLOCK_L = 120;
export const TRAVEL_BLOCKS = 1;

export type NumberSpec = {
  x: number; // design px (centre-left anchor)
  y: number; // baseline, design px
  size: number; // font px
  period: number; // frames between value changes (divides 600)
  offset: number; // frame offset
  values: string[]; // one per period slot (600 / period entries)
  weight: number;
  alpha: number;
};

export type PlaneKind = "big" | "cluster" | "chart";

export type PlaneSpec = {
  kind: PlaneKind;
  depth: number; // position in the block, 0..L
  x: number;
  y: number;
  rx: number;
  ry: number;
  w: number; // world width
  designW: number;
  designH: number;
  numbers: NumberSpec[];
  candles: CandleSpec | null;
  lines: LineSpec[];
};

export type CandleSpec = {
  count: number;
  base: number[];
  amp: number[];
  cyc: number[];
  ph: number[];
  body: number[];
  bodyCyc: number[];
  dark: boolean[];
  wickUp: number[];
  wickDn: number[];
};

export type LineSpec = {
  points: number[]; // base values 0..1
  cyc: number[];
  ph: number[];
  amp: number;
  tone: "main" | "up" | "down";
  alpha: number;
  width: number;
};

const PERIODS = [60, 75, 100, 120, 150, 200, 300];

const rand = makeRand(3765);

const price = () => {
  const big = rand.next() < 0.5;
  const v = big ? rand.range(10, 99.99) : rand.range(1, 99.99);
  return v.toFixed(2);
};

const makeNumber = (x: number, y: number, size: number, weight: number, alpha: number): NumberSpec => {
  const period = rand.pick(PERIODS);
  const slots = LOOP / period;
  // keep the integer part mostly stable, like a ticking price
  const first = parseFloat(price());
  const values: string[] = [];
  let v = first;
  for (let i = 0; i < slots; i++) {
    values.push(Math.min(99.99, Math.max(1, v)).toFixed(2));
    v += rand.range(-2.5, 2.5);
  }
  return { x, y, size, period, offset: rand.int(0, period), values, weight, alpha };
};

const makeCandles = (count: number): CandleSpec => {
  const base: number[] = [];
  let v = rand.range(0.35, 0.65);
  for (let i = 0; i < count; i++) {
    v = Math.min(0.85, Math.max(0.15, v + rand.range(-0.08, 0.08)));
    base.push(v);
  }
  return {
    count,
    base,
    amp: base.map(() => rand.range(0.02, 0.07)),
    cyc: base.map(() => rand.int(1, 4)),
    ph: base.map(() => rand.next()),
    body: base.map(() => rand.range(0.03, 0.12)),
    bodyCyc: base.map(() => rand.int(1, 3)),
    dark: base.map(() => rand.next() < 0.22),
    wickUp: base.map(() => rand.range(0.01, 0.06)),
    wickDn: base.map(() => rand.range(0.01, 0.06)),
  };
};

const makeLine = (n: number, tone: LineSpec["tone"], alpha: number): LineSpec => {
  const pts: number[] = [];
  let v = rand.range(0.3, 0.7);
  for (let i = 0; i < n; i++) {
    v = Math.min(0.9, Math.max(0.1, v + rand.range(-0.12, 0.12)));
    pts.push(v);
  }
  return {
    points: pts,
    cyc: pts.map(() => rand.int(1, 4)),
    ph: pts.map(() => rand.next()),
    amp: rand.range(0.015, 0.05),
    tone,
    alpha,
    width: rand.range(2.0, 3.6),
  };
};

const PLANE_COUNT = 46;

export const PLANES: PlaneSpec[] = Array.from({ length: PLANE_COUNT }, (_, i) => {
  const r = rand.next();
  const kind: PlaneKind = r < 0.32 ? "big" : r < 0.64 ? "cluster" : "chart";
  const depth = ((i + rand.range(0, 0.8)) / PLANE_COUNT) * BLOCK_L;
  const spreadX = 15;
  const spreadY = 8;
  const common = {
    depth,
    x: rand.range(-spreadX, spreadX),
    y: rand.range(-spreadY, spreadY),
    rx: rand.range(-0.14, 0.14),
    ry: rand.range(-0.4, 0.4),
  };
  if (kind === "big") {
    const designW = 1200;
    const designH = 420;
    return {
      kind,
      ...common,
      w: rand.range(7, 13),
      designW,
      designH,
      numbers: [makeNumber(60, 340, 330, 800, 1)],
      candles: null,
      lines: [],
    };
  }
  if (kind === "cluster") {
    const designW = 1100;
    const designH = 700;
    // a loose column of prices, one per row, so they never overlap
    const n = rand.int(3, 6);
    const numbers: NumberSpec[] = [];
    let y = 40;
    for (let k = 0; k < n; k++) {
      const size = rand.range(60, 140);
      y += size * 1.12;
      if (y > designH - 20) break;
      numbers.push(makeNumber(rand.range(30, 520), y, size, rand.pick([600, 700, 800]), rand.range(0.55, 1)));
    }
    return { kind, ...common, w: rand.range(5, 9), designW, designH, numbers, candles: null, lines: [] };
  }
  const designW = 1400;
  const designH = 700;
  const lineCount = rand.int(1, 4);
  const lines: LineSpec[] = Array.from({ length: lineCount }, (_, k) => {
    const tone: LineSpec["tone"] = k === 0 ? "main" : rand.next() < 0.5 ? "up" : "down";
    return makeLine(rand.int(28, 60), tone, tone === "main" ? 0.9 : 0.4);
  });
  const extra = rand.next() < 0.6 ? [makeNumber(rand.range(40, 900), rand.range(110, 220), rand.range(70, 120), 700, 0.85)] : [];
  return {
    kind,
    ...common,
    w: rand.range(10, 17),
    designW,
    designH,
    numbers: extra,
    candles: makeCandles(rand.int(18, 38)),
    lines,
  };
});
