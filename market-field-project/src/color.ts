/** Minimal hex colour helpers — no dependency needed for this much. */

export const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const toHex = (c: number) =>
  Math.round(Math.min(Math.max(c, 0), 255))
    .toString(16)
    .padStart(2, "0");

export const rgba = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Mix `hex` toward white by `t` (0..1). Returns hex so the result can be fed
 * straight back into the other helpers.
 */
export const lighten = (hex: string, t: number) => {
  const { r, g, b } = hexToRgb(hex);
  const m = (c: number) => c + (255 - c) * t;
  return `#${toHex(m(r))}${toHex(m(g))}${toHex(m(b))}`;
};
