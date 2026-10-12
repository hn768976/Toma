import { mulberry32 } from "./rng";

// A seeded random walk made periodic: subtract the straight line between the
// end points so it ends where it started, then normalise to [0, 1]. Index it
// with any real number; it repeats every `length` points.
export class PeriodicSeries {
  readonly values: Float32Array;
  constructor(
    readonly length: number,
    seed: number,
    opts: { momentum?: number; spikes?: number; smooth?: number } = {},
  ) {
    const rnd = mulberry32(seed);
    const n = length;
    const raw = new Float64Array(n + 1);
    let v = 0;
    let vel = 0;
    const mom = opts.momentum ?? 0.6;
    for (let i = 1; i <= n; i++) {
      const shock = rnd() - 0.5;
      const spike = rnd() < (opts.spikes ?? 0.04) ? (rnd() - 0.5) * 6 : 0;
      vel = vel * mom + shock + spike * 0.5;
      v += vel;
      raw[i] = v;
    }
    const end = raw[n];
    for (let i = 0; i <= n; i++) raw[i] -= (end * i) / n;
    // optional circular smoothing
    let arr = Array.from(raw.slice(0, n));
    const sm = opts.smooth ?? 0;
    for (let pass = 0; pass < sm; pass++) {
      arr = arr.map(
        (_, i) => (arr[(i - 1 + n) % n] + 2 * arr[i] + arr[(i + 1) % n]) / 4,
      );
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of arr) {
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    this.values = new Float32Array(arr.map((x) => (x - lo) / (hi - lo)));
  }
  at(i: number): number {
    const n = this.length;
    const f = Math.floor(i);
    const t = i - f;
    const a = this.values[((f % n) + n) % n];
    const b = this.values[(((f + 1) % n) + n) % n];
    return a + (b - a) * t;
  }
  // Integer-index read
  get(i: number): number {
    const n = this.length;
    return this.values[((i % n) + n) % n];
  }
}
