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
  /** Strength of the travelling specular hot zone (1 = as in the reference). */
  hotZone: number;
  /**
   * Start / end time of the foreground wipe (out-of-focus glass panes
   * sweeping through the frame while the focus breathes), or null.
   */
  wipeWindow: readonly [number, number] | null;
};

/**
 * Version 1 - matches the reference.
 * Values were measured from the reference (12.04 s) by tracking the
 * perspective of the centre die: a steady ~73 degree orbit at roughly 5 deg/s
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
    [10.2, -56],
    [12.04, -66],
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
    [0, 14.7],
    [3, 15.2],
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
    [0, 0.15],
    [12.04, 0.15],
  ],
  envYaw: [
    [0, 0],
    [12.1, 0],
  ],
  // Follows the brightness profile of the reference: a dip while the first
  // light pass has gone, bright through the wipe, open at the end.
  exposure: [
    [0, 0.75],
    [6, 0.75],
    [7, 0.66],
    [8, 0.68],
    [8.6, 0.7],
    [9.0, 0.66],
    [9.5, 0.72],
    [10, 0.85],
    [10.5, 0.9],
    [12.04, 1.12],
  ],
  hotZone: 1,
  wipeWindow: [8.56, 10.04],
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
    [0, 0.22],
    [6, 0.18],
    [12.04, 0.15],
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
  hotZone: 0.32,
  wipeWindow: null,
};
