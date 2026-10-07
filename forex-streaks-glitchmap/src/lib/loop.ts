// Shared timing constants. Every animated quantity in the project is a
// function of (frame % LOOP_FRAMES) so frame 600 is identical to frame 0.
export const FPS = 30;
export const LOOP_FRAMES = 600; // 20 s
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const TAU = Math.PI * 2;

/** Loop frame in [0, 600). */
export const loopFrame = (frame: number): number => ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
/** Loop phase in [0, 1). */
export const loopPhase = (frame: number): number => loopFrame(frame) / LOOP_FRAMES;

export const clamp = (x: number, a = 0, b = 1): number => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
