import { Vector3 } from "three";

/**
 * The cloth is a plane tilted away from the camera, looked at across a shallow
 * angle. Distances are world units; the near edge of the plane sits at the
 * origin and runs away from the camera along `planeD`.
 */
export const TILT_DEGREES = 19;

const tilt = (TILT_DEGREES * Math.PI) / 180;
/** Away-from-camera direction along the cloth. */
export const PLANE_D = new Vector3(0, Math.sin(tilt), -Math.cos(tilt));
/** Displacement axis (the cloth's own normal). */
export const PLANE_N = new Vector3(0, Math.cos(tilt), Math.sin(tilt));

export const DEPTH_NEAR = -8; // extends past the bottom of frame so the
// cloth's own near edge can never swing into shot when a fold drops.
export const DEPTH_FAR = 46;
/** The plane is a trapezoid so line samples are not wasted off-frame near the
 *  camera and still cover the frustum at the far edge. */
export const SPAN_NEAR = 26;
export const SPAN_FAR = 78;

export const CAMERA_POSITION = new Vector3(0, 5.6, 22);
export const CAMERA_TARGET = new Vector3(0, 6.35, -20);
export const CAMERA_FOV = 26;

/** Displacement field. */
export const AMPLITUDE = 2.5;
export const ANISOTROPY = 0.42; // < 1 stretches folds across the frame
export const OCT_FREQ = new Vector3(0.048, 0.105, 0.19);
export const OCT_AMP = new Vector3(1.0, 0.46, 0.09);
export const OCT_DRIFT = new Vector3(7.0, 4.5, 2.4);
export const OCT_TIME = new Vector3(0.42, 0.5, 0.62);

/** Key light direction (pointing at the light). */
export const LIGHT_DIR = new Vector3(-0.6, 0.72, -0.35).normalize();

export const AMBIENT = 0.06;
export const TROUGH_DARKEN = 0.5;
export const DIFFUSE = 1.15;
export const DIFFUSE_POW = 1.15;
export const RIM_POW = 2.2;

/** Ribbon width and antialiasing, in composition pixels. */
export const WIDTH_PX = 1.9;
export const MIN_PX = 1.05; // device px
/** On-screen line pitch (device px) above which lines resolve on their own.
 *  Below it, ribbons are merged rather than thinned — see the vertex shader. */
export const SAFE_PX = 2.6;
export const MERGE_K = 3.0;
export const REF_DIST = 30;

/** Light DOF. */
export const FOCUS_DIST = 34;
export const NEAR_DIST = 22;
export const NEAR_BLUR_PX = 3.0;

/** Depth fade — the far field dissolves instead of terminating. */
export const FADE_START = 38;
export const FADE_END = 60;

export const GLOW_WIDTH_BOOST = 7;
export const GRAIN_AMOUNT = 0.02;

/** How far the opaque backing sits below the line surface, world units. */
export const BACK_OFFSET = 0.05;
/** How much of the fill is visible between the lines. */
export const FILL_STRENGTH = 0.36;
