import * as THREE from "three";

// Deterministic 64x64 blue-noise tile generated with the void-and-cluster
// "largest void" ranking (toroidal Gaussian energy, sigma 1.5). It is
// computed once at module load; ties resolve to the lowest index, so the
// result is identical on every machine and every render thread.
const N = 64;
const makeBlueNoise = (): Uint8Array => {
  const R = 6;
  const sigma = 1.5;
  const kernel: number[] = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      kernel.push(Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)));
    }
  }
  const energy = new Float64Array(N * N);
  const rank = new Int32Array(N * N).fill(-1);
  for (let r = 0; r < N * N; r++) {
    let best = -1;
    let bestE = Infinity;
    for (let i = 0; i < N * N; i++) {
      if (rank[i] < 0 && energy[i] < bestE) {
        bestE = energy[i];
        best = i;
      }
    }
    rank[best] = r;
    const bx = best % N;
    const by = (best / N) | 0;
    let k = 0;
    for (let dy = -R; dy <= R; dy++) {
      const y = (by + dy + N) % N;
      for (let dx = -R; dx <= R; dx++) {
        const x = (bx + dx + N) % N;
        energy[y * N + x] += kernel[k++];
      }
    }
  }
  const out = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const v = Math.floor((rank[i] / (N * N)) * 256);
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
};

const BLUE_NOISE_DATA = makeBlueNoise();

export const createBlueNoiseTexture = () => {
  const tex = new THREE.DataTexture(BLUE_NOISE_DATA, N, N, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
};

export const BLUE_NOISE_SIZE = N;
