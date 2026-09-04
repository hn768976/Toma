// Seeded value noise + fbm. Used for the sky mottling, the Milky Way band and
// its dust lanes. Everything is a pure function of (seed, x, y) so it renders
// identically on every worker and every frame.
import { mulberry32 } from "../particle-ring/random";

export type Noise2D = (x: number, y: number) => number;

const TABLE = 256;
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export const makeNoise2D = (seed: number): Noise2D => {
  const rand = mulberry32(seed);

  const source = new Uint8Array(TABLE);
  for (let i = 0; i < TABLE; i++) source[i] = i;
  for (let i = TABLE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = source[i];
    source[i] = source[j];
    source[j] = tmp;
  }

  const perm = new Uint8Array(TABLE * 2);
  for (let i = 0; i < TABLE * 2; i++) perm[i] = source[i & (TABLE - 1)];

  const values = new Float32Array(TABLE);
  for (let i = 0; i < TABLE; i++) values[i] = rand();

  return (x, y) => {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const xi = fx & (TABLE - 1);
    const yi = fy & (TABLE - 1);
    const u = fade(x - fx);
    const v = fade(y - fy);

    const v00 = values[perm[perm[xi] + yi] & (TABLE - 1)];
    const v10 = values[perm[perm[xi + 1] + yi] & (TABLE - 1)];
    const v01 = values[perm[perm[xi] + yi + 1] & (TABLE - 1)];
    const v11 = values[perm[perm[xi + 1] + yi + 1] & (TABLE - 1)];

    const a = v00 + (v10 - v00) * u;
    const b = v01 + (v11 - v01) * u;
    return a + (b - a) * v;
  };
};

export const fbm = (
  noise: Noise2D,
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
) => {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x * frequency, y * frequency);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
};

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
