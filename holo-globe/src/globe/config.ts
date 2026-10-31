import { Key, track } from "../three/util";

/** Colours are sRGB hex; the scene converts them to linear for shading. */
export type GlobePalette = {
  bgCenter: string;
  bgEdge: string;
  /** Ocean digits / dim structure. */
  deep: string;
  /** Land digits, rings, network lines. */
  main: string;
  /** Highlights: coastlines, labels, data panels, node sparks. */
  hot: string;
  /** Atmosphere rim glow. */
  rim: string;
};

export type CameraState = {
  /** Distance from globe centre (globe radius = 1). */
  distance: number;
  /** Orbit angles in degrees, in the frame of the (unrotated) scene. */
  azimuth: number;
  elevation: number;
  roll: number;
  /** Vertical offset of the look-at point (world units). */
  lookY: number;
  /** Depth-of-field focus emulation: 0 = in focus, 1 = fully defocused. */
  defocus: number;
  /** Global brightness fade (fade-in from black). */
  exposure: number;
};

export type GlobeConfig = {
  palette: GlobePalette;
  camera: (t: number) => CameraState;
  /** Globe spin in degrees as a function of time (seconds). */
  spin: (t: number) => number;
};

export const BLUE_PALETTE: GlobePalette = {
  bgCenter: "#0c2a4a",
  bgEdge: "#01050b",
  deep: "#1b5fae",
  main: "#3d9cff",
  hot: "#bfe6ff",
  rim: "#4aa8ff",
};

// Earth spins west-to-east: from the camera's side the surface drifts to
// the right, revealing the Americas after Africa, about 15.6 deg/s, with
// Africa (lon ~18E) facing the lens at t = 2.8 s - as in the reference.
const SPIN_RATE = 15.6;
const spinV1 = (t: number) => -18 + SPIN_RATE * (t - 2.8);

/** Logarithmic zoom keys: values are log(distance - 1) so the dive feels even. */
const logKeys = (keys: Key[]): Key[] =>
  keys.map(([t, v]) => [t, Math.log(v - 1)]);

// Version 1 - matches the reference: start a few digits above the surface
// (huge, defocused "1"/"0" glyphs), pull straight back through the dotted
// surface, reveal Africa, then settle into a fixed, slightly elevated
// framing with the globe spinning inside its orbital rings.
const v1Distance = track(
  logKeys([
    [0, 1.024],
    [0.5, 1.034],
    [1.0, 1.17],
    [1.5, 1.5],
    [2.0, 1.85],
    [2.5, 2.15],
    [3.0, 2.55],
    [3.5, 3.05],
    [4.0, 3.65],
    [4.5, 4.25],
    [5.0, 4.7],
    [5.6, 4.95],
    [6.5, 5.05],
    [30, 5.1],
  ]),
);
const v1Roll = track([
  [0, 14],
  [1.5, 9],
  [3.0, 3],
  [5.0, 0],
  [30, 0],
]);
const v1LookY = track([
  [0, 0],
  [2.0, 0],
  [3.0, 0.42],
  [4.0, 0.38],
  [5.2, 0.05],
  [6.0, 0.02],
  [30, 0.02],
]);
const v1Defocus = track([
  [0, 1],
  [0.6, 0.85],
  [1.0, 0.05],
  [1.8, 0],
  [2.3, 0.35],
  [2.8, 0.15],
  [3.6, 0],
  [30, 0],
]);
const v1Exposure = track([
  [0, 0.15],
  [0.55, 1],
  [30, 1],
]);

export const GLOBE_V1: GlobeConfig = {
  palette: BLUE_PALETTE,
  spin: spinV1,
  camera: (t) => ({
    distance: 1 + Math.exp(v1Distance(t)),
    azimuth: 0,
    elevation: 10,
    roll: v1Roll(t),
    lookY: v1LookY(t),
    defocus: v1Defocus(t),
    exposure: v1Exposure(t),
  }),
};

// Version 2 - alternative CAMERA ANGLE + MOVEMENT (same palette and
// content). The dive starts top-down over the Arctic, cranes down past the
// ring plane while orbiting ~140 deg around the planet, and finishes on a
// low "hero" angle looking up at the globe from below its rings, with a
// slow push-in for the last third.
const v2Distance = track(
  logKeys([
    [0, 1.06],
    [0.7, 1.12],
    [1.6, 1.42],
    [2.6, 2.1],
    [3.8, 3.2],
    [5.2, 4.6],
    [7.0, 5.6],
    [14, 5.8],
    [22, 4.9],
    [30, 4.3],
  ]),
);
const v2Elevation = track([
  [0, 72],
  [3, 58],
  [7, 34],
  [13, 18],
  [19, 4],
  [24, -9],
  [30, -13],
]);
const v2Azimuth = track([
  [0, -30],
  [6, 5],
  [15, 50],
  [24, 90],
  [30, 108],
]);
const v2Roll = track([
  [0, -18],
  [4, -8],
  [10, -3],
  [20, 4],
  [30, 6],
]);
const v2LookY = track([
  [0, 0],
  [3, 0.25],
  [6, 0.05],
  [20, -0.02],
  [30, 0.1],
]);
const v2Defocus = track([
  [0, 1],
  [0.7, 0.7],
  [1.3, 0.0],
  [30, 0],
]);

export const GLOBE_V2: GlobeConfig = {
  palette: BLUE_PALETTE,
  spin: (t) => 10 + SPIN_RATE * t,
  camera: (t) => ({
    distance: 1 + Math.exp(v2Distance(t)),
    azimuth: v2Azimuth(t),
    elevation: v2Elevation(t),
    roll: v2Roll(t),
    lookY: v2LookY(t),
    defocus: v2Defocus(t),
    exposure: v1Exposure(t),
  }),
};
