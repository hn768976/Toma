// Deterministic 2D value noise + the fBm / ridged variants the nebula
// textures are built from.
//
// Everything here is a pure function of (x, y, seed) — no Math.random(),
// no Date.now(). Remotion renders frames out of order across worker
// tabs, so any hidden state would make the cloud structure flicker
// between frames.

const hash2 = (xi: number, yi: number, seed: number): number => {
  let h =
    Math.imul(xi, 374761393) +
    Math.imul(yi, 668265263) +
    Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

// Quintic smoothstep: zero 1st and 2nd derivative at the cell edges, so
// stacked octaves don't show the lattice as visible creases.
const smoother = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

export const valueNoise2D = (x: number, y: number, seed: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smoother(x - xi);
  const v = smoother(y - yi);

  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);

  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return top + (bottom - top) * v;
};

// Classic fractal Brownian motion — soft, cloud-like, roughly 0..1.
export const fbm2D = (
  x: number,
  y: number,
  seed: number,
  octaves: number,
): number => {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed + i * 131);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
};

// Ridged multifractal: folding the noise around its midpoint turns the
// smooth blobs of fBm into thread-like crests. That is what gives the
// nebula its wispy filaments rather than flat fog.
export const ridged2D = (
  x: number,
  y: number,
  seed: number,
  octaves: number,
): number => {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = valueNoise2D(x * freq, y * freq, seed + i * 197);
    const ridge = 1 - Math.abs(n * 2 - 1);
    sum += amp * ridge * ridge;
    norm += amp;
    amp *= 0.55;
    // Slightly irrational lacunarity keeps octaves from lining up into
    // a grid pattern.
    freq *= 2.03;
  }
  return sum / norm;
};

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
