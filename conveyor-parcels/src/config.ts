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
    cardboard: "#7f735f",
    cardboardEdge: "#a79b82",
    strap: "#1a2228",
    label: "#8f857c",
    mark: "#3a342e",
    roller: "#5e4d40",
    rollerGap: "#30271f",
    rail: "#6e625a",
    floor: "#2a211d",
    backdrop: "#4d3d3a",
    rackPost: "#2c2422",
    rackBeam: "#5a4c3c",
    rackGoods: ["#5b4a4c", "#544e58", "#63504a", "#6e5a4f", "#4f4a56", "#5e4a46", "#54433d", "#5a5350", "#66504a"],
    bokeh: [
      { color: "#ff9a62", intensity: 3.6 },
      { color: "#ffb27a", intensity: 2.6 },
      { color: "#ffd9a8", intensity: 2.2 },
      { color: "#e8785a", intensity: 3 },
    ],
    keyLight: "#fff3e6",
    skyFill: "#d9b596",
    groundFill: "#0c0908",
    bounce: "#ffdcb0",
    envCeiling: "#ffe2b8",
    envWalls: "#6b5c52",
  },
  // Version 2: same scene, cold "night shift" palette - blue-white light, steel-grey cartons,
  // orange straps as the single warm accent. Each colour keeps the brightness of its Version 1
  // counterpart, so only the hues change.
  v2: {
    cardboard: "#6f7a84",
    cardboardEdge: "#96a3ae",
    strap: "#b84a18",
    label: "#7f8a93",
    mark: "#20272d",
    roller: "#454e56",
    rollerGap: "#1a2026",
    rail: "#5c6770",
    floor: "#1c232a",
    backdrop: "#33414c",
    rackPost: "#1f262c",
    rackBeam: "#3c4f58",
    rackGoods: ["#3f4c58", "#3f5263", "#475a66", "#566f7a", "#3a4660", "#3d5560", "#3a4a54", "#4a5560", "#5a4a46"],
    bokeh: [
      { color: "#58d6ff", intensity: 3.6 },
      { color: "#7ab8ff", intensity: 2.6 },
      { color: "#c8f2ff", intensity: 2.2 },
      { color: "#ff7a3a", intensity: 3 },
    ],
    keyLight: "#e6f1ff",
    skyFill: "#9fb4c6",
    groundFill: "#080a0c",
    bounce: "#bcd8f0",
    envCeiling: "#cfe6ff",
    envWalls: "#55606b",
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
    /** Real cylinders for the first `count` rollers; a flat strip with the same light bands continues beyond. */
    count: 66,
    /** How many of them (nearest the lens) use the fine round profile. */
    nearCount: 40,
    firstAt: 9,
    /** Roller radius in pitches (0.5 would make neighbours touch). */
    radius: 0.485,
    /** Belt edges, in pitches left / right of the camera. */
    left: -15.3,
    right: 10.8,
  },
  /** The travelling overhead light: one lit zone per loop. */
  lightZone: {
    /** Length of the lit zone and of one full period, in pitches. */
    length: 31,
    period: 64,
    /** Distance of the zone's leading edge from the camera at frame 0, in pitches. */
    leadAtFrame0: 49.5,
  },
  /**
   * Parcels, measured in the camera's ground frame (x = right of the lens axis, distance = along it).
   * size = [width of the face turned to the camera, height, depth] in pitches.
   * corner = [x, distance] of the near-left bottom corner. yawDeg turns the right end away from the camera.
   * straps = positions along strapAxis (0 = near / left, 1 = far / right).
   */
  parcels: [
    { id: "hero", size: [5.05, 1.6, 6.6], topRise: 0.18, corner: [-0.17, 26.3], yawDeg: 35, straps: [0.25, 0.69], strapAxis: "depth", rim: true, label: false, flaps: false, mark: true },
    { id: "mid", tone: 1.3, size: [10.7, 2.42, 6], corner: [-5.5, 52], yawDeg: 1.5, straps: [0.37, 0.77], strapAxis: "width", rim: false, label: false, flaps: false, mark: false },
    { id: "far", tone: 1.25, size: [8.6, 5.35, 7], corner: [-4.55, 62.5], yawDeg: -2, straps: [], strapAxis: "width", rim: false, label: true, flaps: true, mark: false },
    { id: "last", size: [7, 8.2, 6], corner: [-3.4, 80], yawDeg: 3, straps: [], strapAxis: "width", rim: false, label: false, flaps: false, mark: false },
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
    /** The lamp in view: pitches left of the lens axis, height above the roller tops, distance at frame 0. */
    lamp: { x: -23.4, y: 3.3, distanceAtStart: 155 },
    /**
     * How many times further away (and larger) the hall is than it is built. It drifts past that many
     * times slower. At 1 it would return to its start every loop; the reference's hall does not.
     */
    parallax: 3,
    seed: 20240613,
  },
};

export interface ParcelSpec {
  id: string;
  size: [number, number, number];
  /** Brightness multiplier for this parcel's board (haze makes the middle row read lighter). */
  tone?: number;
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
