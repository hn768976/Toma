export type Rgb = readonly [number, number, number];

const HEX = /^#([0-9a-f]{6})$/i;

export const hexToRgb = (hex: string): Rgb => {
  const m = HEX.exec(hex.trim());
  if (!m) {
    throw new Error(`Not a 6-digit hex colour: ${hex}`);
  }
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
};

export const scale = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k];

export const css = (c: Rgb): string =>
  `rgb(${Math.round(clamp255(c[0]))},${Math.round(clamp255(c[1]))},${Math.round(
    clamp255(c[2]),
  )})`;

export const cssA = (c: Rgb, alpha: number): string =>
  `rgba(${Math.round(clamp255(c[0]))},${Math.round(clamp255(c[1]))},${Math.round(
    clamp255(c[2]),
  )},${Math.max(0, Math.min(1, alpha)).toFixed(4)})`;

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Pre-computed ramp of CSS colour strings between two colours. Used so the
 * per-dot loop never builds a string — it just indexes into the ramp.
 */
export const buildRamp = (a: Rgb, b: Rgb, steps: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    out.push(css(mix(a, b, steps === 1 ? 0 : i / (steps - 1))));
  }
  return out;
};
