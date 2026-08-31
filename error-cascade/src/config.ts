/**
 * Every tunable value for the piece lives here.
 *
 * There is exactly ONE exported VARIANTS object, keyed by variant name. It
 * holds the palette, the dialog style, the spawn curve and the message set.
 * No hex literal appears anywhere else in the project — if you want a new
 * look, you add a key here and nothing else changes.
 */

export type VariantName = "light" | "dark";

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 600;

/** Every dialog is the same size. The uniformity is the joke. */
export const DIALOG_WIDTH = 520;
export const DIALOG_HEIGHT = 190;

export interface Palette {
  background: string;
  dialogFill: string;
  dialogBorder: string;
  dialogBevel: string;
  titleBar: string;
  titleText: string;
  bodyText: string;
  iconCircle: string;
  iconGlyph: string;
  shadow: string;
  /** Grain is drawn as white noise at a very low alpha. */
  grain: string;
}

export interface DialogStyle {
  width: number;
  height: number;
  /** Title bar height as a fraction of the dialog height. */
  titleBarRatio: number;
  borderWidth: number;
  bevelWidth: number;
  /** The bevel highlight has to be far weaker on a dark dialog. */
  bevelAlpha: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  titleFontSize: number;
  bodyFontSize: number;
  /** Radius of the round error icon in the body. */
  iconRadius: number;
  paddingX: number;
}

/**
 * One segment of the spawn curve: `total` dialogs are emitted evenly across
 * frames [from, to), optionally ramping from `rateStart` to `rateEnd` instead.
 * `group` ties a segment to a spawn cluster (used by the "clustered" layout).
 */
export interface SpawnSegment {
  from: number;
  to: number;
  /** Fixed number of dialogs across the whole segment. */
  total?: number;
  /** Per-frame rate ramp; used instead of `total` when present. */
  rateStart?: number;
  rateEnd?: number;
  /** Split a long segment into this many independent clusters. */
  clusters?: number;
}

export type SpawnLayout = "radial" | "clustered";

export interface Messages {
  /** Small label in the title bar. */
  title: string;
  /** The single line of body text. Identical on every dialog, by design. */
  body: string;
}

export interface Variant {
  palette: Palette;
  dialog: DialogStyle;
  /** The spawn curve, as data. Reshaping v2 never touches the spawn logic. */
  spawn: SpawnSegment[];
  layout: SpawnLayout;
  messages: Messages;
  /** Peak rotation jitter, in degrees, applied symmetrically. */
  rotationJitterDeg: number;
  /** Frames the scale-in spring runs for. */
  spawnDurationInFrames: number;
  /** Dialogs pop in from this scale. */
  spawnFromScale: number;
  grainAlpha: number;
}

const BASE_DIALOG: DialogStyle = {
  width: DIALOG_WIDTH,
  height: DIALOG_HEIGHT,
  titleBarRatio: 0.13,
  borderWidth: 2,
  bevelWidth: 1,
  bevelAlpha: 1,
  shadowBlur: 16,
  shadowOffsetX: 7,
  shadowOffsetY: 9,
  titleFontSize: 14,
  bodyFontSize: 18,
  iconRadius: 25,
  paddingX: 20,
};

/**
 * v1 "accelerating": one dialog alone, then a leak that turns into a flood.
 *
 * The brief's stated per-frame rates and its "~600 dialogs by the end" do not
 * quite agree — the literal 2-4/frame flood only reaches ~350 total, which
 * leaves visible gaps in the background. Coverage is the stated intent, so the
 * flood ramps 2 -> FLOOD_PEAK instead of 2 -> 4, landing at ~750 dialogs. The
 * shape (hold, leak, quicken, fast, flood, hold) is exactly as specified.
 */
const LIGHT_FLOOD_PEAK = 13;

const ACCELERATING: SpawnSegment[] = [
  // One dialog, alone at centre. The emptiness is what makes the rest land.
  { from: 0, to: 1, total: 1 },
  { from: 1, to: 60, total: 0 },
  // Slow: roughly one every 20 frames.
  { from: 60, to: 180, rateStart: 1 / 20, rateEnd: 1 / 20 },
  // Quickening: one every 8 frames.
  { from: 180, to: 330, rateStart: 1 / 8, rateEnd: 1 / 8 },
  // Fast: one every 3 frames.
  { from: 330, to: 480, rateStart: 1 / 3, rateEnd: 1 / 3 },
  // Flood.
  { from: 480, to: 570, rateStart: 2, rateEnd: LIGHT_FLOOD_PEAK },
  // Hold. Nothing moves.
  { from: 570, to: 600, total: 0 },
];

/**
 * v2 "bursts": silence, then waves. Each burst is its own cluster, so coverage
 * builds as overlapping patches rather than as an even fill.
 */
const BURSTS: SpawnSegment[] = [
  { from: 0, to: 45, total: 0 },
  { from: 45, to: 75, total: 40, clusters: 1 },
  { from: 75, to: 140, total: 0 },
  { from: 140, to: 175, total: 70, clusters: 1 },
  { from: 175, to: 230, total: 0 },
  { from: 230, to: 265, total: 130, clusters: 2 },
  { from: 265, to: 300, total: 0 },
  // Bursts every ~25 frames, each larger, gaps shortening.
  { from: 300, to: 311, total: 22, clusters: 1 },
  { from: 323, to: 334, total: 28, clusters: 1 },
  { from: 345, to: 356, total: 35, clusters: 1 },
  { from: 366, to: 377, total: 42, clusters: 1 },
  { from: 386, to: 397, total: 50, clusters: 1 },
  { from: 405, to: 417, total: 58, clusters: 2 },
  // Continuous flood, no gaps — still landing as patches, just back to back.
  { from: 420, to: 560, rateStart: 1, rateEnd: 2.4, clusters: 10 },
  // Hold, frame covered.
  { from: 560, to: 600, total: 0 },
];

export const VARIANTS: Record<VariantName, Variant> = {
  light: {
    palette: {
      background: "#000000",
      dialogFill: "#F0F0F0",
      dialogBorder: "#7A7A7A",
      dialogBevel: "#FFFFFF",
      titleBar: "#2E6FD4",
      titleText: "#FFFFFF",
      bodyText: "#1A1A1A",
      iconCircle: "#D93A3A",
      iconGlyph: "#FFFFFF",
      shadow: "rgba(0, 0, 0, 0.35)",
      grain: "#FFFFFF",
    },
    dialog: BASE_DIALOG,
    spawn: ACCELERATING,
    layout: "radial",
    messages: {
      title: "System Notice",
      body: "Critical Error #20326202620261510",
    },
    rotationJitterDeg: 1.5,
    spawnDurationInFrames: 5,
    spawnFromScale: 0.94,
    grainAlpha: 0.02,
  },
  dark: {
    palette: {
      background: "#08090C",
      dialogFill: "#1E2128",
      dialogBorder: "#3A3F48",
      dialogBevel: "#4A5058",
      // The alarm colour moves: title bar red-orange, icon amber.
      titleBar: "#C4442E",
      titleText: "#FFFFFF",
      bodyText: "#D8DCE2",
      iconCircle: "#F5A02E",
      iconGlyph: "#1E2128",
      shadow: "rgba(0, 0, 0, 0.55)",
      grain: "#FFFFFF",
    },
    dialog: {
      ...BASE_DIALOG,
      // A bright top-left edge that reads as a bevel on a pale dialog reads as
      // a rendering error on a dark one.
      bevelAlpha: 0.45,
      shadowBlur: 20,
      shadowOffsetY: 10,
    },
    spawn: BURSTS,
    layout: "clustered",
    messages: {
      title: "System Notice",
      body: "Critical Error #20326202620261510",
    },
    rotationJitterDeg: 1.5,
    spawnDurationInFrames: 5,
    spawnFromScale: 0.94,
    grainAlpha: 0.02,
  },
};
