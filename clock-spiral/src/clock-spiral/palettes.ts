// Linear-ish RGB colours fed to the shaders.
export type Palette = {
  paper: [number, number, number];
  paperHot: [number, number, number];
  ink: [number, number, number];
  rim: [number, number, number];
  gap: [number, number, number];
  gapDeep: [number, number, number];
  bg: [number, number, number];
  grade: [number, number, number];
};

// V1: aged parchment, burnt-sepia troughs, amber glow (matches the reference).
export const SEPIA: Palette = {
  paper: [1.0, 0.8, 0.55],
  paperHot: [1.0, 0.95, 0.8],
  ink: [0.13, 0.06, 0.03],
  rim: [0.2, 0.11, 0.05],
  gap: [0.48, 0.25, 0.11],
  gapDeep: [0.1, 0.04, 0.015],
  bg: [0.035, 0.016, 0.008],
  grade: [1.04, 0.98, 0.9],
};

// V2: moonlit silver dial with cold teal-blue troughs and ice-blue glow.
export const FROST: Palette = {
  paper: [0.72, 0.84, 0.98],
  paperHot: [0.92, 0.98, 1.0],
  ink: [0.02, 0.05, 0.12],
  rim: [0.38, 0.5, 0.62],
  gap: [0.12, 0.3, 0.46],
  gapDeep: [0.02, 0.07, 0.14],
  bg: [0.006, 0.015, 0.03],
  grade: [0.94, 1.0, 1.06],
};

export const PALETTES = { sepia: SEPIA, frost: FROST };
export type PaletteName = keyof typeof PALETTES;
