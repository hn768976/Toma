// Timing and scene config for the particle-wave motion graphic.
// The composition is authored at 4K (3840x2160); everything that is
// measured in pixels is derived from the canvas height so the same
// component renders identically at any output scale (e.g. --scale=0.5
// for a 1080p delivery).

export const FPS = 30;

// 20s, matching the reference clip. Every wave in the height field
// completes a whole number of cycles over this span, so the last frame
// flows straight back into the first (seamless loop).
export const DURATION_IN_FRAMES = 600;

export const WIDTH_4K = 3840;
export const HEIGHT_4K = 2160;

// Particle grid in world units: lines run along z (into depth), with
// dots spaced evenly along each line.
export const GRID_X_MIN = -70;
export const GRID_X_MAX = 70;
export const GRID_Z_NEAR = -2;
export const GRID_Z_FAR = -190;
export const LINE_SPACING = 0.4;
export const DOT_SPACING = 0.24;
