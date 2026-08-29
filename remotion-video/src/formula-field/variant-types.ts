// The shape a variant takes. The data that fills it lives in variants.ts —
// palette, notation set, motion mode and depth range, all in one place.

import type { Cmd } from "./diagram";
import type { Node } from "./ast";

export type Palette = {
  /** Frame background at the corners. */
  deep: string;
  /** Centre of the radial wash. */
  wash: string;
  /** Mid-distance glyph tone. */
  mid: string;
  /** Near glyph tone. */
  bright: string;
  /** Distant glyph tone. */
  dim: string;
  /** Brightest highlights: flares and glow cores. */
  white: string;
};

export type MotionMode = "approach" | "recede" | "lateral";

export type Motion = {
  mode: MotionMode;
  /** +1 travels toward the viewer, −1 away from it, 0 removes depth motion. */
  depthDir: 1 | -1 | 0;
  /** +1 drifts away from the focus, −1 draws in toward it, 0 holds station. */
  radialDir: 1 | -1 | 0;
  /** Vanishing point / expansion origin, as a fraction of the frame. */
  focus: [number, number];
  /** Exponent on the depth-to-radius mapping: how hard the field splays. */
  spreadPow: number;
  /** Whole traversals of the range per 600-frame loop, per glyph. */
  laps: number[];
  /** "lateral" only — fraction of glyphs drifting right to left. */
  leftwardShare?: number;
  /** "lateral" only — on-screen size multiplier range, since depth no longer scales. */
  sizeRange?: [number, number];
};

export type Notation =
  /** A formula line, laid out by the expression engine. */
  | { id: string; kind: "equation"; e: Node; size?: number }
  /** A drawn structure or diagram. */
  | { id: string; kind: "structure"; cmds: Cmd[] };

export type Variant = {
  /** Seed namespace and lookup key for this variant. */
  key: string;
  palette: Palette;
  notation: Notation[];
  motion: Motion;
  /** Depth range. Above 1.0 a glyph exceeds the frame and crops. */
  depth: { min: number; max: number };
  /** Glyphs alive at any moment. */
  count: number;
  /** On-screen width a mid-depth glyph aims for, in 4K pixels. */
  targetWidth: number;
};
export type { Node, Cmd };
