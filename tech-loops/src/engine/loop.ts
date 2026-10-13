/** Every composition is a 600-frame (20 s @ 30 fps) seamless loop. */
export const LOOP = 600;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/**
 * Phase in [0, 1) of a motion that repeats `k` times per loop. `k` must be a
 * whole number for the loop to close; the integer modulo keeps it exact, so
 * frame 600 reproduces frame 0 bit for bit (and a non-whole k would not).
 */
export const cyc = (frame: number, k = 1) => (((k * frame) % LOOP) + LOOP) % LOOP / LOOP;
export const phaseOf = (frame: number) => cyc(frame, 1);

export const TAU = Math.PI * 2;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
