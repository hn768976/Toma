// Loop timing. All motion is a whole number of cycles over LOOP frames,
// so frame LOOP renders exactly like frame 0.
export const FPS = 30;
export const LOOP = 600;
export const TAU = Math.PI * 2;

// Loop check only: don't wrap the frame, so a non-whole cycle count would show.
const NO_WRAP = process.env.REMOTION_NO_WRAP === "1";

/** Phase 0..1 of `cycles` cycles over the loop (cycles must be whole for a seamless loop). */
export const phase = (frame: number, cycles = 1) => {
  const f = NO_WRAP ? frame : ((frame % LOOP) + LOOP) % LOOP;
  const p = (f * cycles) / LOOP;
  return p - Math.floor(p);
};
/** sin of `cycles` whole cycles over the loop, with an optional phase offset (turns). */
export const wave = (frame: number, cycles = 1, offset = 0) =>
  Math.sin(TAU * (phase(frame, cycles) + offset));
export const cwave = (frame: number, cycles = 1, offset = 0) =>
  Math.cos(TAU * (phase(frame, cycles) + offset));
