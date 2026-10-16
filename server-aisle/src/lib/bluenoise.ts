import { DataTexture, NearestFilter, RedFormat, RepeatWrapping, UnsignedByteType } from "three";
import { mulberry32 } from "./random";

// 64x64 blue-noise threshold map built with void-and-cluster from a fixed
// seed. Generated once per thread at module level; deterministic.
const N = 64;
const SIGMA = 1.5;

const build = (): Uint8Array => {
  const size = N * N;
  // Toroidal Gaussian look-up table.
  const lut = new Float32Array(size);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = Math.min(x, N - x);
      const dy = Math.min(y, N - y);
      lut[y * N + x] = Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
    }
  const energy = new Float32Array(size);
  const bits = new Uint8Array(size);
  const apply = (idx: number, sign: number) => {
    const px = idx % N;
    const py = (idx / N) | 0;
    for (let y = 0; y < N; y++) {
      const ry = ((y - py + N) % N) * N;
      const row = y * N;
      for (let x = 0; x < N; x++) energy[row + x] += sign * lut[ry + ((x - px + N) % N)];
    }
  };
  const tightest = () => {
    let best = -1;
    let bv = -Infinity;
    for (let i = 0; i < size; i++) if (bits[i] && energy[i] > bv) { bv = energy[i]; best = i; }
    return best;
  };
  const largestVoid = () => {
    let best = -1;
    let bv = Infinity;
    for (let i = 0; i < size; i++) if (!bits[i] && energy[i] < bv) { bv = energy[i]; best = i; }
    return best;
  };
  const rng = mulberry32(0xb1ee5);
  const initial = Math.floor(size * 0.1);
  let placed = 0;
  while (placed < initial) {
    const i = Math.floor(rng() * size);
    if (!bits[i]) { bits[i] = 1; apply(i, 1); placed++; }
  }
  // Relax into a well-spread prototype pattern.
  for (let iter = 0; iter < size; iter++) {
    const c = tightest();
    bits[c] = 0; apply(c, -1);
    const v = largestVoid();
    if (v === c) { bits[c] = 1; apply(c, 1); break; }
    bits[v] = 1; apply(v, 1);
  }
  const rank = new Int32Array(size);
  const proto = bits.slice();
  const protoEnergy = energy.slice();
  // Phase 1: rank the prototype's points by removing tightest clusters.
  let r = initial - 1;
  while (r >= 0) {
    const c = tightest();
    bits[c] = 0; apply(c, -1);
    rank[c] = r--;
  }
  bits.set(proto); energy.set(protoEnergy);
  // Phase 2+3: fill the largest voids.
  for (let k = initial; k < size; k++) {
    const v = largestVoid();
    bits[v] = 1; apply(v, 1);
    rank[v] = k;
  }
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = Math.floor((rank[i] * 256) / size);
  return out;
};

const DATA = build();

export const makeBlueNoiseTexture = () => {
  const tex = new DataTexture(DATA, N, N, RedFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.minFilter = tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
};
