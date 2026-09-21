/** Composition format. Rendered at --scale=0.5 for the 1080p previews. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

/**
 * The loop length, in frames. Everything periodic is driven by
 * `frame % LOOP_FRAMES`, so a composition can be temporarily extended to 601
 * frames for the loop-closure check and frame 600 still equals frame 0.
 */
export const LOOP_FRAMES = 600;
export const DURATION_IN_FRAMES = LOOP_FRAMES;

/** World units. The frame is 2 units tall at the blade plane (z = 0). */
export const VIEW_H = 2;
export const VIEW_W = (VIEW_H * WIDTH) / HEIGHT;

/**
 * Vertical field of view. 24 deg matches a ~57mm lens on full frame, inside the
 * 50-70mm the look wants: long enough that edge blades are not distorted
 * differently from the centre ones.
 */
export const FOV_DEG = 24;
export const CAMERA_Z = VIEW_H / 2 / Math.tan((FOV_DEG * Math.PI) / 360);

/** Blades run this much past the frame, so no end of the array is ever visible. */
export const ARRAY_OVERSCAN = 1.22;
/** Blades are this much taller than the frame, so they are always cropped. */
export const BLADE_HEIGHT = VIEW_H * 1.35;
