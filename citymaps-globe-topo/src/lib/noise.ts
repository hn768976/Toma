import { Rng } from "./random";

const mod = (a: number, n: number) => ((a % n) + n) % n;
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

// Value noise on an integer lattice that repeats every `period` cells, so it
// tiles seamlessly. Returns roughly [-1, 1].
export const periodicNoise = (rng: Rng, period: number) => {
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rng() * 2 - 1;
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = fade(x - xi);
    const fy = fade(y - yi);
    const x0 = mod(xi, period);
    const x1 = mod(xi + 1, period);
    const y0 = mod(yi, period) * period;
    const y1 = mod(yi + 1, period) * period;
    const a = g[y0 + x0] + (g[y0 + x1] - g[y0 + x0]) * fx;
    const b = g[y1 + x0] + (g[y1 + x1] - g[y1 + x0]) * fx;
    return a + (b - a) * fy;
  };
};

// Fractal sum of periodic noises. `period` is the base lattice period; each
// octave doubles frequency and period so the sum still tiles.
export const periodicFbm = (rng: Rng, period: number, octaves: number) => {
  const layers = Array.from({ length: octaves }, (_, i) => periodicNoise(rng, period << i));
  return (x: number, y: number) => {
    let s = 0;
    let amp = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const f = 1 << i;
      s += layers[i](x * f, y * f) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return s / norm;
  };
};

// Non-periodic 2D value noise / fbm (used for the topo terrain).
export const valueNoise = (rng: Rng, size = 256) => periodicNoise(rng, size);
