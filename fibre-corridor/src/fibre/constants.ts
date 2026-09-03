/** Composition constants. The whole piece is authored at 4K. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 375 frames @ 30fps = 12.5s. Every periodic term below closes on this. */
export const LOOP = 375;

/**
 * Default depth-of-field bucket edges. Depth `d` is 0 at the horizon, 1 at
 * the camera. Each variant may move them: where the focal band sits depends
 * on how the geometry maps depth onto the frame, and a corridor and a tube do
 * not map it the same way.
 */
export const DOF_NEAR = 0.58;
export const DOF_FAR = 0.18;
/** Cross-fade width between buckets, in depth units. */
export const DOF_FEATHER = 0.07;
/** Blur radius per bucket at 4K, in px. */
export const BLUR_NEAR = 28;
export const BLUR_MID = 1.5;
export const BLUR_FAR = 7;

/** Strand stroke widths at 4K, in px. */
export const STRAND_W_MIN = 3.0;
export const STRAND_W_MAX = 20;

/** Samples per strand section. */
export const SAMPLES_RUN = 56;
export const SAMPLES_ARC = 30;
export const SAMPLES_WALL = 26;
export const SAMPLES_TUNNEL = 96;

/** Polygon chunk length, in samples, used for tapered variable-width fills. */
export const CHUNK = 6;
