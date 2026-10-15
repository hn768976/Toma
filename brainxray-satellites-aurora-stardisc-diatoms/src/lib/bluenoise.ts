// 64x64 blue-noise threshold map via void-and-cluster (Ulichney), generated
// once, deterministically, at module level.
import { mulberry32 } from "./rand";

const N = 64;
const SIGMA = 1.5;

const buildKernel = () => {
  const k = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = Math.min(x, N - x);
      const dy = Math.min(y, N - y);
      k[y * N + x] = Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
    }
  return k;
};

const generate = (): Uint8Array => {
  const K = buildKernel();
  const total = N * N;
  const bin = new Uint8Array(total);
  const energy = new Float32Array(total);
  const apply = (i: number, sign: number) => {
    const ix = i % N;
    const iy = (i / N) | 0;
    for (let y = 0; y < N; y++) {
      const ky = ((y - iy + N) % N) * N;
      const row = y * N;
      for (let x = 0; x < N; x++) energy[row + x] += sign * K[ky + ((x - ix + N) % N)];
    }
  };
  const tightestCluster = () => {
    let best = -1, bv = -Infinity;
    for (let i = 0; i < total; i++) if (bin[i] && energy[i] > bv) { bv = energy[i]; best = i; }
    return best;
  };
  const largestVoid = () => {
    let best = -1, bv = Infinity;
    for (let i = 0; i < total; i++) if (!bin[i] && energy[i] < bv) { bv = energy[i]; best = i; }
    return best;
  };
  const rnd = mulberry32(1234567);
  const initial = Math.floor(total / 10);
  let placed = 0;
  while (placed < initial) {
    const i = Math.floor(rnd() * total);
    if (!bin[i]) { bin[i] = 1; apply(i, 1); placed++; }
  }
  // Relax initial pattern.
  for (let it = 0; it < 4 * total; it++) {
    const c = tightestCluster();
    bin[c] = 0; apply(c, -1);
    const v = largestVoid();
    if (v === c) { bin[c] = 1; apply(c, 1); break; }
    bin[v] = 1; apply(v, 1);
  }
  const rank = new Int32Array(total);
  const proto = bin.slice();
  const protoEnergy = energy.slice();
  // Phase 1: rank the initial points by removing tightest clusters.
  let ones = initial;
  while (ones > 0) {
    const c = tightestCluster();
    bin[c] = 0; apply(c, -1);
    ones--;
    rank[c] = ones;
  }
  bin.set(proto);
  energy.set(protoEnergy);
  // Phase 2+3: fill largest voids.
  for (let r = initial; r < total; r++) {
    const v = largestVoid();
    bin[v] = 1; apply(v, 1);
    rank[v] = r;
  }
  const out = new Uint8Array(total * 4);
  for (let i = 0; i < total; i++) {
    const v = Math.floor(((rank[i] + 0.5) / total) * 256);
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
};

export const BLUE_NOISE_SIZE = N;
let cached: Uint8Array | null = null;
export const blueNoiseRGBA = () => (cached ??= generate());
