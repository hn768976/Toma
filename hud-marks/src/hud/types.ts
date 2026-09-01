/**
 * Shared types for the HUD mark system.
 *
 * A "field" is a plain DATA array of MarkSpec entries. The renderer only ever
 * walks that array — adding, removing or repositioning marks never requires
 * new drawing code. The one exception is a genuinely new shape, which is added
 * to the MarkType union and to the switch inside <Mark>.
 */

export type MarkType =
  | "cornerBracket"
  | "cropMark"
  | "dotColumn"
  | "chevron"
  | "diagonalPair"
  | "crossedX"
  | "arc"
  | "squarePanel"
  | "tickRow"
  | "circleOutline"
  | "dash"
  | "registrationTarget"
  | "colourBar";

/** Semantic palette slots. No mark ever names a colour directly. */
export type ToneKey = "ink" | "dim" | "accent";

export type Palette = {
  bg: string;
  ink: string;
  dim: string;
  accent: string;
  panel: string;
};

/** Per-shape construction options. All optional; every shape has a default. */
export type MarkOpts = {
  /** dotColumn: 1 or 2 parallel columns */
  columns?: number;
  /** dotColumn: number of hollow circles, 6-10 */
  dots?: number;
  /** chevron: stack two chevrons instead of one */
  pair?: boolean;
  /** tickRow: number of ticks */
  ticks?: number;
  /** arc: start angle in degrees (0 = +x, clockwise, y down) */
  start?: number;
  /** arc: swept angle in degrees, 40-120 */
  sweep?: number;
  /** colourBar: number of swatches, 6-8 */
  swatches?: number;
  /** colourBar: which swatch takes the accent colour */
  accentAt?: number;
  /** cropMark: how far the two arms stop short of meeting, in px */
  gap?: number;
};

export type MarkSpec = {
  /** Stable id — seeds this mark's flicker and its shape's internal detail. */
  id: string;
  type: MarkType;
  /** Grid cell. Positions are integers so every mark snaps to the pitch. */
  gx: number;
  gy: number;
  /** Size in grid cells, so extents land on the grid too. */
  wc: number;
  hc: number;
  /** Static rotation in degrees. */
  rot: number;
  tone: ToneKey;
  /** Fade window, in frames. */
  in: number;
  inDur: number;
  out: number;
  outDur: number;
  /** Full turns over the whole composition. Omitted means static. */
  spin?: number;
  /** Whether this mark takes part in the flicker / ink-density pass. */
  flicker?: boolean;
  opts?: MarkOpts;
};

export type FlickerConfig = {
  /** Chance per mark per second of one flicker event. */
  chance: number;
  /** Opacity multiplier while flickering. */
  level: number;
  minDur: number;
  maxDur: number;
};

export type GlitchConfig = {
  minGap: number;
  maxGap: number;
  minDur: number;
  maxDur: number;
  minSlices: number;
  maxSlices: number;
  minShift: number;
  maxShift: number;
  minSliceH: number;
  maxSliceH: number;
  /** Vertical spread of one event's slices, so they read as clustered. */
  cluster: number;
};

export type Phase = { name: string; from: number; to: number };

export type Variant = {
  palette: Palette;
  /** The mark types this version draws from. */
  vocabulary: MarkType[];
  layout: "edgeWeighted" | "centredCluster" | "registration";
  /** Grid pitch in px at 4K. */
  pitch: number;
  /** Uniform stroke weight at 4K. */
  stroke: number;
  peakCount: number;
  phases: Phase[];
  field: MarkSpec[];
  flicker: FlickerConfig | null;
  /** Print's replacement for flicker: slower, gentler under-inking. */
  inkVariation: FlickerConfig | null;
  glitch: GlitchConfig | null;
  grain: { alpha: number; tile: number; frames: number };
  paper: { alpha: number } | null;
};

export type VariantName = "sparse" | "dense";
