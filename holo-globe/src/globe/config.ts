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
  /**
   * Keep the orbital rings visible even when the camera is close to the
   * planet (from this time on). Version 1 hides them while skimming the
   * surface, like the reference; version 2 flies between them.
   */
  ringsCloseFrom?: number;
};

// Saturated electric blue / cyan on a navy-to-black field, sampled from the
// reference (highlights ~ rgb(40,175,240), background corners near black).
export const BLUE_PALETTE: GlobePalette = {
  bgCenter: "#0a2c52",
  bgEdge: "#000207",
  deep: "#0a4f9c",
  main: "#169cff",
  hot: "#86d8ff",
  rim: "#1a98ff",
};

// Earth spins west-to-east: from the camera's side the surface drifts to
// the right, revealing the Americas after Africa, at 14.7 deg/s - as in the
// reference. While the camera skims the surface the spin is eased in from
// rest: at full speed the glyphs right under the lens would jump most of
// the frame height every frame (temporal aliasing / strobing).
const SPIN_RATE = 14.7;
const rampedTurns = (() => {
  // Integral of SPIN_RATE * smoothstep(0.2, 3.6, t), tabulated per 1/120 s.
  const dt = 1 / 120;
  const table: number[] = [0];
  for (let i = 1; i <= 31 * 120; i++) {
    const t = (i - 0.5) * dt;
    const x = Math.min(1, Math.max(0, (t - 0.2) / 3.4));
    table.push(table[i - 1] + SPIN_RATE * x * x * (3 - 2 * x) * dt);
  }
  return (t: number) => {
    const f = Math.max(0, t) / dt;
    const i = Math.min(table.length - 2, Math.floor(f));
    return table[i] + (table[i + 1] - table[i]) * (f - i);
  };
})();
// Africa (lon ~18E) faces the lens at t = 2.8 s.
const spinV1 = (t: number) => -18 + rampedTurns(t) - rampedTurns(2.8);

/** Logarithmic zoom keys: values are log(distance - 1) so the dive feels even. */
const logKeys = (keys: Key[]): Key[] =>
  keys.map(([t, v]) => [t, Math.log(v - 1)]);

// Version 1 - matches the reference: ~0.3 s of empty navy, then a few
// digits above the surface (huge, defocused glyphs), pull straight back
// through the digit surface, reveal Africa, then settle into a fixed,
// slightly elevated framing with the globe spinning inside its rings.
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
  [0.3, 0.9],
  [0.75, 0.15],
  [1.1, 0.0],
  [1.8, 0],
  [2.3, 0.35],
  [2.8, 0.15],
  [3.6, 0],
  [30, 0],
]);
const introExposure = track([
  [0, 0],
  [0.25, 0.04],
  [0.7, 1],
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
    exposure: introExposure(t),
  }),
};

// Version 2 - alternative CAMERA ANGLE + MOVEMENT (same palette/content).
// Instead of V1's straight pull-back to a locked-off, centred globe:
// 0-3 s   top-down dive out of the Arctic,
// 3-20 s  a low "orbital horizon" flight: the camera skims ~0.6 radii above
//         the planet, flying between the rings, the planet's curved limb
//         filling the lower frame while it sweeps ~140 deg around it,
// 20-30 s a rising crane pull-out to a high three-quarter view, the rings
//         opening into wide ellipses below the globe.
const v2Distance = track(
  logKeys([
    [0, 1.06],
    [0.7, 1.12],
    [1.6, 1.42],
    [2.6, 1.95],
    [4.0, 2.25],
    [6.0, 1.75],
    [10, 1.6],
    [14, 1.62],
    [18, 1.8],
    [22, 2.6],
    [26, 4.1],
    [30, 5.1],
  ]),
);
const v2Elevation = track([
  [0, 72],
  [3, 52],
  [6, 28],
  [10, 16],
  [14, 12],
  [18, 16],
  [22, 26],
  [26, 40],
  [30, 46],
]);
const v2Azimuth = track([
  [0, -30],
  [6, -62],
  [14, -120],
  [22, -168],
  [30, -200],
]);
const v2Roll = track([
  [0, -18],
  [4, -6],
  [8, 7],
  [14, 9],
  [20, 3],
  [26, -4],
  [30, -6],
]);
const v2LookY = track([
  [0, 0],
  [3, 0.2],
  [6, 0.72],
  [10, 0.9],
  [15, 0.9],
  [19, 0.75],
  [23, 0.4],
  [27, 0.08],
  [30, 0.0],
]);
const v2Defocus = track([
  [0, 1],
  [0.3, 0.9],
  [0.9, 0.1],
  [1.4, 0.0],
  [30, 0],
]);

export const GLOBE_V2: GlobeConfig = {
  palette: BLUE_PALETTE,
  spin: (t) => 10 + rampedTurns(t),
  ringsCloseFrom: 3.0,
  camera: (t) => ({
    distance: 1 + Math.exp(v2Distance(t)),
    azimuth: v2Azimuth(t),
    elevation: v2Elevation(t),
    roll: v2Roll(t),
    lookY: v2LookY(t),
    defocus: v2Defocus(t),
    exposure: introExposure(t),
  }),
};
