import { COLS, ROWS } from "./constants";
import { seededRandom } from "../particle-ring/random";

// One lattice point on the wave surface. u/v are the normalised surface
// coordinates in [-1, 1]; everything else is per-particle "identity" derived
// deterministically from the grid index — never Math.random(), since Remotion
// renders frames out of order across workers and anything not a pure function
// of (index, frame) would flicker.
export type WaveParticle = {
  u: number;
  v: number;
  /** Pre-multiplied PI*u and PI*v, so the per-frame loop skips two multiplies. */
  pu: number;
  pv: number;
  /** Per-particle brightness multiplier — gives the lattice its uneven sparkle. */
  variation: number;
  /** Twinkle phase offset, radians. */
  shimmerPhase: number;
};

export const generateWaveParticles = (): WaveParticle[] => {
  const particles: WaveParticle[] = new Array(COLS * ROWS);
  let i = 0;
  for (let col = 0; col < COLS; col++) {
    // (col + 0.5) / COLS keeps the lattice symmetric about the centre line.
    const u = ((col + 0.5) / COLS) * 2 - 1;
    for (let row = 0; row < ROWS; row++) {
      const v = ((row + 0.5) / ROWS) * 2 - 1;
      const r1 = seededRandom(i, 17);
      const r2 = seededRandom(i, 91);
      particles[i] = {
        u,
        v,
        pu: Math.PI * u,
        pv: Math.PI * v,
        // Skewed towards the dim end so most dots sit back and a minority
        // pop — without this the grid reads as a flat, even screen door.
        variation: 0.45 + 0.85 * r1 * r1,
        shimmerPhase: r2 * Math.PI * 2,
      };
      i++;
    }
  }
  return particles;
};
