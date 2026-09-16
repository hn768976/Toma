// Renders the generated listing onto one big 2D canvas, which becomes the
// texture every block samples.
//
// It is deliberately a single large sheet with RepeatWrapping rather than
// an atlas of per-block tiles. Each block reads a randomly offset window
// into the sheet, which gives every block its own snippet for free while
// keeping wrapping and mipmapping exact — an atlas would need fract() on
// the UVs, and the derivative discontinuity at every tile border shows up
// as a seam once the mip chain kicks in on the distant blocks.

import {
  CODE_COLUMN_WIDTH,
  CODE_FONT_FAMILY,
  CODE_FONT_SIZE,
  CODE_LINE_HEIGHT,
  CODE_PIXELS_PER_UNIT,
} from "./constants";
import { generateListing, lineBrightness } from "./code-source";
import { chance, intRange, mulberry32, range } from "./random";

export type CodeSheet = {
  canvas: HTMLCanvasElement;
  /** Sheet fraction covered by one world unit; the shader's UV scale. */
  uvPerUnit: number;
};

/**
 * @param size Edge length of the square sheet in pixels.
 * @param scale Resolution multiple (1 = 1080p, 2 = 4K). Font metrics are
 *   multiplied by this so text occupies the same share of a block face at
 *   any output size.
 */
export const createCodeSheet = (
  size: number,
  scale: number,
  seed: number,
): CodeSheet => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("CodeGrid: could not get a 2D context for the code sheet");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);

  const fontSize = CODE_FONT_SIZE * scale;
  const lineHeight = CODE_LINE_HEIGHT * scale;
  const columnWidth = CODE_COLUMN_WIDTH * scale;
  const indentWidth = columnWidth * 4;

  ctx.font = `${fontSize}px "${CODE_FONT_FAMILY}", monospace`;
  ctx.textBaseline = "alphabetic";

  const rng = mulberry32(seed);
  const rowCount = Math.ceil(size / lineHeight);

  // Several independent columns of code side by side, so a block sampling
  // a narrow window still lands on complete-looking lines rather than on
  // one endlessly wrapped paragraph.
  const columnPixels = 46 * columnWidth;
  const columns = Math.max(1, Math.round(size / columnPixels));
  const columnPitch = size / columns;

  for (let col = 0; col < columns; col++) {
    const listing = generateListing(rng, rowCount);
    const x0 = col * columnPitch + columnWidth * range(rng, 0.5, 2.5);

    for (let row = 0; row < rowCount; row++) {
      const line = listing[row];
      if (!line || line.text === "") continue;

      // Clip overly long lines to the column so neighbouring columns of
      // code never collide into unreadable mush.
      const maxChars = Math.floor((columnPitch - (x0 - col * columnPitch)) / columnWidth) - 1;
      const text = line.text.slice(0, Math.max(4, maxChars));

      const x = x0 + line.indent * indentWidth;
      const y = (row + 1) * lineHeight - lineHeight * 0.26;
      const brightness = lineBrightness(rng);

      // Glyphs are drawn as plain luminance; the shader tints them.
      const v = Math.round(brightness * 255);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillText(text, x, y);

      // A minority of lines get a hot leading token, which is what gives
      // the reference its scatter of near-white highlights.
      if (chance(rng, 0.08)) {
        const tokenChars = intRange(rng, 3, Math.min(14, text.length));
        ctx.fillStyle = "rgb(255,255,255)";
        ctx.fillText(text.slice(0, tokenChars), x, y);
      }
    }
  }

  return { canvas, uvPerUnit: (CODE_PIXELS_PER_UNIT * scale) / size };
};
