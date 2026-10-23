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
  paperHot: [1.0, 0.9, 0.72],
  ink: [0.13, 0.06, 0.03],
  rim: [0.2, 0.11, 0.05],
  gap: [0.5, 0.3, 0.16],
  gapDeep: [0.26, 0.13, 0.06],
  bg: [0.09, 0.045, 0.02],
  grade: [1.04, 0.98, 0.9],
};

// V2: moonlit silver dial with cold teal-blue troughs and ice-blue glow.
export const FROST: Palette = {
  paper: [0.6, 0.74, 0.9],
  paperHot: [0.78, 0.88, 0.98],
  ink: [0.02, 0.05, 0.12],
  rim: [0.38, 0.5, 0.62],
  gap: [0.12, 0.3, 0.46],
  gapDeep: [0.05, 0.13, 0.22],
  bg: [0.02, 0.045, 0.07],
  grade: [0.94, 1.0, 1.06],
};

export const PALETTES = { sepia: SEPIA, frost: FROST };
export type PaletteName = keyof typeof PALETTES;
