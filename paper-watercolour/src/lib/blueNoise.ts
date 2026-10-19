import { mulberry32 } from "./random";

// 64x64 blue-noise threshold map via void-and-cluster (Ulichney 1993),
// computed once at module load from a fixed seed. Used for the final
// ±1/255 dither so washes and the paper vignette don't band.
const N = 64;
const SIGMA = 1.9;

const build = (): Uint8Array => {
  const size = N * N;
  const lut = new Float32Array(size);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = Math.min(x, N - x);
      const dy = Math.min(y, N - y);
      lut[y * N + x] = Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
    }
  const energy = new Float32Array(size);
  const bits = new Uint8Array(size);
  const toggle = (i: number, sign: number) => {
    const ix = i % N;
    const iy = (i / N) | 0;
    for (let y = 0; y < N; y++) {
      const row = ((y - iy + N) % N) * N;
      const out = y * N;
      for (let x = 0; x < N; x++) energy[out + x] += sign * lut[row + ((x - ix + N) % N)];
    }
  };
  const tightest = (want: number) => {
    let best = -1;
    let bv = -Infinity;
    for (let i = 0; i < size; i++) if (bits[i] === want && energy[i] > bv) (bv = energy[i]), (best = i);
    return best;
  };
  const largestVoid = () => {
    let best = -1;
    let bv = Infinity;
    for (let i = 0; i < size; i++) if (!bits[i] && energy[i] < bv) (bv = energy[i]), (best = i);
    return best;
  };
  const rng = mulberry32(1337);
  const ones = Math.floor(size / 10);
  let placed = 0;
  while (placed < ones) {
    const i = Math.floor(rng() * size);
    if (!bits[i]) (bits[i] = 1), toggle(i, 1), placed++;
  }
  for (let iter = 0; iter < 4096; iter++) {
    const c = tightest(1);
    bits[c] = 0;
    toggle(c, -1);
    const v = largestVoid();
    bits[v] = 1;
    toggle(v, 1);
    if (v === c) break;
  }
  const rank = new Int32Array(size);
  const proto = bits.slice();
  const protoE = energy.slice();
  for (let r = ones - 1; r >= 0; r--) {
    const c = tightest(1);
    bits[c] = 0;
    toggle(c, -1);
    rank[c] = r;
  }
  bits.set(proto);
  energy.set(protoE);
  for (let r = ones; r < size; r++) {
    const v = largestVoid();
    bits[v] = 1;
    toggle(v, 1);
    rank[v] = r;
  }
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = Math.floor((rank[i] * 256) / size);
  return out;
};

export const BLUE_NOISE_SIZE = N;
export const BLUE_NOISE: Uint8Array = build();
