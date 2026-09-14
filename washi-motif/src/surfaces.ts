import type { MotifSpec, PaperTone } from "./types";
import type { PaletteName } from "./palettes";

/** Which ground a surface is printed on, and how that ground behaves. */
export type GroundSpec = {
  readonly kind: "washi" | "cloth" | "metallic" | "wash";
  /** Overrides the tone inferred from the palette's paper colour. */
  readonly tone?: PaperTone;
  readonly fibreDensity?: number;
  readonly grain?: number;
  /** Below 1 for an evenly formed sheet: less blotching, flatter light. */
  readonly mottle?: number;
  readonly light?: number;
  /** Corners pulled down. Applied last, over the motifs. */
  readonly vignette?: number;
  /* cloth */
  readonly weave?: number;
  /* metallic */
  readonly angle?: number;
  readonly sheen?: number;
  readonly crease?: number;
  readonly granulation?: number;
  readonly hotspot?: { readonly x: number; readonly y: number; readonly r: number };
  /* wash */
  readonly blooms?: number;
  readonly bloomScale?: number;
  readonly pigment?: number;
};

/**
 * A SURFACE: a full-bleed texture rather than a bordered composition.
 *
 * The motif set keeps its centre open because it is made to be typed over.
 * These are the opposite product — the sheet itself, edge to edge — so there
 * is no open-centre rule here and the guard does not apply.
 *
 * Each surface names the palette it was designed for; the renderer will still
 * accept any of them.
 */
export type SurfaceSpec = {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly palette: PaletteName;
  readonly ground: GroundSpec;
  readonly motifs: readonly MotifSpec[];
};

const TABLE = {
  /* ── s01 ── A green board: woven cloth, chalk haze, heavy vignette. */
  s01: {
    id: "s01",
    label: "Green board",
    note: "Woven green board with chalk haze and a heavy vignette.",
    palette: "boardGreen",
    ground: { kind: "cloth", weave: 6, vignette: 0.52, grain: 8, mottle: 0.45 },
    motifs: [],
  },

  /* ── s02 ── Seigaiha over the whole sheet, in deeper red on red. */
  s02: {
    id: "s02",
    label: "Seigaiha field",
    note: "Wave-scale pattern over the whole sheet, deeper red on red.",
    palette: "crimsonWave",
    ground: { kind: "washi", fibreDensity: 0.9, vignette: 0.45, mottle: 0.5 },
    motifs: [
      {
        motif: "seigaihaField",
        fill: "outline",
        x: 0.5,
        y: 0.5,
        r: 0.1,
        unit: 0.145,
        rings: 5,
        tonal: 0.3,
        ink: 0,
        alpha: 1,
        stroke: 0.0024,
      },
    ],
  },

  /* ── s03 ── A plain, densely fibrous sheet. Nothing on it at all. */
  s03: {
    id: "s03",
    label: "Lime fibre paper",
    note: "Plain yellow-green sheet, dense even fibre, no motif.",
    palette: "limePaper",
    ground: { kind: "washi", fibreDensity: 1.55, mottle: 0.18, light: 0.15 },
    motifs: [],
  },

  /* ── s04 ── Beaten gold leaf: strong diagonal sheen and heavy creasing. */
  s04: {
    id: "s04",
    label: "Gold leaf",
    note: "Beaten leaf with a strong diagonal sheen and heavy creasing.",
    palette: "goldLeaf",
    ground: {
      kind: "metallic",
      angle: 32,
      sheen: 1.45,
      crease: 5200,
      fibreDensity: 0.9,
      granulation: 600,
    },
    motifs: [],
  },

  /* ── s05 ── Plain vermilion washi. */
  s05: {
    id: "s05",
    label: "Vermilion paper",
    note: "Plain red washi with soft mottling.",
    palette: "vermilionPaper",
    ground: { kind: "washi", fibreDensity: 1.1, mottle: 0.45, light: 0.4 },
    motifs: [],
  },

  /* ── s06 ── Plain navy washi. */
  s06: {
    id: "s06",
    label: "Navy paper",
    note: "Plain navy washi, fine pale fibre.",
    palette: "navyPaper",
    ground: { kind: "washi", fibreDensity: 1, mottle: 0.45, light: 0.4 },
    motifs: [],
  },

  /* ── s07 ── A warm watercolour sky. */
  s07: {
    id: "s07",
    label: "Peach wash",
    note: "Warm watercolour sky, pink into apricot.",
    palette: "peachWash",
    ground: {
      kind: "wash",
      blooms: 44,
      bloomScale: 0.72,
      pigment: 1.2,
      granulation: 1300,
    },
    motifs: [],
  },

  /* ── s08 ── Black paper torn across by gold leaf, struck with splatter. */
  s08: {
    id: "s08",
    label: "Sumi and gold sweep",
    note: "Gold leaf across black paper on a torn diagonal, with splatter.",
    palette: "sumiGold",
    ground: { kind: "washi", fibreDensity: 0.85 },
    motifs: [
      {
        motif: "foilSweep",
        fill: "metallic",
        x: 0.58,
        y: 0.5,
        r: 0.5,
        rotate: -72,
        roughness: 0.02,
        aspect: 0.055,
        dryBrush: 0,
        ink: 0,
        fillAngle: -72,
      },
      {
        motif: "splatter",
        fill: "solid",
        x: 0.4,
        y: 0.46,
        r: 0.1,
        aspect: 3.2,
        rotate: -72,
        ink: 0,
        fillDensity: 1.1,
      },
      {
        motif: "splatter",
        fill: "solid",
        x: 0.3,
        y: 0.2,
        r: 0.035,
        aspect: 3,
        rotate: -66,
        ink: 1,
        fillDensity: 0.45,
      },
    ],
  },

  /* ── s09 ── An amber watercolour with stains settling out of it. */
  s09: {
    id: "s09",
    label: "Amber wash",
    note: "Amber watercolour with granulating stains.",
    palette: "amberWash",
    ground: {
      kind: "wash",
      blooms: 30,
      bloomScale: 0.6,
      pigment: 0.72,
      granulation: 2400,
    },
    motifs: [],
  },

  /* ── s10 ── Large translucent discs over gold leaf. */
  s10: {
    id: "s10",
    label: "Gold discs",
    note: "Large overlapping translucent discs over fibrous gold leaf.",
    palette: "goldLeaf",
    ground: {
      kind: "metallic",
      angle: 18,
      sheen: 0.8,
      crease: 2600,
      fibreDensity: 1.15,
    },
    motifs: [
      { motif: "circle", fill: "solid", x: 0.17, y: 0.29, r: 0.46, ink: 0, alpha: 0.28 },
      { motif: "circle", fill: "solid", x: 0.63, y: 0.09, r: 0.42, ink: 1, alpha: 0.2 },
      { motif: "circle", fill: "solid", x: 0.81, y: 0.63, r: 0.5, ink: 0, alpha: 0.26 },
      { motif: "circle", fill: "solid", x: 0.34, y: 0.93, r: 0.44, ink: 1, alpha: 0.18 },
    ],
  },

  /* ── s11 ── Soft discs on cream, each edged with one thin gold line. */
  s11: {
    id: "s11",
    label: "Cream discs",
    note: "Soft tonal discs on cream, each edged with a thin gold line.",
    palette: "creamPaper",
    ground: { kind: "washi", fibreDensity: 0.8 },
    motifs: [
      { motif: "circle", fill: "solid", x: 0.38, y: 0.29, r: 0.4, ink: 1, alpha: 0.3 },
      { motif: "ring", fill: "outline", x: 0.38, y: 0.29, r: 0.4, ink: 0, stroke: 0.0013 },
      { motif: "circle", fill: "solid", x: 0.11, y: 0.81, r: 0.3, ink: 1, alpha: 0.26 },
      { motif: "ring", fill: "outline", x: 0.11, y: 0.81, r: 0.3, ink: 0, stroke: 0.0008 },
      { motif: "circle", fill: "solid", x: 0.81, y: 0.93, r: 0.42, ink: 1, alpha: 0.28 },
      { motif: "ring", fill: "outline", x: 0.81, y: 0.93, r: 0.42, ink: 0, stroke: 0.0008 },
    ],
  },

  /* ── s12 ── White washi with dry-brushed gold in opposite corners. */
  s12: {
    id: "s12",
    label: "Gold brush corners",
    note: "Dry-brushed gold in opposite corners of a white sheet.",
    palette: "shiroGold",
    ground: { kind: "washi", fibreDensity: 1.2 },
    motifs: [
      {
        motif: "foilSweep",
        fill: "metallic",
        x: 0.16,
        y: 0.19,
        r: 0.5,
        rotate: 142,
        roughness: 0.026,
        aspect: 0.03,
        dryBrush: 0,
        ink: 0,
        fillAngle: 142,
      },
      {
        motif: "foilSweep",
        fill: "metallic",
        x: 0.85,
        y: 0.82,
        r: 0.5,
        rotate: -38,
        roughness: 0.026,
        aspect: 0.03,
        dryBrush: 0,
        ink: 0,
        fillAngle: -38,
      },
    ],
  },

  /* ── s13 ── Polished gold: one soft highlight, fine sparkle, few creases. */
  s13: {
    id: "s13",
    label: "Gold sheen",
    note: "Polished gold with one soft highlight and a fine sparkle.",
    palette: "goldLeaf",
    ground: {
      kind: "metallic",
      angle: 28,
      sheen: 0.8,
      crease: 700,
      granulation: 4600,
      fibreDensity: 0.25,
      hotspot: { x: 0.78, y: 0.1, r: 0.62 },
    },
    motifs: [],
  },

  /* ── s14 ── White brush rings, drawn over one another. */
  s14: {
    id: "s14",
    label: "White brush rings",
    note: "Overlapping brush-drawn rings, white on near-white.",
    palette: "shiroWhite",
    ground: { kind: "washi", fibreDensity: 1.1 },
    motifs: [
      { motif: "brushRing", fill: "outline", x: 0.18, y: 0.21, r: 0.36, ink: 0, strokes: 6, stroke: 0.0045 },
      { motif: "brushRing", fill: "outline", x: 0.55, y: 0.11, r: 0.3, ink: 0, strokes: 5, stroke: 0.004 },
      { motif: "brushRing", fill: "outline", x: 0.83, y: 0.41, r: 0.4, ink: 0, strokes: 6, stroke: 0.0048 },
      { motif: "brushRing", fill: "outline", x: 0.31, y: 0.81, r: 0.34, ink: 0, strokes: 6, stroke: 0.0042 },
      { motif: "brushRing", fill: "outline", x: 0.71, y: 0.91, r: 0.32, ink: 0, strokes: 5, stroke: 0.004 },
      { motif: "brushRing", fill: "outline", x: 0.02, y: 0.59, r: 0.26, ink: 0, strokes: 4, stroke: 0.0036 },
    ],
  },

  /* ── s15 ── Plain sumi-black washi. */
  s15: {
    id: "s15",
    label: "Sumi black paper",
    note: "Plain near-black washi, fine pale fibre.",
    palette: "sumiBlack",
    ground: { kind: "washi", fibreDensity: 0.9, mottle: 0.45, light: 0.4 },
    motifs: [],
  },

  /* ── s16 ── Plain kraft washi, flecked with fibre. */
  s16: {
    id: "s16",
    label: "Kraft paper",
    note: "Plain kraft washi, heavily flecked with fibre.",
    palette: "kraftPaper",
    ground: { kind: "washi", fibreDensity: 1.65, mottle: 0.4, light: 0.4 },
    motifs: [],
  },

  /* ── s17 ── A pale blue watercolour sky. */
  s17: {
    id: "s17",
    label: "Sky wash",
    note: "Pale blue watercolour sky, soft and cool.",
    palette: "skyWash",
    ground: {
      kind: "wash",
      blooms: 36,
      bloomScale: 0.9,
      pigment: 0.85,
      granulation: 900,
      fibreDensity: 0.3,
    },
    motifs: [],
  },
} as const satisfies Record<string, SurfaceSpec>;

export type SurfaceName = keyof typeof TABLE;

/** The table, widened so optional fields stay visible to the renderer. */
export const SURFACES: Record<SurfaceName, SurfaceSpec> = TABLE;

export const SURFACE_NAMES = Object.keys(TABLE) as SurfaceName[];
