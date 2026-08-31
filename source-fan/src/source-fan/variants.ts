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
 * The shape of the fan, in fractions of composition height.
 *
 * Each strand leaves its node almost horizontally, bends up or down onto its
 * own row, and then runs flat along that row — so the second control point and
 * the endpoint share a vertical offset and the tail is horizontal. `splay` is
 * extra spread carried only by the second control point: it opens the fan out
 * in mid-flight without widening the band it settles into, which is what makes
 * a collecting fan (v2) narrow as it travels.
 */
export interface SpreadProfile {
  /** Offset of the first control point — small keeps the origin pinched. */
  readonly c1: number;
  /** Half-height of the band of rows the strands settle onto. */
  readonly end: number;
  /** Extra mid-flight spread at the second control point. */
  readonly splay: number;
  /** How far past its row the second control point sits, as a multiplier. */
  readonly overshoot: number;
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
  /**
   * Glyph slots the pattern repeats over, and slots it drifts per loop. The
   * loop only closes when driftSlots is a multiple of patternSlots, so make
   * the pattern longer than the frame and drift it exactly one pattern: the
   * bands then scroll without ever showing a seam or a visible repeat.
   */
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
    // Pinched at the node, bending out onto rows that span the frame: broadcast.
    spread: { c1: 0.008, end: 0.42, splay: 0, overshoot: 1.38 },
    flowStops: { c1: 0.013, c2: 0.065, end: 0.5 },
    gather: 0.85,
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
      uStart: 0.42,
      uEnd: 0.985,
      rows: 90,
      baseGap: 0.0032,
      gapGrowth: 3.4,
      sizeMin: 3.5,
      sizeMax: 9,
      rowTrack: 0,
      flashChance: 0.006,
      brightChance: 0.2,
      rowFalloff: 0.18,
    },
    backdrop: {
      orientation: "vertical",
      glyphStep: 46,
      lineStep: 54,
      patternSlots: 48,
      driftSlots: 48,
      bandLines: 5,
      bandStride: 7,
      fontSize: 34,
      alpha: 1,
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
    // Opens wide in mid-flight, then gathers onto a narrow band: collection.
    spread: { c1: 0.05, end: 0.16, splay: 0.24, overshoot: 1.38 },
    flowStops: { c1: 0.018, c2: 0.088, end: 0.68 },
    gather: 0.25,
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
      uStart: 0.55,
      uEnd: 0.99,
      rows: 96,
      baseGap: 0.0026,
      gapGrowth: 3,
      sizeMin: 3,
      sizeMax: 6.5,
      rowTrack: 0,
      flashChance: 0.006,
      brightChance: 0.26,
      rowFalloff: 0.15,
    },
    backdrop: {
      orientation: "horizontal",
      glyphStep: 40,
      lineStep: 52,
      patternSlots: 96,
      driftSlots: 96,
      bandLines: 5,
      bandStride: 7,
      fontSize: 30,
      alpha: 0.72,
      glyphs: GLYPHS,
    },
    vignetteStrength: 0.2,
    grainAlpha: 0.04,
  },
};
