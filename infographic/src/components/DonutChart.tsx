import React, { useMemo } from "react";
import type { PanelSpec } from "../layout";
import { font } from "../fonts";
import {
  drawTabular,
  makeCanvas,
  rndRange,
  withAlpha,
  type Ctx,
} from "../draw/primitives";
import { drawPanelHeading } from "../draw/chrome";
import { usePanelPainter, usePlane } from "./PlaneContext";

const TAU = Math.PI * 2;
/** Arcs sweep clockwise from 12 o'clock. */
const START = -Math.PI / 2;

const geometry = (w: number, h: number, scale: number) => {
  const top = 70 * scale;
  const cy = top + (h - top) * 0.44;
  const r = Math.min(w * 0.42, (h - top) * 0.4);
  return { cy, cx: w / 2, r, thickness: r * 0.36, top };
};

export const DonutChart: React.FC<{ panel: PanelSpec }> = ({ panel }) => {
  const { variant } = usePlane();
  const scale = variant.contentScale;
  const target = rndRange(`${panel.seed}-target`, 0.24, 0.95);
  const colour =
    rndRange(`${panel.seed}-c`, 0, 1) > 0.5
      ? variant.palette.inkPrimary
      : variant.palette.inkSecondary;

  const staticLayer = useMemo(() => {
    const c = makeCanvas(panel.w, panel.h);
    const ctx = c.getContext("2d") as Ctx;
    drawPanelHeading(ctx, variant, panel.seed, panel.w, scale);

    const g = geometry(panel.w, panel.h, scale);

    // The unfilled portion stays visible: a darker ring on paper, a very dim
    // ring at 20% of the fill colour on the dark ground, where there is no
    // "darker" to go to.
    ctx.lineCap = "butt";
    ctx.lineWidth = g.thickness;
    ctx.strokeStyle = withAlpha(
      variant.chart.donutRemainder === "ghost"
        ? colour
        : variant.chart.donutTrackColor,
      variant.chart.donutTrackAlpha,
    );
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.r, 0, TAU);
    ctx.stroke();

    // Caption strip under the ring.
    ctx.font = font(500, 17 * scale);
    ctx.textAlign = "center";
    ctx.fillStyle = variant.palette.textDim;
    ctx.fillText(
      "share of recorded band",
      g.cx,
      g.cy + g.r + g.thickness * 0.5 + 34 * scale,
      panel.w * 0.9,
    );
    ctx.textAlign = "left";
    return c;
  }, [panel.w, panel.h, panel.seed, variant, scale, colour]);

  usePanelPainter(panel, (ctx, api) => {
    ctx.drawImage(staticLayer, 0, 0);

    const g = geometry(panel.w, panel.h, scale);
    const value = target * api.t;

    if (value > 0.0005) {
      ctx.lineCap = "butt";
      ctx.lineWidth = g.thickness;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, g.r, START, START + TAU * value);
      ctx.stroke();
    }

    // The number climbs with the arc, in the arc's colour, on fixed digit
    // advances so it never jitters.
    const pct = Math.round(value * 100);
    ctx.font = font(700, g.r * 0.62);
    ctx.textBaseline = "middle";
    ctx.fillStyle = colour;
    drawTabular(ctx, `${pct}%`, g.cx, g.cy, "center");
    ctx.textBaseline = "alphabetic";
  });

  return null;
};
