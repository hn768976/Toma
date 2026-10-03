export const FPS = 30;
export const LOOP_FRAMES = 600; // 20 s
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const ASPECT = WIDTH / HEIGHT;

/**
 * Loop phase in [0, 1). Everything animated is a periodic function of this
 * value with whole-number cycles, so frame 600 is frame 0 and 599 -> 0 is as
 * smooth as any other step.
 */
export const loopPhase = (frame: number) =>
  (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;

export const TAU = Math.PI * 2;
