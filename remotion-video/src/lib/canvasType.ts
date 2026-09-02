// Vendored from remotion-lib (~/projects/remotion-lib/src).
// Do not edit here: change it in the library and re-run
// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.
/**
 * Canvas typography: a wrapped display line, tracked-out small caps, and a
 * rule. All three are palette-agnostic — every colour, face and size arrives
 * as a parameter.
 *
 * `overflow` wraps the text to a width WIDER than the box it is drawn into, so
 * it runs off the edge. Combined with a clip path on the caller's side, that
 * produces text cut mid-word — the thing that makes a fragment read as a torn
 * scrap rather than as a neatly cropped card.
 */

export type HeadlineOptions = {
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  color: string;
  lineHeight: number;
  maxLines: number;
  /** Wrap wider than the sheet so the headline is cropped by the tear. */
  overflow?: boolean;
  /** Squeeze the headline until it fits maxLines. Off for partials. */
  fitToLines?: boolean;
};

const wrap = (
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] => {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = current ? `${current} ${words[i]}` : words[i];
    if (current && ctx.measureText(candidate).width > width) {
      lines.push(current);
      current = words[i];
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
};

export const drawHeadline = (
  ctx: CanvasRenderingContext2D,
  opts: HeadlineOptions,
): number => {
  const {
    text, x, y, maxWidth, fontFamily, fontWeight, color, lineHeight, maxLines,
  } = opts;
  const overflow = opts.overflow ?? false;
  const fitToLines = opts.fitToLines ?? true;

  const wrapWidth = overflow ? maxWidth * 1.5 : maxWidth;
  let fontSize = opts.fontSize;
  let lines: string[] = [];

  // Shrink until the headline fits the allowed number of lines. Partials skip
  // this so they are free to overrun.
  for (let attempt = 0; attempt < 14; attempt++) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    lines = wrap(ctx, text, wrapWidth);
    if (!fitToLines || lines.length <= maxLines) break;
    fontSize *= 0.92;
  }
  if (!fitToLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
  }

  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const step = fontSize * lineHeight;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + fontSize + i * step);
  }
  ctx.restore();

  return y + fontSize + (lines.length - 1) * step + fontSize * 0.28;
};

/**
 * Text with manual letter spacing. Drawn glyph by glyph so the tracking is
 * under our control and does not depend on ctx.letterSpacing, which is not
 * available everywhere.
 */
export const drawTrackedText = (
  ctx: CanvasRenderingContext2D,
  opts: {
    text: string;
    x: number;
    y: number;
    fontFamily: string;
    fontSize: number;
    color: string;
    tracking: number;
  },
): number => {
  const { text, x, y, fontFamily, fontSize, color, tracking } = opts;
  ctx.save();
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let cursor = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    ctx.fillText(ch, cursor, y + fontSize);
    cursor += ctx.measureText(ch).width + tracking;
  }
  ctx.restore();
  return y + fontSize * 1.5;
};

/** A thin horizontal rule. */
export const drawRule = (
  ctx: CanvasRenderingContext2D,
  opts: { x: number; y: number; width: number; color: string; thickness: number },
): number => {
  ctx.save();
  ctx.fillStyle = opts.color;
  ctx.fillRect(opts.x, opts.y, opts.width, opts.thickness);
  ctx.restore();
  return opts.y + opts.thickness;
};
