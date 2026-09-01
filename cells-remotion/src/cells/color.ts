/**
 * Small colour helpers. Nothing here contains a colour of its own — every
 * value comes in from VARIANTS.
 */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const hexToRgb = (hex: string): [number, number, number] => {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

type Hsl = { h: number; s: number; l: number };

const rgbToHsl = (r: number, g: number, b: number): Hsl => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return { h: 0, s: 0, l };
  }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6;
  } else {
    h = ((rn - gn) / d + 4) / 6;
  }
  return { h, s, l };
};

/**
 * Brightness compensation for the blur passes: a blurred fill spreads its
 * energy over a much larger area and reads washed out, so cells in the more
 * blurred buckets get their saturation lifted and their lightness pushed
 * further from the background before they are drawn.
 */
export const compensate = (
  hex: string,
  saturationBoost: number,
  lightnessShift: number,
): string => {
  const [r, g, b] = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const s2 = clamp01(s * (1 + saturationBoost));
  const l2 = clamp01(l + lightnessShift);
  return `hsl(${(h * 360).toFixed(2)} ${(s2 * 100).toFixed(2)}% ${(l2 * 100).toFixed(2)}%)`;
};

export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
