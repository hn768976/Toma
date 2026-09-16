/**
 * Shot definitions for the two Earth versions.
 *
 * Distances are in Earth radii (1 R = 6371 km), so an altitude of 0.062
 * is roughly the 400 km the ISS flies at. Angles are degrees.
 */

export const FPS = 30;

/**
 * 601 frames at 30fps = 20.033s, the exact length of the reference clip
 * (601 samples, 15360/512 timescale).
 */
export const DURATION_IN_FRAMES = 601;

export const HD = { width: 1920, height: 1080 } as const;
export const UHD = { width: 3840, height: 2160 } as const;

export type ShotId = "orbitDrift" | "lowHorizon";

/** A value that eases from `from` to `to` across the shot. */
export type Ramp = readonly [from: number, to: number];

export type ShotConfig = {
  /** Camera height above the surface, in Earth radii. */
  altitude: Ramp;
  /** Angular travel along the orbit. */
  orbit: Ramp;
  /** Tilt of the orbital plane, which decides how the ground track reads. */
  inclination: number;
  /** Where on Earth the shot opens, in degrees. */
  startLongitude: number;
  startLatitude: number;
  /** Degrees the limb sits above the centre of frame. Drives the pitch. */
  limbOffset: Ramp;
  /** Camera roll. Positive lifts the horizon towards the top right. */
  roll: Ramp;
  /** Vertical field of view. */
  fov: Ramp;
  /** Subsolar point, measured in the same orbital frame as `orbit`. */
  sunOrbit: number;
  /** Subsolar latitude relative to the orbital plane. */
  sunElevation: number;
  /** Very slow secondary sway so the move never reads as a turntable. */
  sway: { pitch: number; roll: number; cycles: number };
  sunIntensity: number;
  /** Boost for the NASA Black Marble city lights on the night side. */
  nightIntensity: number;
  /** Renders the solar disc, for shots where it clears the limb. */
  sunDisc: boolean;
  exposure: number;
  bloom: { strength: number; radius: number; threshold: number };
  atmosphere: { rayleigh: number; mie: number; density: number; extinction: number };
};

export const SHOTS: Record<ShotId, ShotConfig> = {
  /**
   * Version A — matches the reference: high-oblique close-up with the limb
   * cutting the frame diagonally, stars in the upper left, the terminator
   * creeping in from the leading edge.
   */
  orbitDrift: {
    altitude: [0.175, 0.138],
    orbit: [0, 21],
    inclination: 24,
    startLongitude: -172,
    startLatitude: -6,
    limbOffset: [10.5, 8.5],
    roll: [-26, -22.5],
    fov: [37, 37],
    sunOrbit: -57,
    sunElevation: 29,
    sway: { pitch: 0.35, roll: 0.5, cycles: 0.75 },
    sunIntensity: 1.0,
    nightIntensity: 1.5,
    sunDisc: false,
    exposure: 0.8,
    bloom: { strength: 0.3, radius: 0.35, threshold: 0.75 },
    atmosphere: { rayleigh: 1.55, mie: 0.5, density: 0.5, extinction: 0.25 },
  },

  /**
   * Version B — different layout: low ISS-cupola horizon, Earth across the
   * bottom of frame, city lights under the camera and a sunrise building
   * over the limb until the solar disc clears it in the last few seconds.
   */
  lowHorizon: {
    altitude: [0.064, 0.055],
    orbit: [0, 24],
    inclination: -11,
    startLongitude: 4,
    startLatitude: 43,
    limbOffset: [6.5, 5.0],
    roll: [-2.5, 1.8],
    fov: [46, 43],
    sunOrbit: 127,
    sunElevation: 6,
    sway: { pitch: 0.25, roll: 0.9, cycles: 0.6 },
    sunIntensity: 1.0,
    nightIntensity: 2.6,
    sunDisc: true,
    exposure: 0.72,
    bloom: { strength: 0.5, radius: 0.78, threshold: 0.8 },
    atmosphere: { rayleigh: 1.15, mie: 0.95, density: 0.5, extinction: 1.15 },
  },
};

/** Radius of the top of the modelled atmosphere (~60 km). */
export const ATMOSPHERE_RADIUS = 1.0094;
/** Radius the cloud deck sits at (~16 km, slightly lifted for parallax). */
export const CLOUD_RADIUS = 1.0025;
