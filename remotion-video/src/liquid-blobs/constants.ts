/**
 * Shared timing + resolution constants for the "Liquid Blobs" motion piece.
 *
 * The four reference clips run 11.92s at 25fps. At the 30fps this project
 * delivers, 358 frames reproduces that length to within a third of a frame.
 */

export const FPS = 30;

/** 358 / 30 = 11.933s — the reference length at 30fps. */
export const DURATION_IN_FRAMES = 358;

export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;

export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

/**
 * Number of metaballs in the field. This is baked into the shader loop, so
 * changing it recompiles the material rather than just updating a uniform.
 */
export const BALL_COUNT = 8;

/** Sphere-tracing budget. Lower renders faster, higher resolves thin necks. */
export const MAX_RAY_STEPS = 72;

export const MIN_HIT_DISTANCE = 0.0015;
export const MAX_RAY_DISTANCE = 26;

/** Vertical field of view of the virtual camera, in degrees. */
export const CAMERA_FOV = 35;
