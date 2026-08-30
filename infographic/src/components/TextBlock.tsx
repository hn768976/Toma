import React, { useMemo } from "react";
import type { PanelSpec } from "../layout";
import { font } from "../fonts";
import {
  drawJustified,
  fillerWords,
  makeCanvas,
  type Ctx,
} from "../draw/primitives";
import { drawPanelHeading } from "../draw/chrome";
import { usePanelPainter, usePlane } from "./PlaneContext";

/**
 * Dense paragraphs of small, illegible, entirely invented copy, justified,
 * under a bold heading line. At this size it reads as texture — nothing here
 * reproduces any real report or published text.
 *
 * Wholly static, so it is rasterised once and blitted from then on.
 */
export const TextBlock: React.FC<{ panel: PanelSpec }> = ({ panel }) => {
  const { variant } = usePlane();
  const scale = variant.contentScale;

  const staticLayer = useMemo(() => {
    const c = makeCanvas(panel.w, panel.h);
    const ctx = c.getContext("2d") as Ctx;
    const top = drawPanelHeading(ctx, variant, panel.seed, panel.w, scale);

    const size = 15 * scale;
    const lineHeight = size * 1.62;
    const maxLines = Math.floor((panel.h - top) / lineHeight);
    ctx.font = font(400, size);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = variant.palette.textDark;
    ctx.globalAlpha = variant.chart.textBlockOpacity;
    // Enough copy to fill the block: wide panels take many more words per line.
    const perLine = Math.ceil(panel.w / (size * 2.9));
    drawJustified(
      ctx,
      fillerWords(panel.seed, maxLines * perLine + 80),
      0,
      top + size,
      panel.w,
      lineHeight,
      maxLines,
      5,
    );
    ctx.globalAlpha = 1;
    return c;
  }, [panel.w, panel.h, panel.seed, variant, scale]);

  usePanelPainter(panel, (ctx) => {
    ctx.drawImage(staticLayer, 0, 0);
  });

  return null;
};
