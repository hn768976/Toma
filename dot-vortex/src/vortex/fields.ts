// The world fields every dot reads from. All are fixed in the frame and
// 2*PI-periodic in theta, which is what lets the animation loop exactly
// (see layout.ts).

import { makeFbm, makePolarNoise } from "./noise";
import {
  SEED_BRIGHTNESS,
  SEED_JITTER,
  SEED_SPARKLE,
  SEED_TWINKLE,
} from "./constants";

// Broad patches with finer structure inside them. Deliberately
// low-frequency: brighter dots must cluster into visible sectors, not
// speckle evenly across the disc.
export const brightnessField = makeFbm(
  [
    { nTheta: 7, nR: 5, weight: 0.6 },
    { nTheta: 17, nR: 11, weight: 0.28 },
    { nTheta: 37, nR: 23, weight: 0.12 },
  ],
  SEED_BRIGHTNESS,
);

// High frequency, so neighbouring dots are decorrelated and sparkles come
// out isolated rather than clumped — but still smooth, so a dot rotating
// through the field fades its sparkle in and out instead of popping.
export const sparkleField = makePolarNoise(613, 180, SEED_SPARKLE);

// Splits dots between twinkle periods and staggers their phase.
export const twinkleField = makePolarNoise(397, 120, SEED_TWINKLE);

// Sub-pixel angular jitter, high frequency so adjacent dots break the
// regular angular spacing that would otherwise beat with the pixel grid.
export const jitterField = makePolarNoise(409, 97, SEED_JITTER);
