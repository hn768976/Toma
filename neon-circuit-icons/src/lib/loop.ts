// Loop constants. Every animated value is a function of t = frame / LOOP
// with whole-number frequencies, so frame 600 === frame 0.
export const FPS = 30;
export const LOOP = 600; // 20 s
export const TAU = Math.PI * 2;

export const loopT = (frame: number) => (((frame % LOOP) + LOOP) % LOOP) / LOOP;
export const wrap1 = (x: number) => x - Math.floor(x);
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
