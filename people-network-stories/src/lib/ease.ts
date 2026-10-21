export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Maps x from [a,b] to [0,1], clamped.
export const remap = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
export const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOut = (t: number, p = 3) => 1 - Math.pow(1 - clamp01(t), p);
export const easeIn = (t: number, p = 2) => Math.pow(clamp01(t), p);

// Piecewise-linear keyframes: keys = [[time, value], ...] sorted by time.
export const keyframes = (t: number, keys: [number, number][], ease = smooth) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return lerp(v0, v1, ease((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
