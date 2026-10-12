// A 64×64 tileable blue-noise threshold map, generated once with the
// void-and-cluster method (Ulichney 1993). Pure math, seeded, deterministic.
import { mulberry32 } from "./random";

export const BLUE_NOISE_SIZE = 64;

const build = (): Uint8Array => {
  const N = BLUE_NOISE_SIZE;
  const count = N * N;
  const sigma = 1.5;
  const R = 7; // kernel radius (toroidal)
  const kernel: number[] = [];
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++)
      kernel.push(Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)));

  const bits = new Uint8Array(count);
  const energy = new Float64Array(count);
  const splat = (idx: number, sign: number) => {
    const x = idx % N;
    const y = (idx / N) | 0;
    let k = 0;
    for (let dy = -R; dy <= R; dy++) {
      const yy = (y + dy + N) % N;
      for (let dx = -R; dx <= R; dx++) {
        energy[yy * N + ((x + dx + N) % N)] += sign * kernel[k++];
      }
    }
  };
  const tightest = () => {
    let best = -1;
    let bv = -Infinity;
    for (let i = 0; i < count; i++) if (bits[i] && energy[i] > bv) ((bv = energy[i]), (best = i));
    return best;
  };
  const largestVoid = () => {
    let best = -1;
    let bv = Infinity;
    for (let i = 0; i < count; i++) if (!bits[i] && energy[i] < bv) ((bv = energy[i]), (best = i));
    return best;
  };

  // Initial binary pattern: ~10% random points, relaxed until stable.
  const rng = mulberry32(0xb1e5);
  const initial = Math.floor(count * 0.1);
  let placed = 0;
  while (placed < initial) {
    const i = Math.floor(rng() * count);
    if (!bits[i]) {
      bits[i] = 1;
      splat(i, 1);
      placed++;
    }
  }
  for (let iter = 0; iter < count; iter++) {
    const t = tightest();
    bits[t] = 0;
    splat(t, -1);
    const v = largestVoid();
    if (v === t) {
      bits[t] = 1;
      splat(t, 1);
      break;
    }
    bits[v] = 1;
    splat(v, 1);
  }

  const rank = new Int32Array(count);
  const proto = bits.slice();
  const protoEnergy = energy.slice();
  // Phase 1: remove points from the prototype, ranking downward.
  let ones = initial;
  while (ones > 0) {
    const t = tightest();
    bits[t] = 0;
    splat(t, -1);
    ones--;
    rank[t] = ones;
  }
  // Phase 2 & 3: add points into voids from the prototype upward.
  bits.set(proto);
  energy.set(protoEnergy);
  for (let r = initial; r < count; r++) {
    const v = largestVoid();
    bits[v] = 1;
    splat(v, 1);
    rank[v] = r;
  }
  const out = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const val = Math.floor(((rank[i] + 0.5) / count) * 256);
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = val;
    out[i * 4 + 3] = 255;
  }
  return out;
};

let cache: Uint8Array | null = null;
/** RGBA8 data, value = blue-noise rank in [0,255]. */
export const getBlueNoiseRGBA = () => (cache ??= build());

/** Per-frame tile offset: a fixed function of frame % 600 (golden-ratio walk). */
export const blueNoiseOffset = (loopFrame: number): [number, number] => [
  Math.floor((loopFrame * 0.6180339887 * BLUE_NOISE_SIZE) % BLUE_NOISE_SIZE),
  Math.floor((loopFrame * 0.7548776662 * BLUE_NOISE_SIZE) % BLUE_NOISE_SIZE),
];
