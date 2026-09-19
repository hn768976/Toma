// Shared timing + sizing for the four abstract background plates.
//
// Every plate is authored in a 1920x1080 "design space". The 4K compositions
// are the exact same scene with `resolutionScale: 2`, so a 4K frame is a
// pixel-doubled render of the 1080p frame rather than a different animation.

export const FPS = 30;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

/** Frame counts taken from the reference clips (all at 30 fps). */
export const PLATE_DURATION = {
  goldRain: 600, // 20.0s
  cosmicDust: 900, // 30.0s
  magentaNebula: 330, // 11.0s
  goldBand: 600, // 20.0s
} as const;
