import { mulberry32 } from './random';

// A fixed 64x64 blue-noise tile, generated once at module load with the
// void-and-cluster method from a seeded generator. Used as the dither
// pattern on the flat backgrounds of Capsule Release and Water Drop.
export const BLUE_NOISE_SIZE = 64;

const build = (): Uint8Array => {
  const N = BLUE_NOISE_SIZE;
  const total = N * N;
  const rand = mulberry32(0x5eed);
  const sigma = 1.5;
  const R = 6;
  const kernel: number[] = [];
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++)
      kernel.push(Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)));
  const energy = new Float64Array(total);
  const on = new Uint8Array(total);
  const splat = (idx: number, sign: number) => {
    const x = idx % N;
    const y = (idx / N) | 0;
    let k = 0;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const xx = (x + dx + N) % N;
        const yy = (y + dy + N) % N;
        energy[yy * N + xx] += sign * kernel[k++];
      }
  };
  // initial binary pattern: ~10% random points
  const initial = Math.floor(total * 0.1);
  let placed = 0;
  while (placed < initial) {
    const i = Math.floor(rand() * total);
    if (!on[i]) {
      on[i] = 1;
      splat(i, 1);
      placed++;
    }
  }
  const tightest = () => {
    let best = -1;
    let bv = -Infinity;
    for (let i = 0; i < total; i++) if (on[i] && energy[i] > bv) { bv = energy[i]; best = i; }
    return best;
  };
  const largestVoid = () => {
    let best = -1;
    let bv = Infinity;
    for (let i = 0; i < total; i++) if (!on[i] && energy[i] < bv) { bv = energy[i]; best = i; }
    return best;
  };
  // relax the initial pattern
  for (let iter = 0; iter < total; iter++) {
    const t = tightest();
    on[t] = 0; splat(t, -1);
    const v = largestVoid();
    if (v === t) { on[t] = 1; splat(t, 1); break; }
    on[v] = 1; splat(v, 1);
  }
  const rank = new Int32Array(total);
  const proto = on.slice();
  const protoEnergy = energy.slice();
  // phase 1: remove points from the prototype
  let ones = initial;
  while (ones > 0) {
    const t = tightest();
    on[t] = 0; splat(t, -1);
    ones--;
    rank[t] = ones;
  }
  on.set(proto);
  energy.set(protoEnergy);
  // phase 2 & 3: fill voids
  for (let r = initial; r < total; r++) {
    const v = largestVoid();
    on[v] = 1; splat(v, 1);
    rank[v] = r;
  }
  const out = new Uint8Array(total);
  for (let i = 0; i < total; i++) out[i] = Math.floor((rank[i] / total) * 256);
  return out;
};

export const BLUE_NOISE: Uint8Array = build();
