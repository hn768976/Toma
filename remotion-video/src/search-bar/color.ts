/** Colour helpers. Every colour value itself lives in variants.ts. */

const parse = (hex: string): [number, number, number] => {
  const h = hex.charAt(0) === "#" ? hex.slice(1) : hex;
  const full =
    h.length === 3
      ? h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2)
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Blend two colours; t = 0 returns `a`, t = 1 returns `b`. */
export const mix = (a: string, b: string, t: number, alpha = 1): string => {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgba(${r}, ${g}, ${bl > 255 ? 255 : bl}, ${alpha})`;
};

export const black = (alpha: number): string => `rgba(0, 0, 0, ${alpha})`;
export const white = (alpha: number): string => `rgba(255, 255, 255, ${alpha})`;
