import { DURATION_IN_FRAMES } from "../constants";

export type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
};

// Camera drifts across and slightly through the aisles on a closed path.
// Every term is built from sin/cos of a full turn, so frame 300 lands
// exactly back on frame 0 and the loop is seamless.
const BASE_Y = 9.8;
const BASE_Z = 18.5;
const SWEEP_X = 3.4; // lateral drift
const RISE_Y = 0.85; // the "small rise"
const PUSH_Z = 2.6; // gentle push through the aisles and back

export const cameraAt = (frame: number): CameraState => {
  const a = (2 * Math.PI * frame) / DURATION_IN_FRAMES;

  const x = SWEEP_X * Math.sin(a);
  const y = BASE_Y + RISE_Y * Math.sin(a);
  const z = BASE_Z + PUSH_Z * 0.5 * (Math.cos(a) - 1);

  // The target tracks the camera laterally so the view direction barely
  // changes - the whole move stays within a couple of degrees of rotation.
  return {
    position: [x, y, z],
    target: [x * 0.86, 1.3, -2.6],
  };
};
