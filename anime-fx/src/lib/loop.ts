import { mod } from "./math";

// 10 s loops at 30 fps, animated on twos: 150 drawings per loop.
export const LOOP_FRAMES = 300;
export const LOOP_DRAWINGS = 150;

// Drawing index for a looping composition. Frame 300 maps to drawing 0, so
// a 301-frame render ends on exactly the first frame.
export const loopDrawing = (frame: number) =>
  Math.floor(mod(frame, LOOP_FRAMES) / 2);

// Life-cycle helper for elements that are born, live P drawings and are
// replaced. P must divide LOOP_DRAWINGS so the schedule closes.
export const lifecycle = (d: number, period: number, offset: number) => {
  const t = d + offset;
  const cycles = LOOP_DRAWINGS / period;
  return {
    cycle: Math.floor(t / period) % cycles,
    age: t % period,
    period,
  };
};
