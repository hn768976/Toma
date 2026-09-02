import { loopSin, loopT } from "./constants";

/**
 * The camera drift: a small closed figure-of-eight that returns exactly to its
 * start at frame 240. `amount` is the horizontal amplitude in 4K pixels; the
 * vertical swing is a quarter of it at double frequency.
 *
 * Each depth band is given a different amplitude, which is the whole of the
 * parallax — near bands travel further than far ones.
 */
export const cameraDrift = (frame: number, amount: number) => {
  const t = loopT(frame);
  return {
    x: amount * loopSin(t, 1),
    y: amount * 0.25 * loopSin(t, 2),
  };
};

/** Horizontal drift amplitude per layer, in 4K pixels. Max is the ±14px spec. */
export const DRIFT = {
  far: 4,
  fogBack: 5,
  mid: 7.5,
  fogFront: 9,
  near: 11,
  ground: 11,
  foreground: 14,
  particles: 10,
} as const;
