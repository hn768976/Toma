/**
 * Deterministic pseudo-random number generation.
 *
 * Every value that ends up on screen is drawn from one of these generators at
 * module-evaluation time. Remotion renders frames out of order across several
 * threads, so `Math.random()` anywhere in the render path would produce a
 * different scene per thread. A seeded mulberry32 gives the same stream on
 * every thread for the same seed.
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
  private readonly next01: () => number;

  constructor(seed: number) {
    this.next01 = mulberry32(seed);
  }

  /** Uniform in [0, 1). */
  next() {
    return this.next01();
  }

  /** Uniform in [min, max). */
  range(min: number, max: number) {
    return min + this.next01() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number) {
    return Math.floor(this.range(min, max + 1));
  }

  /** One of the supplied values. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next01() * items.length)];
  }

  /** True with probability p. */
  chance(p: number) {
    return this.next01() < p;
  }

  /**
   * Approximately normal, via the mean of four uniforms. Cheap, bounded and
   * good enough for jittering positions and sizes.
   */
  gaussian(mean = 0, sd = 1) {
    const u = (this.next01() + this.next01() + this.next01() + this.next01()) / 4;
    return mean + (u - 0.5) * 3.4641016 * sd;
  }

  /** A unit vector, uniform over the sphere. */
  unitVector(): [number, number, number] {
    const z = this.range(-1, 1);
    const theta = this.range(0, Math.PI * 2);
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    return [r * Math.cos(theta), r * Math.sin(theta), z];
  }
}

/**
 * Small integer frequency for a Lissajous component.
 *
 * Every drift frequency must be an integer so that at t = 1 the element is
 * exactly back where it started -- that is what makes the composition loop
 * without a visible cut.
 */
export const integerFrequency = (rng: Rng) => rng.int(1, 3);
