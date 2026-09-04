// Composition is authored at 4K so it can be rendered at full resolution
// later; the preview deliverables are the same composition at --scale=0.5.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 900; // 30s, seamless loop

// Every length in the scene is expressed as a fraction of the frame and
// multiplied by this at draw time, so the look is resolution independent.
export const REF_WIDTH = 3840;

/** Scales a value authored against REF_WIDTH to the actual canvas width. */
export const px = (canvasWidth: number, value: number) =>
  (value * canvasWidth) / REF_WIDTH;

// The distant light: left of centre, reaching ~45% of frame height.
export const GLOW_X = 0.385;
export const GLOW_HEIGHT = 0.45;

// Ground band occupies the bottom ~12% of the frame.
export const GROUND_TOP = 0.88;
