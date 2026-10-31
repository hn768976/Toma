type RGB = [number, number, number];

export type CrashPalette = {
  name: string;
  bgInner: RGB;
  bgOuter: RGB;
  lineHot: RGB;
  line: RGB;
  led: RGB;
  candle: RGB;
  text: RGB;
  flare: RGB;
  flareCore: RGB;
  spark: RGB;
  square: RGB;
  haze: RGB;
  dust: RGB;
};

/** Version 1 — sampled from the reference: ember red / orange / hot white. */
export const EMBER_PALETTE: CrashPalette = {
  name: "ember",
  bgInner: [0.36, 0.065, 0.012],
  bgOuter: [0.0, 0.0, 0.0],
  lineHot: [1.0, 0.66, 0.42],
  line: [1.0, 0.36, 0.1],
  led: [1.0, 0.8, 0.72],
  candle: [1.0, 0.32, 0.08],
  text: [1.0, 0.27, 0.06],
  flare: [1.0, 0.42, 0.1],
  flareCore: [1.0, 0.88, 0.65],
  spark: [1.0, 0.62, 0.28],
  square: [1.0, 0.76, 0.62],
  haze: [0.85, 0.16, 0.02],
  dust: [1.0, 0.45, 0.15],
};

/**
 * Version 2 — alternative colour palette: "cold crash". Same scene, camera
 * and timing, regraded to electric blue / cyan with ice-white highlights.
 */
export const ARCTIC_PALETTE: CrashPalette = {
  name: "arctic",
  bgInner: [0.015, 0.09, 0.26],
  bgOuter: [0.0, 0.0, 0.01],
  lineHot: [0.62, 0.92, 1.0],
  line: [0.12, 0.55, 1.0],
  led: [0.78, 0.94, 1.0],
  candle: [0.1, 0.45, 1.0],
  text: [0.1, 0.48, 1.0],
  flare: [0.16, 0.55, 1.0],
  flareCore: [0.82, 0.96, 1.0],
  spark: [0.42, 0.82, 1.0],
  square: [0.72, 0.9, 1.0],
  haze: [0.02, 0.2, 0.62],
  dust: [0.3, 0.7, 1.0],
};
