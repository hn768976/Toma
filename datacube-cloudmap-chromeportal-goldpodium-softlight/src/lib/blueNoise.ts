import { DataTexture, NearestFilter, RedFormat, RepeatWrapping, UnsignedByteType } from "three";
import { mulberry32 } from "./random";

/**
 * 64×64 blue-noise threshold map, generated once with void-and-cluster
 * (Ulichney 1993) from a fixed seed. Pure function of the seed, so every
 * render thread builds the identical texture.
 */
const N = 64;
const SIGMA = 1.9;

const buildRanks = (): Uint8Array => {
  const size = N * N;
  // Toroidal gaussian kernel.
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
  const apply = (idx: number, sign: number) => {
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
  // Initial pattern: ~10% ones.
  const rng = mulberry32(0xb1e5);
  const ones = Math.floor(size * 0.1);
  let placed = 0;
  while (placed < ones) {
    const i = Math.floor(rng() * size);
    if (!bits[i]) { bits[i] = 1; apply(i, 1); placed++; }
  }
  // Phase 0: relax to a well-distributed prototype.
  for (let iter = 0; iter < 4096; iter++) {
    const t = tightest();
    bits[t] = 0; apply(t, -1);
    const v = largestVoid();
    if (v === t) { bits[t] = 1; apply(t, 1); break; }
    bits[v] = 1; apply(v, 1);
  }
  const proto = bits.slice();
  const protoEnergy = energy.slice();
  const rank = new Uint16Array(size);
  // Phase 1: remove ones from tightest clusters, ranks ones-1 .. 0.
  let r = ones - 1;
  while (r >= 0) {
    const t = tightest();
    bits[t] = 0; apply(t, -1);
    rank[t] = r--;
  }
  // Phase 2/3: from the prototype, fill largest voids, ranks ones .. size-1.
  bits.set(proto);
  energy.set(protoEnergy);
  for (let k = ones; k < size; k++) {
    const v = largestVoid();
    bits[v] = 1; apply(v, 1);
    rank[v] = k;
  }
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = Math.floor((rank[i] * 256) / size);
  return out;
};

let cached: DataTexture | null = null;
export const getBlueNoiseTexture = (): DataTexture => {
  if (cached) return cached;
  const tex = new DataTexture(buildRanks(), N, N, RedFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
};
export const BLUE_NOISE_SIZE = N;
