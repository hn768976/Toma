/**
 * Every colour in the piece lives here. Nothing else in `src/` contains a hex
 * literal — layers ask the theme for a colour and the `rgba` helper for an
 * alpha-modulated version of it.
 */

export const THEME = {
  blue: {
    /** Pure black. The piece opens and closes on this. */
    background: "#000000",
    /** The outer, coolest reaches of the volumetric cloud. */
    plasmaDeep: "#1A1466",
    /** The body of the cloud and the outer filament glow. */
    plasmaMid: "#3F3FD4",
    /** The mid channel of a filament. */
    plasmaBright: "#6F8FFF",
    /** The hotter filaments — a fraction of the web runs at this temperature. */
    plasmaCyan: "#4FD4F5",
    /** The hottest centre: the core flash and the thin filament cores. */
    coreWhite: "#FFFFFF",
    /** Ejected sparks. */
    sparkPale: "#C8D8FF",
  },
} as const;

export type PlasmaVariant = keyof typeof THEME;
export type PlasmaTheme = (typeof THEME)[PlasmaVariant];

const rgbCache = new Map<string, readonly [number, number, number]>();

const toRgb = (hex: string): readonly [number, number, number] => {
  const cached = rgbCache.get(hex);
  if (cached) {
    return cached;
  }

  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  rgbCache.set(hex, rgb);
  return rgb;
};

/** `rgba()` string for a theme colour at the given alpha. */
export const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
