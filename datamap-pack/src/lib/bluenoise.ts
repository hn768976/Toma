import { mulberry32 } from "./random";

// 64x64 blue-noise threshold map built with void-and-cluster, generated once
// at module level from a fixed seed. Values are ranks 0..4095 -> [0,1).
const N = 64;
const SIGMA = 1.9;

const build = (): Uint8Array => {
  const rng = mulberry32(0xb1ae);
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
  const on = new Uint8Array(size);
  const splat = (i: number, s: number) => {
    const px = i % N;
    const py = (i / N) | 0;
    for (let y = 0; y < N; y++) {
      const ry = ((y - py + N) % N) * N;
      const row = y * N;
      for (let x = 0; x < N; x++) {
        energy[row + x] += s * kernel[ry + ((x - px + N) % N)];
      }
    }
  };
  // Initial binary pattern: ~10% random points, then relax.
  const initial = Math.floor(size * 0.1);
  let placed = 0;
  while (placed < initial) {
    const i = Math.floor(rng() * size);
    if (!on[i]) {
      on[i] = 1;
      splat(i, 1);
      placed++;
    }
  }
  const tightest = () => {
    let best = -1;
    let bv = -Infinity;
    for (let i = 0; i < size; i++) if (on[i] && energy[i] > bv) { bv = energy[i]; best = i; }
    return best;
  };
  const voidest = () => {
    let best = -1;
    let bv = Infinity;
    for (let i = 0; i < size; i++) if (!on[i] && energy[i] < bv) { bv = energy[i]; best = i; }
    return best;
  };
  for (let iter = 0; iter < size; iter++) {
    const t = tightest();
    on[t] = 0;
    splat(t, -1);
    const v = voidest();
    if (v === t) { on[t] = 1; splat(t, 1); break; }
    on[v] = 1;
    splat(v, 1);
  }
  const rank = new Int32Array(size);
  const proto = on.slice();
  const protoEnergy = energy.slice();
  // Phase 1: remove points from the prototype, ranking downward.
  let ones = 0;
  for (let i = 0; i < size; i++) ones += on[i];
  let r = ones - 1;
  while (r >= 0) {
    const t = tightest();
    on[t] = 0;
    splat(t, -1);
    rank[t] = r--;
  }
  // Phase 2/3: from the prototype, add points into voids, ranking upward.
  on.set(proto);
  energy.set(protoEnergy);
  r = ones;
  while (r < size) {
    const v = voidest();
    on[v] = 1;
    splat(v, 1);
    rank[v] = r++;
  }
  const out = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const val = Math.floor((rank[i] / size) * 256);
    out[i * 4] = val;
    out[i * 4 + 1] = val;
    out[i * 4 + 2] = val;
    out[i * 4 + 3] = 255;
  }
  return out;
};

let cached: Uint8Array | null = null;
export const BLUE_NOISE_SIZE = N;
export const blueNoise = () => {
  if (!cached) cached = build();
  return cached;
};
