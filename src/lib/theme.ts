export type RGB = readonly [number, number, number];

export const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Composition constants. 840 frames @ 30fps = 28.0s, seamless loop. */
export const DURATION = 840;
export const FPS = 30;

/** Both compositions render 4K. */
export const VIDEO_W = 3840;
export const VIDEO_H = 2160;

/**
 * Everything in this piece — stroke weights, font sizes, world geometry, bloom
 * radii — is authored in a 1920x1080 design space and drawn through a single
 * `unit` scale of (compositionWidth / DESIGN_W) x devicePixelRatio. So the 4K
 * composition is the 1080p artwork at 2x, pixel for pixel, and --scale on top
 * of that stays clean in either direction.
 *
 * The design space is shared by every variant: sizing, stroke weights and font
 * scales are not variant-tunable.
 */
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;
