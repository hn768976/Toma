type RGB = [number, number, number];

export type Palette = {
  bgInner: RGB;
  bgOuter: RGB;
  core: RGB;
  halo: RGB;
  star: RGB;
  ring: RGB;
  sparkle: RGB;
  satA: RGB;
  satB: RGB;
  line: RGB;
  lineWarm: RGB;
  widget: RGB;
  panel: RGB;
  dust: RGB;
  dustWarm: RGB;
  pulse: RGB;
};

/** Sampled from the reference: navy space, orange targets, ice-blue lines. */
export const REFERENCE_PALETTE: Palette = {
  bgInner: [0.06, 0.09, 0.13],
  bgOuter: [0.008, 0.022, 0.035],
  core: [1.0, 0.95, 0.98],
  halo: [0.9, 0.62, 0.9],
  star: [1.0, 0.86, 0.92],
  ring: [1.0, 0.47, 0.16],
  sparkle: [1.0, 0.8, 0.9],
  satA: [0.45, 0.85, 1.0],
  satB: [1.0, 0.58, 0.25],
  line: [0.62, 0.76, 1.0],
  lineWarm: [1.0, 0.55, 0.25],
  widget: [0.72, 0.86, 1.0],
  panel: [0.6, 0.8, 1.0],
  dust: [0.55, 0.7, 0.95],
  dustWarm: [1.0, 0.65, 0.4],
  pulse: [0.85, 0.95, 1.0],
};
