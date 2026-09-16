// Timing and base geometry for the neon light-streak compositions.
//
// The source clip this was rebuilt from is 14.614s @ 29.97fps (438 frames).
// We keep the frame count and move to a clean 30fps, so the render is
// 14.6s — the same length, on a broadcast-friendly frame rate.
export const FPS = 30;
export const DURATION_IN_FRAMES = 438;

// Every coordinate in this piece is authored against a 1920x1080 viewBox and
// then scaled by the SVG, so the 4K compositions are true vector 4K rather
// than an upscale. Only CSS blur radii (which are in device pixels) have to
// be multiplied by `resolutionScale`.
export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- The wave axis -------------------------------------------------------
// The whole ribbon is a sine wave living on a straight axis that runs from
// off-screen bottom-left to off-screen top-right. `s` is the normalised
// distance travelled along that axis, 0 -> 1.
export const AXIS_ORIGIN = { x: -320, y: 940 };
export const AXIS_ANGLE_DEG = -16.5;
export const AXIS_LENGTH = 2700;

// How many points each strand is sampled at before being smoothed into a
// path. High enough that the curve never facets, even at 4K.
export const SAMPLES = 150;
