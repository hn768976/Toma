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

// Reference clip: 301 frames @ 25 fps. Helper to key by reference frame.
const f = (frame: number) => frame / 25;

/**
 * Version 1 - matches the reference.
 * Values were measured from the reference by tracking the perspective of the
 * centre die: a slow ~60 degree orbit that rises from 19.5 to 24 degrees and
 * pushes in slightly while the die stays in the middle of the frame, on a
 * very long lens.
 */
export const REFERENCE_ORBIT: ChipLook = {
  name: "reference-orbit",
  yaw: [
    [f(0), 2],
    [f(60), 0],
    [f(90), -7],
    [f(110), -14],
    [f(126), -19],
    [f(156), -24],
    [f(180), -28],
    [f(200), -35],
    [f(220), -40],
    [f(256), -52],
    [f(275), -55.5],
    [f(300), -58.5],
  ],
  elevation: [
    [f(0), 19.5],
    [f(60), 19.5],
    [f(100), 21.5],
    [f(126), 22.8],
    [f(156), 23.4],
    [f(220), 23.6],
    [f(300), 23.8],
  ],
  frameWidth: [
    [f(0), 16.1],
    [f(130), 15.9],
    [f(180), 15.4],
    [f(222), 14.5],
    [f(256), 13.5],
    [f(300), 12.3],
  ],
  targetX: [
    [f(0), 0.1],
    [f(300), -0.1],
  ],
  targetZ: [
    [f(0), 0.0],
    [f(300), -0.15],
  ],
  roll: [
    [0, 0],
    [12, 0],
  ],
  fov: 8,
  aperture: [
    [0, 0.17],
    [f(150), 0.17],
    [f(300), 0.16],
  ],
  envYaw: [
    [0, 0],
    [12.1, 0],
  ],
  exposure: [
    [0, 1],
    [12.1, 1],
  ],
  hotZone: 1,
  wipeWindow: [f(214), f(251)],
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
    [0, 0.24],
    [6, 0.2],
    [12.04, 0.17],
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
  hotZone: 0.45,
  wipeWindow: null,
};
