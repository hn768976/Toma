import React, { useMemo } from "react";
import type { PanelSpec } from "../layout";
import { font } from "../fonts";
import { drawTabular, makeCanvas, type Ctx } from "../draw/primitives";
import { usePanelPainter, usePlane } from "./PlaneContext";

export const yearAt = (t: number, start: number, end: number) =>
  start + Math.floor(t * (end - start) + 1e-9);

/**
 * The spine of the piece. The year climbs across the whole duration in visible
 * whole-year steps, and every chart on the sheet reads the same normalised
 * timeline it is drawn from — the sheet is one dataset moving through time,
 * not a collection of independent animations.
 */
export const YearCounter: React.FC<{ panel: PanelSpec }> = ({ panel }) => {
  const { variant } = usePlane();
  const scale = variant.contentScale;

  const staticLayer = useMemo(() => {
    const c = makeCanvas(panel.w, panel.h);
    const ctx = c.getContext("2d") as Ctx;
    ctx.fillStyle = variant.palette.counterFill;
    ctx.fillRect(0, 0, panel.w, panel.h);
    ctx.font = font(500, panel.h * 0.17);
    ctx.fillStyle = variant.palette.counterText;
    ctx.globalAlpha = 0.62;
    ctx.textBaseline = "alphabetic";
    ctx.fillText("reporting year", panel.h * 0.2, panel.h * 0.3);
    ctx.globalAlpha = 1;
    return c;
  }, [panel.w, panel.h, variant, scale]);

  usePanelPainter(panel, (ctx, api) => {
    ctx.drawImage(staticLayer, 0, 0);

    const { start, end } = variant.counter;
    const year = yearAt(api.t, start, end);
    const prev = yearAt(api.tPrev, start, end);

    ctx.font = font(700, panel.h * 0.52);
    ctx.textBaseline = "middle";
    ctx.fillStyle = variant.palette.counterText;
    // A short dip on the frame the year turns over.
    ctx.globalAlpha = year !== prev ? 0.55 : 1;
    drawTabular(
      ctx,
      String(year),
      panel.w - panel.h * 0.2,
      panel.h * 0.62,
      "right",
    );
    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";
  });

  return null;
};
