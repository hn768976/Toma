/**
 * ONE DATA ROW PER COMPOSITION.
 *
 * Everything that differs between the five films lives in the rows below.
 * World units: Earth radius = 1 (except where a row scales Earth).
 *
 * Quick edits:
 *  - Nebula colour  -> `nebula.inner` / `nebula.outer` on a MoonOrbit row.
 *  - Well depth     -> `well.depth` (bigger = deeper funnel) and
 *                      `well.width` (bigger = wider, softer funnel) on a
 *                      GravityWell row.
 */

export type Vec3 = [number, number, number];

export type WellRow = {
  /** Depth scale A in  y = -A / sqrt(r^2 + c^2). */
  depth: number;
  /** Width c in the same formula (rounds the bottom of the funnel). */
  width: number;
  /** Grid line spacing (world units): ring spacing for a polar grid. */
  spacing: number;
  /** Number of radial spokes; 0 = square grid instead of polar. */
  spokes: number;
  /** Opaque black pit at the bottom of the well, radius (0 = none). */
  pit: number;
  /** Half extent of the square grid (world units). */
  extent: number;
  /** Line colour near the camera / far away (hex). */
  colorNear: string;
  colorFar: string;
  /** Peak line opacity (0..1), additive. */
  opacity: number;
  /** Line width in pixels at 720p (scaled with resolution). */
  lineWidth: number;
  /** Distance fade (world units from the camera): start, end. */
  fade: [number, number];
  /** Darken the lines near the bottom of the well: radius start, end (0 = off). */
  darkCentre: [number, number];
};

export type CameraRow = {
  /** Degrees above the grid / orbit plane. */
  elevation: number;
  /** Degrees; azimuth of the camera around the target (0 = +z). */
  azimuth: number;
  /** Peak yaw swing of a slow closed orbit (degrees), 1 cycle per loop. */
  swing: number;
  distance: number;
  fov: number;
  target: Vec3;
  /** Lens shift as a fraction of frame width (+ moves content left). */
  shiftX: number;
  shiftY: number;
};

type Base = {
  id: string;
  camera: CameraRow;
  /** Direction TOWARD the key light (world space), the "sun direction". */
  keyDir: Vec3;
  keyIntensity: number;
  fill: number;
  exposure: number;
  /** Stars on a far sphere. */
  stars: { count: number; brightness: number; spreadDeg: number };
  earth: {
    radius: number;
    /** Whole turns per 600-frame loop (CCW seen from above the North Pole). */
    spinTurns: number;
    /** Longitude offset so the right continents face the camera (radians). */
    spinOffset: number;
    tiltDeg: number;
    /** Lean of the North Pole toward the camera (degrees), for framing. */
    lean: number;
    rim: number;
    /** Cloud layer opacity (0 = clear sky). */
    clouds: number;
    /** Surface colour saturation (1 = texture as is). */
    saturation: number;
    /** Wide soft blue haze around the globe (0 = off). */
    haze: number;
  };
  moonLook: { albedo: number; glow: number };
};

export type GravityWellRow = Base & {
  kind: "well";
  well: WellRow;
  /** Earth sits in the well at this height above the funnel at r = 0 (Earth radii). */
  earthLift: number;
  /** Bob amplitude as a fraction of Earth's diameter; cycles per loop. */
  bob: { amount: number; cycles: number };
  moon: null | {
    orbitRadius: number;
    /** Extra lift above the funnel surface. */
    lift: number;
    dipDepth: number;
    dipWidth: number;
  };
  sun: null | {
    radius: number;
    orbitRadius: number;
    earthDipDepth: number;
    earthDipWidth: number;
    glow: number;
  };
  bloom: null | { strength: number; radius: number; threshold: number };
};

export type MoonOrbitRow = Base & {
  kind: "orbit";
  orbit: {
    radius: number;
    dots: number;
    dotSize: number;
    dotOpacity: number;
    /** Roll of the orbit plane about the view axis (degrees, + = left end up). */
    tiltDeg: number;
  };
  nebula: {
    inner: string;
    outer: string;
    /** Glow centre in screen UV (0..1, y up). */
    centre: [number, number];
    strength: number;
    dust: number;
  };
};

export type SceneRow = GravityWellRow | MoonOrbitRow;

const KEY_UPPER_LEFT: Vec3 = [-0.5, 0.5, 0.72];

export const ROWS: SceneRow[] = [
  {
    id: "GravityWell_EarthMoon",
    kind: "well",
    camera: { elevation: 30, azimuth: 0, swing: 0, distance: 11, fov: 35, target: [0, -3.0, 0], shiftX: 0, shiftY: -0.06 },
    keyDir: KEY_UPPER_LEFT,
    keyIntensity: 2.4,
    fill: 0.05,
    exposure: 1.0,
    stars: { count: 3000, brightness: 0.7, spreadDeg: 55 },
    earth: { radius: 1, spinTurns: 1, spinOffset: -1.87, tiltDeg: 23.4, lean: 0, rim: 0.1, clouds: 0, saturation: 1.15, haze: 0 },
    moonLook: { albedo: 0.85, glow: 0 },
    well: {
      depth: 11, width: 2.4, spacing: 0.9, spokes: 36, pit: 0, extent: 40,
      colorNear: "#C8D0EA", colorFar: "#7C8CFF", opacity: 0.48, lineWidth: 1.4,
      fade: [16, 46], darkCentre: [0, 0],
    },
    earthLift: 1.6,
    bob: { amount: 0, cycles: 1 },
    moon: { orbitRadius: 2.4, lift: 0.6, dipDepth: 0.15, dipWidth: 0.6 },
    sun: null,
    bloom: null,
  },
  {
    id: "GravityWell_EarthOnly",
    kind: "well",
    camera: { elevation: 21, azimuth: 0, swing: 10, distance: 7.8, fov: 35, target: [0, -2.0, 0], shiftX: 0, shiftY: 0.0 },
    keyDir: KEY_UPPER_LEFT,
    keyIntensity: 2.4,
    fill: 0.05,
    exposure: 1.0,
    stars: { count: 3000, brightness: 0.5, spreadDeg: 60 },
    earth: { radius: 1, spinTurns: 1, spinOffset: -1.87, tiltDeg: 23.4, lean: 22, rim: 0.1, clouds: 0, saturation: 1.15, haze: 0 },
    moonLook: { albedo: 0.85, glow: 0 },
    well: {
      depth: 6, width: 1.5, spacing: 0.45, spokes: 36, pit: 0.6, extent: 50,
      colorNear: "#8A9AB8", colorFar: "#8A9AB8", opacity: 0.32, lineWidth: 0.9,
      fade: [6, 15], darkCentre: [0.6, 0.75],
    },
    earthLift: 2.0,
    bob: { amount: 0.02, cycles: 2 },
    moon: null,
    sun: null,
    bloom: null,
  },
  {
    id: "GravityWell_SunEarth",
    kind: "well",
    camera: { elevation: 30, azimuth: 0, swing: 0, distance: 40, fov: 35, target: [0, -9, 0], shiftX: 0, shiftY: 0 },
    keyDir: KEY_UPPER_LEFT,
    keyIntensity: 2.6,
    fill: 0.04,
    exposure: 1.0,
    stars: { count: 3000, brightness: 0.7, spreadDeg: 55 },
    earth: { radius: 1.5, spinTurns: 3, spinOffset: 0, tiltDeg: 23.4, lean: 0, rim: 1.0, clouds: 0.6, saturation: 1.0, haze: 0 },
    moonLook: { albedo: 0.85, glow: 0 },
    well: {
      depth: 108, width: 6.6, spacing: 1.7, spokes: 48, pit: 0, extent: 90,
      colorNear: "#C8D8FF", colorFar: "#7FA6FF", opacity: 0.6, lineWidth: 1.1,
      fade: [55, 120], darkCentre: [0, 0],
    },
    earthLift: 0,
    bob: { amount: 0, cycles: 1 },
    moon: null,
    sun: { radius: 4.0, orbitRadius: 15, earthDipDepth: 3.0, earthDipWidth: 1.5, glow: 0.6 },
    bloom: { strength: 0.6, radius: 0.5, threshold: 1.2 },
  },
  {
    id: "MoonOrbit_Gold",
    kind: "orbit",
    camera: { elevation: 12, azimuth: 0, swing: 0, distance: 8.6, fov: 30, target: [0, 0, 0], shiftX: 0.12, shiftY: 0 },
    keyDir: [-0.5, 0.45, 0.75],
    keyIntensity: 2.1,
    fill: 0.05,
    exposure: 1.0,
    stars: { count: 3000, brightness: 0.7, spreadDeg: 30 },
    earth: { radius: 1, spinTurns: 1, spinOffset: -1.87, tiltDeg: 23.4, lean: 0, rim: 0.35, clouds: 1.6, saturation: 0.55, haze: 0 },
    moonLook: { albedo: 0.7, glow: 1 },
    orbit: { radius: 2.6, dots: 240, dotSize: 2.8, dotOpacity: 0.9, tiltDeg: 7 },
    nebula: { inner: "#C89A3A", outer: "#3A2A10", centre: [1.07, 0.82], strength: 0.4, dust: 1.0 },
  },
  {
    id: "MoonOrbit_Blue",
    kind: "orbit",
    camera: { elevation: 12, azimuth: 0, swing: 0, distance: 8.6, fov: 30, target: [0, 0, 0], shiftX: 0.12, shiftY: 0 },
    keyDir: [-0.5, 0.45, 0.75],
    keyIntensity: 2.1,
    fill: 0.05,
    exposure: 1.0,
    stars: { count: 3000, brightness: 0.7, spreadDeg: 30 },
    earth: { radius: 1, spinTurns: 1, spinOffset: -1.87, tiltDeg: 23.4, lean: 0, rim: 0.35, clouds: 1.6, saturation: 0.55, haze: 0 },
    moonLook: { albedo: 0.7, glow: 1 },
    orbit: { radius: 2.6, dots: 240, dotSize: 2.8, dotOpacity: 0.9, tiltDeg: 7 },
    nebula: { inner: "#3A6AC8", outer: "#2A1A5A", centre: [1.07, 0.82], strength: 0.4, dust: 1.0 },
  },
];

export const MOON_RADIUS_RATIO = 0.27; // Moon diameter / Earth diameter
