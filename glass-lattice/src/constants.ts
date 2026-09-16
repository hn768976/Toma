/**
 * Timing is locked to the reference clip: 300 frames at 30 fps === 10.000s,
 * and the reference is a seamless loop (its last frame matches its first).
 *
 * Every animated value in `src/three/animation.ts` is a function of
 * `frame / DURATION_IN_FRAMES` with a period of exactly 1, so the loop here is
 * seamless too.
 */
export const FPS = 30;
export const DURATION_IN_FRAMES = 300;

export const WIDTH_4K = 3840;
export const HEIGHT_4K = 2160;
export const WIDTH_1080P = 1920;
export const HEIGHT_1080P = 1080;
