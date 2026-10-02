export const FPS = 30;
export const LOOP_FRAMES = 600; // 20 s

/** Loop phase in [0, 1). Frame 600 is exactly frame 0. */
export const loopPhase = (frame: number) =>
  (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
