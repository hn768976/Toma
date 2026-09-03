/**
 * Colour helpers for the node-hub compositions.
 *
 * Every concrete colour value lives in variants.ts; this module only
 * transforms them, so palettes stay the single source of truth. All functions
 * are pure, which keeps per-frame drawing deterministic.
 */

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Parses "#RGB" or "#RRGGBB" into 0-255 channels. */
export const toRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

/** `hex` at `alpha` (0-1) as a canvas-ready rgba() string. */
export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(4)})`;
};

/** Linear blend: t=0 returns `a`, t=1 returns `b`. */
export const mix = (a: string, b: string, t: number): string => {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${clamp255(r1 + (r2 - r1) * k)}, ${clamp255(g1 + (g2 - g1) * k)}, ${clamp255(b1 + (b2 - b1) * k)})`;
};

/** `mix` but returned as "#RRGGBB", for values stored back into a palette. */
export const mixHex = (a: string, b: string, t: number): string => {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const k = Math.max(0, Math.min(1, t));
  const hex = (n: number) => clamp255(n).toString(16).padStart(2, "0");
  return `#${hex(r1 + (r2 - r1) * k)}${hex(g1 + (g2 - g1) * k)}${hex(b1 + (b2 - b1) * k)}`;
};
