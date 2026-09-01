// Every colour in the piece lives here. Nothing else in src/christmas-bokeh
// may contain a hex literal — layers ask the theme for a colour and, where
// they need transparency, run it through rgba() below.

export type ThemeVariant = "classic";

export type Theme = {
  /** Near-black, very slightly warm. */
  background: string;
  bokeh: {
    red: string;
    gold: string;
    cream: string;
    white: string;
    green: string;
  };
  snow: string;
  spark: string;
  /** Colour the vignette darkens toward at the frame corners. */
  vignette: string;
};

export const THEME: Record<ThemeVariant, Theme> = {
  classic: {
    background: "#0A0A0A",
    bokeh: {
      red: "#D42A2A",
      gold: "#E8B04F",
      cream: "#F5E8C8",
      white: "#FFFFFF",
      green: "#3F8A4A",
    },
    snow: "#FFFFFF",
    spark: "#FFD48F",
    vignette: "#050403",
  },
};

export type BokehColorName = keyof Theme["bokeh"];

const parseHex = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** `rgba(...)` string for a theme colour at a given alpha. */
export const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Same colour pushed toward white by `t`. Used for the hot core of a
 * bokeh disc and of a spark, so the brightest pixels desaturate the way a
 * real over-exposed highlight does instead of just getting more opaque.
 */
export const lighten = (hex: string, t: number, alpha: number) => {
  const [r, g, b] = parseHex(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${alpha})`;
};
