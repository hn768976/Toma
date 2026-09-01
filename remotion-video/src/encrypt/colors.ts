/** Colour helpers. Every colour VALUE lives in `variants.ts`; this file only
 *  transforms values it is handed. */

const parse = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
};

export const mix = (from: string, to: string, t: number): string => {
  const k = Math.max(0, Math.min(1, t));
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  return `rgb(${Math.round(r1 + (r2 - r1) * k)},${Math.round(
    g1 + (g2 - g1) * k,
  )},${Math.round(b1 + (b2 - b1) * k)})`;
};

/** Two-stop mix through a mid colour, for the green -> amber -> red shift. */
export const mix3 = (
  from: string,
  mid: string,
  to: string,
  t: number,
): string => {
  const k = Math.max(0, Math.min(1, t));
  return k < 0.5 ? mix(from, mid, k * 2) : mix(mid, to, (k - 0.5) * 2);
};

/** Lightens a colour toward white, for hatch highlights and bright edges. */
export const lighten = (hex: string, t: number): string => {
  const [r, g, b] = parse(hex);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(r + (255 - r) * k)},${Math.round(
    g + (255 - g) * k,
  )},${Math.round(b + (255 - b) * k)})`;
};
