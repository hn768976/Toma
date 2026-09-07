import {random} from 'remotion';

/**
 * Every random value in the project comes from here, and every value here comes
 * from Remotion's `random()` keyed by the composition's `seed` prop. Math.random
 * is never used, so a given seed always reproduces exactly the same image.
 */
export class Rng {
  private i = 0;

  constructor(private readonly key: string) {}

  /** A fresh stream, deterministically derived from this one. */
  fork(tag: string): Rng {
    return new Rng(`${this.key}~${tag}`);
  }

  /** Next float in [0, 1). */
  next(): number {
    this.i += 1;
    return random(`${this.key}#${this.i}`);
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1 - 1e-9));
  }

  bool(pTrue = 0.5): boolean {
    return this.next() < pTrue;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))];
  }

  /** Pick an index from weighted buckets. */
  weighted(weights: readonly number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let t = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      t -= weights[i];
      if (t <= 0) return i;
    }
    return weights.length - 1;
  }

  /** A short, fictional, illegible code string. */
  code(len: number, charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'): string {
    let s = '';
    for (let i = 0; i < len; i++) s += charset[Math.floor(this.next() * charset.length)];
    return s;
  }
}

/** Small, fast, fully deterministic PRNG for bulk work (grain). */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
