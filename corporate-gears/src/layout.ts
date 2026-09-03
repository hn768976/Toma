/**
 * Scene layout. Every position is a fraction of the frame (x of width, y of
 * height) and every size a fraction of the frame HEIGHT, so the identical
 * layout holds at 1920x1080 preview scale and at 3840x2160.
 */

export type GearDef = {
  x: number;
  y: number;
  /** Tip radius, as a fraction of frame height. */
  rOuter: number;
  /** Root radius, as a fraction of frame height. */
  rRoot: number;
  teeth: number;
  /** Full turns completed over the whole loop. Must be an integer. */
  turns: number;
  strokeWidth: number;
  opacity: number;
  /** Filled dark hub, as a fraction of frame height. */
  hub?: number;
  /** Thin idle ring drawn inside the teeth. */
  innerRing?: number;
  shadow?: boolean;
};

export type MeshGearDef = GearDef & { seed: number };

export type DiscDef = {
  /** Orbit radius the disc rides on, as a fraction of frame height. */
  orbit: number;
  /** Start angle in degrees, 0 = right, positive = clockwise on screen. */
  angle: number;
  /** Disc radius, as a fraction of frame height. */
  r: number;
  /** Degrees of sway over the loop; the disc returns exactly to its start. */
  swing: number;
  /** Set instead of `swing` to make the disc complete exactly one lap. */
  laps?: number;
  phase: number;
};

export type RingDef = {
  /** Ring radius, as a fraction of frame height. */
  r: number;
  /** [startDeg, endDeg] arc segments; the gaps between them are the breaks. */
  arcs: [number, number][];
  strokeWidth: number;
  opacity: number;
  white?: boolean;
  /** Angles at which to place small open circle node markers. */
  nodes?: number[];
  nodeR?: number;
  /** Degrees of sway over the loop, returning exactly to the start. */
  swing: number;
  phase: number;
};

export type SweepDef = {
  /** Centre of the circle the streak is an arc of. */
  cx: number;
  cy: number;
  /** Arc radius, as a fraction of frame height. */
  r: number;
  from: number;
  to: number;
  strokeWidth: number;
  /** Lateral drift in fractions of frame width, out and back over the loop. */
  drift: number;
  phase: number;
  opacity: number;
};

export type WaveDef = {
  /** Baseline height, as a fraction of frame height. */
  baseY: number;
  /** Peak deviation, as a fraction of frame height. */
  amp: number;
  /** Full waves across the frame width. */
  cycles: number;
  strokeWidth: number;
  /** Lateral drift in fractions of frame width, out and back over the loop. */
  drift: number;
};

export type LabelDef = {
  text: string;
  x: number;
  y: number;
  /** Size relative to the centre word. */
  scale: number;
};

/** Centre of the orbit system — dead centre, as in the reference. */
export const CENTRE = { x: 0.5, y: 0.5 };

/**
 * Base gear stroke: 4px at 3840x2160. Each gear scales it — the reference
 * outlines are much heavier than a flat 4px, which reads as a hairline at 4K.
 */
const GEAR_STROKE = 4 / 2160;

export const GEARS: GearDef[] = [
  // Largest, top right, cropped by the frame edge.
  {
    x: 0.845,
    y: 0.035,
    rOuter: 0.375,
    rRoot: 0.315,
    teeth: 15,
    turns: 1,
    strokeWidth: GEAR_STROKE * 2,
    opacity: 0.85,
    innerRing: 0.198,
    shadow: true,
  },
  // Upper left, small, filled dark hub.
  {
    x: 0.195,
    y: 0.255,
    rOuter: 0.163,
    rRoot: 0.134,
    teeth: 16,
    turns: -1,
    strokeWidth: GEAR_STROKE * 1.25,
    opacity: 0.8,
    hub: 0.077,
    innerRing: 0.104,
    shadow: true,
  },
  // Faint accent gear, mid right, sitting far back in the plate.
  {
    x: 0.815,
    y: 0.53,
    rOuter: 0.058,
    rRoot: 0.046,
    teeth: 12,
    turns: -2,
    strokeWidth: GEAR_STROKE * 0.75,
    opacity: 0.22,
    innerRing: 0.03,
  },
];

/** Lower left, drawn as a wireframe polygon mesh instead of a smooth outline. */
export const MESH_GEAR: MeshGearDef = {
  x: 0.045,
  y: 0.87,
  rOuter: 0.25,
  rRoot: 0.205,
  teeth: 12,
  turns: 1,
  strokeWidth: GEAR_STROKE * 0.75,
  opacity: 0.62,
  seed: 20250903,
};

export const DISCS: DiscDef[] = [
  // Drawn first, so it slides behind the big disc once per lap. This is the
  // one disc that rides the whole way round; its orbit is chosen to clear the
  // centre word and all four labels.
  { orbit: 0.31, angle: 232, r: 0.026, swing: 0, laps: 1, phase: 0 },
  { orbit: 0.405, angle: 151.5, r: 0.098, swing: 5, phase: 0 },
  { orbit: 0.42, angle: 15.5, r: 0.05, swing: 7, phase: 1.3 },
  { orbit: 0.46, angle: 55, r: 0.033, swing: 6, phase: 2.5 },
];

export const RINGS: RingDef[] = [
  {
    r: 0.25,
    arcs: [
      [-72, 18],
      [26, 118],
      [126, 208],
      [216, 284],
    ],
    strokeWidth: 2.8 / 2160,
    opacity: 0.75,
    nodes: [-72, 26, 126, 216],
    nodeR: 0.0125,
    swing: 9,
    phase: 0,
  },
  {
    r: 0.325,
    arcs: [
      [104, 250],
      [286, 66],
    ],
    strokeWidth: 2.4 / 2160,
    opacity: 0.5,
    nodes: [104, 286],
    nodeR: 0.009,
    swing: -7,
    phase: 1.1,
  },
  {
    r: 0.405,
    arcs: [
      [42, 148],
      [166, 320],
    ],
    strokeWidth: 3 / 2160,
    opacity: 0.5,
    white: true,
    swing: 6,
    phase: 2.2,
  },
];

export const SWEEPS: SweepDef[] = [
  // Long streak arcing through the upper left.
  {
    cx: 0.78,
    cy: 1.05,
    r: 1.05,
    from: 186,
    to: 256,
    strokeWidth: 3 / 2160,
    drift: 0.006,
    phase: 0,
    opacity: 0.5,
  },
  // Mirror streak falling away to the lower right.
  {
    cx: 0.2,
    cy: 1.0,
    r: 1.0,
    from: -62,
    to: 4,
    strokeWidth: 2.8 / 2160,
    drift: -0.005,
    phase: 1.6,
    opacity: 0.42,
  },
  // Short streak hugging the lower left mesh gear.
  {
    cx: 0.44,
    cy: 0.36,
    r: 0.66,
    from: 118,
    to: 196,
    strokeWidth: 2.6 / 2160,
    drift: 0.004,
    phase: 3.1,
    opacity: 0.38,
  },
];

/** The thin dark wave line that crosses the whole frame in the reference. */
export const WAVE: WaveDef = {
  baseY: 0.47,
  amp: 0.115,
  cycles: 1.6,
  strokeWidth: 2.6 / 2160,
  drift: 0.012,
};

/** Centre word size, as a fraction of frame height. */
export const CENTRE_SIZE = 0.078;

export const LABELS: LabelDef[] = [
  { text: "MISSION", x: 0.512, y: 0.121, scale: 0.5 },
  { text: "INNOVATION", x: 0.196, y: 0.494, scale: 0.46 },
  { text: "STRATEGY", x: 0.374, y: 0.866, scale: 0.42 },
  { text: "GROWTH", x: 0.762, y: 0.732, scale: 0.68 },
];
