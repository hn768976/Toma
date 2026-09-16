import {DURATION_IN_FRAMES} from '../constants';

export type Motion = {
  groupRotation: [number, number, number];
  groupPosition: [number, number, number];
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
};

/**
 * Rest pose. The lattice plane is yawed so its +x side recedes from camera and
 * dissolves into the fog, which is what leaves the empty dark half of the frame
 * in the reference. The small roll keeps the diamonds from sitting perfectly
 * upright.
 */
const BASE_YAW = 0.72;
const BASE_PITCH = 0.055;
const BASE_ROLL = -0.05;
const BASE_X = -0.95;
const BASE_Y = -0.1;
const CAMERA_Z = 2.25;

/**
 * The reference does not pan or scroll: measured against frame 0 it drifts a
 * few dozen pixels, peaks near the middle of the clip and returns exactly to
 * where it started. So the motion here is a slow sway built entirely from
 * sin/cos of `frame / DURATION_IN_FRAMES` — period exactly one loop, therefore
 * frame 300 is bit-identical in pose to frame 0.
 */
export const motionAtFrame = (frame: number): Motion => {
  const t = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
  const a = Math.PI * 2 * t;

  return {
    groupRotation: [
      BASE_PITCH + Math.sin(a + 1.15) * 0.028,
      BASE_YAW + Math.sin(a) * 0.05,
      BASE_ROLL + Math.cos(a) * 0.02,
    ],
    groupPosition: [
      BASE_X + Math.sin(a) * 0.1,
      BASE_Y + Math.sin(a + 0.6) * 0.13,
      Math.cos(a + 2.1) * 0.07,
    ],
    cameraPosition: [Math.sin(a + 0.35) * 0.06, Math.cos(a) * 0.05, CAMERA_Z + Math.cos(a) * 0.16],
    cameraTarget: [0.25, 0, 0],
  };
};
