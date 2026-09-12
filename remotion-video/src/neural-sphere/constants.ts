// Timing, geometry and density config for the neural-sphere core.
//
// Everything here is authored at 1x (1080p) and scaled up for the 4K
// compositions through `computeSceneScale()`, so both resolutions render
// the identical scene and only the *pixel* quantities (line widths, point
// sizes) change. Geometry lives in abstract world units — the camera
// framing is what maps it to the screen — so nothing in the 3D graph
// itself depends on the output resolution.

export const FPS = 30;

// 20s, matching the reference clip exactly (600 frames @ 30fps).
export const DURATION_IN_FRAMES = 600;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Core ------------------------------------------------------------
export const CORE_RADIUS = 0.5;

// --- Filaments (the branching "dendrites" radiating from the core) ----
export const FILAMENT_COUNT = 230;

// Samples per filament curve. Also the width of the baked curve texture
// that the travelling nodes ride along, so keep it a power of two.
export const FILAMENT_SAMPLES = 128;

// Where a filament leaves the core, and how far out it can reach.
export const FILAMENT_START_RADIUS = CORE_RADIUS * 1.02;
export const FILAMENT_MIN_LENGTH = 2.2;
export const FILAMENT_MAX_LENGTH = 17.5;

// Full ribbon width in *1080p pixels*, scaled for 4K. The shader draws a
// tight bright core inside a soft bleed, so the line reads roughly a
// third this wide; the rest is glow.
export const FILAMENT_WIDTH_PX = 3.1;

// --- Travelling nodes (bright dots riding the filaments) --------------
export const NODE_COUNT = 4600;
export const NODE_MIN_SIZE_PX = 2.6;
export const NODE_MAX_SIZE_PX = 8.0;

// Fraction of nodes drawn in the warm accent colour (the magenta specks
// in the reference) rather than the cool primary.
export const NODE_ACCENT_RATIO = 0.17;

// --- Background starfield --------------------------------------------
export const STAR_COUNT = 2300;
export const STAR_FIELD_INNER_RADIUS = 8;
export const STAR_FIELD_OUTER_RADIUS = 34;
export const STAR_MIN_SIZE_PX = 1.6;
export const STAR_MAX_SIZE_PX = 4.4;
export const STAR_ACCENT_RATIO = 0.22;

// --- Camera -----------------------------------------------------------
// Slow push-in over the full clip, mirroring the reference's drift.
export const CAMERA_START_Z = 9.6;
export const CAMERA_END_Z = 7.4;
export const CAMERA_FOV = 42;

// Bodily rotation of the whole neural structure (radians per second).
export const ROTATION_Y_RATE = 0.036;
export const ROTATION_Z_RATE = 0.011;

export type SceneScale = {
  width: number;
  height: number;
  /** 1 at 1080p, 2 at 4K. Multiplies every pixel-space quantity. */
  pixelScale: number;
};

export const computeSceneScale = (resolutionScale: number): SceneScale => ({
  width: BASE_WIDTH * resolutionScale,
  height: BASE_HEIGHT * resolutionScale,
  pixelScale: resolutionScale,
});
