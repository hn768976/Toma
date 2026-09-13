import type { FontKey } from "./fonts";

// One scissored-out magazine letter. Geometry is in the 1920x1080 design
// space and was measured off the reference frame-by-frame, so the tile sizes,
// gaps and baseline drift keep the hand-assembled rhythm of the original
// rather than sitting on a regular grid.
export type LetterSpec = {
  char: string;
  /** Tile rect in design space. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Resting tilt in degrees — nothing is ever perfectly straight. */
  rot: number;
  /** Paper colour the letter was cut from. */
  tile: string;
  /** Printed ink colour of the glyph. */
  ink: string;
  font: FontKey;
  /** Glyph size as a multiple of tile height. */
  size: number;
  /** Optical vertical nudge, as a fraction of tile height. */
  dy: number;
  /** Draws a thick halo behind the glyph (the reference's outlined T). */
  halo?: string;
  /** Renders the glyph as an outline only, in this colour. */
  strokeOnly?: string;
  /** Stagger position within its line. */
  col: number;
};

// Line 1 and line 2 of the reference layout. Tile colours, inks and the
// deliberately mismatched typefaces are sampled from the source frames.
// prettier-ignore
const MENTAL: LetterSpec[] = [
  { char: "M", x: 175, y: 170, w: 305, h: 290, rot: -2.0, tile: "#9B0F0C", ink: "#F7F3EE", font: "playfair", size: 1.0, dy: -0.075, col: 0 },
  { char: "e", x: 495, y: 200, w: 188, h: 240, rot: 1.5, tile: "#0B0F1F", ink: "#E9A81C", font: "jost", size: 1.35, dy: -0.122, col: 1 },
  { char: "n", x: 720, y: 203, w: 210, h: 228, rot: -1.0, tile: "#0D1118", ink: "#FFFFFF", font: "playfairBlack", size: 1.366, dy: -0.267, col: 2 },
  { char: "T", x: 960, y: 165, w: 285, h: 290, rot: 0.8, tile: "#8FD4EA", ink: "#D4359F", font: "bodoni", size: 0.862, dy: 0.046, halo: "#FFFFFF", col: 3 },
  { char: "A", x: 1280, y: 175, w: 220, h: 290, rot: -1.5, tile: "#F0B808", ink: "transparent", strokeOnly: "#2E86C8", font: "anton", size: 0.936, dy: -0.097, col: 4 },
  { char: "L", x: 1550, y: 170, w: 195, h: 290, rot: 2.0, tile: "#0787E4", ink: "#FFFFFF", font: "dmserif", size: 0.967, dy: -0.037, col: 5 },
];

// prettier-ignore
const HEALTH: LetterSpec[] = [
  { char: "H", x: 335, y: 625, w: 225, h: 285, rot: -4.8, tile: "#F7F7F7", ink: "#E01E5A", font: "archivo", size: 0.995, dy: -0.01, col: 0 },
  { char: "E", x: 575, y: 640, w: 215, h: 275, rot: 1.2, tile: "#F09A05", ink: "#12876B", font: "bodoni", size: 0.967, dy: -0.001, col: 1 },
  { char: "a", x: 825, y: 660, w: 175, h: 225, rot: -2.5, tile: "#E3EDF7", ink: "#16264C", font: "playfairItalic", size: 1.359, dy: -0.269, col: 2 },
  { char: "l", x: 1030, y: 640, w: 180, h: 270, rot: 1.5, tile: "#D4062E", ink: "#2E6FC4", font: "anton", size: 1.045, dy: -0.044, col: 3 },
  { char: "t", x: 1240, y: 657, w: 148, h: 233, rot: -1.0, tile: "#0A1020", ink: "#E6D8EC", font: "baskerville", size: 1.337, dy: -0.057, col: 4 },
  { char: "h", x: 1420, y: 625, w: 180, h: 270, rot: -2.0, tile: "#F5EBF6", ink: "#1B6CDE", font: "playfair", size: 1.078, dy: -0.069, col: 5 },
];

// Second version: the same cut-out kit reassembled to read PSYCHOLOGY on a
// single line. Ten letters across one line means noticeably smaller cuttings
// than the two-line reference layout — the tiles run ~170-200 tall against
// the reference's ~230-290. Widths, heights and baselines stay deliberately
// uneven so the line still looks hand-assembled rather than set on a grid.
// prettier-ignore
const PSYCHOLOGY: LetterSpec[] = [
  { char: "P", x: 163, y: 439, w: 138, h: 190, rot: -2.5, tile: "#9B0F0C", ink: "#F7F3EE", font: "playfair", size: 1.0, dy: -0.075, col: 0 },
  { char: "s", x: 317, y: 464, w: 118, h: 168, rot: 1.8, tile: "#0B0F1F", ink: "#E9A81C", font: "jost", size: 1.35, dy: -0.122, col: 1 },
  { char: "Y", x: 453, y: 445, w: 152, h: 182, rot: -1.2, tile: "#0D1118", ink: "#FFFFFF", font: "playfairBlack", size: 1.0, dy: -0.075, col: 2 },
  { char: "C", x: 620, y: 447, w: 158, h: 196, rot: 2.2, tile: "#8FD4EA", ink: "#D4359F", font: "bodoni", size: 0.95, dy: -0.02, halo: "#FFFFFF", col: 3 },
  { char: "h", x: 795, y: 446, w: 120, h: 174, rot: -3.0, tile: "#F0B808", ink: "transparent", strokeOnly: "#2E86C8", font: "anton", size: 0.936, dy: -0.097, col: 4 },
  { char: "O", x: 931, y: 443, w: 178, h: 200, rot: 1.5, tile: "#0787E4", ink: "#FFFFFF", font: "dmserif", size: 0.967, dy: -0.037, col: 5 },
  { char: "L", x: 1127, y: 442, w: 132, h: 186, rot: -2.0, tile: "#F7F7F7", ink: "#E01E5A", font: "archivo", size: 0.995, dy: -0.01, col: 6 },
  { char: "O", x: 1274, y: 449, w: 172, h: 194, rot: 2.8, tile: "#F09A05", ink: "#12876B", font: "bodoni", size: 0.967, dy: -0.001, col: 7 },
  { char: "g", x: 1463, y: 451, w: 124, h: 172, rot: -1.5, tile: "#D4062E", ink: "#2E6FC4", font: "playfair", size: 1.0, dy: -0.215, col: 8 },
  { char: "Y", x: 1603, y: 450, w: 154, h: 188, rot: 2.0, tile: "#0A1020", ink: "#E6D8EC", font: "baskerville", size: 0.98, dy: -0.03, col: 9 },
];

export const WORDS = {
  mentalHealth: [...MENTAL, ...HEALTH],
  psychology: PSYCHOLOGY,
} as const;

export type WordKey = keyof typeof WORDS;
