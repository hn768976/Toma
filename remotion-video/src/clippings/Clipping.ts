import { mixCss, rgba, shade } from "../lib/colorUtils";
import { drawHeadline, drawRule, drawTrackedText } from "../lib/canvasType";
import { drawJustifiedColumns } from "../lib/justifiedColumns";
import { drawChart } from "./Chart";
import { drawHalftone } from "../lib/halftone";
import { paintPaperMottle, paintPaperSheen } from "../lib/paperTexture";
import { bylineText, bylineTracking } from "./text";
import {
  buildTearPath,
  strokeFibreEdge,
  strokeFibreWhiskers,
  tracePath,
} from "../lib/tornEdge";
import type { ClippingSpec } from "./layout";
import type { Palette } from "./variants";
import { rndRange } from "../lib/seededRandom";

/**
 * Clipping — one sheet of torn newsprint, baked once into its own offscreen
 * canvas.
 *
 * This bake is the single most important optimisation in the piece. Building a
 * tear path, generating paper mottle and laying out justified body text are
 * all expensive, and doing any of them per frame at 4K would make the render
 * unusable. Instead every clipping is drawn exactly once, complete with its
 * drop shadow, and the animation does nothing but blit the resulting bitmap
 * with a transform.
 *
 * The shadow is baked in rather than applied at blit time for the same reason:
 * a blurred canvas shadow on a 2000px bitmap costs far more than a plain
 * drawImage, and since the shadow travels with the sheet there is no reason to
 * recompute it.
 */

export type BakedClipping = {
  spec: ClippingSpec;
  canvas: HTMLCanvasElement;
  /** Margin around the sheet inside the bitmap, for tear reach and shadow. */
  pad: number;
};

export type ClippingFonts = {
  headlineFamily: string;
  bodyFamily: string;
};

const SHADOW_BLUR = 34;
const SHADOW_OFFSET = 16;
const TEAR_REACH = 40;

export const bakeClipping = (
  spec: ClippingSpec,
  palette: Palette,
  fonts: ClippingFonts,
): BakedClipping => {
  const pad = TEAR_REACH + SHADOW_BLUR + SHADOW_OFFSET;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(spec.w + pad * 2);
  canvas.height = Math.ceil(spec.h + pad * 2);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { spec, canvas, pad };

  // Tear amplitude grows a little with sheet size, so a big sheet does not
  // look finely torn and a small one coarsely torn.
  const sizeFactor = Math.max(0.75, Math.min(1.15, spec.w / 900));
  const path = buildTearPath({
    seed: spec.seed,
    w: spec.w,
    h: spec.h,
    torn: spec.torn,
    ampLow: 13 * sizeFactor,
    ampHigh: 4.2 * sizeFactor,
    ampNick: 8.5 * sizeFactor,
    wavelengthLow: 430,
    wavelengthHigh: 27,
    step: 3.5,
  });

  // 1. Paper plus its baked drop shadow, in one fill.
  ctx.save();
  ctx.shadowColor = rgba(palette.shadow, palette.shadowAlpha);
  ctx.shadowBlur = SHADOW_BLUR;
  ctx.shadowOffsetX = SHADOW_OFFSET;
  ctx.shadowOffsetY = SHADOW_OFFSET;
  ctx.fillStyle = spec.paperHex;
  tracePath(ctx, path, pad, pad);
  ctx.fill();
  ctx.restore();

  // 2. Everything from here on is confined to the sheet.
  ctx.save();
  tracePath(ctx, path, pad, pad);
  ctx.clip();

  paintPaperSheen(ctx, {
    x: pad,
    y: pad,
    w: spec.w,
    h: spec.h,
    paperHex: spec.paperHex,
    angle: rndRange(`${spec.seed}:sheen`, 0.2, 1.4),
  });

  paintPaperMottle(ctx, {
    seed: spec.seed,
    x: pad,
    y: pad,
    w: spec.w,
    h: spec.h,
    inkHex: palette.inkBlack,
    opacity: 0.04,
  });

  drawContent(ctx, spec, palette, fonts, pad);

  // 3. The fibre edge, stroked inside the clip so only its inner half shows.
  strokeFibreEdge(
    ctx,
    path,
    pad,
    pad,
    shade(spec.paperHex, 0.42, 0.85),
    rndRange(`${spec.seed}:fibre`, 2.5, 4),
  );

  ctx.restore();

  // 4. Loose fibres, outside the clip, breaking the silhouette.
  strokeFibreWhiskers(ctx, path, pad, pad, spec.seed, shade(spec.paperHex, 0.3, 0.55));

  return { spec, canvas, pad };
};

const drawContent = (
  ctx: CanvasRenderingContext2D,
  spec: ClippingSpec,
  palette: Palette,
  fonts: ClippingFonts,
  pad: number,
): void => {
  const margin = spec.w * rndRange(`${spec.seed}:margin`, 0.055, 0.08);
  const contentX = pad + margin;
  const contentW = spec.w - margin * 2;
  let cursorY = pad + margin * rndRange(`${spec.seed}:topmargin`, 0.8, 1.5);

  // Headline size is driven by the sheet, but the multiplier varies widely so
  // that two clippings of similar size can still be set very differently.
  const headlineScale = spec.partial
    ? rndRange(`${spec.seed}:hscale`, 0.3, 0.42)
    : rndRange(`${spec.seed}:hscale`, 0.1, 0.19);
  const headlineSize = contentW * headlineScale;

  cursorY = drawHeadline(ctx, {
    text: spec.headline,
    x: contentX,
    y: cursorY,
    maxWidth: contentW,
    fontFamily: `"${fonts.headlineFamily}", serif`,
    fontWeight: 900,
    fontSize: headlineSize,
    color: rgba(palette.inkBlack, 0.94),
    lineHeight: 1.02,
    maxLines: spec.headlineLines,
    overflow: spec.partial,
    fitToLines: !spec.partial,
  });

  // A partial is a fragment: headline running off the tear, and nothing else.
  if (spec.partial) return;

  cursorY = drawRule(ctx, {
    x: contentX,
    y: cursorY + spec.w * 0.012,
    width: contentW,
    color: rgba(palette.inkSoft, 0.72),
    thickness: Math.max(1.5, spec.w * 0.0022),
  });

  const bylineSize = Math.max(7, contentW * 0.0155);
  cursorY = drawTrackedText(ctx, {
    text: bylineText(spec.seed, [spec.byline]),
    x: contentX,
    y: cursorY + spec.w * 0.014,
    fontFamily: `"${fonts.bodyFamily}", serif`,
    fontSize: bylineSize,
    color: rgba(palette.inkBlack, 0.8),
    tracking: bylineTracking(spec.seed, bylineSize),
  });

  cursorY += spec.w * 0.012;

  const bodyH = spec.h + pad - cursorY - margin * 0.4;
  if (bodyH < 40) return;

  const gutter = Math.max(10, contentW * 0.028);
  const colWidth = (contentW - gutter * (spec.columns - 1)) / spec.columns;
  // Capped as well as scaled: an extra-wide sheet set at colWidth/34 would
  // otherwise end up with body type large enough to read, and the body is
  // meant to be illegible filler at the size it is actually seen.
  const bodySize = Math.max(7, Math.min(colWidth / 34, 15));

  // A chart or halftone panel takes the head of a column; the text in that
  // column starts below it.
  const columnTops: number[] = [];
  for (let c = 0; c < spec.columns; c++) columnTops.push(0);

  if (spec.chart) {
    const chartW = colWidth;
    const chartH = Math.min(bodyH * 0.42, chartW * 0.66);
    const col = spec.columns - 1;
    drawChart(ctx, {
      seed: spec.seed,
      x: contentX + col * (colWidth + gutter),
      y: cursorY,
      w: chartW,
      h: chartH,
      inkHex: palette.inkBlack,
      softInkHex: palette.inkSoft,
    });
    columnTops[col] = chartH + bodySize * 1.2;
  }

  if (spec.halftone) {
    const spanCols = Math.min(2, spec.columns);
    const fullW = colWidth * spanCols + gutter * (spanCols - 1);
    // Hold the aspect ratio rather than letterboxing the panel: a photograph
    // squashed to a thin band stops reading as a photograph.
    const aspect = 0.68;
    const maxH = bodyH * 0.45;
    let photoW = fullW;
    let photoH = fullW * aspect;
    if (photoH > maxH) {
      photoW = maxH / aspect;
      photoH = maxH;
    }
    drawHalftone(ctx, {
      seed: spec.seed,
      x: contentX,
      y: cursorY,
      w: photoW,
      h: photoH,
      inkHex: palette.inkBlack,
    });
    for (let c = 0; c < spanCols; c++) {
      columnTops[c] = Math.max(columnTops[c], photoH + bodySize * 1.2);
    }
  }

  drawJustifiedColumns(ctx, {
    seed: spec.seed,
    x: contentX,
    y: cursorY,
    width: contentW,
    height: bodyH,
    columns: spec.columns,
    gutter,
    fontFamily: `"${fonts.bodyFamily}", serif`,
    fontSize: bodySize,
    lineHeight: 1.38,
    // Newsprint ink is never pure black on the page.
    color: mixCss(palette.inkBlack, palette.inkSoft, 0.35, 0.88),
    columnTops,
  });
};
