// Vendored from @studio/remotion-lib (src/SiteChrome.ts). Do not edit here —
// edit the library and re-run `node scripts/sync-lib.mjs`.
/**
 * <SiteChrome> — the strip of generic site furniture above a headline.
 *
 * Either a small square placeholder mark beside a short wordmark in light
 * caps, or a breadcrumb trail. The mark is a plain geometric square; the
 * wordmarks are generic common nouns supplied by the caller. Nothing here
 * depicts, or is designed to resemble, any real outlet's identity.
 */
import type { Ctx } from "./canvas2d";
import { setBlur, setLetterSpacing } from "./canvas2d";

export type ChromeStyle = "mark" | "breadcrumb";

export interface SiteChromeOptions {
  style: ChromeStyle;
  x: number;
  /** Top of the strip. */
  y: number;
  /** Cap height of the lettering. */
  size: number;
  /** Short generic wordmark, used by the "mark" style. */
  wordmark: string;
  /** Trail segments, used by the "breadcrumb" style. */
  trail: string[];
  font: string;
  markColor: string;
  textColor: string;
  blur: number;
  alpha: number;
}

/** Returns the height consumed. */
export const SiteChrome = (ctx: Ctx, o: SiteChromeOptions): number => {
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = o.alpha;
  setBlur(ctx, o.blur);

  if (o.style === "mark") {
    const box = o.size * 1.55;
    ctx.fillStyle = o.markColor;
    ctx.fillRect(o.x, o.y, box, box);
    ctx.font = o.font;
    ctx.fillStyle = o.textColor;
    setLetterSpacing(ctx, o.size * 0.22);
    ctx.fillText(o.wordmark.toUpperCase(), o.x + box + o.size * 0.9, o.y + box * 0.72);
    setLetterSpacing(ctx, 0);
    ctx.restore();
    return box;
  }

  ctx.font = o.font;
  ctx.fillStyle = o.textColor;
  setLetterSpacing(ctx, o.size * 0.08);
  let cursor = o.x;
  const baseline = o.y + o.size;
  o.trail.forEach((segment, index) => {
    if (index > 0) {
      const sep = "  ›  ";
      ctx.globalAlpha = o.alpha * 0.6;
      ctx.fillText(sep, cursor, baseline);
      cursor += ctx.measureText(sep).width;
      ctx.globalAlpha = o.alpha;
    }
    ctx.fillText(segment, cursor, baseline);
    cursor += ctx.measureText(segment).width;
  });
  setLetterSpacing(ctx, 0);
  ctx.restore();
  return o.size * 1.35;
};
