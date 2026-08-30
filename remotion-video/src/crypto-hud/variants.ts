/**
 * Every colour, geometry and behaviour switch that separates the two versions
 * lives in this file. Nothing else in `crypto-hud/` may contain a hex literal.
 */

export type VariantName = "cyan" | "blue";
export type SymbolType = "bitcoin" | "generic";
export type RingMode = "continuous" | "brokenArcs";
export type BokehDensity = "sparse" | "dense";
export type Depth = "near" | "mid" | "far";

export type Palette = {
  /** Flat base colour of the frame. */
  backgroundDeep: string;
  /** Broad radial wash sitting behind the symbol. */
  backgroundWash: string;
  /** Body fill of the glyph. */
  symbolMain: string;
  /** Hot core burning through the middle of the glyph. */
  symbolCore: string;
  /** Ticks, dashes and blocks on the ring bands. */
  ringMain: string;
  /** The dim guide line each band is built on. */
  ringDim: string;
  /** Dominant bokeh hue. */
  bokehPrimary: string;
  /** Warm accent hue, roughly one disc in five. */
  bokehWarm: string;
  /** Third scattered hue. */
  bokehAccent: string;
  /** Chromatic fringe pushed one way. */
  fringeA: string;
  /** Chromatic fringe pushed the other way. */
  fringeB: string;
};

/** An arc measured in degrees, expressed inside a single symmetry sector. */
export type ArcSpec = { start: number; span: number };

export type BandSpec = {
  id: string;
  /** Fraction of the ring field's outer radius. */
  radius: number;
  /** Radial extent, in 4K pixels, that ticks and blocks live inside. */
  thickness: number;
  /**
   * How many times the band's artwork repeats around the circle. The sprite is
   * built once per sector and stamped `symmetry` times, so rotating by
   * 2*PI/symmetry maps the band exactly onto itself.
   */
  symmetry: number;
  /**
   * Symmetry periods travelled across the 900-frame loop. Always a multiple of
   * `symmetry`, i.e. a whole number of full turns: rotating the sprite by a
   * fraction of a turn resamples its pixel grid differently from 0deg, so only
   * whole turns make frame 900 byte-identical to frame 0.
   */
  periods: number;
  /** Base direction, multiplied by the variant's rotationDirection. */
  spin: 1 | -1;
  /** Bakes a wider bloom into the band's sprite. */
  bright: boolean;
  /** Ticks / dashes / blocks generated per sector. */
  tickCount: number;
  dashCount: number;
  blockCount: number;
  depth: Exclude<Depth, "far">;
  /** brokenArcs only: the disconnected segments inside one sector. */
  arcs?: ArcSpec[];
  /** brokenArcs only: a thicker, brighter arc reading as a progress indicator. */
  progressArc?: ArcSpec;
};

export type VariantConfig = {
  palette: Palette;
  symbolType: SymbolType;
  ringMode: RingMode;
  /** +1 spins the innermost band clockwise, -1 reverses every band. */
  rotationDirection: 1 | -1;
  bokehDensity: BokehDensity;
  bokehCount: number;
  /** Scales every disc's opacity so a dense field does not blow out. */
  bokehOpacityScale: number;
  /** Horizontal flip of the whole composition, applied as one canvas transform. */
  mirror: boolean;
  bands: BandSpec[];
  /** Root string every seeded random in the variant derives from. */
  seed: string;
};

const CYAN_BANDS: BandSpec[] = [
  { id: "c0", radius: 0.5, thickness: 16, symmetry: 60, periods: 120, spin: 1, bright: false, tickCount: 2, dashCount: 1, blockCount: 0, depth: "near" },
  { id: "c1", radius: 0.61, thickness: 34, symmetry: 24, periods: 24, spin: -1, bright: true, tickCount: 3, dashCount: 2, blockCount: 1, depth: "near" },
  { id: "c2", radius: 0.71, thickness: 11, symmetry: 96, periods: 288, spin: 1, bright: false, tickCount: 1, dashCount: 1, blockCount: 0, depth: "near" },
  { id: "c3", radius: 0.81, thickness: 40, symmetry: 18, periods: 18, spin: -1, bright: true, tickCount: 4, dashCount: 3, blockCount: 2, depth: "near" },
  { id: "c4", radius: 0.91, thickness: 14, symmetry: 48, periods: 96, spin: 1, bright: false, tickCount: 2, dashCount: 1, blockCount: 0, depth: "mid" },
  { id: "c5", radius: 1.0, thickness: 26, symmetry: 30, periods: 30, spin: -1, bright: false, tickCount: 3, dashCount: 2, blockCount: 1, depth: "mid" },
];

/**
 * Eight bands of disconnected arcs. Sector starts differ band to band so no
 * clean radial break ever lines up, and because the bands counter-rotate the
 * gaps sweep past one another.
 */
const BLUE_BANDS: BandSpec[] = [
  { id: "b0", radius: 0.52, thickness: 18, symmetry: 1, periods: 1, spin: 1, bright: false, tickCount: 5, dashCount: 3, blockCount: 1, depth: "near",
    arcs: [{ start: 0, span: 110 }, { start: 140, span: 60 }, { start: 224, span: 95 }] },
  { id: "b1", radius: 0.61, thickness: 30, symmetry: 2, periods: 4, spin: -1, bright: true, tickCount: 4, dashCount: 2, blockCount: 1, depth: "near",
    arcs: [{ start: 5, span: 110 }, { start: 133, span: 37 }] },
  { id: "b2", radius: 0.68, thickness: 12, symmetry: 1, periods: 3, spin: 1, bright: false, tickCount: 3, dashCount: 2, blockCount: 0, depth: "near",
    arcs: [{ start: 22, span: 70 }, { start: 108, span: 52 }, { start: 181, span: 80 }, { start: 286, span: 45 }] },
  { id: "b3", radius: 0.75, thickness: 38, symmetry: 1, periods: 1, spin: -1, bright: true, tickCount: 7, dashCount: 4, blockCount: 2, depth: "near",
    arcs: [{ start: 12, span: 140 }, { start: 190, span: 120 }], progressArc: { start: 322, span: 55 } },
  { id: "b4", radius: 0.81, thickness: 14, symmetry: 3, periods: 6, spin: 1, bright: false, tickCount: 2, dashCount: 1, blockCount: 0, depth: "near",
    arcs: [{ start: 5, span: 55 }, { start: 72, span: 40 }] },
  { id: "b5", radius: 0.88, thickness: 26, symmetry: 1, periods: 1, spin: -1, bright: false, tickCount: 6, dashCount: 3, blockCount: 1, depth: "mid",
    arcs: [{ start: 30, span: 95 }, { start: 152, span: 120 }, { start: 300, span: 45 }] },
  { id: "b6", radius: 0.94, thickness: 16, symmetry: 2, periods: 2, spin: 1, bright: false, tickCount: 3, dashCount: 2, blockCount: 0, depth: "mid",
    arcs: [{ start: 15, span: 70 }, { start: 100, span: 62 }] },
  { id: "b7", radius: 1.0, thickness: 34, symmetry: 1, periods: 2, spin: -1, bright: true, tickCount: 5, dashCount: 3, blockCount: 2, depth: "mid",
    arcs: [{ start: 0, span: 60 }, { start: 78, span: 50 }, { start: 240, span: 45 }, { start: 300, span: 40 }], progressArc: { start: 150, span: 72 } },
];

export const VARIANTS: Record<VariantName, VariantConfig> = {
  cyan: {
    palette: {
      backgroundDeep: "#030A1F",
      backgroundWash: "#0A2452",
      symbolMain: "#3FD8F5",
      symbolCore: "#E8FCFF",
      ringMain: "#4FC4E8",
      ringDim: "#1A5C7A",
      bokehPrimary: "#5FD4F5",
      bokehWarm: "#F5A03F",
      bokehAccent: "#E05FC4",
      fringeA: "#E8455F",
      fringeB: "#3F5FE8",
    },
    symbolType: "bitcoin",
    ringMode: "continuous",
    rotationDirection: 1,
    bokehDensity: "sparse",
    bokehCount: 28,
    bokehOpacityScale: 1,
    mirror: false,
    bands: CYAN_BANDS,
    seed: "crypto-hud-cyan",
  },
  blue: {
    palette: {
      backgroundDeep: "#05061F",
      backgroundWash: "#141C5C",
      symbolMain: "#4F7FFF",
      symbolCore: "#E8EEFF",
      ringMain: "#5F8FE8",
      ringDim: "#24387A",
      bokehPrimary: "#6F9FFF",
      bokehWarm: "#F5C43F",
      bokehAccent: "#3FD4C4",
      fringeA: "#E8455F",
      fringeB: "#3FD4E8",
    },
    symbolType: "generic",
    ringMode: "brokenArcs",
    rotationDirection: -1,
    bokehDensity: "dense",
    bokehCount: 70,
    bokehOpacityScale: 0.7,
    mirror: true,
    bands: BLUE_BANDS,
    seed: "crypto-hud-blue",
  },
};
