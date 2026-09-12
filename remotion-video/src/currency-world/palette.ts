// The two colour treatments. `steel` is matched to the reference plate
// (navy base, cyan-teal data, a warm ember haze bleeding through the
// map); `midnight` is the dark-blue grade — the ember is swapped for a
// cobalt bloom and every data colour is pushed off teal onto blue.

export type PaletteName = "steel" | "midnight";

export type Palette = {
  /** Flat colour painted under everything. */
  base: string;
  /** Large soft background blooms: [css color, x%, y%, radius%]. */
  blooms: { color: string; x: number; y: number; r: number }[];
  /** Warm/cool haze that sits behind the map plates. */
  haze: string;
  /** Map dots, brightest to dimmest. */
  dotBright: string;
  dotMid: string;
  dotDim: string;
  /** Currency medallions. */
  ring: string;
  ringGlow: string;
  glyph: string;
  /** Ticker text and its highlight chip. */
  ticker: string;
  chipFill: string;
  chipText: string;
  /** HUD rectangles, rules and depth streaks. */
  hud: string;
  streak: string;
  streakHot: string;
  /** Corner falloff. */
  vignette: string;
};

export const PALETTES: Record<PaletteName, Palette> = {
  steel: {
    base: "#050a11",
    blooms: [
      { color: "rgba(34, 86, 112, 0.55)", x: 50, y: 42, r: 62 },
      { color: "rgba(16, 52, 74, 0.5)", x: 14, y: 74, r: 46 },
      { color: "rgba(24, 68, 92, 0.42)", x: 86, y: 22, r: 44 },
    ],
    haze: "rgba(128, 52, 34, 0.30)",
    dotBright: "#cdf2fb",
    dotMid: "#79c4dc",
    dotDim: "#356f88",
    ring: "rgba(190, 232, 246, 0.82)",
    ringGlow: "rgba(126, 206, 236, 0.55)",
    glyph: "#e6f6fc",
    ticker: "#dcf1fa",
    chipFill: "#bfe9fb",
    chipText: "#07161f",
    hud: "rgba(96, 176, 208, 0.55)",
    streak: "rgba(150, 214, 238, 0.7)",
    streakHot: "#eaf9ff",
    vignette: "rgba(2, 5, 9, 0.72)",
  },
  midnight: {
    base: "#01030b",
    blooms: [
      { color: "rgba(20, 38, 98, 0.5)", x: 50, y: 44, r: 64 },
      { color: "rgba(12, 24, 70, 0.5)", x: 16, y: 72, r: 48 },
      { color: "rgba(16, 30, 84, 0.4)", x: 84, y: 24, r: 44 },
    ],
    haze: "rgba(28, 42, 126, 0.26)",
    dotBright: "#cfdcff",
    dotMid: "#6b8adb",
    dotDim: "#27376e",
    ring: "rgba(186, 206, 252, 0.8)",
    ringGlow: "rgba(78, 110, 214, 0.5)",
    glyph: "#dfe8ff",
    ticker: "#d4e0ff",
    chipFill: "#a8bdf0",
    chipText: "#04081c",
    hud: "rgba(76, 108, 196, 0.52)",
    streak: "rgba(132, 160, 236, 0.68)",
    streakHot: "#e8efff",
    vignette: "rgba(0, 1, 6, 0.78)",
  },
};
