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
  ambient: 6.4,
  keyBoardNeutral: 0.25, // how much the light on the board is pulled towards neutral (0 = pure key colour)
  flashBoost: 1.0, // extra light at the power-up flash
  // atmosphere
  fogDensity: 0.008, // exponential distance fade to the fog colour
  hazeIntensity: 0.1, // glow hanging in the air around the chip
  hazeSize: 7,
  // emissive levels (HDR, drive the bloom)
  frameEmissive: 4.2,
  traceDimEmissive: 0.8,
  traceLitEmissive: 0.42,
  componentEmissive: 1.0,
  beamEmissive: 0.105,
  dieEmissive: 1.3,
  dustEmissive: 0.4,
  // depth of field focus follows the chip
};

export const POST: PostLook = {
  exposure: 1.0,
  toneMapping: "aces",
  bloomThreshold: 0.75,
  bloomKnee: 0.5,
  bloomStrength: 0.7,
  bloomWeights: [0.7, 0.9, 1.2, 1.4, 1.4, 1.3, 1.2],
  bloomTint: [1, 1, 1],
  dofRange: 5.0,
  dofDeadZone: 0.3,
  dofStrength: 0.4,
  lift: [0.012, 0.014, 0.024],
  gain: [1, 1, 1],
  gamma: 1.0,
  saturation: 0.84,
  vignette: 0.6,
  vignetteStart: 0.25,
  vignetteEnd: 1.05,
  chromaticAberration: 0.004,
  grain: 0.07,
  softness: 0.25,
};
