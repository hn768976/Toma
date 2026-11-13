export type TunnelPalette = {
  core: [number, number, number];
  mid: [number, number, number];
  deep: [number, number, number];
  hazeA: [number, number, number];
  hazeB: [number, number, number];
};

/** Version 1 — electric blue, sampled from the reference. */
export const ELECTRIC_BLUE: TunnelPalette = {
  core: [0.38, 0.78, 1.0],
  mid: [0.02, 0.4, 1.0],
  deep: [0.03, 0.14, 0.85],
  hazeA: [0.02, 0.12, 0.55],
  hazeB: [0.12, 0.1, 0.85],
};

/** Version 2 — solar gold / ember: warm alternative palette. */
export const SOLAR_GOLD: TunnelPalette = {
  core: [1.0, 0.9, 0.62],
  mid: [1.0, 0.45, 0.06],
  deep: [0.75, 0.2, 0.02],
  hazeA: [0.5, 0.1, 0.01],
  hazeB: [0.7, 0.05, 0.22],
};
