import React, { useMemo } from "react";
import type { PanelSpec } from "../layout";
import { font } from "../fonts";
import {
  drawTabular,
  fillerWords,
  makeCanvas,
  rndRange,
  withAlpha,
  type Ctx,
} from "../draw/primitives";
import { drawPanelHeading } from "../draw/chrome";
import {
  circleLayout,
  drawLegendStatic,
  drawLegendValues,
  type LegendRow,
} from "../draw/legend";
import { usePanelPainter, usePlane } from "./PlaneContext";

const TAU = Math.PI * 2;
/** Arcs sweep clockwise from 12 o'clock. */
const START = -Math.PI / 2;

export const DonutChart: React.FC<{ panel: PanelSpec }> = ({ panel }) => {
  const { variant } = usePlane();
  const scale = variant.contentScale;
  const top = 70 * scale;
  const target = rndRange(`${panel.seed}-target`, 0.24, 0.95);
  const colour =
    rndRange(`${panel.seed}-c`, 0, 1) > 0.5
      ? variant.palette.inkPrimary
      : variant.palette.inkSecondary;

  const geo = circleLayout(panel.w, panel.h, top, 0.78);
  const thickness = geo.r * 0.36;

  /** Only drawn where the panel is not square enough for the ring alone. */
  const sideRows: LegendRow[] = useMemo(() => {
    const words = fillerWords(`${panel.seed}-leg`, 3);
    return words.map((label, i) => ({
      tone: i === 0 ? colour : variant.palette.inkGrey,
      label,
    }));
  }, [panel.seed, colour, variant.palette.inkGrey]);

  const sideTargets = useMemo(
    () => [0, 1, 2].map((i) => rndRange(`${panel.seed}-sv${i}`, 0.15, 0.9)),
    [panel.seed],
  );

  const staticLayer = useMemo(() => {
    const c = makeCanvas(panel.w, panel.h);
    const ctx = c.getContext("2d") as Ctx;
    drawPanelHeading(ctx, variant, panel.seed, panel.w, scale);

    // The unfilled portion stays visible: a darker ring on paper, a very dim
    // ring at 20% of the fill colour on the dark ground, where there is no
    // "darker" to go to.
    ctx.lineCap = "butt";
    ctx.lineWidth = thickness;
    ctx.strokeStyle = withAlpha(
      variant.chart.donutRemainder === "ghost"
        ? colour
        : variant.chart.donutTrackColor,
      variant.chart.donutTrackAlpha,
    );
    ctx.beginPath();
    ctx.arc(geo.cx, geo.cy, geo.r, 0, TAU);
    ctx.stroke();

    ctx.font = font(500, 17 * scale);
    ctx.textAlign = "center";
    ctx.fillStyle = variant.palette.textDim;
    ctx.fillText(
      "share of recorded band",
      geo.cx,
      geo.cy + geo.r + thickness * 0.5 + 32 * scale,
      geo.r * 2.2,
    );
    ctx.textAlign = "left";

    if (geo.legend) {
      drawLegendStatic(ctx, variant, geo.legend, sideRows, scale);
    }
    return c;
  }, [
    panel.w,
    panel.h,
    panel.seed,
    variant,
    scale,
    colour,
    geo.cx,
    geo.cy,
    geo.r,
    geo.legend,
    thickness,
    sideRows,
  ]);

  usePanelPainter(panel, (ctx, api) => {
    ctx.drawImage(staticLayer, 0, 0);

    const value = target * api.t;
    if (value > 0.0005) {
      ctx.lineCap = "butt";
      ctx.lineWidth = thickness;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.arc(geo.cx, geo.cy, geo.r, START, START + TAU * value);
      ctx.stroke();
    }

    // The number climbs with the arc, in the arc's colour, on fixed digit
    // advances so it never jitters.
    ctx.font = font(700, geo.r * 0.62);
    ctx.textBaseline = "middle";
    ctx.fillStyle = colour;
    drawTabular(ctx, `${Math.round(value * 100)}%`, geo.cx, geo.cy, "center");
    ctx.textBaseline = "alphabetic";

    if (geo.legend) {
      drawLegendValues(
        ctx,
        variant,
        geo.legend,
        sideTargets.map((v) => v * api.t),
        scale,
      );
    }
  });

  return null;
};
