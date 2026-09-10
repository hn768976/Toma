import { random } from "remotion";

/**
 * All randomness in this project goes through Remotion's `random()`, so a
 * composition and palette pair always reproduces the same image.
 *
 * `random()` hashes a numeric seed as `seed * 1e10`. Feeding it consecutive
 * integers therefore pushes the product past the exact-integer range of a
 * double very quickly, at which point neighbouring seeds collide and the noise
 * develops visible repeats. Scaling the draw index down by `SEED_STEP` keeps
 * every product inside the exact range for the ~20M draws a 4K frame needs.
 */
const SEED_STEP = 1e-4;

/** Deterministic uniform in [0, 1) for a draw index. */
export const rnd = (index: number): number => random(index * SEED_STEP);

/** A stable numeric seed base derived from a composition name. */
export const seedFromName = (name: string): number =>
  Math.floor(random(name) * 100_000);
