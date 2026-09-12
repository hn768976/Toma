// The two cuts of the video. Everything that differs between the bearish
// reference match and the bullish variant lives here, so the composition
// itself is written once.
//
// `direction` is the important one: it is not just a recolour. -1 walks the
// background candlestick series lower and points the ticker arrows down; +1
// sends both the other way. Colour alone would read as a palette swap, not
// as a rising market.

export type MarketTheme = {
  /** -1 = falling / bearish, +1 = rising / bullish. */
  direction: -1 | 1;
  /** Page background, under everything. */
  background: string;
  /** Broad atmospheric haze lying behind the map. */
  haze: string;
  /** Hot core of a map dot (near-white, faintly tinted). */
  dotCore: string;
  /** Fully saturated accent, used for far dots and highlights. */
  accent: string;
  /** Dimmer accent for the graticule and background candles. */
  accentDim: string;
  /** Fill of the solid accent-coloured ticker chips. */
  chipFill: string;
  /** Text on the accent-coloured chips. */
  chipText: string;
  /** Fill of the light "quote board" chips. */
  lightChipFill: string;
  /** Text on the light chips. */
  lightChipText: string;
  /** Plain (un-chipped) ticker text. */
  plainText: string;
  /** Vignette colour closing down the frame edges. */
  vignette: string;
};

export const BEARISH: MarketTheme = {
  direction: -1,
  background: "#08060a",
  haze: "rgb(255, 26, 42)",
  dotCore: "rgb(255, 228, 232)",
  accent: "rgb(255, 42, 58)",
  accentDim: "rgb(214, 30, 48)",
  chipFill: "rgb(219, 16, 34)",
  chipText: "rgb(255, 240, 242)",
  lightChipFill: "rgb(226, 226, 230)",
  lightChipText: "rgb(24, 10, 14)",
  plainText: "rgb(248, 236, 238)",
  vignette: "rgba(4, 2, 5, 0.62)",
};

export const BULLISH: MarketTheme = {
  direction: 1,
  background: "#05090a",
  haze: "rgb(10, 240, 130)",
  dotCore: "rgb(226, 255, 238)",
  accent: "rgb(24, 226, 122)",
  accentDim: "rgb(16, 182, 100)",
  chipFill: "rgb(12, 176, 92)",
  chipText: "rgb(234, 255, 242)",
  lightChipFill: "rgb(224, 230, 226)",
  lightChipText: "rgb(4, 26, 14)",
  plainText: "rgb(234, 250, 240)",
  vignette: "rgba(2, 5, 4, 0.62)",
};

export type ThemeName = "bearish" | "bullish";

export const THEMES: Record<ThemeName, MarketTheme> = {
  bearish: BEARISH,
  bullish: BULLISH,
};
