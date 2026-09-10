/**
 * The clean OSD plate: the glyph and the word, rasterised once into a
 * luminance buffer at output resolution.
 *
 * Nothing here moves. The per-frame pass in VCROSD.tsx samples this buffer with
 * displacement, so the letterforms themselves are only ever built once per
 * composition.
 */

import {glyphMatrix, glyphWidthInCells, type GlyphName} from "./glyphs";
import {
  FONT_COLS,
  FONT_ROWS,
  LETTER_SPACING,
  charMatrix,
  labelWidthInCells,
} from "./pixel-font";

/** Left edge of the OSD block, as a fraction of frame width. */
const BLOCK_LEFT = 0.075;
/** Vertical centre of the OSD block, as a fraction of frame height. */
const BLOCK_CENTRE_Y = 0.26;
/** Cell size at full size, as a fraction of frame height. */
const CELL_FRACTION = 0.0195;
/** The block never grows past this fraction of frame width. */
const MAX_BLOCK_WIDTH = 0.7;
/** Blank cells between the glyph and the first letter. */
const GLYPH_GAP = 3;

/** Peak brightness of the phosphor trail, relative to the letter itself. */
const BLEED_STRENGTH = 0.15;
/** Trail length, in cells. */
const BLEED_CELLS = 0.45;

export type Plate = {
  /** Luminance, 0-255, one byte per device pixel. */
  lum: Uint8Array;
  /** Per row: 1 if the row contains anything at all. */
  rowHas: Uint8Array;
  /** Per row: first and last device column holding light. */
  rowMin: Int32Array;
  rowMax: Int32Array;
  /** Device-pixel bounds of the lit block, used to aim the tear events. */
  top: number;
  bottom: number;
  cell: number;
};

export const buildPlate = ({
  dw,
  dh,
  label,
  glyph,
}: {
  dw: number;
  dh: number;
  label: string;
  glyph: GlyphName;
}): Plate => {
  const glyphCells = glyphWidthInCells(glyph);
  const labelCells = labelWidthInCells(label);
  const totalCells = glyphCells + (glyphCells > 0 ? GLYPH_GAP : 0) + labelCells;

  // Cell size is a whole number of device pixels, so every block lands on
  // exact pixel boundaries at 1080p and at 4K alike.
  const idealCell = Math.round(CELL_FRACTION * dh);
  const cell = Math.max(
    2,
    Math.min(idealCell, Math.floor((MAX_BLOCK_WIDTH * dw) / totalCells)),
  );

  const blockHeight = FONT_ROWS * cell;
  const originX = Math.round(BLOCK_LEFT * dw);
  const originY = Math.round(BLOCK_CENTRE_Y * dh - blockHeight / 2);

  const lum = new Uint8Array(dw * dh);

  const fillCell = (cx: number, cy: number) => {
    const px = originX + cx * cell;
    const py = originY + cy * cell;
    for (let y = py; y < py + cell; y++) {
      if (y < 0 || y >= dh) continue;
      const row = y * dw;
      for (let x = px; x < px + cell; x++) {
        if (x < 0 || x >= dw) continue;
        lum[row + x] = 255;
      }
    }
  };

  const paint = (matrix: boolean[][], cellX: number) => {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) fillCell(cellX + c, r);
      }
    }
  };

  let cursor = 0;
  if (glyphCells > 0) {
    paint(glyphMatrix(glyph), cursor);
    cursor += glyphCells + GLYPH_GAP;
  }
  for (const char of label) {
    paint(charMatrix(char), cursor);
    cursor += FONT_COLS + LETTER_SPACING;
  }

  // Phosphor smear: a decaying trail to the right of every lit pixel, the way
  // a CRT's beam keeps glowing for a moment after it has moved on.
  const decay = Math.exp(-1 / Math.max(1, cell * BLEED_CELLS));
  for (let y = 0; y < dh; y++) {
    const row = y * dw;
    let acc = 0;
    for (let x = 0; x < dw; x++) {
      const v = lum[row + x];
      acc = Math.max(v, acc * decay);
      const trail = Math.round(acc * BLEED_STRENGTH);
      if (trail > v) lum[row + x] = trail;
    }
  }

  const rowHas = new Uint8Array(dh);
  const rowMin = new Int32Array(dh);
  const rowMax = new Int32Array(dh);
  let top = dh;
  let bottom = 0;
  for (let y = 0; y < dh; y++) {
    const row = y * dw;
    let min = -1;
    let max = -1;
    for (let x = 0; x < dw; x++) {
      if (lum[row + x] !== 0) {
        if (min < 0) min = x;
        max = x;
      }
    }
    rowMin[y] = min;
    rowMax[y] = max;
    rowHas[y] = min >= 0 ? 1 : 0;
    if (min >= 0) {
      if (y < top) top = y;
      bottom = y;
    }
  }

  return {lum, rowHas, rowMin, rowMax, top, bottom: Math.max(bottom, top), cell};
};
