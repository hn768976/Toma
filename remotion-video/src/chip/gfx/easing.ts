export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
};

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t: number) => Math.pow(clamp01(t), 3);
export const easeInOutCubic = (t: number) =>
  clamp01(t) < 0.5
    ? 4 * clamp01(t) ** 3
    : 1 - Math.pow(-2 * clamp01(t) + 2, 3) / 2;

/** Overshoot-free settle used for the chip touching down. */
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - clamp01(t), 5);

/** Decaying oscillation for the impact recoil. */
export const springImpulse = (t: number, freq = 9, decay = 7) => {
  if (t <= 0) return 0;
  return Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * decay);
};

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
