export type GlowPalette = {
  /** Bar colours, left (tallest) to right (shortest). */
  readonly bars: readonly string[];
  /** Colour of the light pooling at the bar bases. */
  readonly glow: string;
  readonly arrow: string;
  readonly arrowEmissive: string;
  /** Colour of the floor hot-spot revealed by the camera at the end. */
  readonly hotspot: string;
  /** Tint of the stage floor. */
  readonly floor: string;
};

/** Version 1 — matches the reference: red/orange neon bars, dark red arrow. */
export const EMBER: GlowPalette = {
  bars: ["#ff2410", "#ff4a12", "#ff6614", "#ff7416", "#ff7e17", "#ff8618", "#ff8c1a"],
  glow: "#ff1838",
  arrow: "#9a1014",
  arrowEmissive: "#3a0204",
  hotspot: "#ffe2e2",
  floor: "#9a9a9a",
};

/** Version 2 — alternative palette: electric cyan/blue bars, violet arrow. */
export const GLACIER: GlowPalette = {
  bars: ["#2a4dff", "#2a66ff", "#227eff", "#1c96ff", "#16acff", "#12c0ff", "#10d0ff"],
  glow: "#1c5cff",
  arrow: "#7a44e0",
  arrowEmissive: "#26105c",
  hotspot: "#dff0ff",
  floor: "#8f9aae",
};
