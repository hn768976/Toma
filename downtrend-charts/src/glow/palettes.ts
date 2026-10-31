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
  bars: ["#ff2410", "#ff4a12", "#ff6a14", "#ff7c16", "#ff8a18", "#ff961a", "#ffa21c"],
  glow: "#ff1838",
  arrow: "#8a0d10",
  arrowEmissive: "#3a0204",
  hotspot: "#ffe2e2",
  floor: "#9a9a9a",
};

/** Version 2 — alternative palette: electric cyan/blue bars, violet arrow. */
export const GLACIER: GlowPalette = {
  bars: ["#2a4dff", "#2a6aff", "#2286ff", "#1ca2ff", "#16bcff", "#12d4ff", "#10eaff"],
  glow: "#1c5cff",
  arrow: "#5b1fb0",
  arrowEmissive: "#1c0640",
  hotspot: "#dff0ff",
  floor: "#8f9aae",
};
