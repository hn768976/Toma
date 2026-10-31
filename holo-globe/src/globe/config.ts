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
  bgCenter: "#082440",
  bgEdge: "#010409",
  deep: "#0f5a9e",
  main: "#1f8fe0",
  hot: "#a8e4ff",
  rim: "#2a9ff0",
};

// Earth spins west-to-east: from the camera's side the surface drifts to
// the right, revealing the Americas after Africa, about 14.7 deg/s, with
// Africa (lon ~18E) facing the lens at t = 2.8 s - as in the reference.
const SPIN_RATE = 14.7;
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
    [2.5, 2.12],
    [3.0, 2.42],
    [3.5, 2.78],
    [4.0, 3.2],
    [4.5, 3.75],
    [5.0, 4.2],
    [5.6, 4.5],
    [6.5, 4.65],
    [30, 4.72],
  ]),
);
// The globe's axis is tilted 10 deg; counter-roll during the dive so the
// close-up digits read upright like the reference, then level out.
const v1Roll = track([
  [0, -10],
  [1.2, -9],
  [2.6, -3],
  [4.0, 1],
  [5.5, 0],
  [30, 0],
]);
const v1LookY = track([
  [0, 0],
  [2.0, 0],
  [3.0, 0.14],
  [4.0, 0.12],
  [5.2, 0.04],
  [6.0, 0.02],
  [30, 0.02],
]);
const v1Defocus = track([
  [0, 1],
  [0.35, 0.7],
  [0.6, 0.05],
  [1.0, 0.0],
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
// content). The dive starts top-down over the Arctic, then the camera
// sweeps a ~265 deg orbit around the planet while craning down through the
// ring plane to a low angle looking up from beneath the rings (~16 s),
// pushing in close, and finally cranes back up above the rings as it pulls
// out - a continuously travelling shot instead of the locked-off hold.
const v2Distance = track(
  logKeys([
    [0, 1.06],
    [0.7, 1.12],
    [1.6, 1.42],
    [2.6, 2.1],
    [3.8, 3.2],
    [5.2, 4.6],
    [7.0, 5.3],
    [11, 4.6],
    [16, 3.95],
    [22, 4.3],
    [30, 5.4],
  ]),
);
const v2Elevation = track([
  [0, 72],
  [3, 55],
  [7, 28],
  [11, 6],
  [16, -20],
  [22, -6],
  [30, 32],
]);
const v2Azimuth = track([
  [0, -30],
  [6, 25],
  [15, 120],
  [24, 195],
  [30, 235],
]);
const v2Roll = track([
  [0, -18],
  [4, -8],
  [11, 4],
  [16, 12],
  [22, 6],
  [30, -6],
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
