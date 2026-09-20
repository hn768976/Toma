// Deterministic pseudo-randomness.
//
// Remotion renders frames out of order across worker processes, so every
// "random" property has to be a pure function of a stable index. Nothing
// in these compositions may call Math.random() or read the clock.

export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A single stable value in [0, 1) for (index, salt). */
export const rand = (index: number, salt: number) =>
  mulberry32(index * 9781 + salt * 6151 + 1)();

/** A stable value in [min, max) for (index, salt). */
export const randRange = (
  index: number,
  salt: number,
  min: number,
  max: number,
) => min + rand(index, salt) * (max - min);

/** A stable pick from a list for (index, salt). */
export const randPick = <T,>(index: number, salt: number, items: readonly T[]) =>
  items[Math.floor(rand(index, salt) * items.length) % items.length];

/** Wraps `value` into [0, span). */
export const wrap = (value: number, span: number) =>
  ((value % span) + span) % span;

/** Hermite smoothstep, clamped. */
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * 1 inside [a, b], ramping up over `fade` before `a` and down over `fade`
 * after `b`. Used to fade objects in at the far plane and out at the
 * camera so the depth wrap never pops.
 */
export const fadeWindow = (
  x: number,
  a: number,
  b: number,
  fadeIn: number,
  fadeOut: number,
) => smoothstep(a, a + fadeIn, x) * (1 - smoothstep(b - fadeOut, b, x));
