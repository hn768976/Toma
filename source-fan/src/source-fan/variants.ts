/**
 * The ONE place where colour, labels, source count, fan direction and the
 * dot-field settings live. Nothing else in the project contains a hex
 * literal or a label string.
 */

export type VariantName = "blue" | "dark";

export interface Palette {
  /** Flat base fill of the frame. */
  readonly backgroundDeep: string;
  /** Broad soft radial wash sitting on the base. */
  readonly backgroundWash: string;
  /** The illegible character bands. */
  readonly backdropText: string;
  /** The desaturated mid-strand tone. */
  readonly strandPale: string;
  /** What every strand converges to at its far end. */
  readonly strandWhite: string;
  /** One per source node, in node order. */
  readonly nodeHues: readonly string[];
  /** Dot-field palette: the node hues plus white. */
  readonly dotHues: readonly string[];
  readonly vignette: string;
  readonly grain: string;
}

export interface SourceSpec {
  readonly label: string;
  /** Vertical placement as a fraction of composition height. */
  readonly yFraction: number;
  /** Frames per pulse. Must divide 600, and differ between nodes. */
  readonly pulsePeriod: number;
}

/**
 * Vertical spread of the fan at each control point, as a fraction of
 * composition height. A profile that grows (c1 < c2 < end) broadcasts; one
 * that shrinks (c1 > c2 > end) collects.
 */
export interface SpreadProfile {
  readonly c1: number;
  readonly c2: number;
  readonly end: number;
}

/** Where each control point sits along the flow, 0 = node, 1 = far edge. */
export interface FlowStops {
  readonly c1: number;
  readonly c2: number;
  readonly end: number;
}

export interface DotFieldConfig {
  /** Field extent in flow space; 0 is the node edge, 1 the far edge. */
  readonly uStart: number;
  readonly uEnd: number;
  readonly rows: number;
  /** Mean gap between dots in a row, in flow units, at the dense end. */
  readonly baseGap: number;
  /** How much the gap grows toward the far edge (density falloff). */
  readonly gapGrowth: number;
  readonly sizeMin: number;
  readonly sizeMax: number;
  /** Vertical extent of the field as fractions of height. */
  readonly yTop: number;
  readonly yBottom: number;
  /**
   * How rows track the strands: positive spreads rows apart across the
   * field (a broadcasting fan), negative draws them together (a collecting one).
   */
  readonly rowTrack: number;
  /** Share of dots that flash hard rather than breathe. */
  readonly flashChance: number;
  /** Share of dots that are bright rather than dim. */
  readonly brightChance: number;
  /**
   * How much the outer rows thin out. 0 fills the band evenly; higher values
   * pull the field into a lens that matches where the strands arrive.
   */
  readonly rowFalloff: number;
}

export interface BackdropConfig {
  readonly orientation: "vertical" | "horizontal";
  /** Distance between glyph slots along the drift axis. */
  readonly glyphStep: number;
  /** Distance between adjacent character lines across the drift axis. */
  readonly lineStep: number;
  /** Glyph slots the pattern repeats over, and slots it drifts per loop. */
  readonly patternSlots: number;
  readonly driftSlots: number;
  /** Lines are grouped into bands: `bandLines` drawn out of every `bandStride`. */
  readonly bandLines: number;
  readonly bandStride: number;
  readonly fontSize: number;
  readonly alpha: number;
  readonly glyphs: string;
}

export interface VariantConfig {
  readonly palette: Palette;
  readonly sources: readonly SourceSpec[];
  /** +1 puts the nodes on the left and sweeps right; -1 mirrors everything. */
  readonly fanDirection: 1 | -1;
  /** Distance of the nodes from their edge, as a fraction of width. */
  readonly nodeEdgeFraction: number;
  readonly strandsPerNode: number;
  readonly spread: SpreadProfile;
  readonly flowStops: FlowStops;
  /** How strongly strand ends are pulled toward the common centre line. */
  readonly gather: number;
  readonly strandWidthMin: number;
  readonly strandWidthMax: number;
  readonly strandAlphaMin: number;
  readonly strandAlphaMax: number;
  readonly nodeCoreRadius: number;
  readonly nodeHaloRadius: number;
  readonly labelSize: number;
  readonly labelSpacing: number;
  readonly labelGap: number;
  readonly dotField: DotFieldConfig;
  readonly backdrop: BackdropConfig;
  readonly vignetteStrength: number;
  readonly grainAlpha: number;
}

const GLYPHS = "01<>{}[]/\\|=+-*#$%&@?!:;.,^~_ABCDEFGHJKLMNPQRSTUVWXYZ";

export const VARIANTS: Record<VariantName, VariantConfig> = {
  blue: {
    palette: {
      backgroundDeep: "#0A1A4A",
      backgroundWash: "#14306B",
      backdropText: "#16326B",
      strandPale: "#C8D8F5",
      strandWhite: "#FFFFFF",
      nodeHues: ["#3FD4F5", "#F0F4FF", "#F5483F"],
      dotHues: ["#4FC4F5", "#E8F0FF", "#F5606B", "#FFFFFF"],
      vignette: "#000000",
      grain: "#FFFFFF",
    },
    sources: [
      { label: "DATA 1", yFraction: 0.255, pulsePeriod: 120 },
      { label: "DATA 2", yFraction: 0.465, pulsePeriod: 150 },
      { label: "DATA 3", yFraction: 0.715, pulsePeriod: 200 },
    ],
    fanDirection: 1,
    nodeEdgeFraction: 0.11,
    strandsPerNode: 70,
    // Pinched at the node, opening as it travels: broadcast.
    spread: { c1: 0.011, c2: 0.16, end: 0.46 },
    flowStops: { c1: 0.1, c2: 0.55, end: 1 },
    gather: 0,
    strandWidthMin: 1,
    strandWidthMax: 2.5,
    strandAlphaMin: 0.25,
    strandAlphaMax: 0.9,
    nodeCoreRadius: 11,
    nodeHaloRadius: 260,
    labelSize: 36,
    labelSpacing: 9,
    labelGap: 110,
    dotField: {
      uStart: 0.48,
      uEnd: 0.985,
      rows: 54,
      baseGap: 0.0048,
      gapGrowth: 2.4,
      sizeMin: 3.5,
      sizeMax: 9,
      yTop: 0.05,
      yBottom: 0.95,
      rowTrack: 0.22,
      flashChance: 0.006,
      brightChance: 0.2,
      rowFalloff: 0.2,
    },
    backdrop: {
      orientation: "vertical",
      glyphStep: 46,
      lineStep: 62,
      patternSlots: 24,
      driftSlots: 24,
      bandLines: 4,
      bandStride: 7,
      fontSize: 34,
      alpha: 0.9,
      glyphs: GLYPHS,
    },
    vignetteStrength: 0.2,
    grainAlpha: 0.04,
  },
  dark: {
    palette: {
      backgroundDeep: "#05070C",
      backgroundWash: "#0E1622",
      backdropText: "#142030",
      strandPale: "#B8C4D0",
      strandWhite: "#FFFFFF",
      nodeHues: ["#4FE87A", "#F5B04F", "#F0F4F8", "#9B5FE8", "#3FC4B8"],
      dotHues: ["#6FE89F", "#F5C47F", "#B08FF5", "#FFFFFF"],
      vignette: "#000000",
      grain: "#FFFFFF",
    },
    sources: [
      { label: "NODE 01", yFraction: 0.345, pulsePeriod: 100 },
      { label: "NODE 02", yFraction: 0.425, pulsePeriod: 120 },
      { label: "NODE 03", yFraction: 0.5, pulsePeriod: 150 },
      { label: "NODE 04", yFraction: 0.578, pulsePeriod: 200 },
      { label: "NODE 05", yFraction: 0.662, pulsePeriod: 300 },
    ],
    fanDirection: -1,
    nodeEdgeFraction: 0.105,
    strandsPerNode: 45,
    // Spread at the node, narrowing as it travels: collection.
    spread: { c1: 0.155, c2: 0.105, end: 0.028 },
    flowStops: { c1: 0.11, c2: 0.55, end: 1 },
    gather: 0.62,
    strandWidthMin: 1,
    strandWidthMax: 2.2,
    strandAlphaMin: 0.25,
    strandAlphaMax: 0.9,
    nodeCoreRadius: 7,
    nodeHaloRadius: 170,
    labelSize: 28,
    labelSpacing: 7,
    labelGap: 96,
    dotField: {
      uStart: 0.63,
      uEnd: 0.99,
      rows: 66,
      baseGap: 0.003,
      gapGrowth: 2.8,
      sizeMin: 3,
      sizeMax: 6.5,
      yTop: 0.2,
      yBottom: 0.8,
      rowTrack: -0.2,
      flashChance: 0.006,
      brightChance: 0.26,
      rowFalloff: 0.75,
    },
    backdrop: {
      orientation: "horizontal",
      glyphStep: 40,
      lineStep: 58,
      patternSlots: 24,
      driftSlots: 24,
      bandLines: 4,
      bandStride: 7,
      fontSize: 30,
      alpha: 0.5,
      glyphs: GLYPHS,
    },
    vignetteStrength: 0.2,
    grainAlpha: 0.04,
  },
};
