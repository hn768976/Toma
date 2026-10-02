import { hash01, mulberry32, TAU } from "../lib/random";

// All market data is invented and periodic so the 600-frame loop is exact.
export const LOOP = 600;

// ---- candles: one data period of P candles, scrolled exactly once per loop
export const CANDLE_P = 48;
export const CANDLES = (() => {
  const rnd = mulberry32(606);
  const inc = Array.from({ length: CANDLE_P }, () => (rnd() - 0.5) * 2);
  const mean = inc.reduce((a, b) => a + b, 0) / CANDLE_P;
  let c = 100;
  return inc.map((d, i) => {
    const o = c;
    c = c + (d - mean) * 1.6 + Math.sin((i / CANDLE_P) * TAU * 2) * 0.6;
    const hi = Math.max(o, c) + rnd() * 1.2;
    const lo = Math.min(o, c) - rnd() * 1.2;
    return { o, c, hi, lo, v: 0.25 + rnd() * 0.75 };
  });
})();
// normalise close of the last candle back onto the first open (periodic)
{
  const drift = CANDLES[CANDLE_P - 1].c - CANDLES[0].o;
  CANDLES.forEach((k, i) => {
    const a = (drift * i) / CANDLE_P;
    const b = (drift * (i + 1)) / CANDLE_P;
    k.o -= a;
    k.c -= b;
    k.hi -= Math.min(a, b);
    k.lo -= Math.max(a, b);
  });
}

// value that changes on a whole-number cycle: steps every `period` frames
export const stepped = (lf: number, period: number, off: number, ...key: number[]) =>
  hash01(...key, Math.floor((((lf + off) % LOOP) + LOOP) % LOOP / period));

export const CODES = ["IDX-01", "IDX-05", "SEC-A", "SEC-B", "SEC-C", "SEC-D", "FND-7", "FND-9", "FND-2", "BND-3", "CMD-4", "RTE-8", "VOL-6", "IDX-12"];
export const SECTORS = ["SEC-A", "SEC-B", "SEC-C", "SEC-D", "SEC-E", "SEC-F", "SEC-G", "SEC-H", "SEC-J", "SEC-K", "SEC-L", "SEC-M", "SEC-N", "SEC-P"];

// smooth periodic line (integer frequencies in both space and time)
export const wave = (x: number, t: number, seed: number) => {
  let y = 0;
  for (let k = 1; k <= 4; k++) {
    const a = 0.5 / k;
    const m = (1 + Math.floor(hash01(seed, k) * 2)) * (hash01(seed, k, 1) < 0.5 ? -1 : 1);
    y += a * Math.sin(TAU * (k * x + m * t) + hash01(seed, k, 2) * TAU);
  }
  return y;
};
