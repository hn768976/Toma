import { TAU } from "./rng";

/**
 * A smooth, travelling wave used as the spine of the horizontal "river" plates.
 *
 * Each harmonic advances by a whole number of cycles over one loop, so the
 * whole shape returns to itself exactly at u = 1. `xn` is the normalised
 * horizontal position (0 at the left edge, 1 at the right).
 */
export type BandWave = {
  /** Vertical offset of the spine at `xn`, in the range roughly [-1, 1]. */
  offsetAt: (xn: number, u: number) => number;
};

export const makeBandWave = (
  harmonics: { freq: number; amp: number; cycles: number; phase: number }[],
): BandWave => ({
  offsetAt: (xn, u) => {
    let sum = 0;
    for (const h of harmonics) {
      sum += h.amp * Math.sin(TAU * (h.freq * xn + h.cycles * u + h.phase));
    }
    return sum;
  },
});

/**
 * Box-Muller style bell distribution in [-1, 1]-ish, built from a uniform
 * source. Used to scatter particles away from the spine so the band has a soft
 * edge instead of a hard one.
 */
export const bell = (rnd: () => number) => {
  const u1 = Math.max(rnd(), 1e-6);
  const u2 = rnd();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * u2) * 0.35;
};
