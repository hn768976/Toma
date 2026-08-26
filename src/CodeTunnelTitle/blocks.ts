import {makeCodeBlock} from './codegen';

/**
 * Every code block is laid out ONCE into its own small offscreen canvas and
 * then blitted with a transform on each frame. Laying out 50+ multi-line text
 * blocks per frame at 4K is the single most expensive thing this piece could
 * do, and the text never changes, so it is done exactly once per mount.
 */

/** Font size at 4K *before* the /z perspective scaling. */
export const BASE_FONT_PX = 26;

/**
 * The offscreen canvases are rendered at 2x so that blocks stay crisp through
 * the sharp mid band (where scale ~ 1..3); nearer than that the depth blur has
 * taken over and resolution stops mattering.
 */
export const SUPERSAMPLE = 2;

const LINE_HEIGHT = 1.44;

/** Source-space head-room so the blur pass has somewhere to bleed into. */
export const PAD = 74;

export type PreparedBlock = {
  canvas: HTMLCanvasElement;
  /** Canvas dimensions, in offscreen (supersampled) pixels. */
  w: number;
  h: number;
  /** The text box inside the canvas, in offscreen pixels. */
  textW: number;
  textH: number;
  lines: number;
};

export const prepareBlocks = (
  count: number,
  fontFamily: string
): PreparedBlock[] => {
  const fontPx = BASE_FONT_PX * SUPERSAMPLE;
  const lineHeight = Math.round(fontPx * LINE_HEIGHT);
  const font = `400 ${fontPx}px ${fontFamily}, monospace`;

  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) {
    throw new Error('Could not acquire a 2D context for text measurement');
  }
  measure.font = font;

  const blocks: PreparedBlock[] = [];

  for (let i = 0; i < count; i++) {
    const lines = makeCodeBlock(`block-${i}`);
    let textW = 0;
    for (const line of lines) {
      textW = Math.max(textW, measure.measureText(line).width);
    }
    textW = Math.ceil(textW);
    const textH = lines.length * lineHeight;

    const canvas = document.createElement('canvas');
    canvas.width = textW + PAD * 2;
    canvas.height = textH + PAD * 2;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not acquire a 2D context for a code block');
    }

    // Rendered pure white: the depth tint is applied at blit time so a single
    // prerender serves the whole depth ramp.
    ctx.font = font;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#FFFFFF';
    lines.forEach((line, index) => {
      if (line.length === 0) {
        return;
      }
      ctx.fillText(line, PAD, PAD + index * lineHeight);
    });

    blocks.push({
      canvas,
      w: canvas.width,
      h: canvas.height,
      textW,
      textH,
      lines: lines.length,
    });
  }

  return blocks;
};
