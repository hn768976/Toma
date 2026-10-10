// Shared timing / size constants for every composition.
export const FPS = 30;
export const LOOP_FRAMES = 600; // 20 s seamless loop
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Loop phase in [0, 1). frame 600 maps to exactly the same value as frame 0. */
export const loopPhase = (frame: number): number =>
  (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
