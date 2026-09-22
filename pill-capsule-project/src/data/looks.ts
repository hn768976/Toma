/**
 * Every composition in this project is a row in one of the two tables below.
 * Geometry, materials, the motion system, the camera and the post chain are
 * fixed; pill type, colours, count, background, framing and blur are data.
 *
 * To add a colourway: copy a row, change `colourway` and `backdrop`, give it a
 * new `id` and `fileName`. To add a pill shape: add a case to
 * src/lib/pill-geometry.ts and a `shapes` entry in a falling row. Nothing else
 * needs to change. See README.md.
 */

export type Colourway = { cap: string; body: string };

export type LightformerSpec = {
  form: "rect" | "circle";
  /** World position of the light card. */
  position: [number, number, number];
  /** The card is turned to face this point. */
  target: [number, number, number];
  /** Width and height of the card. Elongated cards give the elongated,
   *  soft-streak highlight that reads as a coated tablet. */
  scale: [number, number];
  intensity: number;
  color: string;
};

export type ShadowSpec = {
  position: [number, number, number];
  intensity: number;
  color: string;
  /** Half-extent of the orthographic shadow camera. */
  cameraSize: number;
  bias: number;
  normalBias: number;
  mapSize: number;
};

export type Rig = {
  lightformers: LightformerSpec[];
  /** Ambient lift. Keeps white bodies off dead grey in the deepest shadow. */
  ambient: { intensity: number; color: string };
  /** Look 1 only: the shadow-casting key behind the soft contact shadow. */
  shadowLight: ShadowSpec | null;
  /** PCSS settings for <SoftShadows>. Null disables shadows entirely. */
  softShadows: { size: number; samples: number; focus: number } | null;
  environmentIntensity: number;
};

export type CycSpec = {
  /** Albedo at the floor and at the top of the sweep. */
  floorColor: string;
  wallColor: string;
  floorY: number;
  curveZ: number;
  curveRadius: number;
  floorDepth: number;
  wallHeight: number;
  width: number;
  /** How much studio environment the sweep picks up; below 1 keeps a
   *  saturated backdrop from washing out. */
  envMapIntensity: number;
  /** Brightness at the left and right edges of the sweep. */
  sideFalloff: [number, number];
};

export type DofSpec = {
  worldFocusDistance: number;
  worldFocusRange: number;
  bokehScale: number;
};

export type SingleRow = {
  id: string;
  fileName: string;
  label: string;
  durationInFrames: number;
  /** Length of the motion cycle. Deliberately NOT read from useVideoConfig, so
   *  the *-loopcheck compositions can run one frame past the end and still
   *  close on frame 0. */
  loopFrames: number;
  /** Look 2 renders the beauty pass on frames 0..loopFrames-1 and the luma
   *  matte on the next loopFrames, from the same values. */
  hasMattePass: boolean;
  shape: "capsule" | "tablet";
  scored: boolean;
  colourway: Colourway;
  /** The pill's long axis, as a fraction of frame height. */
  sizeFraction: number;
  /** Centre offset, as a fraction of frame width and height. */
  positionFraction: [number, number];
  /** Fixed tilt in degrees, applied outside the spin. */
  tiltDeg: [number, number, number];
  /** Full turns over one loop, per axis, applied inside the tilt. Integers
   *  only — this is what closes the loop. */
  turns: [number, number, number];
  /** Vertical bob, as a fraction of pill length. One cycle per loop. */
  bobFraction: number;
  /** Keep `far` as tight as the scene allows: the depth-of-field pass works
   *  in depth normalised over [near, far], so a far plane an order of
   *  magnitude beyond the content flattens the circle of confusion to
   *  nothing and the blur silently disappears. */
  camera: { fovDeg: number; z: number; near: number; far: number };
  backdrop: CycSpec | null;
  rig: Rig;
  dof: DofSpec;
  /** Film grain, nominal. Calibrated against the standard deviation actually
   *  measured on the encoded frame, which comes out around half this: the
   *  passes after it attenuate high-frequency noise. 0.04 nominal delivers
   *  ~1.8% on the backdrop, inside the brief's 1.5-2.5% band. The matte pass
   *  always gets zero. */
  grain: number;
  material: { roughness: number; clearcoat: number };
  /** Frames to harvest as stills. */
  stillFrames: [number, number, number];
};

export type FallingRow = {
  id: string;
  fileName: string;
  label: string;
  durationInFrames: number;
  loopFrames: number;
  colourway: Colourway;
  field: {
    seed: number;
    shapes: { shape: "capsule" | "tablet" | "caplet"; weight: number }[];
    count: number;
    period: number;
    zNear: number;
    zFar: number;
    halfWidth: number;
    scale: number;
    sizeJitter: number;
    turnCounts: number[];
  };
  camera: { fovDeg: number; z: number; near: number; far: number };
  backdrop: {
    colorA: string;
    colorB: string;
    center: [number, number];
    spread: number;
    vignette: number;
    z: number;
  };
  rig: Rig;
  dof: DofSpec;
  grain: number;
  material: { roughness: number; clearcoat: number };
  stillFrames: [number, number, number];
};

// --- shared rigs -----------------------------------------------------------

/**
 * Look 1: a large soft key upper-left front, a fill opposite at ~40%, and a
 * broad top card. Bright, low-contrast, product-photography light.
 */
const STUDIO_RIG: Rig = {
  lightformers: [
    {
      form: "rect",
      position: [-7.5, 7.5, 9],
      target: [0, 0, 0],
      scale: [8, 17],
      intensity: 10,
      color: "#f7fbff",
    },
    {
      form: "rect",
      position: [9, 1.5, 7],
      target: [0, 0, 0],
      scale: [11, 11],
      intensity: 3.6,
      color: "#eef3ff",
    },
    {
      form: "rect",
      position: [0, 13, 1],
      target: [0, 0, 0],
      scale: [18, 18],
      intensity: 3.6,
      color: "#ffffff",
    },
    {
      form: "rect",
      position: [0, -2, 12],
      target: [0, 0, 0],
      scale: [16, 8],
      intensity: 1.6,
      color: "#fff8f2",
    },
  ],
  ambient: { intensity: 0.6, color: "#e9f0ff" },
  // Nearly overhead, so the contact shadow sits under the pill rather than
  // thrown off to one side. Shaping comes from the light cards; this one is
  // here for the shadow.
  shadowLight: {
    // Nearly overhead so the shadow sits under the pill, and carrying most of
    // the floor's light as well: too weak against the top card and the contact
    // shadow simply vanishes.
    position: [-1.2, 14, 1.2],
    intensity: 8,
    color: "#fff6ee",
    cameraSize: 13,
    bias: -0.0005,
    normalBias: 0.02,
    mapSize: 1024,
  },
  softShadows: { size: 140, samples: 24, focus: 0.18 },
  environmentIntensity: 1,
};

/**
 * Look 2 inverts look 1: no backdrop, no ground shadow, a tight rim from
 * behind plus a soft key, so the capsule reads against pure black by its
 * edges.
 */
const BLACK_RIG: Rig = {
  lightformers: [
    {
      form: "rect",
      position: [-5.5, 4.5, 7],
      target: [0, 0, 0],
      scale: [7.5, 12],
      intensity: 3.8,
      color: "#fff3e8",
    },
    {
      form: "rect",
      position: [3.2, 2.4, -7],
      target: [0, 0, 0],
      scale: [2.2, 7],
      intensity: 12,
      color: "#ffffff",
    },
    {
      form: "rect",
      position: [-3.4, -2.2, -6.5],
      target: [0, 0, 0],
      scale: [2, 6],
      intensity: 20,
      color: "#ffe9e2",
    },
    {
      form: "rect",
      position: [5.5, -1.5, 5],
      target: [0, 0, 0],
      scale: [4, 6],
      intensity: 1.5,
      color: "#e8efff",
    },
  ],
  ambient: { intensity: 0.12, color: "#20242c" },
  shadowLight: null,
  softShadows: null,
  environmentIntensity: 1,
};

/**
 * Look 3: soft and even, no strong shadows. Depth comes from blur, not from
 * lighting, so the field stays readable when the foreground goes to mush.
 */
const FIELD_RIG: Rig = {
  lightformers: [
    {
      form: "rect",
      position: [-8, 9, 11],
      target: [0, 0, 0],
      scale: [7, 9],
      intensity: 24,
      color: "#fffaf4",
    },
    // Small and very bright: this is the one that puts a tight hotspot on the
    // coating. Broad cards alone give soft square patches, which read as clay.
    {
      form: "rect",
      position: [-4, 7, 9],
      target: [0, 0, 0],
      scale: [1.6, 2.6],
      intensity: 90,
      color: "#ffffff",
    },
    {
      form: "rect",
      position: [10, 2, 9],
      target: [0, 0, 0],
      scale: [8, 10],
      intensity: 5,
      color: "#eef4ff",
    },
    {
      form: "rect",
      position: [0, -9, 8],
      target: [0, 0, 0],
      scale: [16, 10],
      intensity: 1.4,
      color: "#fff6ef",
    },
    // Kept low on purpose: a bright card directly behind the field puts a
    // hard rim on every capsule, which reads as a cut-out rather than as
    // pills in soft light.
    {
      form: "rect",
      position: [0, 0, -14],
      target: [0, 0, 0],
      scale: [22, 22],
      intensity: 0.9,
      color: "#dfeaff",
    },
  ],
  ambient: { intensity: 0.22, color: "#eef4ff" },
  shadowLight: null,
  softShadows: null,
  environmentIntensity: 1,
};

const COATING = { roughness: 0.14, clearcoat: 0.85 };

// --- look 1 and 2 ----------------------------------------------------------

export const SINGLE_ROWS: SingleRow[] = [
  {
    id: "SinglePill-CapsuleGrey",
    fileName: "SinglePill_CapsuleGrey.mp4",
    label: "Look 1A - two-tone capsule on a warm-neutral grey sweep",
    durationInFrames: 300,
    loopFrames: 300,
    hasMattePass: false,
    shape: "capsule",
    scored: false,
    colourway: { cap: "#0072cc", body: "#f7f7f6" },
    sizeFraction: 0.45,
    positionFraction: [-0.19, 0.0],
    tiltDeg: [10, 0, 12],
    turns: [0, 1, 0],
    bobFraction: 0.02,
    camera: { fovDeg: 22, z: 20, near: 2, far: 34 },
    backdrop: {
      floorColor: "#fffdf9",
      wallColor: "#dcdcdc",
      floorY: -3.0,
      curveZ: -6,
      curveRadius: 2.3,
      floorDepth: 20,
      wallHeight: 22,
      width: 54,
      envMapIntensity: 1,
      sideFalloff: [1.1, 0.74],
    },
    rig: STUDIO_RIG,
    dof: { worldFocusDistance: 20, worldFocusRange: 4, bokehScale: 3.6 },
    grain: 0.036,
    // Softer than the falling field on purpose: look 1's reference is a broad
    // satin sheen down the cap, not the tight glint a falling pill catches.
    material: { roughness: 0.34, clearcoat: 0.5 },
    stillFrames: [42, 148, 246],
  },
  {
    id: "SinglePill-TabletBlue",
    fileName: "SinglePill_TabletBlue.mp4",
    label: "Look 1B - scored white tablet on a mid-blue sweep, tumbling",
    durationInFrames: 300,
    loopFrames: 300,
    hasMattePass: false,
    shape: "tablet",
    scored: true,
    colourway: { cap: "#f3f2ee", body: "#f3f2ee" },
    sizeFraction: 0.45,
    positionFraction: [-0.185, 0.0],
    tiltDeg: [0, 0, 18],
    // Two axes, one and two turns: a tumble that never repeats on screen but
    // still closes exactly.
    turns: [1, 2, 0],
    bobFraction: 0.02,
    camera: { fovDeg: 22, z: 20, near: 2, far: 34 },
    backdrop: {
      floorColor: "#00d4ff",
      wallColor: "#0075ff",
      floorY: -3.0,
      curveZ: -6,
      curveRadius: 2.3,
      floorDepth: 20,
      wallHeight: 22,
      width: 54,
      envMapIntensity: 0.26,
      sideFalloff: [1.08, 0.82],
    },
    rig: STUDIO_RIG,
    dof: { worldFocusDistance: 20, worldFocusRange: 4, bokehScale: 3.6 },
    grain: 0.04,
    material: { roughness: 0.34, clearcoat: 0.5 },
    stillFrames: [36, 155, 262],
  },
  {
    id: "SinglePill-BlackMatte",
    fileName: "SinglePill_BlackMatte.mp4",
    label: "Look 2 - red/white capsule on pure black, beauty + luma matte",
    durationInFrames: 600,
    loopFrames: 300,
    hasMattePass: true,
    shape: "capsule",
    scored: false,
    colourway: { cap: "#bb3630", body: "#d6d6d6" },
    sizeFraction: 0.68,
    positionFraction: [0.015, 0.0],
    tiltDeg: [26, 0, -30],
    turns: [0, 1, 0],
    bobFraction: 0.015,
    camera: { fovDeg: 22, z: 20, near: 2, far: 34 },
    backdrop: null,
    rig: BLACK_RIG,
    dof: { worldFocusDistance: 20, worldFocusRange: 5, bokehScale: 1.6 },
    grain: 0.026,
    material: { roughness: 0.23, clearcoat: 0.68 },
    stillFrames: [55, 140, 265],
  },
];

// --- look 3 ----------------------------------------------------------------

/** 3B and 3C share this field verbatim; only the colours differ. */
const UNIFORM_CAPSULE_FIELD = {
  seed: 20240917,
  shapes: [{ shape: "capsule" as const, weight: 1 }],
  count: 50,
  period: 9,
  zNear: 5,
  zFar: -12,
  // Matches the visible half-width at zNear; buildField scales it with depth
  // so the far plane stays filled edge to edge.
  halfWidth: 2.72,
  scale: 0.72,
  sizeJitter: 0.05,
  turnCounts: [1, 2, 3],
};

const TEAL_BACKDROP = {
  colorA: "#42687a",
  colorB: "#76acc8",
  center: [0.54, 0.58] as [number, number],
  spread: 0.95,
  vignette: 0.2,
  z: -16,
};

export const FALLING_ROWS: FallingRow[] = [
  {
    id: "FallingPills-MixedWhite",
    fileName: "FallingPills_MixedWhite.mp4",
    label: "Look 3A - mixed white capsules, tablets and caplets on deep teal-blue",
    durationInFrames: 450,
    loopFrames: 450,
    colourway: { cap: "#ffffff", body: "#ffffff" },
    field: {
      seed: 771103,
      shapes: [
        { shape: "capsule", weight: 0.34 },
        { shape: "tablet", weight: 0.33 },
        { shape: "caplet", weight: 0.33 },
      ],
      count: 62,
      period: 9,
      zNear: 5,
      zFar: -12,
      halfWidth: 2.72,
      scale: 0.66,
      sizeJitter: 0.05,
      turnCounts: [1, 2, 3],
    },
    camera: { fovDeg: 34, z: 10, near: 1, far: 30 },
    backdrop: TEAL_BACKDROP,
    rig: FIELD_RIG,
    dof: { worldFocusDistance: 13, worldFocusRange: 2, bokehScale: 23 },
    grain: 0.04,
    material: COATING,
    stillFrames: [30, 190, 355],
  },
  {
    id: "FallingPills-BlueCapsule",
    fileName: "FallingPills_BlueCapsule.mp4",
    label: "Look 3B - uniform blue/white capsules on bright light blue",
    durationInFrames: 450,
    loopFrames: 450,
    colourway: { cap: "#1436ea", body: "#ffffff" },
    field: UNIFORM_CAPSULE_FIELD,
    camera: { fovDeg: 34, z: 10, near: 1, far: 30 },
    backdrop: {
      colorA: "#72a3f3",
      colorB: "#a4c1fb",
      center: [0.5, 0.68],
      spread: 0.98,
      vignette: 0.16,
      z: -16,
    },
    rig: FIELD_RIG,
    dof: { worldFocusDistance: 13, worldFocusRange: 2, bokehScale: 23 },
    grain: 0.04,
    material: COATING,
    stillFrames: [30, 190, 355],
  },
  {
    // The colourway reclaimed from the excluded reference 1477454113: same rig,
    // same seed, same field, one data row.
    id: "FallingPills-RedCapsule",
    fileName: "FallingPills_RedCapsule.mp4",
    label: "Look 3C - uniform dark red capsules on teal-blue",
    durationInFrames: 450,
    loopFrames: 450,
    colourway: { cap: "#4d0715", body: "#5f1022" },
    field: UNIFORM_CAPSULE_FIELD,
    camera: { fovDeg: 34, z: 10, near: 1, far: 30 },
    backdrop: TEAL_BACKDROP,
    rig: FIELD_RIG,
    dof: { worldFocusDistance: 13, worldFocusRange: 2, bokehScale: 23 },
    grain: 0.04,
    material: COATING,
    stillFrames: [30, 190, 355],
  },
];

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
