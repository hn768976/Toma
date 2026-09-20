/** Shared composition constants. Every stage in the set uses these. */
export const FPS = 30;

/**
 * The animation period.
 *
 * Every moving quantity in the project completes a whole number of cycles
 * over this many frames, so frame LOOP_FRAMES is identical to frame 0.
 * It is deliberately a separate constant from the composition length: that
 * is what lets the loop-closure test extend a composition to 301 frames and
 * render frame 300 without moving the finish line it is trying to check.
 */
export const LOOP_FRAMES = 300;

export const DURATION_IN_FRAMES = LOOP_FRAMES; // 10s, seamless
export const WIDTH = 3840;
export const HEIGHT = 2160;

/**
 * The camera rig.
 *
 * Buyers composite their own product onto the podium top, so the camera is
 * locked: no orbit, no rotation, no roll, no arc, no parallax, no easing.
 *
 * `push` is the one permitted exception — an extremely slow, perfectly
 * linear zoom that a buyer can match with a single scale keyframe. It is 0
 * for every shipped row, because a push cannot also be a seamless loop
 * (frame 300 would not equal frame 0) and the loop is the harder
 * requirement. See the README.
 */
export type CameraRig = {
  /** Vertical field of view in degrees. 23° ≈ a 50mm lens on 16:9 full frame. */
  fovDeg: number;
  /** Camera height above the floor, in world units. */
  height: number;
  /** Camera distance in front of the plinth, in world units. */
  distance: number;
  /** Degrees below horizontal. Kept near 8° so the podium top reads as a surface. */
  tiltDeg: number;
  /** Fraction the image scales up, linearly, over the whole clip. 0 = fully locked. */
  push: number;
};

/**
 * Depth of field.
 *
 * Implemented in image space rather than as a bokeh pass: because the camera
 * is locked, the far field occupies a fixed region of frame, so a masked
 * blur over the rendered image is exact, costs nothing per frame and cannot
 * introduce the flicker a temporal or sampled DOF would.
 */
export type DofLayer = {
  /** Blur radius as a fraction of frame height. */
  blur: number;
  /** Frame-y (0 = top) at and above which this layer is at full strength. */
  top: number;
  /** Frame-y at and below which this layer has no effect. */
  bottom: number;
};

export type DofConfig = {
  layers: DofLayer[];
  /** Elliptical pocket kept sharp, in frame fractions. The plinth lives here. */
  sharp: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    /** 0..1 — how much of the ellipse is the soft edge. */
    feather: number;
  } | null;
};

export type ToneConfig = {
  /**
   * "neutral" is the Khronos PBR Neutral transform — built for product
   * rendering, so it holds material colour instead of pulling everything
   * towards a film curve. "aces" is used where a hot emissive core is
   * wanted. "none" is linear.
   */
  mapping: "neutral" | "aces" | "none";
  exposure: number;
};

export type GradeConfig = {
  /** Film grain amplitude. 0.015 = 1.5%. Doubles as a dither against banding. */
  grain: number;
  /** Corner darkening, 0..1. */
  vignette: number;
};

/**
 * The canopy, described in world units on the occluder plane rather than in
 * texture fractions. That matters because the occluder has to be large
 * enough to fill the key's whole cone — light that misses it reaches the
 * stage unobstructed and leaves a clean quadrant with no shadow at all —
 * so the plane size has to be free to change without resizing every leaf.
 */
export type FoliageConfig = {
  seed: number;
  branches: number;
  leavesPerBranch: number;
  /** Leaf length in world units, on the occluder. */
  leafSize: number;
  /** Branch segment length in world units, on the occluder. */
  branchSize: number;
  /** Pre-blur on the mask, in world units, on top of the shadow's own penumbra. */
  blur: number;
  density: number;
  /** 0 = leaves spread evenly, 1 = dense masses with open sky between them. */
  clumping: number;
  /** Size of the occluder plane in world units. Must cover the key's cone. */
  planeSize: number;
  /** Where the occluder sits — between the key light and the stage, out of shot. */
  position: [number, number, number];
  rotation: [number, number, number];
  /** Sway, in radians, completing `swayCycles` whole cycles over the clip. */
  swayAmplitude: number;
  swayCycles: number;
  /** Secondary drift, so the canopy does not read as a single rocking plane. */
  driftAmplitude: number;
  driftCycles: number;
  lightPosition: [number, number, number];
  /** Where the key is aimed. Moving this moves the whole pattern. */
  lightAim: [number, number, number];
  lightIntensity: number;
  lightColor: string;
  /** Spot cone half-angle in radians. */
  lightAngle: number;
  /** Apparent light size for PCSS. Larger = softer, faster-growing penumbra. */
  softness: number;
};

export type DuotoneGlassParams = {
  kind: "duotone-glass";
  keyLeft: string;
  keyRight: string;
  backdropTop: string;
  backdropBase: string;
  floorColor: string;
  floorRoughness: number;
  disc: { radius: number; height: number; bevel: number };
  glass: {
    transmission: number;
    roughness: number;
    thickness: number;
    ior: number;
    attenuationColor: string;
    attenuationDistance: number;
  };
  /** Strength of the coloured light pooling on the floor beneath the glass. */
  pool: number;
};

export type NeonRingParams = {
  kind: "neon-ring";
  /** The ring colour at its glow edge. */
  ring: string;
  /** The hot core of the tube — near white, tinted towards `ring`. */
  ringCore: string;
  disc: { radius: number; height: number; bevel: number };
  /** Whole cycles the bright segment travels round each ring over the clip. */
  travelCyclesTop: number;
  travelCyclesBottom: number;
  /** Whole cycles of the overall brightness pulse. */
  pulseCycles: number;
};

export type FlutedPlasterParams = {
  kind: "fluted-plaster";
  plinth: "cylinder" | "columns";
  wall: string;
  plaster: string;
  /** Distance from the plinth centre back to the wall. */
  wallDistance: number;
  foliage: FoliageConfig;
};

export type WoodLeafParams = {
  kind: "wood-leaf";
  wall: string;
  floor: string;
  wallDistance: number;
  wood: {
    light: string;
    dark: string;
    rings: number;
    turbulence: number;
  };
  disc: { radius: number; height: number; bevel: number };
  foliage: FoliageConfig;
};

export type LookParams =
  | DuotoneGlassParams
  | NeonRingParams
  | FlutedPlasterParams
  | WoodLeafParams;

export type LookId =
  | "duotone-glass"
  | "neon-ring"
  | "fluted-plaster"
  | "wood-leaf";

export type StageConfig = {
  /** Remotion composition id. */
  id: string;
  /** Output file base name. */
  outName: string;
  look: LookId;
  lookLabel: string;
  variant: "A" | "B";
  variantLabel: string;
  /** Frame to export as the saleable still. */
  stillFrame: number;
  camera: CameraRig;
  tone: ToneConfig;
  dof: DofConfig | null;
  grade: GradeConfig;
  /** Page background behind the canvas — matters only if the canvas is transparent. */
  clear: string;
  params: LookParams;
};
