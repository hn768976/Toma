/**
 * The single source of truth for every colour and every proportion that
 * differs between the two clips.
 *
 * This is the ONLY module in the project that is allowed to contain a hex
 * colour literal. Everything downstream receives colours as parameters, which
 * is what makes the drawing components palette-agnostic (and therefore
 * extractable into the shared library).
 */

export type VariantName = "blue" | "amber";

/** The four corners, in a fixed order used everywhere. */
export const CORNERS = [
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
] as const;

export type Corner = (typeof CORNERS)[number];

export type Palette = {
  /** Deep base colour the whole composition sits on. */
  backgroundDeep: string;
  /** Slightly lifted hue used for the slow drifting wash. */
  backgroundWash: string;
  /** The frame outline. */
  frameLine: string;
  /** The hot inner core of the outline. */
  frameCore: string;
  /** One hue per corner — the signature of the piece. */
  nodes: Record<Corner, string>;
  /** Leading-edge rain glyphs. */
  rainBright: string;
  /** Body of a rain streak. */
  rainMid: string;
  /** Trailing end of a rain streak. */
  rainDim: string;
  /** The pale spark colour mixed in among the accent hues. */
  sparkPale: string;
};

export type FrameGeometry = {
  /** Plate width as a fraction of composition width. */
  widthFraction: number;
  /** Plate height as a fraction of composition height. */
  heightFraction: number;
  /** Plate centre X as a fraction of composition width. */
  centerXFraction: number;
  /** Plate centre Y as a fraction of composition height. */
  centerYFraction: number;
  /** Outline stroke width in composition pixels (4K space). */
  strokeWidth: number;
  /** Radius of a corner node's soft halo, in composition pixels. */
  nodeHaloRadius: number;
  /**
   * Multiplier on the anamorphic streak's length. 1 is the natural width for
   * a tall plate; a wide short bar wants more horizontal emphasis.
   */
  streakScale: number;
  /** Whole circuits the travelling perimeter highlight makes in 360 frames. */
  highlightCircuits: number;
};

export type RainConfig = {
  /** Number of falling columns. */
  columns: number;
  /** Smallest glyph size (far columns), in composition pixels. */
  minGlyphSize: number;
  /** Largest glyph size (near columns), in composition pixels. */
  maxGlyphSize: number;
};

export type RuleLinesConfig = {
  /**
   * Vertical distance from the composition centre to each rule, as a fraction
   * of composition height. One rule above, one below.
   */
  offsetFraction: number;
  /** Number of tick marks distributed at irregular intervals along each rule. */
  tickCount: number;
  /** Rule line thickness in composition pixels. */
  thickness: number;
  /** Base opacity of the rules. */
  opacity: number;
};

export type VariantConfig = {
  palette: Palette;
  frame: FrameGeometry;
  rain: RainConfig;
  /** Present only on variants that get the horizontal rule treatment. */
  ruleLines: RuleLinesConfig | null;
};

export const VARIANTS: Record<VariantName, VariantConfig> = {
  /**
   * v1 — cool navy. A roughly 4:3 plate, moderately tall, pushed right of
   * centre so its left edge sits near the composition midline. The open left
   * half is deliberate: it leaves usable space beside the plate.
   */
  blue: {
    palette: {
      backgroundDeep: "#030A24",
      backgroundWash: "#0A1A4A",
      frameLine: "#4F8FE8",
      frameCore: "#E8F2FF",
      nodes: {
        topLeft: "#3FD4F5", // cyan
        topRight: "#E85FC4", // magenta
        bottomLeft: "#F5A03F", // amber
        bottomRight: "#4FE8A8", // mint
      },
      rainBright: "#A8D8F5",
      rainMid: "#4F9FD4",
      rainDim: "#1E4A7A",
      sparkPale: "#C8E8FF",
    },
    frame: {
      // 1500 x 1125 = 4:3, left edge at x = 1980 (midline is 1920).
      widthFraction: 1500 / 3840,
      heightFraction: 1125 / 2160,
      centerXFraction: 2730 / 3840,
      centerYFraction: 0.5,
      strokeWidth: 4,
      nodeHaloRadius: 300,
      streakScale: 1,
      highlightCircuits: 2,
    },
    rain: {
      columns: 140,
      minGlyphSize: 20,
      maxGlyphSize: 56,
    },
    ruleLines: null,
  },

  /**
   * v2 — warm amber. A roughly 5:1 bar, short and broad, centred both ways.
   * A different plate shape for a different use: v1 suits a stacked title,
   * this suits a single line. Denser, smaller rain fills the space the
   * smaller plate leaves open, and two dim horizontal rules give the bar the
   * horizontal context it otherwise lacks.
   */
  amber: {
    palette: {
      backgroundDeep: "#140A02",
      backgroundWash: "#3D2008",
      frameLine: "#F5A03F",
      frameCore: "#FFF4E0",
      nodes: {
        topLeft: "#FFD44F", // gold
        topRight: "#FF6A4F", // coral
        bottomLeft: "#3FD4C4", // teal
        bottomRight: "#9B7FE8", // violet
      },
      rainBright: "#FFE0B8",
      rainMid: "#D48A3F",
      rainDim: "#6B4514",
      sparkPale: "#FFE8C8",
    },
    frame: {
      // 2600 x 520 = 5:1, centred.
      widthFraction: 2600 / 3840,
      heightFraction: 520 / 2160,
      centerXFraction: 0.5,
      centerYFraction: 0.5,
      strokeWidth: 4,
      nodeHaloRadius: 300,
      // The bar's corner nodes sit close together vertically, so the
      // anamorphic streaks are lengthened to match the shape.
      streakScale: 1.5,
      highlightCircuits: 2,
    },
    rain: {
      columns: 260,
      minGlyphSize: 14,
      maxGlyphSize: 40,
    },
    ruleLines: {
      offsetFraction: 500 / 2160,
      tickCount: 26,
      thickness: 2,
      opacity: 0.3,
    },
  },
};

/** The accent hues of a variant: the four node colours plus the pale spark. */
export const accentSet = (variant: VariantConfig): string[] => [
  ...CORNERS.map((corner) => variant.palette.nodes[corner]),
  variant.palette.sparkPale,
];
