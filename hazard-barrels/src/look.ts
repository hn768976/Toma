/**
 * look.ts - every light, atmosphere, lens and grade setting.
 * Shared by Version 1 and Version 2, so the two only differ in the one
 * intended change (the palette, see config.ts).
 */
import type { GradeSettings } from "./three/GradeEffect";
import type { LensSettings } from "./three/Stage";

export const LIGHT = {
  /** low warm sun from camera-left: the key light */
  key: {
    color: "#ffe9c4",
    intensity: 2.05,
    /** horizontal angle from the camera axis towards camera-left, degrees */
    azimuthDeg: 52,
    elevationDeg: 22,
    /** half-height of the strip, degrees of elevation */
    elevationSpreadDeg: 11,
    /** angular radius of the sun disc: several jittered lights give soft-edged shadows */
    softnessDeg: 2.2,
    samples: 4,
    shadowMapSize: 2048,
  },
  /** image-based sky light (procedural gradient sky, PMREM filtered) */
  env: { intensity: 0.5, sunGlow: 1.6, stripWidthDeg: 7, stripHeightDeg: 16 },
  /** how strongly neighbouring drums block the sky light (analytic occlusion) */
  occlusion: { strength: 0.96, power: 1.2 },
  /** paint-coloured light bounced between drums inside the stack */
  bounce: 0.03,
  /** strength of sunlit paint reflecting onto the drum next to it */
  sunBounce: 0.9,
  /** brightness of the sky backdrop itself */
  skyBackdrop: 1.0,
} as const;

export const SURFACE = {
  roughness: 0.33,
  /** glossy enamel: a higher index of refraction gives the strong vertical highlight */
  ior: 1.8,
  /** clear lacquer layer: a tight bright core on top of the wider base highlight */
  clearcoat: 0.5,
  clearcoatRoughness: 0.1,
  roughnessVariation: 0.1,
  normalScale: 1.0,
  envMapIntensity: 0.42,
} as const;

export const ATMOSPHERE = {
  /** exponential depth haze */
  fogDensity: 0.02,
} as const;

export const LENS: LensSettings = {
  near: 0.2,
  far: 60,
  msaa: 4,
  dof: { enabled: true, focusRange: 1.9, bokehScale: 6.2, resolutionScale: 0.5 },
  motionBlur: { enabled: true, shutter: 0.5, taps: 9 },
  bloom: { enabled: true, threshold: 0.72, smoothing: 0.25, intensity: 0.55, radius: 0.7, levels: 6 },
};

export const GRADE: GradeSettings = {
  exposure: 1.0,
  whiteBalance: [1.0, 1.0, 1.0],
  toneMapping: "aces",
  contrast: 1.0,
  pivot: 0.4,
  saturation: 0.8,
  lift: [0.014, 0.024, 0.024],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.0, 1.0, 1.0],
  shadowTint: [-0.004, 0.004, 0.004],
  highlightTint: [0.0, 0.0, 0.0],
  vignette: 0.06,
  vignetteStart: 0.55,
  grain: 0.0016,
  dither: 1.0,
};
