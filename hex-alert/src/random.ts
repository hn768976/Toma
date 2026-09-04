// Seeded, stateless randomness. Nothing here touches Math.random(), so every
// frame is a pure function of its inputs and renders identically on any machine.

/** FNV-1a over the arguments, finished with a splitmix-style avalanche. */
export const hash = (...xs: number[]): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < xs.length; i++) {
    let v = xs[i] >>> 0;
    for (let b = 0; b < 4; b++) {
      h = (h ^ (v & 0xff)) >>> 0;
      h = Math.imul(h, 16777619) >>> 0;
      v >>>= 8;
    }
  }
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 2246822507) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 3266489909) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/** hash(...) mapped into [0, 1). */
export const hashUnit = (...xs: number[]): number => hash(...xs) / 4294967296;

/** A mulberry32 generator, used once at module level to build the static pools. */
export const makePrng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const HEX = "0123456789ABCDEF";

export const MIN_TOKEN = 2;
export const MAX_TOKEN = 8;
const POOL_SIZE = 512;

/**
 * HEX_POOL[len] holds POOL_SIZE pre-built strings of that length. Picking a
 * token's characters is then a single hash + array lookup instead of one hash
 * per glyph — the difference between a comfortable and a painful 4K render.
 */
const buildPool = (): string[][] => {
  const prng = makePrng(0x5eed1234);
  const pool: string[][] = [];
  for (let len = 0; len <= MAX_TOKEN; len++) {
    const bucket: string[] = [];
    if (len >= MIN_TOKEN) {
      for (let i = 0; i < POOL_SIZE; i++) {
        let s = "";
        for (let c = 0; c < len; c++) {
          s += HEX[Math.floor(prng() * 16)];
        }
        bucket.push(s);
      }
    }
    pool.push(bucket);
  }
  return pool;
};

export const HEX_POOL = buildPool();

export const pickHex = (len: number, seed: number): string =>
  HEX_POOL[len][seed % POOL_SIZE];
