export type Rgb = [number, number, number];

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Pushes a colour toward white — used for the overshoot on the state change. */
export const lighten = (c: Rgb, t: number): Rgb => mixRgb(c, [255, 255, 255], t);

export const rgba = (c: Rgb, alpha: number): string =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;

export const css = (c: Rgb): string => rgba(c, 1);

type Hsl = [number, number, number];

export const rgbToHsl = (c: Rgb): Hsl => {
  const [r, g, b] = [c[0] / 255, c[1] / 255, c[2] / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
};

export const hslToRgb = ([h, s, l]: Hsl): Rgb => {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const x = t - Math.floor(t);
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(hue + 1 / 3) * 255, channel(hue) * 255, channel(hue - 1 / 3) * 255];
};

/**
 * Cross-fade between two colours in HSL, taking the short way round the hue
 * wheel. Mixing red and green in RGB lands on olive at the halfway point; in
 * HSL the same cross-fade runs red -> orange -> amber -> green and stays
 * saturated the whole way through, which is what the state change needs.
 */
export const mixHsl = (a: Rgb, b: Rgb, t: number): Rgb => {
  const [h1, s1, l1] = rgbToHsl(a);
  const [h2, s2, l2] = rgbToHsl(b);
  let dh = ((h2 - h1 + 540) % 360) - 180;
  return hslToRgb([h1 + dh * t, s1 + (s2 - s1) * t, l1 + (l2 - l1) * t]);
};

/** Brightens without desaturating — raises L, leaves H and S alone. */
export const hslLighten = (c: Rgb, amount: number): Rgb => {
  const [h, s, l] = rgbToHsl(c);
  return hslToRgb([h, s, l + (1 - l) * amount]);
};
