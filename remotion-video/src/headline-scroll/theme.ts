// Every colour used by the HeadlineScroll composition lives here. Nothing
// downstream is allowed to write a hex literal — the whole look is a data
// change, which is what lets a second variant (the coming light mode) drop in
// as one more entry in THEMES rather than a code edit.

export type Theme = {
  /** Flat fill behind everything. */
  background: string;
  /** Nearest, most legible blurred line. */
  textBright: string;
  /** Mid-depth blurred lines. */
  textMid: string;
  /** Furthest, faintest blurred lines. */
  textDim: string;
  /** The sharp centre word. */
  word: string;
  /** Chromatic aberration fringes. */
  fringeRed: string;
  fringeCyan: string;
  /** Halo behind the centre word. */
  glow: string;
  /**
   * Painted under the glow to knock the blurred text back before the halo goes
   * on top, so the word separates instead of sitting in a bright soup.
   */
  scrim: string;
  /** Frame edges fall to this. */
  vignette: string;
  /** Film grain speckle. */
  grain: string;
  /**
   * Blend modes. A light variant flips these (grain/vignette multiply down
   * instead of screening up), so they belong to the theme, not the renderer.
   */
  blend: {
    /** How scrolling lines stack onto the background. */
    lines: GlobalCompositeOperation;
    /** Halo + bloom + chromatic build-up around the word. */
    glow: GlobalCompositeOperation;
    /** Grain over the finished frame. */
    grain: GlobalCompositeOperation;
  };
};

export const THEMES = {
  dark: {
    background: "#000000",
    textBright: "#C8C8C8",
    textMid: "#6A6A6A",
    textDim: "#2A2A2A",
    word: "#FFFFFF",
    fringeRed: "#C42030",
    fringeCyan: "#20B4C4",
    glow: "#FFFFFF",
    scrim: "#000000",
    vignette: "#000000",
    grain: "#FFFFFF",
    blend: {
      lines: "screen",
      glow: "lighter",
      grain: "lighter",
    },
  },
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES = Object.keys(THEMES) as [ThemeName, ...ThemeName[]];

/** `#RRGGBB` -> `rgba(r, g, b, a)`. The only place colours get taken apart. */
export const withAlpha = (hex: string, alpha: number): string => {
  const int = parseInt(hex.slice(1), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const toRgb = (hex: string): [number, number, number] => {
  const int = parseInt(hex.slice(1), 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};
