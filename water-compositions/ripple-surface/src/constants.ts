// 4K UHD master compositions.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
// Reference clip: 540 frames (18.018 s @ 29.97 fps). We keep the exact
// frame count at a true 30 fps -> 540 frames = 18.000 s.
export const DURATION_IN_FRAMES = 540;

export const CAMERA = {
  /** Version 1: orthographic, straight top-down view (as in the reference). */
  topDown: 0,
  /** Version 2: low-angle perspective camera with slow dolly + pan. */
  lowAngleDolly: 1,
} as const;
