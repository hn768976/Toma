/**
 * Every colour in the composition lives here. Nothing else in the project
 * contains a hex literal — components take their colours from a Theme, so
 * a new `variant` restyles the whole piece without touching any drawing
 * code.
 */

export type Theme = {
  /** Deepest background, seen at the frame corners. */
  backgroundDeep: string;
  /** The lighter wash pooled behind the subject. */
  backgroundWash: string;
  /** The brain's body — the colour most particles are. */
  particleTeal: string;
  /** The brighter minority, and where a signal pulse lifts a particle to. */
  particleBright: string;
  /** The brightest few, and the peak of a pulse. */
  particleWhite: string;
  /** Flow lines at rest. Deliberately close to the background. */
  ribbonDim: string;
  /** The travelling highlight that makes a flow line readable. */
  ribbonBright: string;
  /** Scattered interface marks. */
  glyphTeal: string;
  /** A glyph mid-flicker. */
  glyphPale: string;
  /** The "AI" lettering. */
  textPale: string;
  /** Colour the vignette darkens toward. */
  vignette: string;
};

export const THEME: Record<string, Theme> = {
  teal: {
    backgroundDeep: "#02100E",
    backgroundWash: "#063028",
    particleTeal: "#3FD4B8",
    particleBright: "#A8FFE8",
    particleWhite: "#E8FFF8",
    ribbonDim: "#14453A",
    ribbonBright: "#4FE8C4",
    glyphTeal: "#2E9F8A",
    glyphPale: "#7FD4C4",
    textPale: "#A8E8D4",
    vignette: "#000806",
  },
  ice: {
    backgroundDeep: "#040C16",
    backgroundWash: "#0A2340",
    particleTeal: "#4FB4E8",
    particleBright: "#A8E0FF",
    particleWhite: "#EAF6FF",
    ribbonDim: "#17364F",
    ribbonBright: "#5FC8FF",
    glyphTeal: "#3A87B8",
    glyphPale: "#8FC8E4",
    textPale: "#AFD8F0",
    vignette: "#000408",
  },
  ember: {
    backgroundDeep: "#140803",
    backgroundWash: "#3A1608",
    particleTeal: "#E8944F",
    particleBright: "#FFCFA0",
    particleWhite: "#FFF0E0",
    ribbonDim: "#4A2312",
    ribbonBright: "#FFA85F",
    glyphTeal: "#B0713C",
    glyphPale: "#E0B48F",
    textPale: "#F0C8A4",
    vignette: "#0A0300",
  },
};

export type ThemeVariant = keyof typeof THEME & string;

export const getTheme = (variant: string): Theme => THEME[variant] ?? THEME.teal;

const hexCache: Record<string, [number, number, number]> = {};

const toRgb = (hex: string): [number, number, number] => {
  const cached = hexCache[hex];
  if (cached) return cached;
  const n = parseInt(hex.slice(1), 16);
  const rgb: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  hexCache[hex] = rgb;
  return rgb;
};

/** `rgba()` string for a theme colour at a given alpha. */
export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
};

/**
 * Blends two theme colours and returns an `rgba()` string. Used to lift a
 * particle's colour toward `particleWhite` as a signal pulse passes over
 * it, rather than switching colour in a hard step.
 */
export const mixAlpha = (
  hexA: string,
  hexB: string,
  t: number,
  alpha: number,
): string => {
  const [r1, g1, b1] = toRgb(hexA);
  const [r2, g2, b2] = toRgb(hexB);
  const k = Math.max(0, Math.min(1, t));
  return `rgba(${Math.round(r1 + (r2 - r1) * k)}, ${Math.round(
    g1 + (g2 - g1) * k,
  )}, ${Math.round(b1 + (b2 - b1) * k)}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
};
