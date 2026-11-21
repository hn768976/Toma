/**
 * config.ts - colours, counts and timings. Edit here.
 * (Light, atmosphere, lens and grade live in look.ts.)
 */

export const VIDEO = {
  width: 3840,
  height: 2160,
  fps: 30,
  /** reference: 8.341667 s at 29.97 fps = 250 frames; at 30 fps = 8.333 s */
  durationInFrames: 250,
} as const;

export type Variant = "v1" | "v2";

export type Palette = {
  /** drum paint */
  paint: string;
  /** stencilled markings (stripes, text, trefoil) */
  ink: string;
  /** grime that collects under hoops and rims */
  grime: string;
  /** sky seen above the stacks */
  skyZenith: string;
  /** colour of the soft fill light from above and from the horizon (not seen directly) */
  fillSky: string;
  fillHorizon: string;
  /** light bounced up from the ground */
  ground: string;
  /** haze colour for depth fade */
  haze: string;
};

export const PALETTES: Record<Variant, Palette> = {
  // Version 1: the reference palette - hazard yellow under a teal sky.
  v1: {
    paint: "#d8cc14",
    ink: "#0c1624",
    grime: "#3a2c10",
    skyZenith: "#0b7888",
    fillSky: "#3a7c74",
    fillHorizon: "#5f8a72",
    ground: "#30381c",
    haze: "#16242a",
  },
  // Version 2: the one change - the palette. Turquoise drums, cream markings, amber dusk sky.
  v2: {
    paint: "#23aeb6",
    ink: "#e9e2c8",
    grime: "#0a2226",
    skyZenith: "#b0561a",
    fillSky: "#7a6a5a",
    fillHorizon: "#a08a6a",
    ground: "#16383a",
    haze: "#201c22",
  },
};

/** Drum dimensions in metres. */
export const BARREL = {
  radius: 0.29,
  height: 0.88,
  /** rolling hoops, as a fraction of the height measured from the top */
  hoopsFromTop: [0.31, 0.68],
  radialSegments: 96,
} as const;

/** Markings on each drum (metres; vertical positions measured from the top rim). */
export const MARKINGS = {
  line1: "RADIOACTIVE",
  line2: "WASTE",
  textWidth: 0.29,
  textLine1Y: 0.118,
  textLine2Y: 0.164,
  stripeBandFromEnd: [0.03, 0.062],
  stripeLength: 0.046,
  stripePitch: 0.088,
  stripeSlant: 0.03,
  signTopY: 0.292,
  signSide: 0.245,
  /** markings repeat this many times around the drum */
  repeats: 2,
} as const;

/** Stack layout: a hex-packed block seen from its corner. */
export const LAYOUT = {
  spacing: 0.62,
  levels: 5,
  /** stacks along the lit face (to the left of the hero stack) */
  rowLeft: 3,
  /** the outermost left row is one drum lower, so sky shows above it at the end */
  outerLeftLevels: 4,
  /** stacks along the shadowed face (receding to the right) */
  rowRight: 9,
  /** direction of each face in the ground plane, degrees (0 = +x, 90 = away from camera) */
  leftAngleDeg: 152,
  rightAngleDeg: 44.3,
  /** how far a drum's markings may turn away from the camera, degrees */
  /** shade and warmth of the paint on the rows behind the hero row (1 = same as hero) */
  backRowShade: 0.84,
  backRowWarmth: 0.8,
  facingJitterDeg: 34,
  /** hero stack: marking rotation per level (bottom to top), degrees */
  heroFacingDeg: [12, -33, 5, 21, -14],
  seed: 20261121,
} as const;

/** Camera: a slow vertical crane up the hero stack, tilted up, slight roll. */
export const CAMERA = {
  fovDeg: 24.6,
  pitchDeg: 22,
  yawDeg: 0,
  rollDeg: 0,
  x: 0.19,
  z: 2.15,
  yStart: 0.937,
  yEnd: 2.037,
  /** sharp focus sits on the front of the hero stack */
  focusDistance: 1.95,
} as const;

/** Moments used for look development (frame numbers). */
export const LOOKDEV_FRAMES = [0, 124, 249] as const;
