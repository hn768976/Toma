import * as THREE from "three";
import { mulberry32 } from "./random";

/**
 * 64×64 blue-noise threshold map built in code (void-and-cluster, Ulichney
 * 1993) from a fixed seed — identical in every tab, no files needed.
 */
const N = 64;
const SIGMA = 1.9;
const R = 7; // kernel half-width (energy beyond is negligible)

const build = (): Uint8Array => {
  const size = N * N;
  const kernel: number[] = [];
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) kernel.push(Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA)));
  const energy = new Float64Array(size);
  const bits = new Uint8Array(size);
  const splat = (idx: number, sign: number) => {
    const x0 = idx % N;
    const y0 = (idx / N) | 0;
    let k = 0;
    for (let dy = -R; dy <= R; dy++) {
      const y = (y0 + dy + N) % N;
      for (let dx = -R; dx <= R; dx++) {
        const x = (x0 + dx + N) % N;
        energy[y * N + x] += sign * kernel[k++];
      }
    }
  };
  const tightest = (b: Uint8Array) => {
    let best = -1;
    let bv = -Infinity;
    for (let i = 0; i < size; i++) if (b[i] && energy[i] > bv) { bv = energy[i]; best = i; }
    return best;
  };
  const largestVoid = (b: Uint8Array) => {
    let best = -1;
    let bv = Infinity;
    for (let i = 0; i < size; i++) if (!b[i] && energy[i] < bv) { bv = energy[i]; best = i; }
    return best;
  };
  // Initial pattern: 10% seeded points, then relax.
  const rng = mulberry32(0xb1e5);
  const ones = Math.floor(size * 0.1);
  let placed = 0;
  while (placed < ones) {
    const i = Math.floor(rng() * size) % size;
    if (!bits[i]) { bits[i] = 1; splat(i, 1); placed++; }
  }
  for (let iter = 0; iter < size; iter++) {
    const c = tightest(bits);
    bits[c] = 0; splat(c, -1);
    const v = largestVoid(bits);
    if (v === c) { bits[c] = 1; splat(c, 1); break; }
    bits[v] = 1; splat(v, 1);
  }
  const rank = new Int32Array(size);
  const proto = bits.slice();
  const protoEnergy = energy.slice();
  // Phase 1: remove clusters from the prototype, ranks ones-1 .. 0.
  const b1 = proto.slice();
  for (let r = ones - 1; r >= 0; r--) {
    const c = tightest(b1);
    b1[c] = 0; splat(c, -1);
    rank[c] = r;
  }
  // Phase 2/3: fill voids from the prototype, ranks ones .. size-1.
  energy.set(protoEnergy);
  const b2 = proto.slice();
  for (let r = ones; r < size; r++) {
    const v = largestVoid(b2);
    b2[v] = 1; splat(v, 1);
    rank[v] = r;
  }
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = Math.floor(((rank[i] + 0.5) / size) * 256);
  return out;
};

let tex: THREE.DataTexture | null = null;
export const blueNoiseTexture = (): THREE.DataTexture => {
  if (!tex) {
    tex = new THREE.DataTexture(build(), N, N, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
  }
  return tex;
};
