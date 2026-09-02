import { loopT as libLoopT } from "../lib/loop";

// Timing and sizing for the "forest silhouette" compositions.
//
// The scene is authored at 4K (3840x2160) and every dimension in the layers
// below is expressed as a fraction of the frame, so the same numbers hold if
// the composition is ever re-registered at another resolution.

export const FPS = 30;

// 240 frames @ 30fps = 8.0s. Every periodic motion in the scene completes a
// whole number of cycles in this many frames, so frame 240 is pixel-identical
// to frame 0 and the clip loops seamlessly.
export const DURATION_IN_FRAMES = 240;

export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Position within the loop at frame `f`, 0 at the start and 1 at frame 240. */
export const loopT = (frame: number) => libLoopT(frame, DURATION_IN_FRAMES);

// Number of discrete tint steps the tree sprite is pre-rasterised into.
// Each instance picks one from its depth, which is what produces the
// "hue shift toward the background colour with distance".
export const TINT_STEPS = 8;

// Height of the pre-rasterised tree sprite, in pixels. Large enough that the
// biggest sharp (near-band) instance is never upscaled by more than ~15%.
export const SPRITE_HEIGHT = 1500;
