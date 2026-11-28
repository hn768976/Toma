/**
 * Every look setting: exposure, lights, atmosphere, bloom, lens, grain.
 * Shared by Version 1, Version 2 and the LookDev stills.
 */
export const LOOK = {
  // 1. exposure + tone mapping (AgX, sRGB output)
  toneMapping: "ACES" as "ACES" | "AgX",
  exposure: 1.0,
  contrast: 1.0, // pivoted around mid grey, applied after tone mapping
  saturation: 1.1,
  lift: [0.06, 0.19, 0.25] as [number, number, number], // added in display space
  gain: [1.08, 1.08, 1.08] as [number, number, number], // multiplied in display space

  // 2. light
  sunColor: "#c3efff", // the sun carries the cyan-mint cast of the whole picture
  sunIntensity: 4.55,
  /** Sun direction as azimuth / elevation in degrees (world space). */
  sunAzimuth: 183,
  sunElevation: 62,
  skyColor: "#b7d9ff", // hemisphere light from above: makes the shadows blue
  groundColor: "#c5e2f0", // bounce from the pale ground
  hemiIntensity: 1.13,
  envIntensity: 0.12, // gradient-sky PMREM environment (reflections on glass)
  // The values below are scene-linear RGB (before tone mapping), not sRGB hex.
  envZenith: [0.2, 0.45, 0.9] as [number, number, number],
  envHorizon: [0.49, 0.68, 0.75] as [number, number, number],
  waterColor: [0.03, 0.05, 0.065] as [number, number, number],
  waterFarColor: [0.03, 0.05, 0.065] as [number, number, number],
  ghostColor: [0.1, 0.13, 0.17] as [number, number, number], // construction lines
  shadowMapSize: 2048,
  shadowRadius: 5.0, // PCF blur: soft shadow edges
  shadowBias: -0.0006,
  shadowNormalBias: 0.04,
  shadowStrength: 0.7, // 1 = shadows receive no direct sun at all; lower = paler, see-through shadows
  contactShade: 0.25, // how much walls darken towards the ground (cheap ambient occlusion)
  glassGlow: 1.0, // strength of the self-illumination of the glass towers
  glassEmissiveLow: [0.005, 0.065, 0.17] as [number, number, number], // scene-linear, at the base
  glassEmissiveHigh: [0.02, 0.17, 0.36] as [number, number, number], // ... and at the top
  glassStreak: [0.5, 0.8, 0.95] as [number, number, number], // reflected-sky streaks on the glass (scene-linear)
  glassStreakAmount: 0.45,
  glassAlpha: 0.8, // opacity of the glass between its highlights: lower = more see-through,
  skyBrightness: 1.0,

  // 3. atmosphere
  fogColor: [0.49, 0.68, 0.75] as [number, number, number],
  fogDensity: 0.005, // FogExp2: far blocks fade towards pale cyan
  waterHaze: 0.0005, // the water fades into the horizon far away

  // 4. glow
  bloomThreshold: 0.9,
  bloomKnee: 0.5,
  bloomStrength: 0.22,

  // 5. texture
  tileJoint: -0.06, // > 0 leaves a joint between finished tiles, < 0 closes them into smooth ground
  tileBevel: 0.08, // highlight / shadow on the edges of the ground tiles
  tileSize: 0.36, // size of the Voronoi ground tiles (world units)
  tileBand: 3.2, // width of the zone in which tiles grow from pebbles to solid
  tilePatch: 3.5, // large-scale patchiness of the tile front
  windowLineStrength: 0.42,
  roofDetailStrength: 0.36,
  grain: 0.0015, // film grain amplitude (display space)

  // 6. lens
  /** Tinted vignette: linear multiplier reached in the far corners. */
  vignetteColor: [0.66, 0.85, 0.9] as [number, number, number],
  vignetteStart: 0.3, // radius (0 centre .. 1 corner) where it begins
  vignettePower: 1.6,
  chromaticAberration: 0.0012, // fraction of the frame radius, at the corners
  softness: 0.75, // 0 = pin sharp, 1 = fully replaced by a ~1.5 px (at 1080p) blur
} as const;

export type Look = typeof LOOK;
