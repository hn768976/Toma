import { mulberry32 } from "./random";

// Seeded 2D Perlin gradient noise, built once per seed (module-level use).
export const makePerlin2 = (seed: number) => {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256);
  const gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = rng() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const g = (ix: number, iy: number, dx: number, dy: number) => {
      const h = perm[perm[ix] + iy];
      return gx[h] * dx + gy[h] * dy;
    };
    const n00 = g(X, Y, xf, yf);
    const n10 = g(X + 1, Y, xf - 1, yf);
    const n01 = g(X, Y + 1, xf, yf - 1);
    const n11 = g(X + 1, Y + 1, xf - 1, yf - 1);
    const u = fade(xf);
    const v = fade(yf);
    return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
  };
};

// Ridged multifractal: sharp crests, as in a rugged mountain range.
export const ridged = (
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves = 5,
  lacunarity = 2.03,
  gain = 0.5,
) => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let prev = 1;
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(noise(x * freq, y * freq) * 1.4);
    n = n * n;
    sum += n * amp * prev;
    prev = Math.min(1, n * 1.6);
    freq *= lacunarity;
    amp *= gain;
  }
  return sum;
};
