/**
 * Shot definitions.
 *
 * Distances are in Earth radii (1 R = 6371 km), so an altitude of 0.062 is
 * roughly the 400 km the ISS flies at. Angles are degrees. Each shot carries
 * its own length, matching the reference clip it was cut against.
 */

export const FPS = 30;

export const HD = { width: 1920, height: 1080 } as const;
export const UHD = { width: 3840, height: 2160 } as const;

export type ShotId =
  | "orbitDrift"
  | "lowHorizon"
  | "dawnReveal"
  | "nightPass"
  | "sunriseCrest"
  | "deepSpaceMeteor"
  | "timelapseStreak";

/** A value that eases from `from` to `to` across the shot. */
export type Ramp = readonly [from: number, to: number];

/**
 * What the camera frames.
 *
 * `limb` aims at the horizon, which is how the close passes are composed —
 * pitch is derived from altitude so the horizon holds its place in frame when
 * the camera climbs or drops. `centre` aims at the planet itself, for the
 * shots where the whole disc is the subject.
 */
export type AimMode = "limb" | "centre";

export type ShotConfig = {
  label: string;
  durationInFrames: number;

  /** Camera height above the surface, in Earth radii. */
  altitude: Ramp;
  /** Angular travel along the orbit. */
  orbit: Ramp;
  /** Tilt of the orbital plane, which decides how the ground track reads. */
  inclination: number;
  /** Where on Earth the shot opens, in degrees. */
  startLongitude: number;
  startLatitude: number;

  aim: AimMode;
  /** Degrees the subject — limb or planet centre — sits above frame centre. */
  framing: Ramp;
  /** Camera yaw, for pushing the subject off centre horizontally. */
  lateral: Ramp;
  /** Camera roll. Negative lifts the horizon towards the top right. */
  roll: Ramp;
  /** Vertical field of view. */
  fov: Ramp;

  /**
   * Rotation of the planet under a fixed camera and a fixed sun, in degrees
   * of longitude. Applied as a texture offset, which is exactly what spinning
   * the planet does: the surface moves, the terminator stays put.
   */
  spin: Ramp;

  /** Subsolar point, in the same orbital frame as `orbit`. */
  sunOrbit: number;
  /** Subsolar latitude relative to the orbital plane. */
  sunElevation: number;

  /** Very slow secondary sway so the move never reads as a turntable. */
  sway: { pitch: number; roll: number; cycles: number };

  sunIntensity: number;
  /** Boost for the NASA Black Marble city lights on the night side. */
  nightIntensity: number;
  /** Level subtracted off the night map first. Lower it as the camera pulls back. */
  nightFloor: number;
  /** Renders the solar disc, for shots where it clears the limb. */
  sunDisc: boolean;

  exposure: number;
  bloom: { strength: number; radius: number; threshold: number };
  atmosphere: { rayleigh: number; mie: number; density: number; extinction: number };
  /** The wide glow standing off the limb, over and above the 60 km shell. */
  halo: { radius: number; strength: number; falloff: number };
  /** In-scattered air laid over the disc itself. */
  surfaceHaze: number;
  /** Ocean glint lobe: higher power is tighter. */
  glint: { power: number; gain: number };
  /** Baseline lift on the surface. Near zero for the pure night passes. */
  ambient: number;

  /** Deep space behind the planet. */
  sky: { nebula: number; dust: number; dustDrift: number };

  /** Scales the procedural surface detail. Zero for shots that smear it away. */
  procedural: number;
  /** Longitudinal smear, in UV units, and how many taps pay for it. */
  motionBlur: { span: number; taps: number };
  /** Lens flare drawn on the sun. Size is in camera-space units. */
  flare: { strength: number; length: number; height: number } | null;

  /** A single meteor pass, in camera space. */
  meteor: {
    /** Frame range it is visible over. */
    enter: number;
    leave: number;
    /** Start and end of the head, in camera-space units. */
    from: readonly [number, number];
    to: readonly [number, number];
    depth: number;
    length: number;
    width: number;
    intensity: number;
  } | null;
};

const NO_BLUR = { span: 0, taps: 1 } as const;
const STILL_SKY = { nebula: 0, dust: 0, dustDrift: 0 } as const;

export const SHOTS: Record<ShotId, ShotConfig> = {
  /**
   * Reference 1 — high-oblique close-up with the limb cutting the frame
   * diagonally, stars in the upper left, terminator falling away behind.
   */
  orbitDrift: {
    label: "Orbit Drift",
    durationInFrames: 601,
    altitude: [0.175, 0.138],
    orbit: [0, 21],
    inclination: 24,
    startLongitude: -172,
    startLatitude: -6,
    aim: "limb",
    framing: [10.5, 8.5],
    lateral: [0, 0],
    roll: [-26, -22.5],
    fov: [37, 37],
    spin: [0, 0],
    sunOrbit: -57,
    sunElevation: 29,
    sway: { pitch: 0.35, roll: 0.5, cycles: 0.75 },
    sunIntensity: 1.0,
    nightIntensity: 1.5,
    nightFloor: 0.075,
    sunDisc: false,
    exposure: 0.95,
    bloom: { strength: 0.46, radius: 0.55, threshold: 0.7 },
    atmosphere: { rayleigh: 1.8, mie: 0.72, density: 0.62, extinction: 0.22 },
    halo: { radius: 1.02, strength: 2.6, falloff: 1.8 },
    surfaceHaze: 0.34,
    glint: { power: 110, gain: 0.85 },
    ambient: 0.03,
    sky: STILL_SKY,
    procedural: 1,
    motionBlur: NO_BLUR,
    flare: null,
    meteor: null,
  },

  /**
   * ISS-cupola framing: near-level horizon, city lights under the camera, and
   * a sunrise building over the limb until the disc clears it at the end.
   */
  lowHorizon: {
    label: "Low Horizon",
    durationInFrames: 601,
    altitude: [0.064, 0.055],
    orbit: [0, 24],
    inclination: -11,
    startLongitude: 4,
    startLatitude: 43,
    aim: "limb",
    framing: [6.5, 5.0],
    lateral: [0, 0],
    roll: [-2.5, 1.8],
    fov: [46, 43],
    spin: [0, 0],
    sunOrbit: 127,
    sunElevation: 6,
    sway: { pitch: 0.25, roll: 0.9, cycles: 0.6 },
    sunIntensity: 1.0,
    nightIntensity: 2.6,
    nightFloor: 0.075,
    sunDisc: true,
    exposure: 0.78,
    bloom: { strength: 0.55, radius: 0.6, threshold: 0.7 },
    atmosphere: { rayleigh: 1.5, mie: 1.2, density: 0.55, extinction: 1.05 },
    // Version B flies at a third of A's altitude, so the same glow extent
    // covers three times as much of the frame — it has to be pulled in hard.
    halo: { radius: 1.022, strength: 2.0, falloff: 1.5 },
    surfaceHaze: 0.15,
    glint: { power: 110, gain: 0.85 },
    ambient: 0.022,
    sky: STILL_SKY,
    procedural: 1,
    motionBlur: NO_BLUR,
    flare: null,
    meteor: null,
  },

  /**
   * Reference 2 — the full disc approached out of the dark. It opens on the
   * night side, nothing but city lights against deep blue space, and the
   * terminator sweeps across as the camera closes to a lit blue marble.
   */
  dawnReveal: {
    label: "Dawn Reveal",
    durationInFrames: 300,
    altitude: [10.5, 3.2],
    orbit: [0, 130],
    inclination: 8,
    startLongitude: 96,
    startLatitude: 18,
    aim: "centre",
    framing: [0, 0],
    lateral: [0, 0],
    roll: [4, -2],
    fov: [34, 34],
    spin: [0, 0],
    sunOrbit: 170,
    sunElevation: 12,
    sway: { pitch: 0.2, roll: 0.35, cycles: 0.5 },
    sunIntensity: 1.0,
    nightIntensity: 9.0,
    nightFloor: 0.02,
    sunDisc: false,
    exposure: 0.95,
    bloom: { strength: 0.5, radius: 0.6, threshold: 0.66 },
    atmosphere: { rayleigh: 2.0, mie: 0.9, density: 0.6, extinction: 0.4 },
    halo: { radius: 1.055, strength: 1.0, falloff: 2.4 },
    surfaceHaze: 0.3,
    glint: { power: 900, gain: 1.4 },
    ambient: 0.03,
    sky: { nebula: 0.22, dust: 0.55, dustDrift: 0.18 },
    procedural: 1,
    motionBlur: NO_BLUR,
    flare: null,
    meteor: null,
  },

  /**
   * Reference 3 — a night pass with the limb low in frame, the continents
   * picked out only by their cities, and a hard cyan edge against the black.
   */
  nightPass: {
    label: "Night Pass",
    durationInFrames: 301,
    altitude: [0.085, 0.072],
    orbit: [0, 14],
    inclination: -6,
    startLongitude: 30,
    startLatitude: 36,
    aim: "limb",
    framing: [-4.5, -3.0],
    lateral: [0, 0],
    roll: [1.5, -1.2],
    fov: [42, 41],
    spin: [0, 0],
    sunOrbit: 137,
    sunElevation: -8,
    sway: { pitch: 0.2, roll: 0.6, cycles: 0.6 },
    sunIntensity: 1.0,
    nightIntensity: 3.4,
    nightFloor: 0.07,
    sunDisc: false,
    exposure: 0.82,
    bloom: { strength: 0.6, radius: 0.66, threshold: 0.66 },
    atmosphere: { rayleigh: 2.2, mie: 0.7, density: 0.5, extinction: 0.85 },
    halo: { radius: 1.026, strength: 3.1, falloff: 1.5 },
    surfaceHaze: 0.12,
    glint: { power: 300, gain: 0.5 },
    ambient: 0.004,
    sky: STILL_SKY,
    procedural: 1,
    motionBlur: NO_BLUR,
    flare: null,
    meteor: null,
  },

  /**
   * Reference 4 — the sun coming up from directly behind the planet. The disc
   * fills the bottom of frame, the cities are the only surface detail, and the
   * whole rim burns electric blue with a hotspot where the sun sits.
   */
  sunriseCrest: {
    label: "Sunrise Crest",
    durationInFrames: 600,
    altitude: [1.05, 0.88],
    orbit: [0, 9],
    inclination: 5,
    startLongitude: 112,
    startLatitude: 6,
    aim: "centre",
    framing: [-21, -19],
    lateral: [0, 0],
    roll: [0.5, -0.5],
    fov: [40, 39],
    spin: [0, 0],
    sunOrbit: 168,
    sunElevation: 0,
    sway: { pitch: 0.15, roll: 0.3, cycles: 0.5 },
    sunIntensity: 1.0,
    nightIntensity: 3.0,
    nightFloor: 0.05,
    sunDisc: false,
    exposure: 1.05,
    bloom: { strength: 0.78, radius: 0.8, threshold: 0.55 },
    // Heavy Mie is the whole point here: the sun is behind the planet, so
    // everything you see of it is forward-scattered through the limb.
    atmosphere: { rayleigh: 4.2, mie: 1.5, density: 0.62, extinction: 0.26 },
    halo: { radius: 1.05, strength: 2.9, falloff: 1.6 },
    surfaceHaze: 0.1,
    glint: { power: 600, gain: 0.6 },
    ambient: 0.013,
    sky: { nebula: 0.12, dust: 0, dustDrift: 0 },
    procedural: 1,
    motionBlur: NO_BLUR,
    flare: null,
    meteor: null,
  },

  /**
   * Reference 5 — the planet held at a distance in a nebula field, with a
   * meteor crossing the upper frame partway through.
   */
  deepSpaceMeteor: {
    label: "Deep Space Meteor",
    durationInFrames: 600,
    altitude: [7.8, 7.0],
    orbit: [0, 7],
    inclination: 12,
    startLongitude: -60,
    startLatitude: 10,
    aim: "centre",
    framing: [1.5, 1.0],
    lateral: [4, 3],
    roll: [0, 0],
    fov: [36, 36],
    spin: [0, 0],
    sunOrbit: 52,
    sunElevation: 16,
    sway: { pitch: 0.12, roll: 0.25, cycles: 0.4 },
    sunIntensity: 1.0,
    nightIntensity: 2.6,
    nightFloor: 0.02,
    sunDisc: false,
    exposure: 0.95,
    bloom: { strength: 0.5, radius: 0.6, threshold: 0.62 },
    atmosphere: { rayleigh: 2.0, mie: 0.8, density: 0.6, extinction: 0.35 },
    halo: { radius: 1.1, strength: 1.0, falloff: 2.6 },
    surfaceHaze: 0.28,
    glint: { power: 900, gain: 0.35 },
    ambient: 0.025,
    sky: { nebula: 0.62, dust: 0.35, dustDrift: 0.1 },
    procedural: 1,
    motionBlur: NO_BLUR,
    flare: null,
    meteor: {
      enter: 150,
      leave: 430,
      from: [7.4, 3.5],
      to: [1.1, 2.15],
      depth: 14,
      length: 2.3,
      width: 0.1,
      intensity: 1.5,
    },
  },

  /**
   * Reference 6 — the fast timelapse. The planet spins under a fixed camera
   * and a fixed sun, fast enough that the deck and the surface smear into
   * streaks, with the sun flaring off the top corner.
   */
  timelapseStreak: {
    label: "Timelapse Streak",
    durationInFrames: 600,
    altitude: [0.048, 0.042],
    // Barely any orbital travel: the motion in this shot is the planet
    // turning, not the camera moving, which is what holds the sun still.
    orbit: [0, 3],
    inclination: 0,
    startLongitude: -30,
    startLatitude: 0,
    aim: "limb",
    framing: [13, 11],
    lateral: [0, 0],
    roll: [-3, -1.5],
    fov: [46, 45],
    spin: [0, 300],
    sunOrbit: 100,
    sunElevation: -26,
    sway: { pitch: 0.15, roll: 0.4, cycles: 0.5 },
    sunIntensity: 1.0,
    nightIntensity: 3.0,
    nightFloor: 0.06,
    sunDisc: true,
    exposure: 0.62,
    bloom: { strength: 0.5, radius: 0.62, threshold: 0.72 },
    atmosphere: { rayleigh: 0.55, mie: 0.32, density: 0.3, extinction: 1.0 },
    halo: { radius: 1.02, strength: 2.0, falloff: 1.5 },
    surfaceHaze: 0.06,
    glint: { power: 200, gain: 0.8 },
    ambient: 0.01,
    sky: STILL_SKY,
    // The procedural detail is fixed to the sphere, not to the surface
    // textures, so at this spin rate it would sit still while everything
    // under it streaked past.
    procedural: 0,
    motionBlur: { span: 0.038, taps: 12 },
    flare: { strength: 1.0, length: 7.5, height: 1.5 },
    meteor: null,
  },
};

export const SHOT_IDS = Object.keys(SHOTS) as ShotId[];

/** Radius of the top of the modelled atmosphere (~60 km). */
export const ATMOSPHERE_RADIUS = 1.0094;
/** Radius the cloud deck sits at (~16 km, slightly lifted for parallax). */
export const CLOUD_RADIUS = 1.0025;
