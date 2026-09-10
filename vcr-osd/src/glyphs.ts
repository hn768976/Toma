/**
 * Transport-control glyphs, drawn on the same 7-row pixel grid as the font so
 * they share the word's cell size and baseline. Widths vary per glyph; heights
 * never do. No icon font, no SVG import — these are basic geometry and drawing
 * them by hand is what keeps them on the same pixel lattice as the letters.
 */

import type {PixelMatrix} from "./pixel-font";

const RIGHT_TRIANGLE = ["#...", "##..", "###.", "####", "###.", "##..", "#..."];

const mirror = (rows: string[]): string[] =>
  rows.map((row) => row.split("").reverse().join(""));

const sideBySide = (a: string[], b: string[], gap: number): string[] =>
  a.map((row, i) => row + ".".repeat(gap) + b[i]);

const LEFT_TRIANGLE = mirror(RIGHT_TRIANGLE);

const SHAPES: Record<string, string[]> = {
  none: [],
  play: RIGHT_TRIANGLE,
  fastForward: sideBySide(RIGHT_TRIANGLE, RIGHT_TRIANGLE, 1),
  rewind: sideBySide(LEFT_TRIANGLE, LEFT_TRIANGLE, 1),
  pause: [
    "##.##",
    "##.##",
    "##.##",
    "##.##",
    "##.##",
    "##.##",
    "##.##",
  ],
  stop: [
    "#######",
    "#######",
    "#######",
    "#######",
    "#######",
    "#######",
    "#######",
  ],
  record: [
    "..###..",
    ".#####.",
    "#######",
    "#######",
    "#######",
    ".#####.",
    "..###..",
  ],
  eject: [
    "...#...",
    "..###..",
    ".#####.",
    "#######",
    ".......",
    "#######",
    "#######",
  ],
};

export type GlyphName = keyof typeof SHAPES;

export const glyphMatrix = (name: GlyphName): PixelMatrix =>
  (SHAPES[name] ?? SHAPES.none).map((row) =>
    row.split("").map((cell) => cell === "#"),
  );

export const glyphWidthInCells = (name: GlyphName): number => {
  const rows = SHAPES[name] ?? SHAPES.none;
  return rows.length === 0 ? 0 : rows[0].length;
};
