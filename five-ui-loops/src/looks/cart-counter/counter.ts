// Count and price, both from ONE eased curve of the frame. No state.
import { mulberry32 } from "../../lib/random";

export const COUNT_START = 12;
export const COUNT_FRAMES = 240; // reaches the final count at frame 252
const EXP = 2.6; // fast at first, slowing toward the end

// Continuous count curve: 1 → final.
export const countCurve = (frame: number, final: number) => {
  const t = Math.min(1, Math.max(0, (frame - COUNT_START) / COUNT_FRAMES));
  return 1 + (final - 1) * (1 - Math.pow(1 - t, EXP));
};

// Displayed count = ceil of the curve: item k shows as soon as the curve
// leaves k-1, and the price rolls from total(k-1) to total(k) meanwhile.
export const displayedCount = (cf: number) => Math.max(1, Math.ceil(cf - 1e-9));

// Frame at which the badge ticks to `k` (k ≥ 2) — inverse of countCurve.
export const tickFrame = (k: number, final: number) => {
  const e = (k - 2) / (final - 1);
  const t = 1 - Math.pow(1 - e, 1 / EXP);
  return COUNT_START + t * COUNT_FRAMES;
};

// Cumulative totals in cents for 0..final items. Seeded per version.
const totalsCache = new Map<string, number[]>();
export const totals = (seed: number, final: number, targetCents = 348_640) => {
  const key = `${seed}:${final}:${targetCents}`;
  const hit = totalsCache.get(key);
  if (hit) return hit;
  const rng = mulberry32(seed * 7919 + 1);
  const raw = Array.from({ length: final }, () => 2999 + Math.floor(rng() * 9000));
  const sum = raw.reduce((a, b) => a + b, 0);
  const prices = raw.map((p) => Math.round((p * targetCents) / sum));
  prices[final - 1] += targetCents - prices.reduce((a, b) => a + b, 0);
  const cum = [0];
  for (const p of prices) cum.push(cum[cum.length - 1] + p);
  totalsCache.set(key, cum);
  return cum;
};

// Price (float cents) for a continuous count value. While the badge shows k
// (curve in (k-1, k]), the total rolls from total(k-1) to total(k) during the
// first third of that interval, so it has landed before the next tick.
export const ROLL_PORTION = 0.35;
export const priceAt = (cf: number, cum: number[]) => {
  const k = displayedCount(cf);
  if (k >= cum.length - 1 && cf >= cum.length - 1) return cum[cum.length - 1];
  if (k <= 1) return cum[1];
  const local = Math.min(1, Math.max(0, (cf - (k - 1)) / ROLL_PORTION));
  const e = 1 - Math.pow(1 - local, 2);
  return cum[k - 1] + (cum[k] - cum[k - 1]) * e;
};
