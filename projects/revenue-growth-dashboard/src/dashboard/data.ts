import { mulberry32, noise1, spline } from "../lib/random";

// All chart data is generated once from fixed seeds (deterministic).

export const AREA_POINTS = (() => {
  const rnd = mulberry32(1337);
  const pts: number[] = [];
  const n = 420;
  const shape: Array<[number, number]> = [
    [0, 0.08],
    [0.12, 0.2],
    [0.22, 0.42],
    [0.3, 0.36],
    [0.38, 0.5],
    [0.46, 0.44],
    [0.55, 0.58],
    [0.66, 0.6],
    [0.76, 0.72],
    [0.86, 0.8],
    [0.94, 0.9],
    [1, 0.96],
  ];
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const base = spline(shape, x);
    const v =
      base +
      (noise1(x * 38, 3) - 0.5) * 0.09 +
      (noise1(x * 110, 5) - 0.5) * 0.05 +
      (rnd() - 0.5) * 0.035;
    pts.push(v);
  }
  return pts;
})();

/** Revenue curves in axis units (0..30). */
export const curveA = (x: number) => 11.5 + 13.6 * Math.cos((2 * Math.PI * (x - 0.1)) / 1.15);
export const curveB = (x: number) => 11.2 + 13.4 * Math.cos((2 * Math.PI * (x - 0.5)) / 1.05);

export const MARKERS_A = [0.2, 0.47, 0.72];
export const MARKERS_B = [0.0, 0.26, 0.44, 0.8];

export const markerLabel = (seed: number) => {
  const r = mulberry32(seed);
  const a = Math.floor(10000 + r() * 89999);
  const b = Math.floor(10000 + r() * 89999);
  return `${a}  ${b}`;
};

export type Candle = { o: number; c: number; h: number; l: number };

export const CANDLES: Candle[] = (() => {
  const rnd = mulberry32(4242);
  const shape: Array<[number, number]> = [
    [0, 0.22],
    [0.08, 0.2],
    [0.16, 0.28],
    [0.22, 0.24],
    [0.27, 0.42],
    [0.31, 0.74],
    [0.36, 0.62],
    [0.42, 0.66],
    [0.47, 0.6],
    [0.52, 0.3],
    [0.56, 0.42],
    [0.6, 0.7],
    [0.66, 0.62],
    [0.71, 0.66],
    [0.76, 0.52],
    [0.8, 0.6],
    [0.86, 0.46],
    [0.92, 0.5],
    [1, 0.42],
  ];
  const n = 112;
  const out: Candle[] = [];
  let prev = spline(shape, 0);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const target = spline(shape, x) + (noise1(x * 60, 9) - 0.5) * 0.12;
    const c = target + (rnd() - 0.5) * 0.06;
    const o = prev + (rnd() - 0.5) * 0.02;
    const h = Math.max(o, c) + rnd() * 0.06 + 0.01;
    const l = Math.min(o, c) - rnd() * 0.06 - 0.01;
    out.push({ o, c, h, l });
    prev = c;
  }
  return out;
})();

/** Zig-zag overlay line (pink in reference) spanning x in [0, 0.62]. */
export const LINE_A = (() => {
  const rnd = mulberry32(777);
  const pts: Array<[number, number]> = [];
  const n = 64;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 0.62;
    const base = 0.16 + x * 0.55 + Math.sin(x * 14) * 0.03;
    pts.push([x, base + (rnd() - 0.5) * 0.12]);
  }
  return pts;
})();

/** Second overlay line (yellow in reference) spanning x in [0.56, 0.92]. */
export const LINE_B = (() => {
  const rnd = mulberry32(991);
  const pts: Array<[number, number]> = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const x = 0.56 + (i / (n - 1)) * 0.36;
    const base = 0.56 - (x - 0.56) * 0.6 + Math.sin(x * 22) * 0.06;
    pts.push([x, base + (rnd() - 0.5) * 0.14]);
  }
  return pts;
})();
