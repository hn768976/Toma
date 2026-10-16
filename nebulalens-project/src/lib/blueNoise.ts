// 64×64 blue-noise threshold map, made with Ulichney's void-and-cluster method
// from a fixed seed. Built once per page (module level) and used for the final
// ±1/255 dither of every composition.
import { mulberry32 } from "./random";

export const BLUE_NOISE_SIZE = 64;

const build = (): Uint8Array => {
  const N = BLUE_NOISE_SIZE;
  const count = N * N;
  const sigma = 1.5;
  // Toroidal gaussian kernel, indexed by (dx, dy) offsets.
  const kernel = new Float32Array(count);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = Math.min(x, N - x);
      const dy = Math.min(y, N - y);
      kernel[y * N + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  }
  const energy = new Float32Array(count);
  const bits = new Uint8Array(count);
  const splat = (idx: number, sign: number) => {
    const px = idx % N;
    const py = (idx / N) | 0;
    for (let y = 0; y < N; y++) {
      const ky = ((y - py + N) % N) * N;
      const row = y * N;
      for (let x = 0; x < N; x++) {
        energy[row + x] += sign * kernel[ky + ((x - px + N) % N)];
      }
    }
  };
  const tightestCluster = () => {
    let best = -1;
    let bestE = -Infinity;
    for (let i = 0; i < count; i++) {
      if (bits[i] && energy[i] > bestE) {
        bestE = energy[i];
        best = i;
      }
    }
    return best;
  };
  const largestVoid = () => {
    let best = -1;
    let bestE = Infinity;
    for (let i = 0; i < count; i++) {
      if (!bits[i] && energy[i] < bestE) {
        bestE = energy[i];
        best = i;
      }
    }
    return best;
  };

  // Initial binary pattern: ~10% of pixels, then relax it.
  const rng = mulberry32(0x5eed);
  const initial = Math.floor(count * 0.1);
  let placed = 0;
  while (placed < initial) {
    const i = Math.floor(rng() * count);
    if (!bits[i]) {
      bits[i] = 1;
      splat(i, 1);
      placed++;
    }
  }
  for (;;) {
    const c = tightestCluster();
    bits[c] = 0;
    splat(c, -1);
    const v = largestVoid();
    if (v === c) {
      bits[c] = 1;
      splat(c, 1);
      break;
    }
    bits[v] = 1;
    splat(v, 1);
  }
  const prototype = bits.slice();
  const protoEnergy = energy.slice();
  const rank = new Int32Array(count);

  // Phase 1: remove clusters from the prototype.
  let ones = initial;
  for (let r = ones - 1; r >= 0; r--) {
    const c = tightestCluster();
    bits[c] = 0;
    splat(c, -1);
    rank[c] = r;
  }
  // Phase 2 & 3: fill voids starting from the prototype.
  bits.set(prototype);
  energy.set(protoEnergy);
  for (let r = ones; r < count; r++) {
    const v = largestVoid();
    bits[v] = 1;
    splat(v, 1);
    rank[v] = r;
  }
  ones = count;
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = Math.floor(((rank[i] + 0.5) / ones) * 256);
  }
  return out;
};

let cached: Uint8Array | null = null;
export const getBlueNoise = (): Uint8Array => {
  if (!cached) cached = build();
  return cached;
};
