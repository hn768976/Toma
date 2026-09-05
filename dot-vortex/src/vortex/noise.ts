// Value-noise sampled in POLAR space (radius x angle).
//
// Why polar and why a field at all: every per-dot attribute that varies
// across the disc — brightness clustering, sparkle selection, angular
// jitter, twinkle phase — is read from one of these fields at the dot's
// *current world position*, never baked onto the dot. That is what makes
// the loop close exactly (see layout.ts for the full argument): when a
// ring has rotated by a whole number of its own dot spacings, every dot
// has landed on a position another dot of that ring occupied at frame 0,
// and — because the field is fixed in the frame — it reads exactly the
// values that dot read. The final frame is the first frame, relabelled.
//
// The lattice wraps in the angular axis, so the field is continuous
// across theta = 0 and dots never pop as they cross the seam.

import { mulberry32 } from "./random";

const TAU = Math.PI * 2;

// Hermite smoothstep — C1 continuous, so the interpolated field has no
// creases at cell boundaries for dots to flicker on.
const smooth = (t: number) => t * t * (3 - 2 * t);

export type PolarNoise = {
  /**
   * @param rn normalised radius, clamped to [0, 1]
   * @param theta angle in radians, any value (wrapped internally)
   * @returns value in [0, 1]
   */
  sample: (rn: number, theta: number) => number;
};

export const makePolarNoise = (
  nTheta: number,
  nR: number,
  seed: number,
): PolarNoise => {
  const rand = mulberry32(seed);
  const data = new Float32Array(nTheta * nR);
  for (let i = 0; i < data.length; i++) {
    data[i] = rand();
  }

  const sample = (rn: number, theta: number) => {
    let x = (theta / TAU) * nTheta;
    x -= Math.floor(x / nTheta) * nTheta; // wrap into [0, nTheta)
    const xi = x | 0;
    const xf = smooth(x - xi);
    const x1 = xi + 1 === nTheta ? 0 : xi + 1;

    let y = (rn < 0 ? 0 : rn > 1 ? 1 : rn) * (nR - 1);
    if (y > nR - 1.000001) {
      y = nR - 1.000001;
    }
    const yi = y | 0;
    const yf = smooth(y - yi);

    const rowA = yi * nTheta;
    const rowB = rowA + nTheta;
    const a = data[rowA + xi] + (data[rowA + x1] - data[rowA + xi]) * xf;
    const b = data[rowB + xi] + (data[rowB + x1] - data[rowB + xi]) * xf;
    return a + (b - a) * yf;
  };

  return { sample };
};

// Three octaves of the above, for brightness clustering: a few broad
// patches with finer structure laid over them, which is what gives the
// reference its visibly brighter sectors rather than an even field.
export const makeFbm = (
  octaves: { nTheta: number; nR: number; weight: number }[],
  seed: number,
): PolarNoise => {
  const layers = octaves.map((o, i) => ({
    noise: makePolarNoise(o.nTheta, o.nR, seed + i * 7919),
    weight: o.weight,
  }));
  const total = layers.reduce((acc, l) => acc + l.weight, 0);
  return {
    sample: (rn, theta) => {
      let sum = 0;
      for (let i = 0; i < layers.length; i++) {
        sum += layers[i].noise.sample(rn, theta) * layers[i].weight;
      }
      return sum / total;
    },
  };
};
