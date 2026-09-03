/**
 * <BodyBlock> — several lines of illegible filler standing in for article
 * body copy. Varied line lengths, a short last line per paragraph, low
 * contrast and a touch of blur: at these sizes it is texture, not text.
 */
import type { Ctx } from "./canvas2d";
import { setBlur } from "./canvas2d";
import { fillerLines } from "./filler-text";
import { randInt } from "./seeded-random";

export interface BodyBlockOptions {
  x: number;
  /** Baseline of the first line. */
  y: number;
  width: number;
  lineCount: number;
  paragraphs: number;
  fontSize: number;
  lineHeight: number;
  font: string;
  color: string;
  alpha: number;
  blur: number;
  seed: string;
}

/** Returns the height consumed. */
export const BodyBlock = (ctx: Ctx, o: BodyBlockOptions): number => {
  ctx.save();
  ctx.font = o.font;
  ctx.fillStyle = o.color;
  ctx.globalAlpha = o.alpha;
  ctx.textBaseline = "alphabetic";
  setBlur(ctx, o.blur);

  const measure = (text: string) => ctx.measureText(text).width;
  let drawn = 0;
  let baseline = o.y;
  for (let p = 0; p < o.paragraphs; p += 1) {
    const remaining = o.lineCount - drawn;
    if (remaining <= 0) break;
    const isLastParagraph = p === o.paragraphs - 1;
    const count = isLastParagraph
      ? remaining
      : Math.min(remaining - 1, randInt(`${o.seed}-p${p}-n`, 2, Math.max(2, remaining - 2)));
    if (count <= 0) break;
    const lines = fillerLines(measure, `${o.seed}-p${p}`, o.width, count, true);
    for (const line of lines) {
      ctx.fillText(line, o.x, baseline);
      baseline += o.lineHeight;
    }
    drawn += count;
    if (!isLastParagraph) baseline += o.lineHeight * 0.55;
  }

  ctx.restore();
  return baseline - o.y;
};
