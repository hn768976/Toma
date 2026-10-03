import { mulberry32 } from "./rng";

/**
 * Seeded 2D gradient (Perlin-style) noise in JS. Used to drive slow motion
 * paths; for a seamless loop it is sampled around a circle in time:
 *   n(cx + R cos(2πt), cy + R sin(2πt)).
 */
export const makeNoise2D = (seed: number) => {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grads = Array.from({ length: 256 }, () => {
    const a = rng() * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)] as const;
  });
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const dot = (ix: number, iy: number, x: number, y: number) => {
    const g = grads[perm[(ix & 255) + perm[iy & 255]]];
    return g[0] * (x - ix) + g[1] * (y - iy);
  };
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const sx = fade(x - x0);
    const sy = fade(y - y0);
    const n0 = dot(x0, y0, x, y) + sx * (dot(x0 + 1, y0, x, y) - dot(x0, y0, x, y));
    const n1 = dot(x0, y0 + 1, x, y) + sx * (dot(x0 + 1, y0 + 1, x, y) - dot(x0, y0 + 1, x, y));
    return (n0 + sy * (n1 - n0)) * 1.4142;
  };
};

/** Loop-safe noise: phase in [0,1) maps onto a circle of radius r in noise space. */
export const loopNoise = (
  noise: (x: number, y: number) => number,
  phase: number,
  cx: number,
  cy: number,
  r: number,
) => {
  const a = phase * Math.PI * 2;
  return noise(cx + r * Math.cos(a), cy + r * Math.sin(a));
};
