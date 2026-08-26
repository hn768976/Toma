/**
 * The entire palette. Green on black — there is no other hue in this piece.
 */
export const COLOR = {
  bg: '#000000',
  ambient: [4, 26, 12] as const, // #041A0C — faint green haze, lower-left
  lineCore: [232, 255, 232] as const, // #E8FFE8 — near-white hot centre
  lineMid: [79, 255, 106] as const, // #4FFF6A — saturated neon green
  lineGlow: [34, 204, 68] as const, // #22CC44 — the bloom colour
  labelWhite: [240, 255, 240] as const, // #F0FFF0
  labelGreen: [63, 224, 95] as const, // #3FE05F
};

export type RGB = readonly [number, number, number];

export const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const rgb = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Composition constants. 840 frames @ 30fps = 28.0s, seamless loop. */
export const DURATION = 840;
export const FPS = 30;

/** The composition renders 4K by default. */
export const VIDEO_W = 3840;
export const VIDEO_H = 2160;

/**
 * Everything in this piece — stroke weights, font sizes, world geometry, bloom
 * radii — is authored in a 1920x1080 design space and drawn through a single
 * `unit` scale of (compositionWidth / DESIGN_W) x devicePixelRatio. So the 4K
 * composition is the 1080p artwork at 2x, pixel for pixel, and --scale on top
 * of that stays clean in either direction.
 */
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

/** The whole scene is tilted so the line and labels run up to the right. */
export const TILT = (-8 * Math.PI) / 180;
