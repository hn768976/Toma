/** Every composition is a 600-frame (20 s @ 30 fps) seamless loop. */
export const LOOP = 600;
export const FPS = 30;

/** Loop phase in [0, 1). Frame 600 maps back to exactly 0. */
export const phase = (frame: number) => (((frame % LOOP) + LOOP) % LOOP) / LOOP;

/** Angle after `turns` whole turns per loop (turns must be an integer). */
export const turnAngle = (frame: number, turns: number) =>
  2 * Math.PI * turns * phase(frame);
