// All names and numbers on the board are invented. The 3-letter codes below
// are checked (scripts/check-codes.mjs) against the ISO 4217 currency list and
// a short list of well-known tickers/indices, and none matches.
export const CODES = [
  "KRV", "LND", "MEZ", "VAL", "QOS", "DUX", "FYL", "HAZ", "JUM", "NOP",
  "PIX", "RIV", "SUL", "TAV", "UBO", "WEX", "YOM", "ZIR", "ALQ", "BOZ",
  "CEV", "EKO", "FIZ", "GRU", "HOV", "IXA", "JEL", "KUV", "LOZ", "MAQ",
] as const;

export const ROWS = 8;

export interface BoardPalette {
  id: string;
  baseTop: string;
  baseBottom: string;
  up: string;
  down: string;
  /** Sparkline gradient (bottom of the fill -> line colour). */
  sparkLow: string;
  sparkHigh: string;
  baseline: string;
  /** Screen-space glows: lower-left and upper-right. */
  glowLL: string;
  glowUR: string;
  /** Signed tilt of the day's moves: < 0 mostly falling (red), > 0 mostly rising. */
  bias: number;
}

export const RED: BoardPalette = {
  id: "Red",
  baseTop: "#0A0204",
  baseBottom: "#180408",
  up: "#3AFF8A",
  down: "#FF3A3A",
  sparkLow: "#2A5AFF",
  sparkHigh: "#4A8AFF",
  baseline: "#FF3A3A",
  glowLL: "#FF1A1A",
  glowUR: "#2A8AFF",
  bias: -0.8,
};

export const BLUE: BoardPalette = {
  id: "Blue",
  baseTop: "#02060F",
  baseBottom: "#040C1E",
  up: "#3AFFC8",
  down: "#FF5A6A",
  sparkLow: "#1E6CFF",
  sparkHigh: "#4AD8FF",
  baseline: "#FF5A6A",
  glowLL: "#2A6AFF",
  glowUR: "#4AD8FF",
  bias: 0.8,
};

export interface RowSpec {
  pair: string;
  sub: string;
  base: number; // opening value
  decimals: number;
  tickPeriod: number; // frames between ticks, 12..40
  tickOffset: number;
  amp: number; // relative movement
  seed: number;
  chip: string;
}

import { mulberry32 } from "../../lib/rand";

const rng = mulberry32(0x0b0a2d11);
const BASES: Array<[number, number]> = [
  [1.2862, 4], [142.04, 2], [0.7348, 4], [6.8475, 4], [95.56, 2], [7.8495, 4], [0.988, 4], [1.3057, 4],
];

export const ROW_SPECS: RowSpec[] = Array.from({ length: ROWS }, (_, r) => {
  const a = CODES[Math.floor(rng() * CODES.length)];
  let b = CODES[Math.floor(rng() * CODES.length)];
  if (b === a) b = CODES[(CODES.indexOf(a) + 7) % CODES.length];
  const [base, decimals] = BASES[r];
  return {
    pair: `${a} / ${b}`,
    sub: `${a}${b}`,
    base,
    decimals,
    tickPeriod: 12 + Math.floor(rng() * 29), // 12..40 frames
    tickOffset: Math.floor(rng() * 40),
    amp: 0.0012 + rng() * 0.003,
    seed: 100 + r * 13,
    chip: r % 4 === 1 ? "" : "TRADE",
  };
});
