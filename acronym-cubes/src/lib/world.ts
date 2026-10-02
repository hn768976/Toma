// World layout. One world unit = one cube edge. Everything on screen is
// framed from fractions of the frame (CUBE_FRAME_FRAC, CAM_FOV) so the
// composition renders identically at 1080p, 4K or 6000x3375.

export const FPS = 30;
export const DURATION_IN_FRAMES = 300; // 10 s, one-way reveal (NOT a loop)
export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;

export const CUBE = 1; // edge length
export const BEVEL = 0.07; // rounded-edge radius
export const GAP = 0.12 * CUBE; // gap between neighbouring cubes
export const ROW_PITCH = CUBE + GAP;

// Apparent height of a resting cube's top face, as a fraction of frame height.
export const CUBE_FRAME_FRAC = 0.115;

// Camera: almost straight down, tilted towards the viewer so the cubes'
// front faces show slightly. Very slow straight push-in, no rotation.
export const CAM_TILT_DEG = 10;
export const CAM_FOV_DEG = 30; // vertical
export const PUSH_IN = 0.025; // 2.5% over the clip (limit is 3%)
export const CAM_LOOK_AT: [number, number, number] = [0, CUBE, 0];

const deg = Math.PI / 180;

export const cameraDistance0 =
  (CUBE * Math.cos(CAM_TILT_DEG * deg)) /
  (2 * CUBE_FRAME_FRAC * Math.tan((CAM_FOV_DEG / 2) * deg));

export const cameraAt = (frame: number) => {
  const t = Math.min(Math.max(frame / (DURATION_IN_FRAMES - 1), 0), 1);
  const d = cameraDistance0 / (1 + PUSH_IN * t);
  const tilt = CAM_TILT_DEG * deg;
  return {
    position: [
      CAM_LOOK_AT[0],
      CAM_LOOK_AT[1] + d * Math.cos(tilt),
      CAM_LOOK_AT[2] + d * Math.sin(tilt),
    ] as [number, number, number],
    lookAt: CAM_LOOK_AT,
    distance: d,
    fov: CAM_FOV_DEG,
  };
};

// The printed sheet. It is slightly larger than what the camera sees.
export const PAPER_W = 19.2;
export const PAPER_H = 10.8;
export const PAPER_Z0 = -0.47; // centre of the sheet (z grows towards the viewer)
export const PAPER_TEX_W = 8192;
export const PAPER_TEX_H = 4608;

// Where things sit on the sheet, in world z (screen-up is -z).
export const DASHED_Z = -4.55; // dashed rule near the top of frame
export const CHART_TOP_Z = -3.85;
export const CHART_BOTTOM_Z = 2.75;
export const CHART_CENTRE_Z = 0.0; // the line passes under the cube row
export const VOLUME_BASE_Z = 4.32; // volume bars grow up from just below frame bottom
export const VOLUME_MAX_H = 1.45;

// Key light: from upper-left, fairly low, shining through a perforated /
// woven pattern. The light and its target translate together sideways, so the
// projected pattern drifts while the shadow direction stays put.
export const KEY_POS: [number, number, number] = [-11, 16, -8];
export const KEY_TARGET: [number, number, number] = [0, 0, -0.4];
export const KEY_DRIFT_X = 0.42; // world units over the whole clip
export const keyLightAt = (frame: number) => {
  const t = Math.min(Math.max(frame / (DURATION_IN_FRAMES - 1), 0), 1);
  const dx = KEY_DRIFT_X * t;
  return {
    position: [KEY_POS[0] + dx, KEY_POS[1], KEY_POS[2]] as [number, number, number],
    target: [KEY_TARGET[0] + dx, KEY_TARGET[1], KEY_TARGET[2]] as [number, number, number],
  };
};

// Timing of the reveal.
export const FIRST_DROP_FRAME = 15;
export const ALL_STILL_BY_FRAME = 120;
export const REST_STILL_FRAME = 200;
