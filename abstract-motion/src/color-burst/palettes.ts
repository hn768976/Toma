export type ColorBurstVariant = "reference" | "solar";

type RGB = [number, number, number];

export type BurstPalette = {
  // Colours chosen for particles flying upward / sideways.
  upper: RGB[];
  // Colours chosen for particles flying downward (the reference's red plume).
  lower: RGB[];
  // Rare bright accent sparks.
  accents: RGB[];
  // Soft powder haze that fills the body of the burst.
  haze: RGB[];
  background: RGB;
};

// Linear-ish RGB values; the final pass applies an exponential tone curve.
export const PALETTES: Record<ColorBurstVariant, BurstPalette> = {
  // Matches the reference: violet / ultramarine body, crimson lower plume,
  // cyan and occasional green-yellow glints.
  reference: {
    upper: [
      [0.62, 0.1, 0.95],
      [0.55, 0.12, 1.0],
      [0.32, 0.16, 1.0],
      [0.18, 0.24, 1.0],
      [0.12, 0.38, 1.0],
      [0.4, 0.14, 1.0],
    ],
    lower: [
      [1.0, 0.03, 0.1],
      [0.88, 0.02, 0.18],
      [0.95, 0.03, 0.12],
      [0.35, 0.12, 1.0],
    ],
    accents: [
      [0.3, 0.85, 1.0],
      [0.45, 0.95, 1.0],
      [0.55, 1.0, 0.45],
      [1.0, 0.85, 0.35],
    ],
    haze: [
      [0.42, 0.2, 0.95],
      [0.6, 0.18, 0.75],
      [0.3, 0.25, 0.9],
    ],
    background: [0.0, 0.0, 0.0],
  },
  // Alternative: a molten "solar flare" palette — amber/gold body, deep
  // ember-red lower plume, teal and white-hot glints on a warm black.
  solar: {
    upper: [
      [1.0, 0.62, 0.12],
      [1.0, 0.78, 0.3],
      [1.0, 0.45, 0.08],
      [0.95, 0.32, 0.06],
      [1.0, 0.88, 0.55],
    ],
    lower: [
      [0.95, 0.16, 0.04],
      [0.85, 0.08, 0.05],
      [1.0, 0.3, 0.05],
      [1.0, 0.55, 0.1],
    ],
    accents: [
      [0.1, 0.9, 0.8],
      [0.25, 0.95, 1.0],
      [1.0, 1.0, 0.85],
      [0.2, 1.0, 0.6],
    ],
    haze: [
      [1.0, 0.42, 0.08],
      [0.9, 0.25, 0.05],
      [1.0, 0.6, 0.15],
    ],
    background: [0.012, 0.004, 0.0],
  },
};
