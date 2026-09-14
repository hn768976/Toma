/**
 * A 5x7 dot-matrix glyph set, drawn as filled cells.
 *
 * The only text in the clip is the LOADING counter and the scattered digits in
 * the glitch field, and both want a squared-off digital look. Building them
 * from cells rather than a webfont keeps the render byte-identical on any
 * machine - no font file to ship, nothing to fall back to if a headless browser
 * is missing a family - and it suits the failing-display subject.
 */

const GLYPHS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

export const GLYPH_COLS = 5;
export const GLYPH_ROWS = 7;

export type Cell = {x: number; y: number};

/** The lit cells of one character, in glyph-local cell coordinates. */
export const glyphCells = (ch: string): Cell[] => {
  const rows = GLYPHS[ch.toUpperCase()] ?? GLYPHS[' '];
  const cells: Cell[] = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < GLYPH_COLS; x++) {
      if (rows[y][x] === '1') cells.push({x, y});
    }
  }
  return cells;
};

/**
 * The lit cells of a whole string, laid out left to right.
 * `tracking` is the gap between glyphs, in cells.
 */
export const textCells = (text: string, tracking = 2): {cells: Cell[]; cols: number} => {
  const cells: Cell[] = [];
  let cursor = 0;
  for (const ch of text) {
    for (const cell of glyphCells(ch)) cells.push({x: cursor + cell.x, y: cell.y});
    cursor += GLYPH_COLS + tracking;
  }
  return {cells, cols: Math.max(0, cursor - tracking)};
};
