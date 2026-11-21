/**
 * look.ts - every light, atmosphere, lens and grade setting.
 * Shared by Version 1 and Version 2, so the two only differ in the one
 * intended change (the camera angle, see config.ts).
 */
import type { GradeSettings } from "./three/GradeEffect";
import type { LensSettings } from "./three/Stage";

export const LIGHT = {
  /** large cool softbox behind and to the right of the set: the key light */
  key: {
    color: "#e9f4ff",
    /** candela-like units; falls off with distance squared (scene is in millimetres) */
    intensity: 2.95e6,
    /** position in module coordinates: [x across, y along, height] */
    position: [280, 440, 520] as [number, number, number],
    aimAt: [120, 90, 0] as [number, number, number],
    /** half-width of the softbox: staggered lights across it give soft penumbrae */
    halfSize: 170,
    /** length of the strip along the board */
    stripLength: 340,
    /** sideways drift of the aim point per millimetre along the strip (negative = far end aims further left) */
    aimSkew: -0.45,
    /** cone half-angle (radians): the soft cone edge is what darkens the left of the table */
    coneAngle: 0.26,
    samples: 8,
    shadowMapSize: 2048,
  },
  /** darkness of the soft contact-shadow decals under the parts (0..1) */
  contactShadow: 0.9,
  /** studio environment for reflections and a little fill */
  env: {
    intensity: 0.3,
    softbox: 7.5,
    ambient: 0.22,
    /** where the softbox sits in reflections: [x across, y along, height] direction */
    softboxDir: [0.55, 0.8, 0.42] as [number, number, number],
  },
} as const;

export const SURFACE = {
  tableRoughness: 0.32,
  pcbRoughness: 0.42,
  chipRoughness: 0.4,
  /** moulded plastic with a fairly strong sheen */
  chipIor: 1.7,
  /** the loose packages are a duller plastic than the memory chips */
  packageIor: 1.5,
  packageRoughness: 0.5,
  leadRoughness: 0.28,
  goldRoughness: 0.5,
} as const;

export const LENS: LensSettings = {
  near: 20,
  far: 3000,
  msaa: 4,
  dof: { enabled: true, focusRange: 46, bokehScale: 4.6, resolutionScale: 0.5 },
  motionBlur: { enabled: true, shutter: 0.5, taps: 9 },
  bloom: { enabled: true, threshold: 0.7, smoothing: 0.25, intensity: 0.5, radius: 0.7, levels: 6 },
};

export const GRADE: GradeSettings = {
  exposure: 1.0,
  whiteBalance: [1.0, 1.0, 1.0],
  toneMapping: "aces",
  contrast: 1.12,
  pivot: 0.4,
  saturation: 1.05,
  lift: [0.006, 0.007, 0.008],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.0, 1.0, 1.0],
  shadowTint: [-0.025, 0.002, 0.018],
  highlightTint: [0.0, 0.0, 0.0],
  vignette: 0.1,
  vignetteStart: 0.5,
  grain: 0.0015,
  dither: 1.0,
};
