import { hash, seedOf, signed } from "./rand";
import { TAU, DURATION_IN_FRAMES } from "./timing";
import { TEAR_BANDS } from "./plane";

const FAST_ON = seedOf("tear/fast/on");
const FAST_DX = seedOf("tear/fast/dx");
const SLOW_ON = seedOf("tear/slow/on");
const SLOW_DX = seedOf("tear/slow/dx");
const SPLIT_JITTER = seedOf("split/jitter");
const SPLIT_SIGN = seedOf("split/sign");

/**
 * Hold windows. Both divide 600, so no partial window survives across the loop
 * point - a band that appears holds for its full 2 or 4 frames and vanishes.
 */
const FAST_HOLD = 2;
const SLOW_HOLD = 4;

/**
 * Per band horizontal offsets, in CSS pixels, for the whole composite.
 *
 * Returns one entry per band (mostly 0). The canvas only redraws the non-zero
 * ones; the message layer needs the full array to slice itself the same way.
 * Offsets are snapped to even pixels so a band copy is a straight pixel blit at
 * either render scale.
 */
export const tearOffsets = (frame: number, planeWidth: number, level: number): number[] => {
  const fastSlot = Math.floor(frame / FAST_HOLD);
  const slowSlot = Math.floor(frame / SLOW_HOLD);

  const fastChance = 0.012 + level * 0.3;
  const slowChance = 0.006 + level * 0.16;
  const fastMax = planeWidth * (0.004 + level * 0.055);
  const slowMax = planeWidth * (0.01 + level * 0.09);

  const offsets = new Array<number>(TEAR_BANDS).fill(0);

  for (let i = 0; i < TEAR_BANDS; i++) {
    let dx = 0;
    if (hash(FAST_ON, i, fastSlot) < fastChance) {
      dx += signed(FAST_DX, i, fastSlot) * fastMax;
    }
    if (hash(SLOW_ON, i, slowSlot) < slowChance) {
      dx += signed(SLOW_DX, i, slowSlot) * slowMax;
    }
    offsets[i] = Math.round(dx / 2) * 2;
  }

  return offsets;
};

/**
 * Channel split distance in CSS pixels. Never reaches zero: the frame is always
 * slightly out of register, which is what reads as signal corruption rather
 * than graphic design.
 */
export const splitOffset = (frame: number, planeWidth: number, level: number): number => {
  const base = planeWidth * 0.00075;
  const swing = planeWidth * 0.0016 * level;
  const drift = Math.sin((TAU * 5 * frame) / DURATION_IN_FRAMES);
  const jitter = hash(SPLIT_JITTER, frame);
  const magnitude = base * (1 + 0.6 * drift) + swing * (0.35 + 0.65 * jitter);
  // The split flips direction now and then; the window divides 600.
  const sign = hash(SPLIT_SIGN, Math.floor(frame / 6)) < 0.22 ? -1 : 1;
  return magnitude * sign;
};
