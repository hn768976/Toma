import { mulberry32 } from "./random";

// Void-and-cluster blue noise (Ulichney 1993), toroidal, computed once at module level.
// Returns ranks normalised to [0,1) for an N x N tile.
export const BLUE_NOISE_SIZE = 64;

const makeBlueNoise = (n: number, seed: number): Float32Array => {
  const total = n * n;
  const sigma = 1.5;
  const lut = new Float32Array(total);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = Math.min(x, n - x);
      const dy = Math.min(y, n - y);
      lut[y * n + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  }
  const energy = new Float32Array(total);
  const bits = new Uint8Array(total);
  const splat = (idx: number, sign: number) => {
    const px = idx % n;
    const py = (idx / n) | 0;
    for (let y = 0; y < n; y++) {
      const ry = ((y - py + n) % n) * n;
      const row = y * n;
      for (let x = 0; x < n; x++) energy[row + x] += sign * lut[ry + ((x - px + n) % n)];
    }
  };
  const tightest = () => {
    let best = -1;
    let bestE = -Infinity;
    for (let i = 0; i < total; i++) if (bits[i] && energy[i] > bestE) { bestE = energy[i]; best = i; }
    return best;
  };
  const largestVoid = () => {
    let best = -1;
    let bestE = Infinity;
    for (let i = 0; i < total; i++) if (!bits[i] && energy[i] < bestE) { bestE = energy[i]; best = i; }
    return best;
  };
  const rng = mulberry32(seed);
  const initialOnes = Math.floor(total * 0.1);
  let placed = 0;
  while (placed < initialOnes) {
    const i = Math.floor(rng() * total);
    if (!bits[i]) { bits[i] = 1; splat(i, 1); placed++; }
  }
  // Relax the initial pattern.
  for (let iter = 0; iter < total; iter++) {
    const c = tightest();
    bits[c] = 0; splat(c, -1);
    const v = largestVoid();
    if (v === c) { bits[c] = 1; splat(c, 1); break; }
    bits[v] = 1; splat(v, 1);
  }
  const rank = new Int32Array(total).fill(-1);
  const proto = bits.slice();
  const protoEnergy = energy.slice();
  // Phase 1: remove clusters, ranks below the initial count.
  let ones = initialOnes;
  while (ones > 0) {
    const c = tightest();
    bits[c] = 0; splat(c, -1);
    ones--;
    rank[c] = ones;
  }
  bits.set(proto);
  energy.set(protoEnergy);
  // Phase 2+3: fill voids up to the full tile.
  ones = initialOnes;
  while (ones < total) {
    const v = largestVoid();
    bits[v] = 1; splat(v, 1);
    rank[v] = ones;
    ones++;
  }
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) out[i] = (rank[i] + 0.5) / total;
  return out;
};

export const BLUE_NOISE = makeBlueNoise(BLUE_NOISE_SIZE, 0x5eed1234);
