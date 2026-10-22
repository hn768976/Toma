export const FPS = 30;
// Reference clip is 12.033s = 361 frames at 30fps.
export const DURATION_IN_FRAMES = 361;

// Compositions are authored at 4K; everything is drawn in "base units"
// of a 1920x1080 frame and multiplied by (width / BASE_WIDTH).
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// Focal length in base pixels. Together with the camera height/distance
// below this reproduces the reference framing: horizon near the vertical
// centre, ring centred ~82% down the frame, ~8 deg viewing elevation.
export const FOCAL = 2466;
export const CAM_HEIGHT = 0.843;
export const CAM_DISTANCE = 6;

// Timeline (frames)
export const RING_IN_START = 15;
export const RING_IN_END = 34;
export const SHOCK_START = 20;
export const SHOCK_END = 60;
export const STREAKS_START = 38;
export const ICONS_START = 52;
export const BARS_START = 95;
export const BARS_END = 165;
