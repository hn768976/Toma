import type { CompositionSpec } from "./types";
import type { PaletteName } from "./palettes";

/**
 * THE COMPOSITION TABLE.
 *
 * Every value that varies between images lives here: motif type, placement,
 * scale, fill treatment and paper tone. The renderer only walks this table, so
 * adding a composition means adding an entry — never new code.
 *
 * Coordinates are fractions of the frame: `x` of the width, `y` and `r` of the
 * height. Values outside 0..1 are deliberate — that is how a motif gets
 * cropped by the frame edge, which is what makes the set read as a decorative
 * border rather than a scattered pattern.
 *
 * `openCentre` is the protected middle of the frame. Nothing may enter it.
 */
const TABLE = {
  /* ── w01 ──────────────────────────────────────────────────────────────────
     STIPPLE CIRCLES. Large stippled discs around all four edges, most of them
     cropped, with a few thin rings crossing them. The calmest composition.  */
  w01: {
    id: "w01",
    label: "Stipple circles",
    note: "Large stippled discs on all four edges, mostly cropped.",
    tone: "light",
    openCentre: { w: 0.56, h: 0.56 },
    motifs: [
      { motif: "circle", fill: "stipple", x: 0.055, y: -0.055, r: 0.165, ink: 0 },
      { motif: "circle", fill: "stipple", x: 0.215, y: 0.025, r: 0.15, ink: 0, fillDensity: 0.85 },
      { motif: "circle", fill: "stipple", x: 0.375, y: -0.07, r: 0.185, ink: 0 },
      { motif: "circle", fill: "stipple", x: 0.71, y: -0.05, r: 0.175, ink: 0 },
      { motif: "circle", fill: "stipple", x: 0.955, y: -0.02, r: 0.17, ink: 0, fillDensity: 0.9 },
      { motif: "circle", fill: "stipple", x: -0.025, y: 0.295, r: 0.175, ink: 0 },
      { motif: "circle", fill: "stipple", x: 0.005, y: 0.635, r: 0.155, ink: 1, fillDensity: 0.8 },
      { motif: "circle", fill: "stipple", x: 1.015, y: 0.41, r: 0.18, ink: 0 },
      { motif: "circle", fill: "stipple", x: 0.985, y: 0.735, r: 0.15, ink: 0, fillDensity: 0.85 },
      { motif: "circle", fill: "stipple", x: 0.115, y: 1.03, r: 0.175, ink: 0 },
      { motif: "circle", fill: "stipple", x: 0.285, y: 0.965, r: 0.155, ink: 1 },
      { motif: "circle", fill: "stipple", x: 0.455, y: 1.045, r: 0.18, ink: 0 },
      { motif: "circle", fill: "stipple", x: 0.805, y: 1.035, r: 0.17, ink: 0 },
      { motif: "ring", fill: "outline", x: 0.135, y: 0.045, r: 0.16, ink: 2, stroke: 0.0022 },
      { motif: "ring", fill: "outline", x: 0.235, y: 0.955, r: 0.145, ink: 2, stroke: 0.0022 },
      { motif: "ring", fill: "outline", x: 0.895, y: 0.925, r: 0.135, ink: 0, stroke: 0.0018 },
      { motif: "ring", fill: "outline", x: 0.995, y: 0.075, r: 0.13, ink: 0, stroke: 0.0018 },
    ],
  },

  /* ── w02 ──────────────────────────────────────────────────────────────────
     THIN RINGS AND DOT CLUSTERS. Big thin rings sweeping through the corners
     and crossing each other, small dot clusters where they meet, one small
     solid disc. The most open composition.                                  */
  w02: {
    id: "w02",
    label: "Thin rings and dot clusters",
    note: "Sweeping ring outlines crossing at the corners. Very sparse.",
    tone: "light",
    openCentre: { w: 0.6, h: 0.6 },
    fibreDensity: 1.05,
    motifs: [
      { motif: "ring", fill: "outline", x: 0.09, y: -0.2, r: 0.42, ink: 0, stroke: 0.0021 },
      { motif: "ring", fill: "outline", x: -0.1, y: 0.2, r: 0.36, ink: 0, stroke: 0.002 },
      { motif: "ring", fill: "outline", x: 0.235, y: -0.13, r: 0.3, ink: 1, stroke: 0.0019 },
      { motif: "ring", fill: "outline", x: 0.9, y: 1.16, r: 0.38, ink: 0, stroke: 0.0021 },
      { motif: "ring", fill: "outline", x: 1.11, y: 0.78, r: 0.34, ink: 0, stroke: 0.002 },
      { motif: "ring", fill: "outline", x: 0.66, y: 1.19, r: 0.31, ink: 1, stroke: 0.0019 },
      { motif: "ring", fill: "outline", x: 1.06, y: 0.06, r: 0.26, ink: 0, stroke: 0.0019 },
      { motif: "dotCluster", fill: "solid", x: 0.115, y: 0.145, r: 0.062, ink: 0, fillDensity: 1.1 },
      { motif: "dotCluster", fill: "solid", x: 0.325, y: 0.045, r: 0.045, ink: 0, fillDensity: 0.8 },
      { motif: "dotCluster", fill: "solid", x: 0.795, y: 0.885, r: 0.07, ink: 0, fillDensity: 1.3 },
      { motif: "dotCluster", fill: "solid", x: 0.955, y: 0.955, r: 0.05, ink: 0, fillDensity: 0.9 },
      { motif: "dotCluster", fill: "solid", x: 0.045, y: 0.53, r: 0.038, ink: 0, fillDensity: 0.7 },
      { motif: "circle", fill: "solid", x: 0.755, y: 0.055, r: 0.07, ink: 2, alpha: 0.85 },
    ],
  },

  /* ── w03 ──────────────────────────────────────────────────────────────────
     CHRYSANTHEMUM ROW. Formal rosettes along the top and bottom edges only,
     alternating outline-with-line-fill and solid. The left and right edges
     stay nearly empty. The most formal composition in the set.              */
  w03: {
    id: "w03",
    label: "Chrysanthemum row",
    note: "Formal rosette rows on the top and bottom edges only.",
    tone: "light",
    openCentre: { w: 0.56, h: 0.56 },
    motifs: [
      { motif: "chrysanthemum", fill: "lineFill", x: 0.055, y: 0.05, r: 0.145, ink: 1, petals: 12, outline: true, stroke: 0.0026, fillAngle: 25, fillDensity: 0.85 },
      { motif: "chrysanthemum", fill: "solid", x: 0.235, y: -0.005, r: 0.155, ink: 0, petals: 12, rotate: 14 },
      { motif: "chrysanthemum", fill: "lineFill", x: 0.415, y: 0.06, r: 0.14, ink: 1, petals: 12, outline: true, stroke: 0.0026, fillAngle: 115, fillDensity: 0.81, rotate: 7 },
      { motif: "chrysanthemum", fill: "solid", x: 0.6, y: 0, r: 0.16, ink: 0, petals: 12, rotate: 21 },
      { motif: "chrysanthemum", fill: "lineFill", x: 0.785, y: 0.055, r: 0.145, ink: 1, petals: 12, outline: true, stroke: 0.0026, fillAngle: 60, fillDensity: 0.85 },
      { motif: "chrysanthemum", fill: "solid", x: 0.96, y: -0.01, r: 0.15, ink: 0, petals: 12, rotate: 9 },
      { motif: "chrysanthemum", fill: "solid", x: 0.13, y: 1.005, r: 0.155, ink: 0, petals: 12, rotate: 17 },
      { motif: "chrysanthemum", fill: "lineFill", x: 0.315, y: 0.945, r: 0.14, ink: 1, petals: 12, outline: true, stroke: 0.0026, fillAngle: 145, fillDensity: 0.85 },
      { motif: "chrysanthemum", fill: "solid", x: 0.5, y: 1.01, r: 0.16, ink: 0, petals: 12, rotate: 5 },
      { motif: "chrysanthemum", fill: "lineFill", x: 0.685, y: 0.95, r: 0.145, ink: 1, petals: 12, outline: true, stroke: 0.0026, fillAngle: 35, fillDensity: 0.81, rotate: 11 },
      { motif: "chrysanthemum", fill: "solid", x: 0.87, y: 1, r: 0.15, ink: 0, petals: 12, rotate: 23 },
      { motif: "circle", fill: "woven", x: -0.015, y: 0.48, r: 0.06, ink: 1, fillDensity: 0.9 },
      { motif: "circle", fill: "solid", x: 1.008, y: 0.56, r: 0.055, ink: 2 },
    ],
  },

  /* ── w04 ──────────────────────────────────────────────────────────────────
     RING FLOWERS ON DARK. Gold ring-lattice flowers at three corners over
     stippled discs, on near-black paper. The only dark composition.         */
  w04: {
    id: "w04",
    label: "Ring flowers on dark",
    note: "Gold ring-lattice flowers at three corners on near-black washi.",
    tone: "dark",
    openCentre: { w: 0.56, h: 0.56 },
    fibreDensity: 0.9,
    motifs: [
      { motif: "circle", fill: "stipple", x: 0.025, y: 0.185, r: 0.13, ink: 0, fillDensity: 1.1 },
      { motif: "circle", fill: "stipple", x: 0.235, y: -0.05, r: 0.12, ink: 0, fillDensity: 0.9 },
      { motif: "circle", fill: "stipple", x: 0.9, y: 0.905, r: 0.145, ink: 0, fillDensity: 1.1 },
      { motif: "circle", fill: "stipple", x: 0.61, y: 1.04, r: 0.125, ink: 0, fillDensity: 0.95 },
      { motif: "circle", fill: "stipple", x: 0.085, y: 1.02, r: 0.115, ink: 0, fillDensity: 0.85 },
      { motif: "ringFlower", fill: "outline", x: 0.11, y: 0.015, r: 0.245, ink: 0, petals: 7, stroke: 0.0013 },
      { motif: "ringFlower", fill: "outline", x: 0.775, y: 1.065, r: 0.26, ink: 0, petals: 7, stroke: 0.0013, rotate: 12 },
      { motif: "ringFlower", fill: "outline", x: 0.985, y: 0.71, r: 0.215, ink: 0, petals: 7, stroke: 0.0013, rotate: 25 },
      { motif: "ringFlower", fill: "outline", x: 0.015, y: 0.845, r: 0.19, ink: 1, petals: 7, stroke: 0.0013, rotate: 8 },
    ],
  },

  /* ── w05 ──────────────────────────────────────────────────────────────────
     RING FLOWERS ON LIGHT. The same lattice flowers on light paper, with
     woven and line-filled discs interspersed and one seigaiha cluster.
     Denser than w04; all four corners occupied.                             */
  w05: {
    id: "w05",
    label: "Ring flowers on light",
    note: "Lattice flowers with woven and line-filled discs, four corners.",
    tone: "light",
    openCentre: { w: 0.56, h: 0.56 },
    motifs: [
      { motif: "circle", fill: "woven", x: 0.045, y: 0.2, r: 0.115, ink: 1, fillDensity: 1 },
      { motif: "circle", fill: "lineFill", x: 0.265, y: -0.04, r: 0.125, ink: 1, fillAngle: 30 },
      { motif: "circle", fill: "woven", x: 0.925, y: 0.885, r: 0.13, ink: 1 },
      { motif: "circle", fill: "lineFill", x: 0.58, y: 1.04, r: 0.12, ink: 1, fillAngle: 115 },
      { motif: "circle", fill: "woven", x: 0.985, y: 0.145, r: 0.12, ink: 1, fillDensity: 0.9 },
      { motif: "circle", fill: "lineFill", x: 0.04, y: 0.86, r: 0.1, ink: 1, fillAngle: 70 },
      { motif: "seigaiha", fill: "outline", x: 0.435, y: -0.065, r: 0.155, ink: 1, rings: 4, stroke: 0.0012 },
      { motif: "ringFlower", fill: "outline", x: 0.115, y: 0.015, r: 0.235, ink: 0, petals: 7, stroke: 0.0013 },
      { motif: "ringFlower", fill: "outline", x: 0.785, y: 1.055, r: 0.25, ink: 0, petals: 7, stroke: 0.0013, rotate: 12 },
      { motif: "ringFlower", fill: "outline", x: 1.005, y: 0.66, r: 0.22, ink: 0, petals: 7, stroke: 0.0013, rotate: 25 },
      { motif: "ringFlower", fill: "outline", x: -0.02, y: 0.615, r: 0.175, ink: 0, petals: 7, stroke: 0.0013, rotate: 8 },
      { motif: "ringFlower", fill: "outline", x: 0.315, y: 1.06, r: 0.2, ink: 0, petals: 8, stroke: 0.0013, rotate: 18 },
      { motif: "ringFlower", fill: "outline", x: 0.83, y: -0.05, r: 0.185, ink: 0, petals: 7, stroke: 0.0013, rotate: 4 },
    ],
  },

  /* ── w06 ──────────────────────────────────────────────────────────────────
     SAKURA CORNERS. Large metallic blossoms at the upper-left and lower-right
     only, each flanked by two smaller ones. The other two corners are empty.
     The boldest composition, and the one with the fewest elements.          */
  w06: {
    id: "w06",
    label: "Sakura corners",
    note: "Metallic cherry blossoms on one diagonal, two corners left empty.",
    tone: "light",
    openCentre: { w: 0.56, h: 0.56 },
    motifs: [
      { motif: "sakura", fill: "metallic", x: 0.055, y: 0.03, r: 0.285, ink: 0, rotate: -14, fillAngle: 40 },
      { motif: "sakura", fill: "metallic", x: 0.315, y: -0.075, r: 0.17, ink: 1, rotate: 26, fillAngle: 15 },
      { motif: "sakura", fill: "metallic", x: -0.045, y: 0.42, r: 0.155, ink: 0, rotate: 8, fillAngle: 70 },
      { motif: "sakura", fill: "metallic", x: 0.93, y: 1.025, r: 0.3, ink: 0, rotate: 22, fillAngle: 210 },
      { motif: "sakura", fill: "metallic", x: 0.655, y: 1.075, r: 0.175, ink: 0, rotate: -9, fillAngle: 190 },
      { motif: "sakura", fill: "metallic", x: 1.04, y: 0.585, r: 0.16, ink: 1, rotate: 34, fillAngle: 250 },
    ],
  },

  /* ── w07 ──────────────────────────────────────────────────────────────────
     DUAL-TONE STIPPLE. Stippled discs in two inks at similar weight, around
     all four edges, with a few thin rings. The second tone must stay clearly
     present — it is what separates this from w01.                           */
  w07: {
    id: "w07",
    label: "Dual-tone stipple",
    note: "Stippled discs in two inks at equal weight around every edge.",
    tone: "light",
    openCentre: { w: 0.56, h: 0.56 },
    motifs: [
      { motif: "circle", fill: "stipple", x: 0.035, y: -0.02, r: 0.185, ink: 0 },
      { motif: "circle", fill: "stipple", x: 0.245, y: -0.085, r: 0.215, ink: 1, fillDensity: 1.2 },
      { motif: "circle", fill: "stipple", x: 0.46, y: -0.03, r: 0.165, ink: 0, fillDensity: 0.9 },
      { motif: "circle", fill: "stipple", x: 0.675, y: -0.07, r: 0.21, ink: 1, fillDensity: 1.2 },
      { motif: "circle", fill: "stipple", x: 0.88, y: 0.005, r: 0.175, ink: 0 },
      { motif: "circle", fill: "stipple", x: -0.03, y: 0.355, r: 0.205, ink: 1, fillDensity: 1.2 },
      { motif: "circle", fill: "stipple", x: 0.02, y: 0.7, r: 0.165, ink: 0 },
      { motif: "circle", fill: "stipple", x: 1.035, y: 0.325, r: 0.21, ink: 1, fillDensity: 1.2 },
      { motif: "circle", fill: "stipple", x: 0.995, y: 0.66, r: 0.17, ink: 0, fillDensity: 0.95 },
      { motif: "circle", fill: "stipple", x: 0.145, y: 1.06, r: 0.205, ink: 1, fillDensity: 1.2 },
      { motif: "circle", fill: "stipple", x: 0.355, y: 0.995, r: 0.17, ink: 0 },
      { motif: "circle", fill: "stipple", x: 0.565, y: 1.08, r: 0.215, ink: 1, fillDensity: 1.2 },
      { motif: "circle", fill: "stipple", x: 0.78, y: 1.005, r: 0.175, ink: 0, fillDensity: 0.9 },
      { motif: "ring", fill: "outline", x: 0.135, y: 0.09, r: 0.145, ink: 1, stroke: 0.002 },
      { motif: "ring", fill: "outline", x: 0.925, y: 0.905, r: 0.14, ink: 1, stroke: 0.002 },
      { motif: "ring", fill: "outline", x: 0.44, y: 1.055, r: 0.155, ink: 0, stroke: 0.0018 },
      { motif: "ring", fill: "outline", x: 0.585, y: 0.02, r: 0.13, ink: 0, stroke: 0.0018 },
    ],
  },

  /* ── w08 ──────────────────────────────────────────────────────────────────
     KUMO CLOUDS. Stylised clouds on the upper-right / lower-left diagonal,
     cropped by the frame, each in a different treatment. The other two
     corners stay empty.                                                     */
  w08: {
    id: "w08",
    label: "Kumo clouds",
    note: "Stylised clouds on one diagonal, three different fill treatments.",
    tone: "light",
    openCentre: { w: 0.52, h: 0.52 },
    motifs: [
      // Upper right: turned so the lobed edge hangs down into the frame.
      { motif: "kumo", fill: "dotGrid", x: 0.9, y: 0.04, r: 0.3, aspect: 1.7, petals: 9, ink: 0, rotate: 180, fillDensity: 1.05 },
      { motif: "kumo", fill: "solid", x: 0.62, y: -0.02, r: 0.21, aspect: 1.5, petals: 6, ink: 1, rotate: 180 },
      { motif: "kumo", fill: "lineFill", x: 1.04, y: 0.3, r: 0.19, aspect: 1.4, petals: 6, ink: 1, rotate: 180, fillAngle: 0, fillDensity: 1.15 },
      // Lower left: the same shape the other way up.
      { motif: "kumo", fill: "lineFill", x: 0.1, y: 0.99, r: 0.33, aspect: 1.7, petals: 9, ink: 0, fillAngle: 0, fillDensity: 1.05 },
      { motif: "kumo", fill: "dotGrid", x: 0.37, y: 1.05, r: 0.23, aspect: 1.6, petals: 7, ink: 1, fillDensity: 1 },
      { motif: "kumo", fill: "solid", x: -0.03, y: 0.79, r: 0.175, aspect: 1.4, petals: 5, ink: 0 },
    ],
  },
} as const satisfies Record<string, CompositionSpec>;

/** The eight names, inferred from the table above. */
export type CompositionName = keyof typeof TABLE;

/**
 * The table, widened to the spec type: the renderer reads it through
 * CompositionSpec so optional fields stay visible.
 */
export const COMPOSITIONS: Record<CompositionName, CompositionSpec> = TABLE;

export const COMPOSITION_NAMES = Object.keys(TABLE) as CompositionName[];

/** The palette pairing used for the 16-still batch and the contact sheet. */
export const BATCH_PAIRS: readonly {
  readonly composition: CompositionName;
  readonly palettes: readonly [PaletteName, PaletteName];
}[] = [
  { composition: "w01", palettes: ["goldWhite", "silverGold"] },
  { composition: "w02", palettes: ["goldWhite", "sakuraPink"] },
  { composition: "w03", palettes: ["redGold", "goldWhite"] },
  { composition: "w04", palettes: ["goldBlack", "indigoGold"] },
  { composition: "w05", palettes: ["goldWhite", "sakuraPink"] },
  { composition: "w06", palettes: ["goldWhite", "redGold"] },
  { composition: "w07", palettes: ["silverGold", "goldWhite"] },
  { composition: "w08", palettes: ["goldWhite", "indigoGold"] },
];
