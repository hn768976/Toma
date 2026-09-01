/**
 * The single source of truth for colour and render mode.
 *
 * This is the ONLY module in the project that contains a hex literal. Every
 * painter and every 3D component reads its colours from here, so re-skinning
 * the piece means editing this file and nothing else.
 */

export type Palette = {
  /** Deep blue-violet base the whole frame sits on. */
  backgroundDeep: string;
  /** Lighter wash blended over the base for a soft top-left falloff. */
  backgroundWash: string;
  /** Panel body fill, used at `panelFillAlpha`. */
  panelFill: string;
  /** Hairline around every panel. */
  panelBorder: string;
  /** Chart grid. */
  gridLine: string;
  /** Platform A — heaviest, most volatile. */
  seriesMagenta: string;
  /** Platform B — medium weight. */
  seriesBlue: string;
  /** Platform C — thinnest, calmest. */
  seriesWhite: string;
  /** Column bars behind the lines, used at `barAlpha`. */
  barMagenta: string;
  /** Counter numerals. */
  counterWhite: string;
  /** Sparklines under the counters. */
  counterMagenta: string;
  /** Labels, axis ticks, legend text. */
  textPale: string;
  /** Ticker: positive change. */
  tickerGreen: string;
  /** Ticker: negative change. */
  tickerRed: string;
};

const PALETTE: Palette = {
  backgroundDeep: "#0A0A2E",
  backgroundWash: "#1A1450",
  panelFill: "#12123A",
  panelBorder: "#3A3A6B",
  gridLine: "#24245C",
  seriesMagenta: "#F5487A",
  seriesBlue: "#6F8FD4",
  seriesWhite: "#F0F4FF",
  barMagenta: "#C43A6B",
  counterWhite: "#FFFFFF",
  counterMagenta: "#F5487A",
  textPale: "#A8B4D4",
  tickerGreen: "#3FE87A",
  tickerRed: "#F5486B",
};

/** Alpha values that belong with the palette rather than the painters. */
export const ALPHA = {
  /** Panel fills sit at ~70%. */
  panelFill: 0.7,
  /** Bars behind the lines sit at ~40%. */
  bar: 0.4,
  /** Vignette strength at the corners. */
  vignette: 0.18,
  /** Film grain. */
  grain: 0.03,
} as const;

export type VariantName = "flat" | "tilted";

export type Variant = {
  name: VariantName;
  /**
   * `flat2D` blits the dashboard buffer straight to the composition canvas.
   * `plane3D` uploads the same buffer as a CanvasTexture on a tilted plane.
   */
  renderMode: "flat2D" | "plane3D";
  palette: Palette;
  /**
   * Backing-store size of the dashboard's own offscreen canvas. The flat
   * variant is authored and rasterised at full 4K. The tilted variant draws the
   * identical dashboard at half resolution: at that tilt, with depth-of-field
   * softening the near and far edges, the difference is invisible and it
   * roughly quarters the per-frame texture cost.
   */
  buffer: { width: number; height: number };
};

export const VARIANTS: Record<VariantName, Variant> = {
  flat: {
    name: "flat",
    renderMode: "flat2D",
    palette: PALETTE,
    buffer: { width: 3840, height: 2160 },
  },
  tilted: {
    name: "tilted",
    renderMode: "plane3D",
    palette: PALETTE,
    buffer: { width: 1920, height: 1080 },
  },
};
