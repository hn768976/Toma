/**
 * Colours, counts and timings for the conveyor-parcels composition.
 * Everything a non-programmer is likely to want to change lives in this file.
 * Look settings (exposure, light levels, fog, bloom, grain) live in look.ts.
 */

export const FPS = 30;
/** Reference: 250 frames @ 24 fps = 10.4167 s -> round(10.4167 * 30) = 313 frames. */
export const DURATION_IN_FRAMES = 313;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** World scale. All lengths below are in roller pitches ("P"); one pitch is this many metres. */
export const P = 0.05;

export type Variant = "v1" | "v2";

export interface Palette {
  /** Surface colours (sRGB hex). */
  cardboard: string;
  cardboardEdge: string;
  strap: string;
  label: string;
  mark: string;
  roller: string;
  rollerGap: string;
  rail: string;
  floor: string;
  /** Out-of-focus warehouse behind the parcels. */
  backdrop: string;
  rackPost: string;
  rackBeam: string;
  rackGoods: string[];
  /** Distant lamps that become bokeh discs: colour + brightness. */
  bokeh: { color: string; intensity: number }[];
  /** Light colours (sRGB hex). */
  keyLight: string;
  skyFill: string;
  groundFill: string;
  bounce: string;
  envCeiling: string;
  envWalls: string;
}

export const PALETTES: Record<Variant, Palette> = {
  // Version 1: the reference's warm tungsten / kraft-brown look.
  v1: {
    cardboard: "#886c4c",
    cardboardEdge: "#b09672",
    strap: "#0b1419",
    label: "#8f857c",
    mark: "#1a1612",
    roller: "#4f4741",
    rollerGap: "#1b1613",
    rail: "#b8aea4",
    floor: "#2a211d",
    backdrop: "#4d3d3a",
    rackPost: "#2b2320",
    rackBeam: "#6b5a3c",
    rackGoods: ["#5b4a52", "#514a5c", "#6a5045", "#7a5e4d", "#48414f", "#5d4b40", "#54433d"],
    bokeh: [
      { color: "#ff9a62", intensity: 9 },
      { color: "#ffb27a", intensity: 6 },
      { color: "#ffd9a8", intensity: 5 },
      { color: "#e8785a", intensity: 7 },
    ],
    keyLight: "#fff3e0",
    skyFill: "#d9b596",
    groundFill: "#2a1f1b",
    bounce: "#ffdcb0",
    envCeiling: "#ffe2b8",
    envWalls: "#6b5c52",
  },
  // Version 2: same scene, cold "night shift" palette - blue-cyan light, pale grey cartons,
  // orange straps as the single warm accent.
  v2: {
    cardboard: "#9aa7b4",
    cardboardEdge: "#c3ced8",
    strap: "#d2571a",
    label: "#e4ecf2",
    mark: "#18222c",
    roller: "#7f8a94",
    rollerGap: "#0f1418",
    rail: "#a9b6c2",
    floor: "#141c24",
    backdrop: "#273847",
    rackPost: "#141b22",
    rackBeam: "#2f5560",
    rackGoods: ["#2f4a5e", "#3a5a6b", "#2a3d58", "#4a6a78", "#24384c", "#365066", "#2c4252"],
    bokeh: [
      { color: "#58d6ff", intensity: 9 },
      { color: "#7ab8ff", intensity: 6 },
      { color: "#c8f2ff", intensity: 5 },
      { color: "#ff7a3a", intensity: 7 },
    ],
    keyLight: "#d9efff",
    skyFill: "#7fa6c4",
    groundFill: "#1c2a36",
    bounce: "#bfe2ff",
    envCeiling: "#cfeaff",
    envWalls: "#1f2c38",
  },
};

export const CONFIG = {
  /**
   * Camera, fitted to the reference: a long lens (about 12 degrees vertical) riding 2.6 roller
   * pitches above the belt, tilted down 2.7 degrees, looking straight along the direction of travel.
   */
  camera: {
    fovY: 12.14,
    height: 2.57,
    pitchDeg: 2.68,
    /** Angle between the lens axis and the direction of travel. */
    beltYawDeg: 0,
  },
  travel: {
    /** The parcels and camera travel exactly this many roller pitches per loop (6.13 rollers / s). */
    pitchesPerLoop: 64,
  },
  rollers: {
    /** Real cylinders out to this distance; a flat strip continues beyond. */
    count: 150,
    firstAt: 9,
    /** Roller radius in pitches (0.5 would make neighbours touch). */
    radius: 0.46,
    /** Belt edges, in pitches left / right of the camera. */
    left: -15.3,
    right: 10.8,
  },
  /** The travelling overhead light: one lit zone per loop. */
  lightZone: {
    /** Length of the lit zone and of one full period, in pitches. */
    length: 34,
    period: 64,
    /** Distance of the zone's leading edge from the camera at frame 0, in pitches. */
    leadAtFrame0: 47,
  },
  /**
   * Parcels, measured in the camera's ground frame (x = right of the lens axis, distance = along it).
   * size = [width of the face turned to the camera, height, depth] in pitches.
   * corner = [x, distance] of the near-left bottom corner. yawDeg turns the right end away from the camera.
   * straps = positions along strapAxis (0 = near / left, 1 = far / right).
   */
  parcels: [
    { id: "hero", size: [5.07, 1.55, 6.23], topRise: 0.24, corner: [-0.17, 26.5], yawDeg: 35.3, straps: [0.31, 0.775], strapAxis: "depth", rim: true, label: false, flaps: false, mark: true },
    { id: "mid", size: [8.7, 2.48, 5.5], corner: [-4.5, 42], yawDeg: 1.5, straps: [0.37, 0.77], strapAxis: "width", rim: false, label: false, flaps: false, mark: false },
    { id: "far", size: [8, 5.1, 7], corner: [-4.26, 58], yawDeg: -2, straps: [], strapAxis: "width", rim: false, label: true, flaps: true, mark: false },
    { id: "sideR", size: [6.2, 2.3, 6], corner: [4.4, 57.5], yawDeg: -4, straps: [], strapAxis: "width", rim: false, label: false, flaps: false, mark: false },
    { id: "sideL", size: [8.5, 2.1, 6], corner: [-14.6, 61], yawDeg: 5, straps: [0.6], strapAxis: "width", rim: false, label: false, flaps: false, mark: false },
    { id: "last", size: [6.6, 7.6, 6], corner: [-3.2, 74], yawDeg: 3, straps: [], strapAxis: "width", rim: false, label: false, flaps: false, mark: false },
  ] as ParcelSpec[],
  vibration: {
    /** Vertical shake of each parcel in pitches, and its rate in Hz. */
    amplitude: 0.02,
    hz: 6,
    tiltDeg: 0.1,
  },
  backdrop: {
    /** Rack uprights every this many pitches (must divide pitchesPerLoop). */
    postSpacing: 32,
    /** Floor level below the roller tops, in pitches. */
    floorY: -15,
    goodsPerSide: 26,
    bokehPerPeriod: 1,
    seed: 20240613,
  },
};

export interface ParcelSpec {
  id: string;
  size: [number, number, number];
  /** How much higher the lid sits at the back than at the front, in pitches. */
  topRise?: number;
  corner: [number, number];
  yawDeg: number;
  straps: number[];
  strapAxis: "depth" | "width";
  rim: boolean;
  label: boolean;
  flaps: boolean;
  mark: boolean;
}
