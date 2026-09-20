export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Fades in over the first `pad` of 0..1 and out over the last `pad`. */
export const edgeFade = (t: number, pad: number): number =>
  smoothstep(0, pad, t) * smoothstep(0, pad, 1 - t);

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
