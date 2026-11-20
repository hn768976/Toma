import type { PostLook } from "./lib/post";

// Every look setting (exposure, light, atmosphere, bloom, lens, grain) in one place.
// Version 1 and Version 2 share this file; only the camera path differs.

export const LOOK = {
  // key light on the sand: warm, soft, from the front and slightly above
  keyDir: [0.42, 0.05, 0.9] as [number, number, number],
  keyColor: "#ffdcae",
  keyIntensity: 0.85,
  fillColor: "#5a4636", // faint warm bounce so shadows stay brown, not black
  fillIntensity: 0.2,
  topLight: 0.85, // light from above that catches the sand surface
  sheen: 0.5, // satin highlight on the packed sand
  sparkle: 2.0, // brightness of glitter grains
  grainContrast: 0.5, // fine sand texture
  // glass
  streakIntensity: 0.75,
  streakWidth: 0.024, // angular width of the strip light
  sideLineIntensity: 0.1,
  rimIntensity: 1.8,
  fresnel: 0.008,
  edgeLine: 0.9, // thin amber line along the silhouette of the glass
  caustics: 0.0, // hair-fine lines of light running down the lower glass
  filmUpper: 0.6, // opacity of gold dust coating on the upper glass
  filmLower: 0.012,
  // glints
  glintIntensity: 4.2,
  glintSize: 0.25, // world units for size = 1
  speckIntensity: 3.2,
  // background glow
  bgGlowCentre: [0.17, 0.68] as [number, number], // uv (0,0 = bottom-left)
  bgGlowRadius: 0.36,
};

export const POST: PostLook = {
  exposure: 1.0,
  toneMapping: "aces",
  bloomThreshold: 0.8,
  bloomKnee: 0.5,
  bloomStrength: 0.45,
  bloomWeights: [1.0, 0.9, 0.7, 0.6, 0.5, 0.5, 0.5],
  bloomTint: [1.0, 0.8, 0.5],
  dofRange: 4.0,
  dofDeadZone: 0.1,
  dofStrength: 0.0,
  // matte, lifted blacks like the reference (#242422)
  lift: [0.139, 0.139, 0.129],
  gain: [1.0, 0.96, 0.9],
  gamma: 1.0,
  saturation: 0.74,
  vignette: 0.15,
  vignetteStart: 0.55,
  vignetteEnd: 1.2,
  chromaticAberration: 0.0015,
  grain: 0.007,
  softness: 0.35,
};
