/**
 * The single source of truth for every colour, layout mode, counter range and
 * chart mix in the piece. No hex literal and no layout coordinate lives
 * anywhere else in the project.
 */

export type VariantName = "blue" | "warm" | "dark";

export type Palette = {
  /** The paper / screen ground. Fills the whole canvas; no page edge is visible. */
  background: string;
  /** Subtle tonal variation painted across the sheet. */
  paperShade: string;
  /** Darkest charts and headings. */
  inkDark: string;
  /** Primary chart colour. */
  inkPrimary: string;
  /** Secondary chart colour. */
  inkSecondary: string;
  /** Third chart colour (used for the third line series / third bar tone). */
  inkTertiary: string;
  /** Neutral bars and comparison elements. */
  inkGrey: string;
  textDark: string;
  textDim: string;
  counterFill: string;
  counterText: string;
};

export type Tilt = {
  /** Degrees. Negative rotates counter-clockwise on screen: the sheet recedes upper-RIGHT. */
  rotateDeg: number;
  /** x' = x + shear * y, applied before the rotation. Mirrored when the tilt reverses. */
  shear: number;
  /** Compression along the receding axis. 0.91 == the right side compresses ~9%. */
  scaleX: number;
  scaleY: number;
};

export type DepthConfig = {
  /** Half-width of the sharp focal band, in sheet units, measured from v = 0. */
  bandHalfWidth: number;
  /** Gaussian radius in canvas px applied to each of the three buffers. */
  nearBlur: number;
  midBlur: number;
  farBlur: number;
};

export type FinishConfig = {
  /** Alpha of the paper-shade tonal gradient. */
  paperShadeAlpha: number;
  /** Alpha of the brightness lift at the sheet's upper-left. */
  lightLiftAlpha: number;
  vignetteColor: string;
  vignetteAlpha: number;
  grainAlpha: number;
  /** Horizontal scanlines every 5px. Dark variant only. */
  scanlines: boolean;
  scanlineColor: string;
  scanlineAlpha: number;
  /** Soft screen glow at the sheet's centre. Dark variant only. */
  screenGlowColor: string;
  screenGlowAlpha: number;
};

export type ChartStyle = {
  /** Tones cycled inside a single bar chart. Two for v1/v3, three for v2. */
  barTones: string[];
  /** One colour per line-chart series (always three available). */
  seriesTones: string[];
  /** Tones cycled by the pie wedges. */
  wedgeTones: string[];
  /**
   * How the donut's unfilled remainder reads.
   * "track" paints a visible darker ring; "ghost" paints a very dim ring at
   * `donutTrackAlpha` of the fill colour, for the dark ground where there is
   * no "darker" to go to.
   */
  donutRemainder: "track" | "ghost";
  donutTrackColor: string;
  donutTrackAlpha: number;
  /** Text blocks drop to this opacity so they stay texture, not the brightest thing. */
  textBlockOpacity: number;
  /** Emissive glow radius for bars and lines. 0 everywhere except the dark variant. */
  glowBlur: number;
};

export type Variant = {
  name: VariantName;
  palette: Palette;
  /** Key into LAYOUTS. */
  layoutMode: string;
  /** Multiplies every chart's internal type and stroke sizes. */
  contentScale: number;
  counter: { start: number; end: number };
  /** Human-readable record of what the layout array contains. */
  chartMix: string;
  tilt: Tilt;
  depth: DepthConfig;
  finish: FinishConfig;
  chart: ChartStyle;
  /** Sheet-space drift over the full duration, along the plane's own axis. */
  drift: { fromU: number; toU: number; fromV: number; toV: number };
};

export const VARIANTS: Record<string, Variant> = {
  // #region variant:blue
  blue: {
    name: "blue",
    palette: {
      background: "#E8EEF2",
      paperShade: "#D4DEE6",
      inkDark: "#1B3A6B",
      inkPrimary: "#2E6FD4",
      inkSecondary: "#4FA8E8",
      inkTertiary: "#1B3A6B",
      inkGrey: "#8A96A4",
      textDark: "#2A3542",
      textDim: "#7A8694",
      counterFill: "#1B3A6B",
      counterText: "#FFFFFF",
    },
    layoutMode: "dense",
    contentScale: 1,
    counter: { start: 1965, end: 2028 },
    chartMix:
      "6 donuts (3x2 grid), 2 bar, 3 line, 3 pie, 4 text, 3 value-row groups",
    tilt: { rotateDeg: -14, shear: -0.16, scaleX: 0.91, scaleY: 1 },
    depth: { bandHalfWidth: 620, nearBlur: 12, midBlur: 0, farBlur: 20 },
    finish: {
      paperShadeAlpha: 0.85,
      lightLiftAlpha: 0.075,
      vignetteColor: "#C9A98A",
      vignetteAlpha: 0.08,
      grainAlpha: 0.03,
      scanlines: false,
      scanlineColor: "#000000",
      scanlineAlpha: 0,
      screenGlowColor: "#FFFFFF",
      screenGlowAlpha: 0,
    },
    chart: {
      barTones: ["#2E6FD4", "#4FA8E8"],
      seriesTones: ["#2E6FD4", "#4FA8E8", "#1B3A6B"],
      wedgeTones: ["#2E6FD4", "#4FA8E8", "#1B3A6B", "#8A96A4", "#2E6FD4"],
      donutRemainder: "track",
      donutTrackColor: "#8A96A4",
      donutTrackAlpha: 0.34,
      textBlockOpacity: 1,
      glowBlur: 0,
    },
    drift: { fromU: 0, toU: -620, fromV: 0, toV: -60 },
  },
  // #endregion
  // #region variant:warm
  warm: {
    name: "warm",
    palette: {
      background: "#F5EFE2",
      paperShade: "#EBE2D0",
      inkDark: "#5C3A24",
      inkPrimary: "#C4553A",
      inkSecondary: "#D99A2B",
      inkTertiary: "#7A8A4A",
      inkGrey: "#A89684",
      textDark: "#3D2A1C",
      textDim: "#8A7561",
      counterFill: "#5C3A24",
      counterText: "#F5EFE2",
    },
    layoutMode: "sparse",
    contentScale: 1.7,
    counter: { start: 1900, end: 2000 },
    chartMix: "3 large donuts (single row), 1 wide line, 2 bar, 1 pie, 2 text",
    tilt: { rotateDeg: 11, shear: 0.16, scaleX: 0.91, scaleY: 1 },
    depth: { bandHalfWidth: 600, nearBlur: 12, midBlur: 0, farBlur: 20 },
    finish: {
      paperShadeAlpha: 0.9,
      lightLiftAlpha: 0.08,
      vignetteColor: "#B08A5E",
      vignetteAlpha: 0.08,
      grainAlpha: 0.032,
      scanlines: false,
      scanlineColor: "#000000",
      scanlineAlpha: 0,
      screenGlowColor: "#FFFFFF",
      screenGlowAlpha: 0,
    },
    chart: {
      barTones: ["#C4553A", "#D99A2B", "#7A8A4A"],
      seriesTones: ["#C4553A", "#D99A2B", "#7A8A4A"],
      wedgeTones: ["#C4553A", "#D99A2B", "#7A8A4A", "#5C3A24", "#A89684"],
      donutRemainder: "track",
      donutTrackColor: "#A89684",
      donutTrackAlpha: 0.4,
      textBlockOpacity: 1,
      glowBlur: 0,
    },
    drift: { fromU: 0, toU: -340, fromV: 0, toV: 30 },
  },
  // #endregion
  // #region variant:dark
  dark: {
    name: "dark",
    palette: {
      background: "#0E1218",
      paperShade: "#161C24",
      inkDark: "#E8F4F8",
      inkPrimary: "#4FD4F5",
      inkSecondary: "#2E9FB8",
      inkTertiary: "#E8F4F8",
      inkGrey: "#4A5866",
      textDark: "#C8D8E4",
      textDim: "#5A6A78",
      counterFill: "#4FD4F5",
      counterText: "#0E1218",
    },
    layoutMode: "dense",
    contentScale: 1,
    counter: { start: 2000, end: 2050 },
    chartMix:
      "6 donuts (3x2 grid), 2 bar, 3 line, 3 pie, 4 text, 3 value-row groups",
    tilt: { rotateDeg: -14, shear: -0.16, scaleX: 0.91, scaleY: 1 },
    depth: { bandHalfWidth: 620, nearBlur: 12, midBlur: 0, farBlur: 20 },
    finish: {
      // Strong tonal variation reads as dirt on a dark ground, so keep it faint.
      paperShadeAlpha: 0.4,
      lightLiftAlpha: 0.035,
      vignetteColor: "#000000",
      vignetteAlpha: 0.16,
      grainAlpha: 0.03,
      scanlines: true,
      scanlineColor: "#000000",
      scanlineAlpha: 0.03,
      screenGlowColor: "#4FD4F5",
      screenGlowAlpha: 0.05,
    },
    chart: {
      barTones: ["#4FD4F5", "#2E9FB8"],
      seriesTones: ["#4FD4F5", "#2E9FB8", "#E8F4F8"],
      wedgeTones: ["#4FD4F5", "#2E9FB8", "#E8F4F8", "#4A5866", "#4FD4F5"],
      donutRemainder: "ghost",
      donutTrackColor: "#4FD4F5",
      donutTrackAlpha: 0.2,
      textBlockOpacity: 0.7,
      glowBlur: 14,
    },
    drift: { fromU: 0, toU: -620, fromV: 0, toV: -60 },
  },
  // #endregion
};

export const getVariant = (name: string): Variant => {
  const v = VARIANTS[name];
  if (!v) {
    throw new Error(`Unknown variant "${name}"`);
  }
  return v;
};
