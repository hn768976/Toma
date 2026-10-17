import { mulberry32 } from "./random";

/**
 * 64x64 tileable blue noise, built once by void-and-cluster (Ulichney 1993)
 * from a fixed seed. Returns ranks normalised to 0..255.
 */
const N = 64;
const SIGMA = 1.9;

const build = (): Uint8Array => {
  const size = N * N;
  const kernel = new Float32Array(size);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = Math.min(x, N - x);
      const dy = Math.min(y, N - y);
      kernel[y * N + x] = Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
    }
  }
  const energy = new Float32Array(size);
  const bits = new Uint8Array(size);
  const splat = (i: number, s: number) => {
    const px = i % N;
    const py = (i / N) | 0;
    for (let y = 0; y < N; y++) {
      const ky = ((y - py + N) % N) * N;
      const row = y * N;
      for (let x = 0; x < N; x++) {
        energy[row + x] += s * kernel[ky + ((x - px + N) % N)];
      }
    }
  };
  const argBest = (want: number, max: boolean) => {
    let best = -1;
    let bv = max ? -Infinity : Infinity;
    for (let i = 0; i < size; i++) {
      if (bits[i] !== want) continue;
      const e = energy[i];
      if (max ? e > bv : e < bv) {
        bv = e;
        best = i;
      }
    }
    return best;
  };
  const rng = mulberry32(0xb10e);
  const initial = Math.floor(size * 0.1);
  let placed = 0;
  while (placed < initial) {
    const i = Math.floor(rng() * size);
    if (!bits[i]) {
      bits[i] = 1;
      splat(i, 1);
      placed++;
    }
  }
  // Relax the initial pattern.
  for (let iter = 0; iter < size; iter++) {
    const c = argBest(1, true);
    bits[c] = 0;
    splat(c, -1);
    const v = argBest(0, false);
    if (v === c) {
      bits[c] = 1;
      splat(c, 1);
      break;
    }
    bits[v] = 1;
    splat(v, 1);
  }
  const rank = new Int32Array(size);
  const proto = bits.slice();
  const protoEnergy = energy.slice();
  // Phase 1: remove clusters from the prototype.
  let ones = initial;
  while (ones > 0) {
    const c = argBest(1, true);
    bits[c] = 0;
    splat(c, -1);
    ones--;
    rank[c] = ones;
  }
  bits.set(proto);
  energy.set(protoEnergy);
  // Phase 2/3: fill voids.
  for (let r = initial; r < size; r++) {
    const v = argBest(0, false);
    bits[v] = 1;
    splat(v, 1);
    rank[v] = r;
  }
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = Math.floor((rank[i] * 256) / size);
  return out;
};

let cached: Uint8Array | null = null;
export const blueNoise64 = () => {
  if (!cached) cached = build();
  return cached;
};
export const BLUE_NOISE_SIZE = N;
