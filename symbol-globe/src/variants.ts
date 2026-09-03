/**
 * The two versions of the piece, and the only place in the project where a
 * colour or a glyph choice is written down.
 *
 * Everything downstream — the globe, the centre mark, the scattered field, the
 * lattice, the wash, the vignette — reads its colours from the `palette` of the
 * active variant and its shapes from `centreGlyph` / `fieldSet`. Adding a third
 * version should mean adding a third entry here and nothing else.
 */
import type { GlyphKind } from "./lib/glyphPaths";

export type VariantId = "question" | "alert";

export type Palette = {
  /** Deepest background tone; also the vignette shade. */
  backgroundDeep: string;
  /** The drifting wash that lifts the background off flat black. */
  backgroundWash: string;
  /** Land dots at the centre of the sphere, facing the viewer. */
  globeDot: string;
  /** Land dots near the limb, turned away from the viewer. */
  globeDim: string;
  /** The atmospheric ring at the sphere's edge. */
  globeLimb: string;
  /** Great-circle arcs crossing the globe's face. */
  arcLine: string;
  /** Mid channel of the centre glyph's neon build. */
  glyphMid: string;
  /** Hot core of the centre glyph. */
  glyphCore: string;
  /** Scattered field glyphs. */
  fieldMain: string;
  /** The paler minority among the field glyphs. */
  fieldPale: string;
  /** The background lattice. */
  networkLine: string;
};

/** How the centre glyph's glow behaves over the loop. */
export type PulseMode =
  /** One slow sine breath. Reads as a held question. */
  | "breathe"
  /** Two quick pulses then a pause, on a short cycle. Reads as an alarm. */
  | "alarm";

export type FieldEntry = { kind: GlyphKind; weight: number };

export type Variant = {
  palette: Palette;
  centreGlyph: GlyphKind;
  centrePulse: PulseMode;
  /** Relative frequencies of each mark in the scattered field. */
  fieldSet: FieldEntry[];
  /** Number of lattice lines behind everything. */
  networkLineCount: number;
  /** Multiplier on lattice opacity; > 1 reads as a busier, more urgent frame. */
  networkOpacity: number;
};

export const VARIANTS: Record<VariantId, Variant> = {
  question: {
    palette: {
      backgroundDeep: "#050F3A",
      backgroundWash: "#0F2470",
      globeDot: "#4F8FD4",
      globeDim: "#2A5490",
      globeLimb: "#7FC4F5",
      arcLine: "#3F6FB8",
      glyphMid: "#4FD4FF",
      glyphCore: "#E8FAFF",
      fieldMain: "#3F7FD4",
      fieldPale: "#A8D4F5",
      networkLine: "#1E3A7A",
    },
    centreGlyph: "question",
    centrePulse: "breathe",
    fieldSet: [
      { kind: "question", weight: 0.5 },
      { kind: "plus", weight: 0.2 },
      { kind: "percent", weight: 0.18 },
      { kind: "exclamation", weight: 0.12 },
    ],
    networkLineCount: 24,
    networkOpacity: 1,
  },
  alert: {
    palette: {
      backgroundDeep: "#1A0A02",
      backgroundWash: "#4A2408",
      globeDot: "#C4842E",
      globeDim: "#7A4E18",
      globeLimb: "#FFC46A",
      arcLine: "#8A5A24",
      glyphMid: "#FFB03F",
      glyphCore: "#FFF4E0",
      fieldMain: "#D49040",
      fieldPale: "#FFD8A8",
      networkLine: "#5C3A14",
    },
    centreGlyph: "exclamation",
    centrePulse: "alarm",
    fieldSet: [
      { kind: "exclamation", weight: 0.55 },
      { kind: "triangle", weight: 0.2 },
      { kind: "circledCross", weight: 0.15 },
      { kind: "question", weight: 0.1 },
    ],
    networkLineCount: 40,
    networkOpacity: 1.35,
  },
};
