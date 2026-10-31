export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeInOutSine = (t: number) =>
  -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
/** Smooth growth used for bars: quick start, soft settle. */
export const easeOutQuart = (t: number) => 1 - Math.pow(1 - clamp01(t), 4);

export type Vec3 = [number, number, number];
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/** Piecewise interpolation over keyframes with an easing per segment; clamps at both ends. */
export const interpolateKeys = (
  t: number,
  input: readonly number[],
  output: readonly number[],
  ease: (x: number) => number = (x) => x,
) => {
  if (t <= input[0]) return output[0];
  for (let i = 0; i < input.length - 1; i++) {
    if (t <= input[i + 1]) {
      const p = (t - input[i]) / (input[i + 1] - input[i]);
      return lerp(output[i], output[i + 1], ease(p));
    }
  }
  return output[output.length - 1];
};
