/**
 * Deterministic hashing. Every animated value on both boards is a pure
 * function of the frame number, so Remotion can render frames out of order
 * across threads and still get an identical, exactly looping result.
 */

/**
 * FNV-1a over the joined parts, finished with an avalanche step.
 *
 * The finaliser is not decoration. Most call sites vary only the last part —
 * usually the frame number — and plain FNV-1a moves the result by roughly the
 * prime for a one-digit change, which is small enough that consecutive frames
 * kept landing in the same bucket and a "random" character stopped changing.
 */
export const hash = (...parts: (string | number)[]): number => {
  const input = parts.join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

/** Hash mapped into [0, 1). */
export const hash01 = (...parts: (string | number)[]): number =>
  hash(...parts) / 0x100000000;

/** Hash mapped into the integer range [min, max]. */
export const hashInt = (
  min: number,
  max: number,
  ...parts: (string | number)[]
): number => min + Math.floor(hash01(...parts) * (max - min + 1));

export const hashPick = <T,>(items: readonly T[], ...parts: (string | number)[]): T =>
  items[Math.floor(hash01(...parts) * items.length)] as T;
