export const FPS = 30;
export const LOOP_FRAMES = 600;
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Loop phase in [0, 1). Frame 600 maps to exactly the same value as frame 0, so every
// periodic term built on it (whole cycles only) closes bit-exactly.
export const loopPhase = (frame: number) =>
  (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;

export const TAU = Math.PI * 2;
