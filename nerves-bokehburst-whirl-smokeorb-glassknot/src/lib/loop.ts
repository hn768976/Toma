/** Every composition is a 600-frame (20 s at 30 fps) seamless loop. */
export const LOOP_FRAMES = 600;
export const FPS = 30;

/** Loop phase in [0, 1). Every animated value is a periodic function of this. */
export const loopPhase = (frame: number) =>
  (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;

/** Grain seed: driven by frame % 600 so frame 600 reproduces frame 0. */
export const grainFrame = (frame: number) =>
  ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;

export const TAU = Math.PI * 2;
