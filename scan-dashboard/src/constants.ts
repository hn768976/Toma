/**
 * Global constants for the "Scanning Dashboard Plane" pieces.
 *
 * The composition is authored at 4K so it can be rendered at full size later;
 * every measurement below is expressed in composition pixels.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 16 s. Every animated quantity completes an integer number of cycles here. */
export const DURATION = 480;

/**
 * The dashboard lives on a flat plane that is raked away from the camera.
 * The plane is authored in its own coordinate space and overfills the frame so
 * that modules crop at every edge.
 */
export const PLANE_W = 4900;
export const PLANE_H = 3000;
export const PLANE_CX = PLANE_W / 2;
export const PLANE_CY = PLANE_H / 2;

/** CSS `perspective` applied to the plane container. */
export const PERSPECTIVE = 2500;
/** Rake of the plane around X, in degrees. */
export const RAKE = 18;

/** The scanned sphere at the centre of the plane. */
export const SPHERE_CX = PLANE_CX;
export const SPHERE_CY = 1380;
export const SPHERE_R = 520;
/** Elevation of the camera above the sphere's equator, in degrees. */
export const SPHERE_TILT = 20;
/** Full turns of the sphere over DURATION frames. Integer keeps the loop shut. */
export const SPHERE_TURNS = 2;
/** Passes of the falling scan band over DURATION frames. */
export const SCAN_PASSES = 4;

/** Hairline weights, in composition pixels. */
export const SW = {
  gridMinor: 1.4,
  gridMajor: 2.4,
  frame: 2,
  hair: 1.6,
  wire: 2.2,
  accent: 3,
} as const;
