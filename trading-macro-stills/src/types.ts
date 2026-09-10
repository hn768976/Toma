import type { ColorKey } from "./palettes";

/* ── element specs ─────────────────────────────────────────────────────── */

export type CandlesSpec = {
  kind: "candles";
  /** Layers sharing a tag show the same market. Match `count` and
   *  `volatility` across them or the series will diverge. */
  series?: string;
  /** How many candles span the layer. Low counts read as wide candles. */
  count: number;
  /** Body width in layer pixels (~22 at 4K for a normal series). */
  bodyWidth: number;
  /** Wick width in layer pixels (~4 at 4K). */
  wickWidth: number;
  volatility: number;
  hollowRate: number;
  /** Vertical fraction of the layer the price range occupies. */
  fill: number;
  gain: number;
};

export type CurveDef = {
  color: ColorKey;
  /** Smoothing length; larger is lazier and further from the price. */
  window: number;
  width: number;
  /** Dash pattern in layer pixels. Omit for a solid curve. */
  dash?: [number, number];
  glow: number;
  /** Vertical offset as a fraction of layer height. */
  offset?: number;
  amplitude?: number;
  /** Linear climb across the layer, as a fraction of layer height. */
  rise?: number;
  /** Draw as a polyline through sampled nodes rather than a smooth curve. */
  angular?: number;
  /** Node dot radius in layer pixels. 0 or absent for none. */
  nodes?: number;
};

export type CurvesSpec = {
  kind: "curves";
  /** The price series the curves are smoothed from. */
  source: { count: number; volatility: number; series?: string };
  fill: number;
  curves: CurveDef[];
};

export type BinarySpec = {
  kind: "binary";
  fontSize: number;
  /** Extra tracking as a fraction of the character advance. */
  tracking: number;
  lineHeight: number;
  /** Fraction of characters drawn at full brightness. */
  brightRate: number;
  gain: number;
};

export type NumericSpec = {
  kind: "numeric";
  fontSize: number;
  lineHeight: number;
  columns: number;
  /** Fraction of rows carrying an invented three or four letter code. */
  labelRate: number;
  /** Fraction of values drawn in the contrasting colour. */
  accentRate: number;
  accent: ColorKey;
  gain: number;
};

export type CodeSpec = {
  kind: "code";
  fontSize: number;
  lineHeight: number;
  gain: number;
};

export type GridSpec = {
  kind: "grid";
  /** Cell size in layer pixels. */
  pitch: number;
  lineWidth: number;
  gain: number;
};

export type DotsSpec = {
  kind: "dots";
  cell: number;
  dot: number;
  /** Number of brighter clusters seeded across the panel. */
  clusters: number;
  gain: number;
};

export type ElementSpec =
  | CandlesSpec
  | CurvesSpec
  | BinarySpec
  | NumericSpec
  | CodeSpec
  | GridSpec
  | DotsSpec;

/* ── layers ────────────────────────────────────────────────────────────── */

export type LayerSpec = {
  id: string;
  /** 0 is nearest the lens, 1 is furthest away. */
  depth: number;
  /** Centre and size as fractions of the frame. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** In-plane rotation in degrees. Neighbouring layers must differ. */
  rotate: number;
  /**
   * Far-edge height over near-edge height. Below 1 the layer recedes to the
   * right, above 1 to the left. This is what separates the layers into
   * distinct physical screens rather than one flat image.
   */
  keystone: number;
  shear: number;
  /** Radius of the layer-wide bloom pass, in layer pixels. */
  glow: number;
  /** Overrides the depth-derived value when present. */
  scale?: number;
  opacity: number;
  /** Alpha ramp across the layer: from, to, and the ramp's angle in degrees. */
  fade?: { from: number; to: number; angle: number };
  /** -1 fully cool, +1 fully warm, 0 untouched. */
  warmth?: number;
  content: ElementSpec;
};

export type FlareSpec = {
  /** Position as a fraction of the frame. May sit outside 0..1. */
  x: number;
  y: number;
  /** Core radius as a fraction of frame width. */
  core: number;
  halo: number;
  intensity: number;
  /** +1 warm, -1 cool. */
  warmth: number;
  /** Anamorphic streak width as a fraction of frame width. */
  streak: number;
  /** Streak height as a fraction of its width — keep this small. */
  streakRatio: number;
  streakAlpha: number;
  /** Chromatic split at the streak ends, fraction of frame width. */
  fringe: number;
  ghosts: number;
};

export type CompositionSpec = {
  id: string;
  /** Which depth is sharp. Everything either side of it blurs. */
  focusDepth: number;
  /** Half-width of the sharp band, and of the mid band, in depth units. */
  focusBand: number;
  midBand: number;
  /** Blur radius for each of the five buffers, far to near, in 4K pixels. */
  bracketBlur: [number, number, number, number, number];
  /** Brightness applied before each buffer is blurred, so soft layers bloom. */
  bracketBloom: [number, number, number, number, number];
  background: {
    /** Broad wash behind everything. */
    tint: ColorKey;
    tintAlpha: number;
    tintX: number;
    tintY: number;
    vignette: number;
    grain: number;
    /** Overall gain on the layer stack. Below 1 for the quieter setups. */
    exposure: number;
  };
  layers: LayerSpec[];
  flare: FlareSpec;
};
