type RGB = readonly [number, number, number];

export type Palette = {
  uBase: RGB;
  uBaseHi: RGB;
  uRibbon: RGB;
  uRibbonAlt: RGB;
  uShadow: RGB;
  uSpec: RGB;
  uGlitterA: RGB;
  uGlitterB: RGB;
};

/** Linear-ish RGB colours fed straight to the shader. */
export const PALETTES = {
  // Version 1 – matches the reference: acid lime sheet, magenta → violet folds.
  limeMagenta: {
    uBase: [0.52, 0.86, 0.04],
    uBaseHi: [0.86, 1.0, 0.38],
    uRibbon: [0.82, 0.08, 0.62],
    uRibbonAlt: [0.5, 0.22, 0.85],
    uShadow: [0.03, 0.05, 0.01],
    uSpec: [1.0, 0.9, 1.0],
    uGlitterA: [1.0, 0.55, 0.95],
    uGlitterB: [0.75, 1.0, 0.25],
  },
  // Version 2 – alternative palette: aqua/teal sheet with molten gold → coral folds.
  aquaGold: {
    uBase: [0.06, 0.72, 0.82],
    uBaseHi: [0.6, 0.98, 1.0],
    uRibbon: [1.0, 0.55, 0.06],
    uRibbonAlt: [0.95, 0.24, 0.2],
    uShadow: [0.0, 0.02, 0.05],
    uSpec: [1.0, 0.96, 0.85],
    uGlitterA: [1.0, 0.85, 0.4],
    uGlitterB: [0.45, 0.95, 1.0],
  },
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;
