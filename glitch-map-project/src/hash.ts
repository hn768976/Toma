/**
 * Deterministic hashing for the glitch field.
 *
 * Remotion renders frames out of order and across threads, so every visual
 * decision has to be a pure function of its inputs. Nothing here reads
 * Math.random(), a clock, or any state carried between frames: given the same
 * (y, frame) - or (slot, epoch) - the field draws identically every time.
 */

/** 32-bit integer hash. Returns a float in [0, 1). */
export const hash = (a: number, b = 0, c = 0): number => {
  let h = (a | 0) * 0x27d4eb2d;
  h = (h ^ ((b | 0) * 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0;
  h = (h ^ ((c | 0) * 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
};

/** Hash mapped onto [min, max). */
export const hashRange = (min: number, max: number, a: number, b = 0, c = 0): number =>
  min + hash(a, b, c) * (max - min);

/** Hash mapped onto the integers [min, max]. */
export const hashInt = (min: number, max: number, a: number, b = 0, c = 0): number =>
  min + Math.floor(hash(a, b, c) * (max - min + 1));
