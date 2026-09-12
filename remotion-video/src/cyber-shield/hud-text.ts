// Deterministic "live data" for the HUD readouts.
//
// Every value is a pure function of (id, frame) so Remotion's workers,
// which render frames out of order, always agree on what a given frame
// looks like. Values hold for NUMBER_TICK_PERIOD frames and then jump,
// which reads as instrumentation refreshing rather than noise.

import { NUMBER_TICK_PERIOD } from "./constants";
import { seededRandom } from "../shared/random";

const hashId = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** A digit string of `length` chars that resamples every tick period. */
export const tickingDigits = (
  id: string,
  frame: number,
  length: number,
  /** Chance a character is a space, to break the run into groups. */
  spacing = 0.14,
): string => {
  const bucket = Math.floor(frame / NUMBER_TICK_PERIOD);
  const base = hashId(id);
  let out = "";
  for (let i = 0; i < length; i++) {
    // Only some columns are live; the rest stay put, the way a real
    // readout only changes its low-order digits.
    const live = seededRandom(base + i * 17, 61) > 0.45;
    const seed = base + i * 101 + (live ? bucket * 7919 : 0);
    if (seededRandom(base + i * 13, 62) < spacing && i > 0 && i < length - 1) {
      out += " ";
      continue;
    }
    out += String(Math.floor(seededRandom(seed, 63) * 10));
  }
  return out;
};

/** A stable-but-slowly-changing 0..1 series, used for bars and charts. */
export const seriesValue = (
  id: string,
  index: number,
  frame: number,
  period: number,
): number => {
  const base = hashId(id) + index * 313;
  const bucket = Math.floor(frame / period);
  const t = (frame % period) / period;
  const a = seededRandom(base + bucket * 977, 71);
  const b = seededRandom(base + (bucket + 1) * 977, 71);
  // Smoothstep between the current and next sample so bars glide.
  const e = t * t * (3 - 2 * t);
  return a + (b - a) * e;
};
