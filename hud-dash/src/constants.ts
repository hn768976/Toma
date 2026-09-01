/** Global timing / frame geometry. Everything periodic must close on LOOP. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 390 frames @ 30fps = 13.0s. 390 = 2 * 3 * 5 * 13 — lots of usable divisors. */
export const LOOP = 390;
