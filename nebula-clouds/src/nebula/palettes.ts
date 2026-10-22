export type RGB = readonly [number, number, number];

export type NebulaPalette = {
  /** Deepest cloud shadow. */
  deep: RGB;
  /** Main body colour of the sky. */
  mid: RGB;
  /** Lit cloud tops. */
  light: RGB;
  /** Soft milky haze that sits over the clouds. */
  haze: RGB;
  /** Thin filaments that trace the cloud edges. */
  vein: RGB;
  /** Warm wash that blooms in the lower half over time. */
  wash: RGB;
  /** Small bright core near the top right. */
  glow: RGB;
};

// Sampled from the reference footage (sRGB, 0-255).
export const referencePalette: NebulaPalette = {
  deep: [56, 98, 210],
  mid: [106, 158, 238],
  light: [150, 208, 252],
  haze: [190, 206, 246],
  vein: [214, 176, 236],
  wash: [178, 146, 228],
  glow: [236, 250, 255],
};

// Alternate colour grade: teal/emerald sky with golden filaments.
export const auroraPalette: NebulaPalette = {
  deep: [12, 58, 80],
  mid: [28, 112, 120],
  light: [112, 206, 190],
  haze: [196, 236, 218],
  vein: [255, 222, 160],
  wash: [236, 160, 110],
  glow: [255, 246, 214],
};

export const palettes = {
  reference: referencePalette,
  aurora: auroraPalette,
} as const;

export type PaletteName = keyof typeof palettes;
