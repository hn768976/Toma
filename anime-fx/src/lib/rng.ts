// Deterministic randomness. Nothing in this project calls Math.random().
// Every stream is a mulberry32 generator whose seed is derived from the
// module-level ROOT_SEED plus a list of keys (composition id, drawing index,
// element index ...), so any frame can be rendered cold and come out identical.

export const ROOT_SEED = 0x2a5eed11;

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// FNV-1a over a mixed list of strings / numbers.
export const seedOf = (...keys: (string | number)[]): number => {
  let h = 0x811c9dc5 ^ ROOT_SEED;
  for (const k of keys) {
    const s = typeof k === "number" ? `#${k}` : k;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x7f;
    h = Math.imul(h, 0x01000193);
  }
  // final avalanche
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

export class Rand {
  private r: () => number;
  constructor(...keys: (string | number)[]) {
    this.r = mulberry32(seedOf(...keys));
  }
  next() {
    return this.r();
  }
  range(a: number, b: number) {
    return a + (b - a) * this.r();
  }
  int(a: number, b: number) {
    // inclusive a, exclusive b
    return Math.floor(this.range(a, b));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.r() * arr.length) % arr.length];
  }
  chance(p: number) {
    return this.r() < p;
  }
  sign() {
    return this.r() < 0.5 ? -1 : 1;
  }
  gauss() {
    // sum of 4 uniforms, roughly normal, sd ~1
    return (this.r() + this.r() + this.r() + this.r() - 2) * 1.732;
  }
  // a fresh, independent function for libraries that want () => number
  fn() {
    return mulberry32(Math.floor(this.r() * 4294967296));
  }
}

// Integer hash of a few ints -> [0,1)
export const hash01 = (...keys: number[]) => seedOf(...keys) / 4294967296;
