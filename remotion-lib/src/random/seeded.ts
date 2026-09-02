import { random } from "remotion";

// Deterministic seeded randomness.
//
// Everything here is a pure function of its seed string, so a value is the
// same on every worker and on every re-render. Math.random() would give a
// different answer on each call, which in a Remotion render means a different
// frame per worker and visible flicker.

/** Seeded 0..1. */
export const rnd = (seed: string) => random(seed);

/** Seeded value in [lo, hi). */
export const rndRange = (seed: string, lo: number, hi: number) =>
  lo + random(seed) * (hi - lo);

/** Seeded integer in [lo, hi], inclusive both ends. */
export const rndInt = (seed: string, lo: number, hi: number) =>
  lo + Math.floor(random(seed) * (hi - lo + 1));

/** Seeded pick from a list. */
export const pick = <T>(seed: string, list: readonly T[]): T =>
  list[Math.min(list.length - 1, Math.floor(random(seed) * list.length))];

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

/** Shortest signed angular distance from `a` to `b`, in (-PI, PI]. */
export const angleDelta = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** Positive angular distance travelled going forwards from `a` to `b`, [0, 2PI). */
export const angleForward = (a: number, b: number) => {
  const d = (b - a) % (Math.PI * 2);
  return d < 0 ? d + Math.PI * 2 : d;
};

