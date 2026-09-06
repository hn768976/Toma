import { DURATION_IN_FRAMES } from "../constants";

export type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
};

// Slow dolly inward. The camera starts at the outermost point of a shallow
// closed arc and pushes toward the racks, then eases back out along a
// slightly different line - the small lateral bow means the way out isn't a
// retrace of the way in, and the move never comes to a standstill at the
// turnaround. Built from sin/cos of a single full turn, so frame 300 lands
// exactly back on frame 0 and the loop stays seamless.
const BASE_Y = 9.8;
const Z_CENTER = 18.0;
const Z_REACH = 2.4; // how far it pushes in, and back out again
const X_ARC = 0.7; // slight sideways bow, keeps the return path distinct
const Y_RISE = 0.45;

export const cameraAt = (frame: number): CameraState => {
  const a = (2 * Math.PI * frame) / DURATION_IN_FRAMES;

  return {
    position: [
      X_ARC * Math.sin(a),
      BASE_Y + Y_RISE * Math.sin(a),
      Z_CENTER + Z_REACH * Math.cos(a),
    ],
    // Target is fixed, so moving the camera toward it reads as a dolly
    // rather than a pan. The lateral bow swings the view by under two
    // degrees across the whole loop.
    target: [0, 1.3, -2.6],
  };
};
