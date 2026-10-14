// 64x64 blue-noise tile by void-and-cluster (Ulichney), built once at load
// from a seeded PRNG. Used to dither the soft backdrops.
import * as THREE from "three";
import { mulberry32 } from "./random";

const N = 64;
const SIGMA = 1.5;

const buildRanks = (seed: number): Float32Array => {
  const size = N * N;
  const rng = mulberry32(seed);
  const R = 6;
  const kernel: number[] = [];
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++)
      kernel.push(Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA)));
  const addEnergy = (e: Float32Array, idx: number, sign: number) => {
    const x0 = idx % N, y0 = (idx / N) | 0;
    let k = 0;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const x = (x0 + dx + N) % N, y = (y0 + dy + N) % N;
        e[y * N + x] += sign * kernel[k++];
      }
  };
  const pattern = new Uint8Array(size);
  const energy = new Float32Array(size);
  const initial = Math.floor(size * 0.1);
  let placed = 0;
  while (placed < initial) {
    const i = Math.floor(rng() * size);
    if (!pattern[i]) { pattern[i] = 1; addEnergy(energy, i, 1); placed++; }
  }
  const tightest = (p: Uint8Array, e: Float32Array) => {
    let best = -1, bv = -Infinity;
    for (let i = 0; i < size; i++) if (p[i] && e[i] > bv) { bv = e[i]; best = i; }
    return best;
  };
  const largestVoid = (p: Uint8Array, e: Float32Array) => {
    let best = -1, bv = Infinity;
    for (let i = 0; i < size; i++) if (!p[i] && e[i] < bv) { bv = e[i]; best = i; }
    return best;
  };
  // Relax the initial pattern.
  for (let iter = 0; iter < size; iter++) {
    const c = tightest(pattern, energy);
    pattern[c] = 0; addEnergy(energy, c, -1);
    const v = largestVoid(pattern, energy);
    if (v === c) { pattern[c] = 1; addEnergy(energy, c, 1); break; }
    pattern[v] = 1; addEnergy(energy, v, 1);
  }
  const rank = new Float32Array(size);
  // Phase 1: remove clusters from the initial pattern.
  const p1 = pattern.slice();
  const e1 = energy.slice();
  for (let r = initial - 1; r >= 0; r--) {
    const c = tightest(p1, e1);
    p1[c] = 0; addEnergy(e1, c, -1);
    rank[c] = r;
  }
  // Phase 2 and 3: fill voids.
  const p2 = pattern.slice();
  const e2 = energy.slice();
  for (let r = initial; r < size; r++) {
    const v = largestVoid(p2, e2);
    p2[v] = 1; addEnergy(e2, v, 1);
    rank[v] = r;
  }
  for (let i = 0; i < size; i++) rank[i] = (rank[i] + 0.5) / size;
  return rank;
};

let cached: THREE.DataTexture | null = null;

export const getBlueNoiseTexture = () => {
  if (cached) return cached;
  const ranks = buildRanks(0x5eed);
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const v = Math.round(ranks[i] * 255);
    data[i * 4] = v;
    // Second channel: the same tile shifted, for a decorrelated sample.
    const j = (((i / N) | 0) + 23) % N * N + ((i % N) + 41) % N;
    data[i * 4 + 1] = Math.round(ranks[j] * 255);
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
};
