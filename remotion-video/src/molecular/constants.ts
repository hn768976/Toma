// Shared timing + sizing for the "Molecular Dreams" version set.
//
// Every version is authored once at BASE_WIDTH x BASE_HEIGHT (1080p) and
// re-rendered at 2x for the 4K compositions. Nothing in the scene is measured
// in pixels, so the only thing `resolutionScale` changes is sample counts for
// effects that are tuned in screen space (grain, bokeh radius, dust size).

export const FPS = 30;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

/** Seconds -> whole frames at 30fps, matching each source reference. */
export const secondsToFrames = (seconds: number): number =>
  Math.round(seconds * FPS);
