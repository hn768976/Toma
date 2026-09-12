// The trade tape: a pre-computed stream of prints, each stamped with the
// frame it arrives on. Panels read it with a binary search, so cost per
// frame is O(log n) regardless of how long the clip is.

import { FPS } from "../constants";
import { mulberry32, randInt } from "./random";
import { blockSymbolAt, symbolAt } from "./symbols";

export type Direction = 1 | -1 | 0;

export type Print = {
  frame: number;
  seconds: number;
  symbol: string;
  side: "B" | "S";
  volume: number;
  price: number;
  dir: Direction;
  block: boolean;
};

const priceFor = (rnd: () => number): number => {
  const r = rnd();
  if (r < 0.3) return 1 + rnd() * 9; // penny names
  if (r < 0.7) return 10 + rnd() * 40;
  if (r < 0.92) return 50 + rnd() * 80;
  return 130 + rnd() * 120;
};

const volumeFor = (rnd: () => number): number => {
  const r = rnd();
  if (r < 0.42) return 100 * randInt(rnd, 1, 10);
  if (r < 0.78) return 100 * randInt(rnd, 10, 60);
  if (r < 0.95) return 100 * randInt(rnd, 60, 250);
  return 100 * randInt(rnd, 400, 1200);
};

// Arrivals are bursty rather than metronomic: most prints land 1-2 frames
// apart inside a burst, then the column pauses for a beat. That is what
// makes a real tape feel alive instead of looking like a marquee.
const nextGap = (rnd: () => number, meanGap: number): number => {
  const burst = rnd() < 0.55;
  const g = burst ? meanGap * 0.35 : meanGap * 1.9;
  return Math.max(1, Math.round(g * (0.55 + rnd() * 0.9)));
};

export const buildTape = (
  seed: number,
  totalFrames: number,
  rowsPerSecond: number,
): Print[] => {
  const rnd = mulberry32(seed);
  const meanGap = FPS / rowsPerSecond;
  const prints: Print[] = [];

  // Start well before frame 0 so the columns are already full when the
  // clip opens — a tape that fills from empty reads as a page load.
  let frame = -Math.ceil(meanGap * 60);

  while (frame < totalFrames) {
    const block = rnd() < 0.07;
    const r = rnd();
    const dir: Direction = r < 0.5 ? 1 : r < 0.88 ? -1 : 0;
    prints.push({
      frame,
      seconds: frame / FPS,
      symbol: block ? blockSymbolAt(rnd) : symbolAt(rnd),
      side: rnd() < 0.56 ? "B" : "S",
      volume: volumeFor(rnd),
      price: priceFor(rnd),
      dir,
      block,
    });
    frame += nextGap(rnd, meanGap);
  }

  return prints;
};

// Index of the last row that has arrived by `frame`, or -1. Generic over
// anything frame-stamped, so the tape and the blotter share it.
export const lastArrivedIndex = <T extends { frame: number }>(
  prints: readonly T[],
  frame: number,
): number => {
  let lo = 0;
  let hi = prints.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (prints[mid].frame <= frame) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
};

// The newest `count` prints, newest first.
export const visiblePrints = (
  prints: Print[],
  frame: number,
  count: number,
): Print[] => {
  const end = lastArrivedIndex(prints, frame);
  if (end < 0) return [];
  const start = Math.max(0, end - count + 1);
  return prints.slice(start, end + 1).reverse();
};
