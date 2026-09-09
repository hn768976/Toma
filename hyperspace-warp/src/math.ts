export const clamp = (x: number, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Standard cubic ease-in-out on [0, 1]. */
export const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/**
 * Exact antiderivative of easeInOutCubic, F(x) = integral from 0 to x.
 * Used to turn the speed arc into a travelled-distance curve in closed form,
 * so D(frame) needs no accumulation across frames.
 *   F(0) = 0, F(0.5) = 1/16, F(1) = 1/2.
 */
export const easeInOutCubicIntegral = (x: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 0.5;
  if (x <= 0.5) return x * x * x * x;
  const u = 1 - x;
  return x - 0.5 + u * u * u * u;
};
