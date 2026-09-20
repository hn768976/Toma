/**
 * Shared timing + resolution constants for the two abstract glass pieces.
 *
 * Both pieces are authored as perfect loops: every animated quantity is a
 * function of `progress` (0..1 across the composition) built only from
 * sin/cos of `2 * PI * progress` (or integer multiples), so frame 0 and the
 * frame after the last one are identical. That makes the exports safe to
 * loop in a player without a visible seam.
 */

export const FPS = 30;

/** 1080p delivery size. The 4K compositions render at exactly 2x this. */
export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

/** V1 — frosted vertical panes on white. Reference is 10s. */
export const V1_DURATION_IN_FRAMES = 10 * FPS;

/** V2 — glossy fanning panels on black. Reference is 16s. */
export const V2_DURATION_IN_FRAMES = 16 * FPS;

export const TAU = Math.PI * 2;
