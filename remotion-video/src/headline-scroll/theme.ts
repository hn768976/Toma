// Every colour used by the HeadlineScroll composition lives here, alongside the
// handful of numbers that genuinely differ between variants (blur ceiling,
// vignette strength, halo alphas). Nothing downstream writes a hex literal, and
// nothing downstream branches on the variant name — a new look is one more
// entry in THEMES, not a code change.

/** One radial pass of the treatment behind the centre word. */
export type HaloPass = {
  color: string;
  /** Peak alpha at the centre, before GLOW_STRENGTH and the pulse. */
  alpha: number;
  /** Radius as a multiple of GLOW_RADIUS_RATIO * frame height. */
  radiusScale: number;
  /** Higher falls off faster. */
  falloff: number;
  blend: GlobalCompositeOperation;
};

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
  /**
   * Chromatic aberration. The same two offset impressions are used for the
   * larger blurred lines and for the centre word.
   */
  fringe: {
    red: string;
    cyan: string;
    /**
     * How the two impressions combine. Additive on a dark ground, where the
     * text is light and the pair should sum back to it; subtractive on a light
     * ground, where dark type over paper is ink and the pair should multiply
     * back to it. Anything else reads as a coloured drop shadow.
     */
    blend: GlobalCompositeOperation;
    /**
     * Subtractive path only: how far each impression is tinted from paper
     * toward its fringe hue. Low keeps the misregistration subtle and keeps
     * the corrected second impression inside gamut.
     */
    strength: number;
  };

  lines: {
    /** How scrolling lines stack onto the background. */
    blend: GlobalCompositeOperation;
    /**
     * Deepest blur in the stack. Dark type on a light ground smears more
     * visibly than light on dark, so the light variant needs a lower ceiling
     * or the montage turns to grey mush.
     */
    blurCeiling: number;
  };

  /**
   * Two radial passes behind the word. `wash` resets the ground underneath it;
   * `core` is the halo proper and carries the pulse.
   *
   * On dark that means a black scrim knocking the blurred text back, then a
   * white halo lifting the word out of it. On light it inverts to a near-white
   * wash that bleaches the text beneath, so the word reads as dark type on a
   * cleared patch of paper. A dark halo on light would read as a drop shadow
   * and float the word above the page instead of setting it on it.
   */
  halo: { wash: HaloPass; core: HaloPass };

  finish: {
    /** Bloom on the word only. Additive glow on a light ground is wrong. */
    bloom: boolean;
    /**
     * Highlight roll-off, as a colour-dodge source. Lifts what is already
     * bright toward paper white and leaves the dark type alone — the light
     * variant's answer to bloom.
     */
    exposureLift: string | null;
  };

  vignette: {
    color: string;
    /** Peak alpha at the frame edge. */
    strength: number;
  };

  grain: { color: string; blend: GlobalCompositeOperation };
};

export const THEMES = {
  dark: {
    background: "#000000",
    textBright: "#C8C8C8",
    textMid: "#6A6A6A",
    textDim: "#2A2A2A",
    word: "#FFFFFF",
    fringe: {
      red: "#C42030",
      cyan: "#20B4C4",
      blend: "lighter",
      strength: 1,
    },
    lines: { blend: "screen", blurCeiling: 30 },
    halo: {
      wash: {
        color: "#000000",
        alpha: 0.85,
        radiusScale: 1.4,
        falloff: 1.8,
        blend: "source-over",
      },
      core: {
        color: "#FFFFFF",
        alpha: 0.22,
        radiusScale: 1,
        falloff: 2.2,
        blend: "lighter",
      },
    },
    finish: { bloom: true, exposureLift: null },
    vignette: { color: "#000000", strength: 1 },
    grain: { color: "#FFFFFF", blend: "lighter" },
  },
  light: {
    // Warm off-white, not pure white: #FFFFFF reads as a screen, the cream cast
    // reads as paper, which is the whole point of this variant.
    background: "#F4F2ED",
    textBright: "#1A1A1A",
    textMid: "#6A6866",
    textDim: "#C4C0BA",
    word: "#0A0A0A",
    fringe: {
      red: "#E04050",
      cyan: "#30A0C0",
      blend: "multiply",
      strength: 0.5,
    },
    lines: { blend: "multiply", blurCeiling: 24 },
    halo: {
      wash: {
        color: "#FBFAF7",
        alpha: 0.92,
        radiusScale: 1.5,
        falloff: 1.6,
        blend: "source-over",
      },
      core: {
        color: "#FFFFFF",
        alpha: 0.6,
        radiusScale: 1,
        falloff: 2,
        blend: "source-over",
      },
    },
    finish: { bloom: false, exposureLift: "#FFFFFF" },
    // Lighten the edges instead of darkening them: the frame falls off toward
    // white and the centre stays the darkest region.
    vignette: { color: "#FFFDF8", strength: 0.15 },
    grain: { color: "#2A2622", blend: "multiply" },
  },
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES = Object.keys(THEMES) as [ThemeName, ...ThemeName[]];

/** `#RRGGBB` -> `rgba(r, g, b, a)`. The only place colours get taken apart. */
export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const toRgb = (hex: string): [number, number, number] => {
  const int = parseInt(hex.slice(1), 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};
