import type { PostLook } from "./lib/post";

// Every look setting (exposure, light, atmosphere, bloom, lens, grain) in one place.
// Version 1 and Version 2 share this file; only the palette differs.

export const LOOK = {
  // light
  keyLightIntensity: 0.6, // glow of the frame onto the board
  keyLightRadius: 1.6, // falloff radius (world units)
  keyLightHeight: 0.45,
  beamLightIntensity: 0.12,
  beamLightRadius: 3.2,
  ambient: 7.4,
  keyBoardNeutral: 0.45, // how much the light on the board is pulled towards neutral (0 = pure key colour)
  flashBoost: 0.6, // extra light at the power-up flash
  // atmosphere
  fogDensity: 0.008, // exponential distance fade to the fog colour
  hazeIntensity: 0.06, // glow hanging in the air around the chip
  hazeSize: 7,
  // emissive levels (HDR, drive the bloom)
  frameEmissive: 5.5,
  traceDimEmissive: 1.1,
  traceLitEmissive: 0.3,
  componentEmissive: 1.0,
  beamEmissive: 0.13,
  dieEmissive: 0.5,
  dustEmissive: 0.7,
  // depth of field focus follows the chip
};

export const POST: PostLook = {
  exposure: 1.0,
  toneMapping: "aces",
  bloomThreshold: 0.75,
  bloomKnee: 0.5,
  bloomStrength: 0.5,
  bloomWeights: [1.0, 1.2, 1.3, 1.3, 1.2, 1.1, 1.0],
  bloomTint: [1, 1, 1],
  dofRange: 5.0,
  dofDeadZone: 0.3,
  dofStrength: 0.45,
  lift: [0.012, 0.014, 0.024],
  gain: [1, 1, 1],
  gamma: 1.0,
  saturation: 0.8,
  vignette: 0.5,
  vignetteStart: 0.25,
  vignetteEnd: 1.05,
  chromaticAberration: 0.004,
  grain: 0.022,
  softness: 0.25,
};
