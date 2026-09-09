import {DURATION, type Version} from '../config';
import {loopNoise} from '../rand';

/**
 * Exposure flicker: the white field dims very slightly and irregularly.
 *
 * The curve is deadbanded below 0.45 so a good share of frames sit at exactly
 * 1.0 — i.e. a pure #ffffff field that leaves the footage underneath completely
 * untouched — and only dips from there, never above white. Peak dip is
 * `flickerDepth` (2-5%); at 10% it reads as a fault, at 3% it reads as film.
 */
export const flickerLevel = (v: Version, frame: number): number => {
  const n =
    0.62 * loopNoise(v.seed ^ 0xf11c, frame, DURATION, 2) +
    0.38 * loopNoise(v.seed ^ 0xf12d, frame, DURATION, 5);
  const above = Math.max(0, (n - 0.45) / 0.55);
  return 1 - v.flickerDepth * above * above;
};

/** Horizontal weave of the whole plate, in output device pixels. */
export const weaveOffset = (v: Version, frame: number): number => {
  if (v.weavePx <= 0) {
    return 0;
  }
  const a = loopNoise(v.seed ^ 0x3ea7, frame, DURATION, 7) - 0.5;
  const b = loopNoise(v.seed ^ 0x3eb8, frame, DURATION, 3) - 0.5;
  // Rounded to whole pixels so the scratches stay crisp rather than resampled.
  return Math.round((a * 1.4 + b * 0.7) * v.weavePx);
};
