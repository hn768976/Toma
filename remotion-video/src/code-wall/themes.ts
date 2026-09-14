// Two colourways for the code wall.
//
// "blue" reproduces the reference: cyan/teal code on deep navy with hot
// orange-red selection bars. "green" is the same scene regraded to a
// phosphor-terminal green on near-black, keeping the warm accents so the
// highlighted rows still read at a glance.

export type Theme = {
  name: string;
  /** Radial background wash, innermost stop first. */
  backdrop: { inner: string; mid: string; outer: string };
  /** Translucent slab behind a panel's content. */
  panelFill: string;
  /** Hairline border around framed panels. */
  frameStroke: string;
  frameStrokeSoft: string;
  /** Code text, from faintest (deep background layers) to brightest. */
  codeDim: string;
  codeMid: string;
  codeBright: string;
  /** Section headers such as "ELEMENTS /TX03". */
  label: string;
  labelAlt: string;
  /** Cool progress/selection bars. */
  barCool: string;
  barCoolGlow: string;
  /** Hot selection bars and the text sitting on them. */
  accent: string;
  accentSoft: string;
  accentText: string;
  /** Horizontal lens streaks drifting across the field. */
  streak: string;
  streakHot: string;
  /** Corner falloff. */
  vignette: string;
  /**
   * Per-theme bloom trim. Bloom screen-blends the frame over itself, and a
   * near-monochrome palette saturates its dominant channel far faster than a
   * blue/orange one does — the green grade turns milky at the strength the
   * blue grade needs. 1 = the global strength, lower = less.
   */
  bloomScale: number;
};

export const BLUE_THEME: Theme = {
  name: "blue",
  backdrop: {
    inner: "#0d3968",
    mid: "#04142d",
    outer: "#010712",
  },
  panelFill: "rgba(26, 84, 152, 0.22)",
  frameStroke: "rgba(70, 196, 236, 0.62)",
  frameStrokeSoft: "rgba(46, 132, 196, 0.34)",
  codeDim: "#14528f",
  codeMid: "#3fc0e8",
  codeBright: "#9df2ff",
  label: "#41e0b4",
  labelAlt: "#66d9ff",
  barCool: "#2fe4ff",
  barCoolGlow: "rgba(60, 226, 255, 0.85)",
  accent: "#ff4a12",
  accentSoft: "rgba(255, 82, 20, 0.92)",
  accentText: "#ffd7b0",
  streak: "rgba(120, 226, 255, 0.78)",
  streakHot: "rgba(255, 138, 60, 0.6)",
  vignette: "rgba(0, 3, 10, 0.82)",
  bloomScale: 1,
};

export const GREEN_THEME: Theme = {
  name: "green",
  backdrop: {
    inner: "#06381b",
    mid: "#021309",
    outer: "#000603",
  },
  panelFill: "rgba(18, 92, 48, 0.17)",
  frameStroke: "rgba(80, 224, 130, 0.55)",
  frameStrokeSoft: "rgba(40, 142, 78, 0.3)",
  codeDim: "#0f5c2b",
  codeMid: "#42c96f",
  codeBright: "#a6ff9e",
  label: "#8bf94a",
  labelAlt: "#5cf0a4",
  barCool: "#4dff88",
  barCoolGlow: "rgba(90, 255, 140, 0.85)",
  accent: "#ff4a12",
  accentSoft: "rgba(255, 82, 20, 0.92)",
  accentText: "#ffd7b0",
  streak: "rgba(134, 255, 170, 0.72)",
  streakHot: "rgba(255, 138, 60, 0.58)",
  vignette: "rgba(0, 6, 3, 0.86)",
  bloomScale: 0.72,
};

export const THEMES = { blue: BLUE_THEME, green: GREEN_THEME } as const;

export type ThemeName = keyof typeof THEMES;
