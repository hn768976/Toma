import {makeCanvas} from "./use-canvas";

/**
 * An offscreen sprite sheet of a small character set rendered once per colour.
 *
 * Filling a shape with tens of thousands of glyphs is only affordable if the
 * glyphs are rasterised once and blitted thereafter: `fillText` per glyph per
 * frame is roughly two orders of magnitude more expensive than `drawImage`
 * from an atlas. The atlas is laid out as one row per colour ("brightness
 * bracket") and one column per character.
 *
 * Cells are sized to the caller's grid metrics plus symmetric padding, so a
 * blit can be positioned with sub-cell jitter without the glyph being clipped.
 */
export type GlyphAtlas = {
  canvas: HTMLCanvasElement;
  /** Width of one atlas cell, i.e. the width of a blit. */
  cellWidth: number;
  /** Height of one atlas cell, i.e. the height of a blit. */
  cellHeight: number;
  /** Horizontal padding baked into each side of a cell. */
  padX: number;
  /** Vertical padding baked into each side of a cell. */
  padY: number;
  /** Source rect of the glyph for `char` in `bracket`. */
  source: (charIndex: number, bracket: number) => {sx: number; sy: number};
};

export const createGlyphAtlas = (opts: {
  chars: readonly string[];
  /** One CSS colour per brightness bracket, dim first. */
  colors: readonly string[];
  fontFamily: string;
  fontSize: number;
  /** Nominal grid cell the glyph is centred in. */
  boxWidth: number;
  boxHeight: number;
  /** Extra room each side so jittered blits never clip the glyph. */
  padX?: number;
  padY?: number;
}): GlyphAtlas => {
  const padX = opts.padX ?? 3;
  const padY = opts.padY ?? 2;
  const cellWidth = Math.ceil(opts.boxWidth + padX * 2);
  const cellHeight = Math.ceil(opts.boxHeight + padY * 2);

  const {canvas, ctx} = makeCanvas(
    cellWidth * opts.chars.length,
    cellHeight * opts.colors.length,
  );

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${opts.fontSize}px ${opts.fontFamily}`;

  for (let b = 0; b < opts.colors.length; b++) {
    ctx.fillStyle = opts.colors[b];
    for (let c = 0; c < opts.chars.length; c++) {
      ctx.fillText(
        opts.chars[c],
        c * cellWidth + cellWidth / 2,
        b * cellHeight + cellHeight / 2,
      );
    }
  }

  return {
    canvas,
    cellWidth,
    cellHeight,
    padX,
    padY,
    source: (charIndex: number, bracket: number) => ({
      sx: charIndex * cellWidth,
      sy: bracket * cellHeight,
    }),
  };
};
