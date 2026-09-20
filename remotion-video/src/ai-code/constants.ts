// Shared timing and sizing for the three "AI code" background plates.
//
// All three are 10s at 30fps and seamlessly loopable: every periodic
// motion below uses a period that divides DURATION_IN_FRAMES, and the
// scrolling scenes travel exactly one spatial period over the clip, so
// the last frame hands off cleanly to frame 0.

export const FPS = 30;
export const DURATION_IN_FRAMES = 300; // 10.0s, matching the references

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

/** 1 = 1080p, 2 = 2160p (4K UHD). */
export type ResolutionScale = 1 | 2;
