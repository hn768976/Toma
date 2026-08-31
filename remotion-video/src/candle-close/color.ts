type Rgb = { r: number; g: number; b: number };

const hexToRgb = (hex: string): Rgb => {
  const clean = hex.charAt(0) === "#" ? hex.slice(1) : hex;
  const full =
    clean.length === 3
      ? clean.charAt(0) +
        clean.charAt(0) +
        clean.charAt(1) +
        clean.charAt(1) +
        clean.charAt(2) +
        clean.charAt(2)
      : clean;
  const value = parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

export const rgba = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
};

// Blends `hex` toward `target` by t (0 = untouched, 1 = fully target).
// Used by the depth-of-field pass: on the light variant blurred candles are
// lifted toward the pale background before blurring, so they soften toward
// white instead of muddying.
export const mix = (hex: string, target: string, t: number): string => {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(a.r + (b.r - a.r) * k);
  const g = Math.round(a.g + (b.g - a.g) * k);
  const bl = Math.round(a.b + (b.b - a.b) * k);
  return `rgb(${r}, ${g}, ${bl})`;
};
