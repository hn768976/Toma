// Every animated value comes from the Remotion frame. Looping looks use the
// frame folded into one 600-frame cycle, so frame 600 is exactly frame 0.
export const LOOP_FRAMES = 600;
export const loopFrame = (frame: number) =>
  ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
export const loopPhase = (frame: number) =>
  (loopFrame(frame) / LOOP_FRAMES) * Math.PI * 2;
