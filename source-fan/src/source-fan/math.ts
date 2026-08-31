export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * A closed sine on the 600-frame loop. `cycles` must be an integer so the
 * value at frame 600 is exactly the value at frame 0.
 */
export const loopSin = (frame: number, cycles: number, phase: number): number =>
  Math.sin(TAU * ((cycles * (frame % 600)) / 600 + phase));

export const cubicAt = (
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number => {
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
  );
};

/** Pick a value from a list using a 0..1 seeded roll. */
export const pick = <T,>(list: readonly T[], roll: number): T =>
  list[Math.min(list.length - 1, Math.floor(roll * list.length))];
