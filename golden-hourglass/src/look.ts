import type { PostLook } from "./lib/post";

// Every look setting (exposure, light, atmosphere, bloom, lens, grain) in one place.
// Version 1 and Version 2 share this file; only the camera path differs.

export const LOOK = {
  // key light on the sand: warm, soft, from the front and slightly above
  keyDir: [0.34, -0.12, 0.93] as [number, number, number],
  keyColor: "#ffe2b8",
  keyIntensity: 0.5,
  fillColor: "#5a4636", // faint warm bounce so shadows stay brown, not black
  fillIntensity: 0.2,
  topLight: 1.1, // light from above that catches the sand surface
  sheen: 0.5, // satin highlight on the packed sand
  sparkle: 1.6, // brightness of glitter grains
  grainContrast: 0.42, // fine sand texture
  // glass
  streakIntensity: 0.8,
  streakWidth: 0.04, // angular width of the strip light
  sideLineIntensity: 0.1,
  rimIntensity: 1.8,
  fresnel: 0.07,
  filmUpper: 0.38, // opacity of gold dust coating on the upper glass
  filmLower: 0.02,
  // glints
  glintIntensity: 3.2,
  glintSize: 0.36, // world units for size = 1
  speckIntensity: 2.4,
  // background glow
  bgGlowCentre: [0.2, 0.6] as [number, number], // uv (0,0 = bottom-left)
  bgGlowRadius: 0.36,
};

export const POST: PostLook = {
  exposure: 1.0,
  toneMapping: "aces",
  bloomThreshold: 0.8,
  bloomKnee: 0.5,
  bloomStrength: 0.35,
  bloomWeights: [1.0, 0.9, 0.7, 0.6, 0.5, 0.5, 0.5],
  bloomTint: [1.0, 0.88, 0.7],
  dofRange: 4.0,
  dofDeadZone: 0.1,
  dofStrength: 0.0,
  // matte, lifted blacks like the reference (#242422)
  lift: [0.139, 0.139, 0.129],
  gain: [1.0, 0.975, 0.95],
  gamma: 1.0,
  saturation: 0.82,
  vignette: 0.0,
  vignetteStart: 0.4,
  vignetteEnd: 1.2,
  chromaticAberration: 0.0015,
  grain: 0.006,
  softness: 0.0,
};
