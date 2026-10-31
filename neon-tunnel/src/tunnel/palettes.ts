export type Palette = {
  base: [number, number, number];
  wood: [number, number, number];
  glow: [number, number, number];
  core: [number, number, number];
  reflTint: [number, number, number];
  exposure: number;
};

/** Version 1 — matches the reference: warm sepia/amber neon on dark, greenish-black wood. */
export const WARM_SEPIA: Palette = {
  base: [4 / 255, 6 / 255, 2 / 255],
  wood: [0.8, 0.56, 0.3],
  glow: [0.92, 0.64, 0.38],
  core: [1.0, 0.8, 0.6],
  reflTint: [0.9, 0.78, 0.6],
  exposure: 1.15,
};

/** Version 2 — alternative palette: electric magenta neon in a violet-stained corridor. */
export const MAGENTA_VIOLET: Palette = {
  base: [5 / 255, 3 / 255, 12 / 255],
  wood: [0.34, 0.2, 0.6],
  glow: [1.0, 0.16, 0.62],
  core: [1.0, 0.42, 0.86],
  reflTint: [0.35, 0.55, 1.0],
  exposure: 1.15,
};
