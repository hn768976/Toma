// Vendored from remotion-lib (~/projects/remotion-lib/src).
// Do not edit here: change it in the library and re-run
// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.
import { makeParagraphs } from "./fillerText";

/**
 * Justified filler columns — n columns of justified nonsense prose with
 * visible gutters.
 *
 * Justification is done by hand: each line is measured, and the slack is
 * shared out between the word spaces. The last line of a paragraph is left
 * ragged and is usually short, which is the single strongest cue that a block
 * of text is set prose rather than a stack of grey bars.
 *
 * A column may start lower than the others (`columnTops`), which is how a
 * panel — a chart, an image, a pull quote — is dropped into the layout
 * without the text running underneath it.
 */

export type JustifiedColumnsOptions = {
  seed: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: number;
  gutter: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  color: string;
  /** Extra top inset per column, for panels that sit at the head of a column. */
  columnTops?: number[];
};

type Line = { words: string[]; lastOfParagraph: boolean };

const layoutLines = (
  ctx: CanvasRenderingContext2D,
  paragraphs: string[],
  colWidth: number,
): Line[] => {
  const lines: Line[] = [];
  for (let p = 0; p < paragraphs.length; p++) {
    const words = paragraphs[p].split(" ");
    let current: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const candidate = current.concat([words[i]]);
      if (current.length > 0 && ctx.measureText(candidate.join(" ")).width > colWidth) {
        lines.push({ words: current, lastOfParagraph: false });
        current = [words[i]];
      } else {
        current = candidate;
      }
    }
    if (current.length > 0) {
      lines.push({ words: current, lastOfParagraph: true });
    }
  }
  return lines;
};

export const drawJustifiedColumns = (
  ctx: CanvasRenderingContext2D,
  opts: JustifiedColumnsOptions,
): void => {
  const {
    seed, x, y, width, height, columns, gutter,
    fontFamily, fontSize, lineHeight, color,
  } = opts;
  if (width <= 0 || height <= 0) return;

  const colWidth = (width - gutter * (columns - 1)) / columns;
  if (colWidth < fontSize * 3) return;

  ctx.save();
  ctx.font = `400 ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const step = fontSize * lineHeight;
  const maxLinesPerColumn = Math.ceil(height / step) + 2;
  const paragraphCount = Math.max(3, Math.ceil((maxLinesPerColumn * columns) / 6));
  const paragraphs = makeParagraphs(seed, paragraphCount);
  const lines = layoutLines(ctx, paragraphs, colWidth);

  const spaceWidth = ctx.measureText(" ").width;
  let cursor = 0;

  for (let c = 0; c < columns; c++) {
    const colX = x + c * (colWidth + gutter);
    const top = y + (opts.columnTops ? opts.columnTops[c] ?? 0 : 0);
    let lineY = top + fontSize;
    while (lineY <= y + height && cursor < lines.length) {
      const line = lines[cursor];
      cursor++;
      const joined = line.words.join(" ");
      const natural = ctx.measureText(joined).width;
      const gaps = line.words.length - 1;
      // Justify everything except paragraph-final lines, and refuse to
      // justify when the stretch would open ugly rivers.
      const slack = colWidth - natural;
      const canJustify =
        !line.lastOfParagraph && gaps > 0 && slack > 0 && slack / gaps < spaceWidth * 1.9;

      if (canJustify) {
        const extra = slack / gaps;
        let penX = colX;
        for (let w = 0; w < line.words.length; w++) {
          ctx.fillText(line.words[w], penX, lineY);
          penX += ctx.measureText(line.words[w]).width + spaceWidth + extra;
        }
      } else {
        ctx.fillText(joined, colX, lineY);
      }
      lineY += step;
    }
    // Loop the stream rather than leaving a column short on a tall clipping.
    if (cursor >= lines.length) cursor = 0;
  }

  ctx.restore();
};
