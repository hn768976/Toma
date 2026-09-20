/**
 * Deterministic pseudo-random numbers.
 *
 * Every layout decision in the scene (component placement, trace routing,
 * ray angles, dust motes) runs through one of these so that a given frame
 * always renders identically — across machines, across a distributed render,
 * and between the 1080p and 4K compositions.
 */
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

export class Rng {
  private next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  /** Uniform in [0, 1). */
  float() {
    return this.next();
  }

  /** Uniform in [min, max). */
  range(min: number, max: number) {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max]. */
  int(min: number, max: number) {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability `p`. */
  chance(p: number) {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length) % items.length];
  }

  /** Roughly gaussian via the central limit theorem. */
  gaussian() {
    return (this.next() + this.next() + this.next() - 1.5) / 1.5;
  }
}
