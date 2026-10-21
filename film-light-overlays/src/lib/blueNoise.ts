import { DataTexture, NearestFilter, RedFormat, RepeatWrapping, UnsignedByteType } from "three";
import { mulberry32 } from "./random";

// 64x64 blue-noise threshold map, built once by void-filling on a torus:
// each step puts the next rank into the emptiest spot (lowest Gaussian energy).
const N = 64;
let cached: DataTexture | null = null;

export const buildBlueNoise = (): Uint8Array => {
  const rng = mulberry32(0xb10e);
  const sigma2 = 2 * 1.6 * 1.6;
  const kernel = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = Math.min(x, N - x);
      const dy = Math.min(y, N - y);
      kernel[y * N + x] = Math.exp(-(dx * dx + dy * dy) / sigma2);
    }
  }
  const energy = new Float32Array(N * N);
  for (let i = 0; i < energy.length; i++) energy[i] = rng() * 1e-4;
  const filled = new Uint8Array(N * N);
  const out = new Uint8Array(N * N);
  for (let rank = 0; rank < N * N; rank++) {
    let best = -1;
    let bestE = Infinity;
    for (let i = 0; i < N * N; i++) {
      if (!filled[i] && energy[i] < bestE) {
        bestE = energy[i];
        best = i;
      }
    }
    filled[best] = 1;
    out[best] = Math.floor((rank * 256) / (N * N));
    const bx = best % N;
    const by = (best / N) | 0;
    for (let y = 0; y < N; y++) {
      const row = ((y + by) % N) * N;
      for (let x = 0; x < N; x++) {
        energy[row + ((x + bx) % N)] += kernel[y * N + x];
      }
    }
  }
  return out;
};

export const getBlueNoiseTexture = () => {
  if (cached) return cached;
  const tex = new DataTexture(buildBlueNoise(), N, N, RedFormat, UnsignedByteType);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
};
