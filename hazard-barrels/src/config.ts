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
    skyZenith: "#066a7c",
    fillSky: "#3a7c74",
    fillHorizon: "#6a8a6c",
    ground: "#35391b",
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
  textWidth: 0.315,
  /** extra space between letters, in ems */
  letterSpacingEm: 0.035,
  textLine1Y: 0.125,
  textLine2Y: 0.182,
  stripeBandFromEnd: [0.029, 0.064],
  stripeLength: 0.05,
  stripePitch: 0.092,
  stripeSlant: 0.03,
  signTopY: 0.3,
  signSide: 0.24,
  /** line width of the sign's outline */
  signStroke: 0.008,
  /** markings repeat this many times around the drum */
  repeats: 3,
} as const;

/** Stack layout: a hex-packed block seen from its corner. */
export const LAYOUT = {
  spacing: 0.62,
  levels: 5,
  /** stacks along the lit face (to the left of the hero stack) */
  rowLeft: 3,
  /** gap from the hero stack to the row behind it on the left (wider than `spacing`, so a third stack shows in the wedge between them) */
  leftSpacing: 1.245,
  /** extra stacks as [x, z, drop]: one seen (sunlit) through the wedge between the hero stack and
   *  the leaning row, and one far back that closes the left edge of the frame without shading it */
  extraStacks: [
    [-0.66, -1.75, 0],
    [-1.675, -2.05, 0],
  ] as [number, number, number][],
  /** stacks further apart than this do not shade or light each other */
  neighbourReach: 1.4,
  /** the outermost left row is one drum lower, so sky shows above it at the end */
  outerLeftLevels: 4,
  /** stacks along the shadowed face (receding to the right) */
  rowRight: 9,
  /** direction of each face in the ground plane, degrees (0 = +x, 90 = away from camera) */
  leftAngleDeg: 133,
  rightAngleDeg: 44.3,
  /** how far a drum's markings may turn away from the camera, degrees */
  /** shade and warmth of the paint on the rows behind the hero row (1 = same as hero) */
  backRowShade: 0.9,
  backRowWarmth: 0.8,
  /** the rows behind lean a little towards the hero stack (degrees), pivoting at this height */
  backRowLeanDeg: 2.6,
  leanPivotY: 2.4,
  /** far stacks of the hero row stand this much lower (uneven ground), so their tops show at the end */
  farRowDrop: 0.3,
  /** rolling hoop and rim bead sizes */
  hoopHeight: 0.009,
  hoopHalfWidth: 0.014,
  rimBead: 0.006,
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
