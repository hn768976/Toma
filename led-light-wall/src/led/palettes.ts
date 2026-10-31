export type Vec3 = readonly [number, number, number];

export type LedPalette = {
  uBgLeft: Vec3;
  uBgMid: Vec3;
  uBgRight: Vec3;
  uBgDeep: Vec3;
  uLightLeft: Vec3;
  uLightRight: Vec3;
  uLightAccent: Vec3;
  uHaze: Vec3;
  uRay: Vec3;
  uExposure: number;
};

/** Version 1 – matches the reference: violet (left) -> azure -> cyan (right). */
export const PALETTE_REFERENCE: LedPalette = {
  uBgLeft: [0.4, 0.16, 0.85],
  uBgMid: [0.27, 0.37, 0.9],
  uBgRight: [0.3, 0.47, 0.92],
  uBgDeep: [0.14, 0.08, 0.42],
  uLightLeft: [0.35, 0.7, 1.0],
  uLightRight: [0.24, 0.8, 1.0],
  uLightAccent: [0.8, 0.38, 1.0],
  uHaze: [0.45, 0.75, 1.0],
  uRay: [0.35, 0.9, 1.0],
  uExposure: 1.0,
};

/** Version 2 – alternative palette: magenta (left) -> crimson -> amber/gold (right). */
export const PALETTE_SUNSET: LedPalette = {
  uBgLeft: [0.5, 0.04, 0.45],
  uBgMid: [0.66, 0.08, 0.2],
  uBgRight: [0.78, 0.32, 0.04],
  uBgDeep: [0.22, 0.01, 0.16],
  uLightLeft: [1.0, 0.45, 0.85],
  uLightRight: [1.0, 0.82, 0.35],
  uLightAccent: [1.0, 0.35, 0.25],
  uHaze: [0.9, 0.45, 0.35],
  uRay: [1.0, 0.8, 0.4],
  uExposure: 1.0,
};
