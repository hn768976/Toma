/**
 * The build sequence, in frames at 30fps. Not a loop: the clip builds from
 * nothing to a solid map and holds.
 */
export const TIMING = {
  /** LOADING ring: up at the open, gone by ~frame 70. */
  loadingIn: 0,
  loadingHold: 52,
  loadingOut: 70,

  /** The outline traces on. The signature beat. */
  traceStart: 60,
  traceEnd: 170,

  /** The fill arrives as horizontal scanline stripes, bottom to top. */
  stripesStart: 150,
  stripesEnd: 260,

  /** Stripes consolidate: gaps close, the shape becomes continuous. */
  solidStart: 250,
  solidEnd: 310,

  /** Hold on the solid map. */
  holdStart: 300,
} as const;

export const DURATION_IN_FRAMES = 360;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
