import { LOOP } from "../common/constants";
import { at, mulberry32, periodicSeries } from "../common/random";

// All chart data is periodic. The chart scrolls exactly one data period
// (N_CANDLES * CANDLE_SP px at 4K) per LOOP frames.

export const N_CANDLES = 64;
export const CANDLE_SP = 48; // px at 3840 wide
export const SCROLL = N_CANDLES * CANDLE_SP; // 3072 px per loop
export const N_AREA = 192;
export const AREA_SP = SCROLL / N_AREA; // 16 px

const rand = mulberry32(0x1368839);

const closes = (() => {
  const a = periodicSeries(rand, N_CANDLES, 1.3);
  const b = periodicSeries(rand, N_CANDLES, 2.2);
  return a.map((v, i) => 0.12 + 0.76 * (0.75 * v + 0.25 * b[i]));
})();

export type Candle = { o: number; c: number; h: number; l: number };
export const CANDLES: Candle[] = closes.map((c, i) => {
  const o = at(closes, i - 1);
  const top = Math.max(o, c);
  const bot = Math.min(o, c);
  return { o, c, h: top + 0.01 + rand() * 0.05, l: bot - 0.01 - rand() * 0.05 };
});

export const AREA: number[] = (() => {
  const a = periodicSeries(rand, N_AREA, 1.0);
  const j = periodicSeries(rand, N_AREA, 3.5); // jagged component
  return a.map((v, i) => 0.1 + 0.8 * (0.7 * v + 0.3 * j[i]));
})();

// --- labels: each value cycles a fixed sequence; sequence length * step = LOOP
export type Ticker = { code: string; values: number[]; changes: number[]; step: number; phase: number };

const tickerCodes = ["IDX-01", "SEC-A", "IDX-07", "SEC-F", "IDX-12", "SEC-K", "IDX-23", "SEC-C", "IDX-31", "SEC-M", "IDX-44", "SEC-R"];
const STEPS = [50, 60, 75, 100, 120];
export const TICKERS: Ticker[] = tickerCodes.map((code, i) => {
  const base = i === 0 ? 4525.85 : i === 1 ? 756.46 : Math.round(rand() * 5000 * 100) / 100 + 20;
  const step = STEPS[Math.floor(rand() * STEPS.length)];
  const n = LOOP / step;
  const values: number[] = [];
  const changes: number[] = [];
  for (let k = 0; k < n; k++) {
    const ch = Math.round((rand() - 0.55) * base * 0.004 * 100) / 100 || -0.21;
    changes.push(i === 0 && k === 0 ? -0.21 : ch);
    values.push(i <= 1 && k === 0 ? base : Math.round((base + (rand() - 0.5) * base * 0.006) * 100) / 100);
  }
  return { code, values, changes, step, phase: Math.floor(rand() * step) };
});

export const tickerAt = (t: Ticker, frame: number) => {
  const k = Math.floor((frame + t.phase) / t.step);
  return { value: at(t.values, k), change: at(t.changes, k), sinceTick: (frame + t.phase) % t.step };
};

export const PRICE_LO = 4380;
export const PRICE_HI = 4680;
