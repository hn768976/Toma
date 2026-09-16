// The camera move.
//
// A constant forward flight over the field plus a slow sway, bob, yaw,
// roll and pitch drift, matching the reference's low, long-lens glide.
// Every oscillation completes a whole number of cycles per loop and the
// forward travel is exactly LOOP_CELLS, so the pose at frame
// DURATION_IN_FRAMES is identical to the pose at frame 0.

import {
  CAMERA_BOB_CYCLES,
  CAMERA_BOB_Y,
  CAMERA_HEIGHT,
  CAMERA_PITCH_DEG,
  CAMERA_PITCH_DRIFT_DEG,
  CAMERA_ROLL_DEG,
  CAMERA_SWAY_CYCLES,
  CAMERA_SWAY_X,
  CAMERA_YAW_DEG,
  CELL,
  FOCUS_BREATH,
  FOCUS_BREATH_CYCLES,
  FOCUS_DISTANCE,
  LOOP_CELLS,
} from "./constants";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export type CameraPose = {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
  focusDistance: number;
};

/**
 * @param progress Position in the loop, 0 to 1. Pass frame / durationInFrames
 *   (not / (duration - 1)): the last frame must land just short of the
 *   start pose, not on it, or the loop stutters by one frame.
 */
export const cameraPose = (progress: number): CameraPose => {
  const t = progress * TAU;

  return {
    x: Math.sin(t * CAMERA_SWAY_CYCLES) * CAMERA_SWAY_X * CELL,
    y:
      CAMERA_HEIGHT +
      Math.sin(t * CAMERA_BOB_CYCLES + 1.1) * CAMERA_BOB_Y * CELL,
    z: -progress * LOOP_CELLS * CELL,

    // The yaw lags the sway by a quarter turn, so the camera leans into
    // the drift the way a physical crane would rather than crabbing.
    pitch: (CAMERA_PITCH_DEG + Math.sin(t + 2.4) * CAMERA_PITCH_DRIFT_DEG) * DEG,
    yaw: Math.sin(t - Math.PI / 2) * CAMERA_YAW_DEG * DEG,
    roll: Math.sin(t + 0.6) * CAMERA_ROLL_DEG * DEG,

    focusDistance:
      FOCUS_DISTANCE + Math.sin(t * FOCUS_BREATH_CYCLES + 0.3) * FOCUS_BREATH,
  };
};
