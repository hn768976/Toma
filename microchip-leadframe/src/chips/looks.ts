import type { Track } from "../engine/keyframes";

/**
 * A "look" is everything that differs between the two versions of the
 * composition: the camera move and the timing of the foreground wipe.
 * All tracks are keyed in seconds.
 */
export type ChipLook = {
  name: string;
  /** Orbit angle around the vertical axis, degrees. 0 = looking along -Z. */
  yaw: Track;
  /** Elevation above the lead frame, degrees. */
  elevation: Track;
  /** Width of the frame, in world units, at the focus plane (unit pitch = 10). */
  frameWidth: Track;
  /** Point on the lead frame the camera looks at. */
  targetX: Track;
  targetZ: Track;
  /** Camera roll, degrees. */
  roll: Track;
  /** Vertical field of view, degrees (long lens = strong compression). */
  fov: number;
  /** Blur-disc radius at infinity, fraction of frame height. */
  aperture: Track;
  /** Rotation of the studio environment around the vertical axis, degrees. */
  envYaw: Track;
  /** Exposure compensation (1 = neutral). */
  exposure: Track;
  /** Path of the travelling specular hot zone. */
  light: LightPath;
  /** Strength of the travelling specular hot zone (1 = as in the reference). */
  hotZone: number;
  /** Brightness of whatever shows through the stamped openings (1 = default). */
  openingLevel: number;
  /** Extra lift of the blacks (0 = none): a soft, slightly hazy lens look. */
  blackLift: number;
  /** Added to the cool-to-steel grade position (0 = default timeline). */
  coolBias: number;
  /**
   * Start / end time of the foreground wipe (out-of-focus glass panes
   * sweeping through the frame while the focus breathes), or null.
   */
  wipeWindow: readonly [number, number] | null;
  /**
   * Extra blur-disc radius (fraction of frame height) that takes the whole
   * image out of focus around the wipe, or null. The tail is long on purpose
   * so the image eases back into focus instead of snapping.
   */
  wipeDefocus: Track | null;
};

/**
 * The soft specular "hot zone" on the sheet. Coordinates are camera-aligned
 * ground coordinates relative to the camera target (x = screen right,
 * y = away from the camera); power 0 hides the light while it jumps back.
 */
export type LightPath = {
  x: Track;
  y: Track;
  power: Track;
  /** true: straight constant-speed sweeps; false: eased, drifting path. */
  linear: boolean;
};

/**
 * Three clean left-to-right sweeps, timed like the reference: along the far
 * edge (0-3 s), through the middle (3.2-6.9 s) and across the foreground
 * (7.7-10.5 s), where the light comes to rest behind the die; the sheet is
 * at its darkest between the second and third sweep.
 */
const THREE_SWEEPS: LightPath = {
  x: [
    [0, -6],
    [3.0, 9.5],
    [3.2, -9.5],
    [6.9, 9.5],
    [7.7, -9.5],
    [10.5, 5],
    [12.04, 5.5],
  ],
  y: [
    [0, 8],
    [3.0, 8],
    [3.2, -3],
    [6.9, 3],
    [7.7, -5],
    [10.5, 2],
    [12.04, 3],
  ],
  power: [
    [0, 1.7],
    [2.7, 1.7],
    [3.0, 0],
    [3.2, 0],
    [3.6, 2.1],
    [6.5, 2.1],
    [6.9, 0],
    [7.7, 0],
    [8.1, 1.5],
    [10.2, 1.4],
    [10.8, 1.1],
    [12.04, 1.1],
  ],
  linear: true,
};

/** A gentler light that drifts and swells on an eased path. */
const DRIFTING_LIGHT: LightPath = {
  x: [
    [0, -9],
    [3.0, 9],
    [3.3, -10],
    [7.0, 8],
    [7.5, -9],
    [10.5, 7],
    [12.04, 9],
  ],
  y: [
    [0, 10],
    [3.0, 10],
    [3.3, -3],
    [7.0, 3],
    [7.5, -5],
    [10.5, -2],
    [12.04, -2],
  ],
  power: [
    [0, 1.7],
    [2.6, 1.7],
    [3.1, 0],
    [3.4, 0],
    [3.9, 2.1],
    [6.4, 2.1],
    [7.1, 0],
    [7.6, 0],
    [8.2, 1.4],
    [10.2, 1.4],
    [10.8, 0.35],
    [12.04, 0.3],
  ],
  linear: false,
};

/**
 * Version 1 - matches the reference.
 * Values were measured from the reference (12.04 s) by tracking the
 * perspective of the centre die: a steady ~68 degree orbit at roughly 5 deg/s
 * (faster while the foreground wipe passes), rising from 19.5 to 29.5 degrees
 * and pushing in slightly, with the die kept in the middle of the frame, on a
 * very long lens.
 */
export const REFERENCE_ORBIT: ChipLook = {
  name: "reference-orbit",
  yaw: [
    [0, 7],
    [1.3, 0],
    [3, -8],
    [6, -21],
    [8, -32],
    [8.7, -36.5],
    [10.2, -53],
    [11.2, -58],
    [12.04, -61],
  ],
  elevation: [
    [0, 19.5],
    [3, 21],
    [6, 24],
    [8, 25],
    [8.7, 25.4],
    [10.2, 28.5],
    [12.04, 29.5],
  ],
  frameWidth: [
    [0, 15.4],
    [3, 15.6],
    [5.2, 15.6],
    [8, 14.8],
    [8.8, 14.5],
    [10.2, 12.7],
    [12.04, 12.6],
  ],
  targetX: [
    [0, 0.1],
    [12.04, -0.1],
  ],
  targetZ: [
    [0, 0.0],
    [12.04, -0.15],
  ],
  roll: [
    [0, 0],
    [12.04, 0],
  ],
  fov: 8,
  aperture: [
    [0, 0.18],
    [12.04, 0.18],
  ],
  envYaw: [
    [0, 0],
    [12.1, 0],
  ],
  // Follows the brightness profile of the reference: a dip while the first
  // light pass has gone, bright through the wipe, open at the end.
  exposure: [
    [0, 0.66],
    [4.5, 0.66],
    [5.5, 0.59],
    [7, 0.55],
    [8, 0.62],
    [8.6, 0.68],
    [9.0, 0.6],
    [9.5, 0.68],
    [10, 0.75],
    [10.5, 0.62],
    [12.04, 0.75],
  ],
  light: THREE_SWEEPS,
  hotZone: 1,
  openingLevel: 1.5,
  blackLift: 0.02,
  coolBias: 0.25,
  wipeWindow: [8.56, 10.04],
  wipeDefocus: [
    [8.56, 0],
    [8.85, 0.0006],
    [9.05, 0.0025],
    [9.3, 0.008],
    [9.5, 0.0105],
    [9.7, 0.0085],
    [9.95, 0.0042],
    [10.2, 0.0019],
    [10.45, 0.0009],
    [10.7, 0.0003],
    [10.95, 0],
  ],
};

/**
 * Version 2 - alternative camera.
 * Same lead frame, same lighting and materials, but the camera starts almost
 * straight overhead, slowly rotating, then cranes down and glides sideways
 * across the strip into a low, shallow-focus hero angle - orbiting in the
 * opposite direction to version 1 and without the foreground wipe.
 */
export const CRANE_DOWN: ChipLook = {
  name: "crane-down",
  yaw: [
    [0, 38],
    [3, 47],
    [6, 62],
    [9, 78],
    [12.04, 86],
  ],
  elevation: [
    [0, 80],
    [2.5, 74],
    [5.5, 52],
    [8.5, 31],
    [12.04, 21],
  ],
  frameWidth: [
    [0, 27],
    [3, 25],
    [6, 19.5],
    [9, 15.5],
    [12.04, 13.6],
  ],
  targetX: [
    [0, -10],
    [3, -8.6],
    [7, -2.4],
    [10, -0.3],
    [12.04, 0],
  ],
  targetZ: [
    [0, 10],
    [3, 8.8],
    [7, 2.2],
    [10, 0.25],
    [12.04, 0],
  ],
  roll: [
    [0, 0],
    [12.04, 0],
  ],
  fov: 9,
  aperture: [
    [0, 0.25],
    [6, 0.21],
    [12.04, 0.18],
  ],
  // The key side of the room follows the orbit part of the way, so the sheet
  // keeps its sheen instead of falling into the dark half of the studio.
  envYaw: [
    [0, 24],
    [3, 33],
    [6, 46],
    [9, 60],
    [12.04, 66],
  ],
  // Seen from above the sheet mirrors the overhead soft box: expose down.
  exposure: [
    [0, 0.42],
    [2.5, 0.46],
    [5.5, 0.8],
    [8.5, 0.88],
    [12.04, 0.86],
  ],
  light: DRIFTING_LIGHT,
  hotZone: 0.32,
  openingLevel: 1,
  blackLift: 0,
  coolBias: 0,
  wipeWindow: null,
  wipeDefocus: null,
};
