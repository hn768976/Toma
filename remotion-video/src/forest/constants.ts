import { wrap } from "./rand";

// Timing and sizing for the "forest silhouette" compositions.
//
// The scene is authored at 4K (3840x2160) and every dimension below is
// expressed as a fraction of the frame, so the same numbers hold if the
// composition is ever re-registered at another resolution.

export const FPS = 30;

// 240 frames @ 30fps = 8.0s. Every periodic motion in the scene completes a
// whole number of cycles in this many frames, so frame 240 is pixel-identical
// to frame 0 and the clip loops seamlessly.
export const DURATION_IN_FRAMES = 240;

export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Position within the loop at frame `f`, 0 at the start and 1 at frame 240. */
export const loopT = (frame: number) => frame / DURATION_IN_FRAMES;

/**
 * sin/cos of `cycles` whole turns over one loop.
 *
 * Every periodic value in the scene goes through these rather than through
 * Math.sin(2*PI*cycles*t + phase) directly. Algebraically the two are the
 * same, but sin(phase + 2*PI*3) is NOT bit-identical to sin(phase) in
 * floating point, and that difference is enough to change the odd pixel
 * between frame 0 and frame 240. Reducing the argument with a wrap first
 * makes the loop close exactly, not just to the eye.
 */
export const loopSin = (t: number, cycles: number, phase = 0) =>
  Math.sin(2 * Math.PI * wrap(cycles * t, 1) + phase);

export const loopCos = (t: number, cycles: number, phase = 0) =>
  Math.cos(2 * Math.PI * wrap(cycles * t, 1) + phase);

// Number of discrete tint steps the tree sprite is pre-rasterised into.
// Each instance picks one from its depth, which is what produces the
// "hue shift toward the background colour with distance".
export const TINT_STEPS = 8;

// Height of the pre-rasterised tree sprite, in pixels. Large enough that the
// biggest sharp (near-band) instance is never upscaled by more than ~15%.
export const SPRITE_HEIGHT = 1500;
