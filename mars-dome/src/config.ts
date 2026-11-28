/**
 * Colours, counts and timings for the mars-dome composition.
 * Look settings (exposure, light levels, fog, bloom, grain) live in look.ts.
 * World units are metres. The tower stands at the origin; the camera looks towards -z.
 */

export const FPS = 30;
/** Reference: 623 frames @ 60 fps = 10.3833 s -> round(10.3833 * 30) = 311 frames. */
export const DURATION_IN_FRAMES = 311;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export type Variant = "v1" | "v2";

export const PALETTE = {
  /** Surfaces (sRGB hex). */
  hull: "#b3b1ac",
  hullDark: "#8e8278",
  hullAccent: "#8f8a84",
  roofInset: "#6b4f40",
  beam: "#bdb5a8",
  tower: "#cdcbc6",
  towerGlass: "#39404c",
  plaza: "#867d7b",
  plazaSeam: "#6c6462",
  wall: "#a8a29c",
  curb: "#93867b",
  grass: "#4c4635",
  foliage: "#1a2414",
  trunk: "#3a2c22",
  mast: "#cfc8bf",
  cable: "#d9cfc4",
  terrainLit: "#e08a55",
  terrainDark: "#8a4a26",
  terrainPale: "#f0a25c",
  sand: "#b9683e",
  /** Lights (sRGB hex). */
  sun: "#fff0df",
  skyFill: "#b9c0b4",
  groundFill: "#7a5a48",
  lamp: "#fff4ea",
  beacon: "#e0200e",
  haze: "#c1673f",
  hazeSun: "#eaa55f",
};

export const CONFIG = {
  /**
   * Base camera, fitted to the reference frame: a ~40 degree lens about 50 m from the tower,
   * 24 m up, just outside the glass, tilted down 16.5 degrees.
   */
  camera: {
    fovY: 40.3,
    position: [7.9, 24, 50.1] as [number, number, number],
    pitchDeg: 16.5,
  },
  /**
   * Version 1 camera: a slow hand-held style drift, fitted to feature tracks of the reference.
   * Each row is [cos, sin] for harmonics 1, 2, 3 of the loop, so the move closes exactly.
   */
  sway: {
    /** Sideways and vertical travel in metres. */
    x: [[-0.083, -0.132], [0.043, 0.049], [0.032, 0.014]],
    y: [[0.0102, -0.045], [0.004, 0.034], [-0.012, -0.005]],
    /** Pan and tilt in degrees. */
    yawDeg: [[0.0804, 0.061], [-0.0655, -0.0309], [-0.0088, 0.0027]],
    pitchDeg: [[0.029, 0.0201], [-0.0259, -0.0507], [0.0074, 0.0127]],
  },
  /**
   * Version 2 camera: a slow orbital sweep around the tower with a push-in over the dome.
   * All terms are whole cycles of the loop, so the last frame flows into the first.
   */
  orbit: {
    /** Half-width of the sweep in degrees: the camera swings from +sweep to -sweep and back. */
    sweepDeg: 18,
    /** How far the camera pushes in at the middle of the loop, metres. */
    pushIn: 12,
    /** How far it rises at the middle of the loop, metres. */
    rise: 3,
  },
  dome: {
    plazaRadius: 41,
    baseRadius: 43,
    hubRadius: 8.4,
    hubHeight: 18.2,
    /** Compass directions of the arch ribs, degrees clockwise from "towards the camera". */
    archAzimuthsDeg: [33, 130, 220, 275],
    /** Outer masts: azimuth, distance from the tower, height, inward lean in degrees. */
    masts: [
      { azimuthDeg: -146, radius: 49, height: 21.4, leanDeg: 6 },
      { azimuthDeg: 114, radius: 49, height: 21, leanDeg: 6 },
      { azimuthDeg: 58, radius: 49, height: 21, leanDeg: 6 },
      { azimuthDeg: -64, radius: 49, height: 21, leanDeg: 6 },
    ],
  },
  /** Buildings: kind, centre [x, z], heading in degrees (0 = long axis along x). */
  buildings: [
    { kind: "capsules", at: [-13.6, 3], headingDeg: -15, length: 9, levels: 3 },
    { kind: "hall", at: [16.6, 6.5], headingDeg: 20, length: 10, levels: 1 },
    { kind: "rings", at: [-6.5, 14.4], headingDeg: 0, length: 0, levels: 2 },
    { kind: "rings", at: [0.6, 14.9], headingDeg: 0, length: 0, levels: 2 },
    { kind: "block", at: [-3.1, 11.4], headingDeg: 8, length: 3.4, levels: 1 },
    { kind: "rings", at: [4.9, -4.3], headingDeg: 0, length: 0, levels: 2 },
    { kind: "rings", at: [10, -7], headingDeg: 0, length: 0, levels: 2 },
    { kind: "rings", at: [2.2, -9.5], headingDeg: 0, length: 0, levels: 1 },
    { kind: "tent", at: [-27.3, -9.5], headingDeg: 14, length: 11, levels: 1 },
    { kind: "tent", at: [-29.2, -4], headingDeg: 14, length: 10, levels: 1 },
    { kind: "tent", at: [-31, 2], headingDeg: 14, length: 9, levels: 1 },
    { kind: "tent", at: [31.5, 4], headingDeg: -55, length: 8, levels: 1 },
    { kind: "tent", at: [27.5, 11.5], headingDeg: -55, length: 7, levels: 1 },
    { kind: "block", at: [24, -17], headingDeg: 40, length: 5, levels: 1 },
  ] as BuildingSpec[],
  /** Planted plots: inner / outer radius and the arc they cover (degrees clockwise from "towards the camera"). */
  plots: [
    { r0: 9, r1: 20.5, a0: -46, a1: 24 },
    { r0: 8, r1: 22.5, a0: -130, a1: -70 },
    { r0: 9, r1: 22.5, a0: 40, a1: 100 },
    { r0: 7.5, r1: 17, a0: 134, a1: 206 },
    { r0: 30, r1: 39, a0: -152, a1: -100 },
    { r0: 30, r1: 39, a0: 106, a1: 168 },
    { r0: 30, r1: 39, a0: -72, a1: -44 },
  ],
  trees: { perPlot: 3, extra: 4, height: 4.3, seed: 4117 },
  lamps: { count: 32, seed: 9203 },
  terrain: { seed: 77, size: [3000, 2100] as [number, number], segments: 400 },
  /** A slim pole right in front of the lens, far out of focus, with two beacons. Camera-space metres. */
  foregroundPole: {
    top: [3.9, 0.84, -7.5] as [number, number, number],
    bottom: [2.28, -2.03, -6.5] as [number, number, number],
    radius: 0.1,
  },
};

export interface BuildingSpec {
  kind: "capsules" | "rings" | "block" | "tent" | "hall";
  at: [number, number];
  headingDeg: number;
  length: number;
  levels: number;
}
