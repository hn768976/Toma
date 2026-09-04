// Composition is authored at 4K; every size below is expressed either as a
// fraction of the frame or in SVG viewBox units, so a 1080p preview
// (`--scale=0.5`) is pixel-identical in layout to the 4K render.

export const FPS = 30;
export const DURATION_IN_FRAMES = 360; // 12s, seamless loop
export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;

// The plane's own coordinate system. The SVG keeps this aspect ratio, so one
// viewBox unit is always the same fraction of the frame width.
export const VB_W = 2000;
export const VB_H = 1400;

// Plane width as a multiple of the frame width. The plane overfills the frame
// on every edge so elements are cropped rather than floating in space.
export const PLANE_SCALE = 1.8;

// 1 viewBox unit = frameWidth * PLANE_SCALE / VB_W px
//               = 3.456 px at 3840 wide, 1.728 px at 1920 wide.
// HAIR is therefore ~2px at 4K and ~1px at 1080p — the hairline the spec asks for.
export const HAIR = 0.6;

// Plane rake.
export const ROT_X = 9; // degrees — layout recedes toward the top
export const ROT_Z = -12; // degrees — horizontals run uphill to the right
export const PERSPECTIVE = 1.6; // multiple of frame width

// Whole-plane drift, in viewBox units. One full ellipse per loop.
export const DRIFT_X = 34;
export const DRIFT_Y = 19;

// Radar sweep: integer revolutions per loop.
export const SWEEP_REVOLUTIONS = 1;
